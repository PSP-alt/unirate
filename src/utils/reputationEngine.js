/* ═══════════════════════════════════════════════════
   Reputation Engine — защита репутации преподавателей

   Взвешенный рейтинг, обнаружение спама/манипуляций,
   распределение по дисциплинам, временной decay,
   минимальный порог для валидного рейтинга.
   ═══════════════════════════════════════════════════ */

/* ── Минимальное количество оценок для «достоверного» рейтинга ── */
export const MIN_RATINGS_THRESHOLD = 5

/* ── Весовые коэффициенты ── */
const RECENCY_HALF_LIFE_DAYS = 180  // через 6 месяцев вес = 0.5
const SHORT_COMMENT_WEIGHT = 0.5    // короткие отзывы (<30 символов) весят меньше
const LONG_COMMENT_BONUS = 1.2      // развёрнутые отзывы (>150 символов) весят больше
const LOW_ATTENDANCE_WEIGHT = 0.6   // студенты с посещаемостью <50% весят меньше

/* ── Recency decay: экспоненциальное затухание ── */
function recencyWeight(createdAt) {
  if (!createdAt) return 0.5
  const ts = createdAt.toDate ? createdAt.toDate() : new Date(createdAt)
  const daysSince = (Date.now() - ts.getTime()) / 86400000
  return Math.pow(0.5, daysSince / RECENCY_HALF_LIFE_DAYS)
}

/* ── Вес по качеству отзыва (суммарная длина комментариев) ── */
function commentQualityWeight(r) {
  // Поддерживаем как новый формат (positiveComment+negativeComment), так и старый (comment)
  const combined = [r.positiveComment, r.negativeComment, r.comment]
    .filter(Boolean).join(' ')
  if (!combined || combined.length < 10) return SHORT_COMMENT_WEIGHT
  if (combined.length >= 150) return LONG_COMMENT_BONUS
  return 1.0
}

/* ── Вес по посещаемости (6 уровней) ── */
function attendanceWeight(level) {
  const weights = {
    very_high: 1.0,
    high:      1.0,
    medium:    0.85,
    low:       LOW_ATTENDANCE_WEIGHT,  // 0.6
    very_low:  0.5,
    none:      0.3,
  }
  return weights[level] ?? 1.0
}

/* ══ Взвешенный рейтинг ══
   Учитывает: свежесть, качество отзыва, посещаемость */
export function computeWeightedRating(ratings) {
  if (!ratings.length) return { weighted: 0, raw: 0, totalWeight: 0 }

  let weightedSum = 0
  let totalWeight = 0
  let rawSum = 0

  ratings.forEach(r => {
    const score = r.averageScore || 0
    const w =
      recencyWeight(r.createdAt) *
      commentQualityWeight(r) *
      attendanceWeight(r.attendanceLevel)

    weightedSum += score * w
    totalWeight += w
    rawSum += score
  })

  return {
    weighted: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0,
    raw: Math.round((rawSum / ratings.length) * 10) / 10,
    totalWeight,
  }
}

/* ══ Рейтинг за последний год ══ */
export function computeRecentRating(ratings) {
  const oneYearAgo = Date.now() - 365 * 86400000
  const recent = ratings.filter(r => {
    const ts = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0)
    return ts.getTime() > oneYearAgo
  })
  if (!recent.length) return null
  const avg = recent.reduce((s, r) => s + (r.averageScore || 0), 0) / recent.length
  return { avg: Math.round(avg * 10) / 10, count: recent.length }
}

/* ══ Рейтинг по дисциплинам ══ */
export function computeDisciplineBreakdown(ratings) {
  const map = {}
  ratings.forEach(r => {
    const disc = r.discipline || 'Без дисциплины'
    if (!map[disc]) map[disc] = { sum: 0, count: 0 }
    map[disc].sum += r.averageScore || 0
    map[disc].count++
  })
  return Object.entries(map)
    .map(([name, { sum, count }]) => ({
      name,
      avg: Math.round((sum / count) * 10) / 10,
      count,
    }))
    .sort((a, b) => b.count - a.count)
}

/* ══ Обнаружение спама / манипуляций ══ */
export function detectManipulation(ratings) {
  const alerts = []

  // 1. Burst detection: > 3 оценок за 24 часа
  const now = Date.now()
  const last24h = ratings.filter(r => {
    const ts = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0)
    return now - ts.getTime() < 86400000
  })
  if (last24h.length > 3) {
    alerts.push({
      type: 'burst',
      severity: 'high',
      message: `${last24h.length} оценок за последние 24 часа — возможная координированная атака`,
    })
  }

  // 2. Однотипные низкие оценки (> 3 подряд с score <= 3)
  const sorted = [...ratings].sort((a, b) => {
    const ta = a.createdAt?.seconds ?? 0
    const tb = b.createdAt?.seconds ?? 0
    return tb - ta
  })
  let consecutiveLow = 0
  for (const r of sorted) {
    if ((r.averageScore || 0) <= 3) consecutiveLow++
    else break
  }
  if (consecutiveLow >= 3) {
    alerts.push({
      type: 'consecutive_low',
      severity: 'medium',
      message: `${consecutiveLow} подряд низких оценок — может требоваться проверка`,
    })
  }

  // 3. Подозрительно короткие комментарии в низких оценках
  const shortLow = ratings.filter(r => {
    const combined = [r.positiveComment, r.negativeComment, r.comment]
      .filter(Boolean).join(' ')
    return (r.averageScore || 0) <= 3 && combined.length < 15
  })
  if (shortLow.length >= 3) {
    alerts.push({
      type: 'low_quality_negative',
      severity: 'low',
      message: `${shortLow.length} низких оценок без аргументации`,
    })
  }

  return alerts
}

/* ══ Рейтинг достоверности ══
   Показывает, насколько можно доверять текущему рейтингу */
export function confidenceLevel(ratingsCount) {
  if (ratingsCount >= 20) return { label: 'Высокая достоверность', level: 'high', pct: 100 }
  if (ratingsCount >= MIN_RATINGS_THRESHOLD) return { label: 'Достаточно данных', level: 'medium', pct: 70 }
  if (ratingsCount >= 2) return { label: 'Мало данных', level: 'low', pct: 40 }
  return { label: 'Недостаточно данных', level: 'none', pct: 10 }
}

/* ══ Динамика рейтинга по семестрам ══ */
export function computeSemesterBreakdown(ratings) {
  const map = {}
  ratings.forEach(r => {
    if (!r.semester) return
    if (!map[r.semester]) map[r.semester] = { sum: 0, count: 0 }
    map[r.semester].sum += r.averageScore || 0
    map[r.semester].count++
  })
  // Хроно-сортировка: «Весна 2024» → «Осень 2024» → «Весна 2025» …
  const parseOrd = s => {
    const [term, yr] = (s || '').split(' ')
    return (parseInt(yr) || 0) * 2 + (term === 'Весна' ? 1 : 0)
  }
  return Object.entries(map)
    .map(([semester, { sum, count }]) => ({
      semester,
      avg: Math.round((sum / count) * 10) / 10,
      count,
    }))
    .sort((a, b) => parseOrd(a.semester) - parseOrd(b.semester))
}

/* ══ NPS — готовность рекомендовать преподавателя ══ */
export function computeNPS(ratings) {
  const npsRatings = ratings.filter(r => r.nps != null)
  if (npsRatings.length < 3) return null

  const promoters  = npsRatings.filter(r => r.nps === 'yes').length
  const neutral    = npsRatings.filter(r => r.nps === 'maybe').length
  const detractors = npsRatings.filter(r => r.nps === 'no').length
  const total      = npsRatings.length

  const pctPromoters  = Math.round((promoters  / total) * 100)
  const pctNeutral    = Math.round((neutral    / total) * 100)
  const pctDetractors = 100 - pctPromoters - pctNeutral

  return {
    total,
    promoters,
    neutral,
    detractors,
    pctPromoters,
    pctNeutral,
    pctDetractors,
    // NPS score: promoters% − detractors% (−100…+100)
    score: pctPromoters - pctDetractors,
  }
}

/* ══ Проверки перед отправкой отзыва ══ */
export const REVIEW_RULES = {
  minCommentLength: 20,
  maxCommentLength: 1000,
  minCommentForLowScore: 50, // при оценке <= 3 нужен развёрнутый комментарий
}

export function validateReview({ averageScore, positiveComment = '', negativeComment = '', comment = '' }) {
  const errors = []

  // Суммарная длина всех текстовых полей
  const combined = [positiveComment.trim(), negativeComment.trim(), comment.trim()]
    .filter(Boolean).join(' ')

  if (averageScore <= 3 && combined.length < REVIEW_RULES.minCommentForLowScore) {
    errors.push(`При низкой оценке необходим развёрнутый комментарий (минимум ${REVIEW_RULES.minCommentForLowScore} символов суммарно)`)
  }

  if (combined.length > 0 && combined.length < REVIEW_RULES.minCommentLength) {
    errors.push(`Минимальная длина комментария — ${REVIEW_RULES.minCommentLength} символов`)
  }

  return errors
}
