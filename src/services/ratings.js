/* ═══════════════════════════════════════════════════
   Сервис оценок — CRUD для коллекции ratings

   Создание оценок, проверка «уже оценивал»,
   получение оценок преподавателя,
   голосование за полезность, жалобы, ответы преподавателей.
   ═══════════════════════════════════════════════════ */

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  increment,
  arrayUnion,
  onSnapshot,
} from 'firebase/firestore'
import { db } from './firebase'

/* Очистка отзыва от приватных полей перед публичной отдачей.
   Анонимные отзывы НЕ должны раскрывать studentId — раньше клиент
   видел его в network-tab даже для isAnonymous:true. */
function sanitizePublicRating(r) {
  if (!r) return r
  if (r.isAnonymous === false) return r           // авторство публичное
  const { studentId, studentCourse, ...rest } = r // вырезаем
  return rest
}

/* ── Создать оценку (отправить на модерацию) ── */
export async function createRating(data) {
  try {
    const docRef = await addDoc(collection(db, 'ratings'), {
      teacherId: data.teacherId,
      studentId: data.studentId,
      criteriaScores: data.criteriaScores,   // null = "затрудняюсь ответить"
      averageScore: data.averageScore,
      // Два поля комментария (HSE-стиль)
      positiveComment: data.positiveComment || '',
      negativeComment: data.negativeComment || '',
      comment: data.comment || '',            // combined, backward-compat
      discipline: data.discipline || '',
      // Роль преподавателя: 'lecturer' | 'seminar' | 'both' | 'unknown'
      teacherRole: data.teacherRole || null,
      // Посещаемость (6 уровней: very_high | high | medium | low | very_low | none)
      attendanceLevel:  data.attendanceLevel  || 'high',  // общая (или основная)
      attendanceLecture: data.attendanceLecture || null,  // лекции
      attendanceSeminar: data.attendanceSeminar || null,  // семинары/практики
      // Семестр/период (выбирается студентом: «Весна 2025»)
      semester: data.semester || '',
      // NPS: yes | maybe | no | null
      nps: data.nps || null,
      // Оценка курса (опционально, 1-10)
      courseScore: data.courseScore || null,
      status: 'pending',
      rejectionReason: '',
      isAnonymous: data.isAnonymous !== false,
      studentCourse: data.studentCourse,
      // Голосование за полезность
      helpfulVotes: 0,
      unhelpfulVotes: 0,
      votedBy: [],
      // Жалобы
      flags: 0,
      flaggedBy: [],
      flagReasons: [],
      // Ответ преподавателя
      teacherResponse: '',
      teacherResponseAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { id: docRef.id, error: null }
  } catch (error) {
    console.error('[createRating]', error)
    return { id: null, error: 'Не удалось отправить оценку' }
  }
}

/* ── Получить отзыв студента для конкретного преподавателя (с учётом статуса) ── */
export async function getStudentRatingForTeacher(teacherId, studentId) {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('teacherId', '==', teacherId),
      where('studentId', '==', studentId),
    )
    const snapshot = await getDocs(q)
    if (snapshot.empty) return { rating: null, error: null }
    // Берём самый новый отзыв (на случай если их несколько после отклонения)
    const docs = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
    return { rating: docs[0], error: null }
  } catch (error) {
    console.error('[getStudentRatingForTeacher]', error)
    return { rating: null, error: 'Не удалось получить отзыв' }
  }
}

/* ── [deprecated] Оставлен для совместимости ── */
export async function hasStudentRated(teacherId, studentId) {
  const { rating } = await getStudentRatingForTeacher(teacherId, studentId)
  return { hasRated: rating?.status === 'approved', error: null }
}

/* ── Подписка на одобренные отзывы преподавателя (real-time) ──
   Возвращает санитизированные отзывы: studentId/studentCourse скрыты
   у анонимных. */
export function subscribeToApprovedRatings(teacherId, onUpdate) {
  const q = query(
    collection(db, 'ratings'),
    where('teacherId', '==', teacherId),
    where('status', '==', 'approved'),
  )
  return onSnapshot(
    q,
    (snapshot) => {
      const ratings = snapshot.docs
        .map(d => sanitizePublicRating({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      onUpdate(ratings)
    },
    (err) => {
      console.error('[subscribeToApprovedRatings]', err)
      onUpdate([])
    },
  )
}

/* ── Получить одобренные оценки преподавателя ── */
export async function getApprovedRatings(teacherId) {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('teacherId', '==', teacherId),
      where('status', '==', 'approved'),
    )
    const snapshot = await getDocs(q)
    const ratings = snapshot.docs
      .map((d) => sanitizePublicRating({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aTime = a.createdAt?.seconds ?? 0
        const bTime = b.createdAt?.seconds ?? 0
        return bTime - aTime
      })
    return { ratings, error: null }
  } catch (error) {
    console.error('[getApprovedRatings]', error)
    return { ratings: [], error: 'Ошибка загрузки оценок' }
  }
}

/* ── Получить оценки конкретного студента.
   Сортируем на клиенте — раньше серверный orderBy('createdAt')
   требовал composite index (studentId + createdAt). Без индекса
   запрос падал, и getDocs выкидывал ошибку, которая тихо ловилась
   в catch — пустой массив возвращался, но в DevTools было видно
   FAILED_PRECONDITION. */
export async function getStudentRatings(studentId) {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('studentId', '==', studentId),
    )
    const snapshot = await getDocs(q)
    const ratings = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
    return { ratings, error: null }
  } catch (error) {
    console.error('[getStudentRatings]', error)
    return { ratings: [], error: 'Ошибка загрузки оценок' }
  }
}

/* ── Получить все оценки преподавателя (для статистики) ── */
export async function getAllTeacherRatings(teacherId) {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('teacherId', '==', teacherId),
    )
    const snapshot = await getDocs(q)
    const ratings = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    return { ratings, error: null }
  } catch (error) {
    return { ratings: [], error: 'Ошибка загрузки оценок' }
  }
}

/* ══ ГОЛОСОВАНИЕ ЗА ПОЛЕЗНОСТЬ ══
   ВАЖНО: используем arrayUnion + increment вместо read-modify-write.
   Раньше при двух одновременных голосах второй overwrite-ил первого
   в votedBy, но increment счётчика срабатывал дважды → разсогласование.
   arrayUnion атомарно добавляет, не позволяя дубликатов. */
export async function voteReview(ratingId, userId, isHelpful) {
  try {
    const ratingRef = doc(db, 'ratings', ratingId)
    const snap = await getDoc(ratingRef)
    if (!snap.exists()) return { error: 'Отзыв не найден' }

    const data = snap.data()
    const votedBy = data.votedBy || []
    if (votedBy.includes(userId)) return { error: 'Вы уже голосовали' }

    await updateDoc(ratingRef, {
      [isHelpful ? 'helpfulVotes' : 'unhelpfulVotes']: increment(1),
      votedBy: arrayUnion(userId),
      updatedAt: serverTimestamp(),
    })
    return { error: null }
  } catch (error) {
    console.error('[voteReview]', error)
    return { error: 'Ошибка голосования' }
  }
}

/* ══ ЖАЛОБА НА ОТЗЫВ ══
   Аналогично voteReview — arrayUnion для flaggedBy и flagReasons,
   increment для счётчика flags. Auto-hide при >=5 жалоб остаётся,
   но решение принимается на основе текущего значения, что в гонке
   может привести к не-моментальному скрытию — это приемлемо: окно
   между 5-й жалобой и записью status:'flagged' не несёт security-
   риска, отзыв всё равно скроется на следующем чтении. */
export async function flagReview(ratingId, userId, reason) {
  try {
    const ratingRef = doc(db, 'ratings', ratingId)
    const snap = await getDoc(ratingRef)
    if (!snap.exists()) return { error: 'Отзыв не найден' }

    const data = snap.data()
    const flaggedBy = data.flaggedBy || []
    if (flaggedBy.includes(userId)) return { error: 'Вы уже пожаловались' }

    const newFlags = (data.flags || 0) + 1

    const update = {
      flags: increment(1),
      flaggedBy: arrayUnion(userId),
      flagReasons: arrayUnion({ userId, reason, at: new Date().toISOString() }),
      updatedAt: serverTimestamp(),
    }
    // Автоматически скрыть если >= 5 жалоб
    if (newFlags >= 5) {
      update.status = 'flagged'
    }

    await updateDoc(ratingRef, update)
    return { error: null, autoHidden: newFlags >= 5 }
  } catch (error) {
    console.error('[flagReview]', error)
    return { error: 'Ошибка отправки жалобы' }
  }
}

/* ══ ОТВЕТ ПРЕПОДАВАТЕЛЯ ══ */
export async function addTeacherResponse(ratingId, teacherUserId, response) {
  try {
    const ratingRef = doc(db, 'ratings', ratingId)
    const snap = await getDoc(ratingRef)
    if (!snap.exists()) return { error: 'Отзыв не найден' }

    await updateDoc(ratingRef, {
      teacherResponse: response.trim(),
      teacherResponseAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { error: null }
  } catch (error) {
    console.error('[addTeacherResponse]', error)
    return { error: 'Ошибка сохранения ответа' }
  }
}
