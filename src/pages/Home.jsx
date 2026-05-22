import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTeachers } from '../services/teachers'
import { getApprovedRatings } from '../services/ratings'
import { getCriteriaForTeacher } from '../utils/ratingCriteria'
import { collection, getCountFromServer, query, where } from 'firebase/firestore'
import { db } from '../services/firebase'
import { ArrowRight, Mail, MessageSquareText, ShieldCheck, Sparkles, Award, Trophy } from 'lucide-react'

/* Минимум одобренных отзывов, чтобы преподаватель попал в номинацию «месяца» */
const FEATURED_MIN_REVIEWS = 3
/* Сколько критериев показываем на карточке */
const FEATURED_TOP_CRITERIA = 4

/* ════════════════════════════════════════════════════════════
   UNIRATE — Честный разговор о преподавании
   Лендинг: тёмная шапка, серифный курсив для акцентов,
   карточка «преподаватель недели», статистика, 4-шага.
════════════════════════════════════════════════════════════ */

const STEPS = [
  { n: '01', title: 'Вход по почте',      desc: 'Только студенческая почта университета. Никаких соцсетей и утечек.', Icon: Mail },
  { n: '02', title: 'Отзыв с критериями', desc: 'Пять критериев вместо одной звезды. Плюсы и минусы — отдельно.',    Icon: MessageSquareText },
  { n: '03', title: 'Модерация 24 ч',     desc: 'Каждый отзыв проходит ручную проверку. Без личных выпадов.',          Icon: ShieldCheck },
  { n: '04', title: 'Диалог и материалы', desc: 'Преподаватель отвечает, делится конспектами. Разговор идёт дальше.',  Icon: Sparkles },
]

export default function Home() {
  const { user, userData } = useAuth()
  const navigate = useNavigate()

  /* null = ещё грузится, число = реальное значение, undefined = ошибка/недоступно */
  const [stats, setStats] = useState({ students: null, teachers: null, ratings: null, avg: null })
  /* status: 'loading' | 'empty' | 'ready' */
  const [featured, setFeatured] = useState({ status: 'loading', data: null })

  useEffect(() => {
    let cancelled = false

    /* Считаем агрегаты по реальным фильтрам:
       — students = users where role == 'student' (а не все users)
       — teachers = вся коллекция teachers (профили публичные)
       — ratings  = ratings where status == 'approved' (только публикуемые) */
    async function loadCount(q, key) {
      try {
        const snap = await getCountFromServer(q)
        if (cancelled) return
        setStats(s => ({ ...s, [key]: snap.data().count }))
      } catch (e) {
        /* Незалогиненный пользователь не может читать users — это нормально.
           Покажем прочерк вместо числа. */
        console.warn(`[stats:${key}]`, e?.code || e?.message)
        if (!cancelled) setStats(s => ({ ...s, [key]: undefined }))
      }
    }

    /* Публичный счётчик (meta/counters) — доступен без авторизации.
       Если его нет — фоллбек на прямой запрос users (требует auth). */
    ;(async () => {
      try {
        const { getDoc, doc: firestoreDoc } = await import('firebase/firestore')
        const snap = await getDoc(firestoreDoc(db, 'meta', 'counters'))
        if (!cancelled && snap.exists()) {
          const d = snap.data()
          if (d.students != null) setStats(s => ({ ...s, students: d.students }))
          if (d.ratings  != null) setStats(s => ({ ...s, ratings:  d.ratings }))
        } else {
          /* Фоллбек — прямые запросы (нужна авторизация) */
          loadCount(query(collection(db, 'users'), where('role', '==', 'student')), 'students')
          loadCount(query(collection(db, 'ratings'), where('status', '==', 'approved')), 'ratings')
        }
      } catch {
        loadCount(query(collection(db, 'users'), where('role', '==', 'student')), 'students')
        loadCount(query(collection(db, 'ratings'), where('status', '==', 'approved')), 'ratings')
      }
    })()
    loadCount(collection(db, 'teachers'), 'teachers')

    return () => { cancelled = true }
  }, [])

  /* ── Преподаватель месяца: реальные данные из Firestore ── */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { teachers: list } = await getTeachers()
        if (cancelled) return

        /* Обновляем счётчик преподавателей точным значением
           (getTeachers уже фильтрует isDeleted) */
        setStats(s => ({ ...s, teachers: list.length }))

        if (!list?.length) {
          setFeatured({ status: 'empty', data: null })
          return
        }

        /* Средний балл по платформе — для статистики.
           Если нет ни одного преподавателя с реальной оценкой — ставим
           undefined (в UI покажется прочерк, не нулевая «8,3» из мока). */
        const rated = list.filter(x => (x.averageRating || 0) > 0)
        if (rated.length) {
          const avg = rated.reduce((s, x) => s + (x.averageRating || 0), 0) / rated.length
          setStats(s => ({ ...s, avg: Math.round(avg * 10) / 10 }))
        } else {
          setStats(s => ({ ...s, avg: undefined }))
        }

        /* Кандидаты — открыты к оценкам и набрали минимум отзывов */
        const candidates = list
          .filter(x => x.ratingsEnabled && (x.ratingsCount || 0) >= FEATURED_MIN_REVIEWS)
          .sort((a, b) =>
            (b.averageRating || 0) - (a.averageRating || 0) ||
            (b.ratingsCount  || 0) - (a.ratingsCount  || 0)
          )

        if (!candidates.length) {
          setFeatured({ status: 'empty', data: null })
          return
        }

        /* Перебираем кандидатов по убыванию рейтинга. Если у топового
           getApprovedRatings вернул пусто (например, ratingsCount
           рассинхронизировался с реальной базой), берём следующего. */
        let chosen = null
        let chosenRatings = []
        for (const cand of candidates) {
          const { ratings } = await getApprovedRatings(cand.id)
          if (cancelled) return
          if (ratings && ratings.length) {
            chosen = cand
            chosenRatings = ratings
            break
          }
        }
        if (!chosen) {
          setFeatured({ status: 'empty', data: null })
          return
        }

        const top = chosen
        const ratings = chosenRatings

        /* — Лучший отзыв для цитаты: самая высокая оценка + непустой положительный комментарий — */
        const withQuote = ratings.filter(r => {
          const text = (r.positiveComment || r.comment || '').trim()
          return text.length >= 30 && (r.averageScore || 0) >= 8
        })
        const sortedQuotes = withQuote.sort((a, b) =>
          (b.averageScore || 0) - (a.averageScore || 0) ||
          (b.helpfulVotes || 0) - (a.helpfulVotes || 0) ||
          (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
        )
        const quote = sortedQuotes[0]
          ? {
              text:        (sortedQuotes[0].positiveComment || sortedQuotes[0].comment || '').trim(),
              score:       sortedQuotes[0].averageScore || 0,
              isAnonymous: sortedQuotes[0].isAnonymous !== false,
              discipline:  sortedQuotes[0].discipline || '',
              semester:    sortedQuotes[0].semester || '',
            }
          : null

        /* — Реальные средние по критериям всех типов преподавателя — */
        const criteriaList = getCriteriaForTeacher(top)
        const criteriaAvgs = criteriaList
          .map(crit => {
            const values = ratings
              .map(r => r.criteriaScores?.[crit.key])
              .filter(v => typeof v === 'number' && !isNaN(v))
            if (!values.length) return null
            const avg = values.reduce((s, v) => s + v, 0) / values.length
            return {
              key:   crit.key,
              label: crit.label,
              score: Math.round(avg * 10) / 10,
              count: values.length,
            }
          })
          .filter(Boolean)
          .sort((a, b) => b.score - a.score)
          .slice(0, FEATURED_TOP_CRITERIA)

        setFeatured({
          status: 'ready',
          data: {
            teacher:  top,
            quote,
            criteria: criteriaAvgs,
          },
        })
      } catch (e) {
        console.error('[featured-teacher]', e)
        if (!cancelled) setFeatured({ status: 'empty', data: null })
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-[var(--color-cream)] text-[var(--color-ink)]">

      {/* ═════════════════════════════════════════════
         HERO — на тёмном фоне
         ═════════════════════════════════════════════ */}
      <section className="relative bg-[#1A1613] text-[var(--color-ink)] overflow-hidden">
        {/* Мягкое свечение справа */}
        <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-[var(--color-rust)]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[20rem] h-[20rem] rounded-full bg-[var(--color-rust)]/5 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 md:px-12 pt-32 pb-24 grid lg:grid-cols-[1.15fr_1fr] gap-14 items-start">

          {/* Левая колонка — текст */}
          <div className="animate-fade-up">
            <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--color-rust-soft)] mb-10">
              <span>Анонимно</span><span className="opacity-40">·</span>
              <span>По делу</span><span className="opacity-40">·</span>
              <span>С модерацией</span>
            </div>

            <h1 className="font-display text-[40px] sm:text-[52px] md:text-[76px] leading-[1.05] tracking-[-0.025em] text-[#F4EBDB]">
              {user ? (
                <>
                  <span className="block whitespace-nowrap">С возвращением,</span>
                  <span className="block italic text-[var(--color-rust)]">{userData?.firstName || 'друг'}.</span>
                </>
              ) : (
                <>
                  <span className="block whitespace-nowrap">Честный разговор</span>
                  <span className="block">о <span className="italic text-[var(--color-rust)]">преподавании.</span></span>
                </>
              )}
            </h1>

            <p className="mt-10 max-w-md text-[15px] leading-relaxed text-[#B8A999]">
              <span className="font-display italic text-[#F4EBDB]">Unirate</span> — это закрытая платформа,
              где студенты оставляют подписанные псевдонимом отзывы,
              а преподаватели делятся материалами. Всё проходит через
              модерацию — без анонимных выпадов, но и без страха говорить.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              {user ? (
                <>
                  <button
                    onClick={() => navigate(userData?.role === 'teacher' ? `/teachers/${user.uid}` : '/teachers')}
                    className="group inline-flex items-center gap-3 px-6 py-3.5 rounded-full bg-[var(--color-rust)] text-[#FFFDF7] text-sm font-semibold hover:bg-[#C55830] transition-colors"
                  >
                    {userData?.role === 'teacher' ? 'Мой профиль' : 'К преподавателям'}
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                  <Link
                    to="/materials"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-[#3A322A] text-[#E6D9C9] text-sm font-medium hover:border-[var(--color-rust-soft)] hover:text-[#F4EBDB] transition-colors"
                  >
                    Материалы
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/register?role=student"
                    className="group inline-flex items-center gap-3 px-6 py-3.5 rounded-full bg-[var(--color-rust)] text-[#FFFDF7] text-sm font-semibold hover:bg-[#C55830] transition-colors"
                  >
                    Войти как студент
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                  <Link
                    to="/register?role=teacher"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-[#3A322A] text-[#E6D9C9] text-sm font-medium hover:border-[var(--color-rust-soft)] hover:text-[#F4EBDB] transition-colors"
                  >
                    Я преподаватель
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Правая колонка — карточка преподавателя месяца (real-data) */}
          <FeaturedCard featured={featured} />
        </div>

        {/* Разделитель + статистика */}
        <div className="relative max-w-7xl mx-auto px-6 md:px-12 pb-20">
          <div className="flex items-center gap-4 opacity-40 mb-10 pt-4">
            <div className="h-px flex-1 bg-[#3A322A]" />
            <span className="font-display italic text-[#B8A999] text-sm">∼</span>
            <div className="h-px flex-1 bg-[#3A322A]" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 max-w-3xl">
            <Stat value={stats.students} label="студентов"      format={formatNum} />
            <Stat value={stats.teachers} label="преподавателей" format={formatNum} />
            <Stat value={stats.ratings}  label="отзывов"        format={formatNum} />
            <Stat value={stats.avg}      label="средний балл"   format={formatRating} accent />
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════
         HOW IT WORKS — на кремовом фоне
         ═════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-24">
        <div className="flex flex-wrap items-end justify-between gap-8 mb-14">
          <div className="max-w-2xl">
            <div className="label-eyebrow mb-4">Как это работает</div>
            <h2 className="font-display text-[28px] sm:text-[36px] md:text-[52px] leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)]">
              Четыре шага от вопроса{' '}
              <span className="italic text-[var(--color-rust)]">«как у меня на курсе?»</span> до ответа.
            </h2>
          </div>
          <span className="font-mono text-xs text-[var(--color-muted)] tracking-widest">01 — 04</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((step, i) => (
            <StepCard key={step.n} step={step} delay={i * 80} />
          ))}
        </div>
      </section>

      {/* ═════════════════════════════════════════════
         ДВЕ СТОРОНЫ ДИАЛОГА
         ═════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 pb-24">
        <div className="grid md:grid-cols-2 gap-5">
          <AudienceCard
            role="Студентам"
            title={<>Говорите прямо —<br /><span className="italic text-[var(--color-rust)]">без страха</span>.</>}
            bullets={[
              'Подписанный отзыв под псевдонимом',
              'Пять критериев: ясность, справедливость, вовлечённость, подготовка, обратная связь',
              'Плюсы и минусы отдельно — без «всё плохо»',
            ]}
            cta={{ to: '/register?role=student', label: 'Создать аккаунт студента' }}
          />
          <AudienceCard
            role="Преподавателям"
            title={<>Услышьте, что <span className="italic text-[var(--color-rust)]">работает</span>.</>}
            bullets={[
              'Отвечайте на отзывы публично — развёрнуто',
              'Делитесь конспектами и видео с курсом',
              'Никаких рейтинговых войн — только разговор',
            ]}
            cta={{ to: '/register?role=teacher', label: 'Подать заявку' }}
            secondary
          />
        </div>
      </section>

      {/* ═════════════════════════════════════════════
         CTA
         ═════════════════════════════════════════════ */}
      {!user && (
        <section className="max-w-7xl mx-auto px-6 md:px-12 pb-24">
          <div className="rounded-[24px] sm:rounded-[32px] bg-[#1A1613] text-[#F4EBDB] p-6 sm:p-10 md:p-16 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[var(--color-rust)]/20 blur-3xl" />
            <div className="relative grid md:grid-cols-[1.5fr_1fr] gap-8 items-end">
              <div>
                <div className="label-eyebrow mb-4" style={{ color: 'var(--color-rust-soft)' }}>Готовы говорить по делу?</div>
                <h3 className="font-display text-[28px] sm:text-[36px] md:text-[56px] leading-[1.02] tracking-[-0.02em]">
                  Вход занимает минуту.{' '}
                  <span className="italic text-[var(--color-rust)]">Разговор — всю сессию.</span>
                </h3>
              </div>
              <div className="flex flex-col sm:flex-row md:flex-col gap-3">
                <Link
                  to="/register"
                  className="group inline-flex items-center justify-center gap-3 px-6 py-4 rounded-full bg-[var(--color-rust)] text-[#FFFDF7] text-sm font-semibold hover:bg-[#C55830] transition-colors"
                >
                  Зарегистрироваться
                  <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-full border border-[#3A322A] text-[#E6D9C9] text-sm font-medium hover:border-[var(--color-rust-soft)] hover:text-[#F4EBDB] transition-colors"
                >
                  У меня уже есть аккаунт
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────
   КАРТОЧКА: ПРЕПОДАВАТЕЛЬ МЕСЯЦА (real-data)
   ──────────────────────────────────────────────── */
function FeaturedCard({ featured }) {
  /* — Состояние: загрузка — */
  if (featured.status === 'loading') {
    return (
      <div className="relative rounded-[28px] bg-[#24201C] border border-[#3A322A] p-7 md:p-8 animate-fade-up" style={{ animationDelay: '120ms' }}>
        <div className="flex items-center justify-between mb-8">
          <span className="label-eyebrow" style={{ color: 'var(--color-rust-soft)' }}>Преподаватель месяца</span>
          <span className="text-[10px] tracking-[0.18em] uppercase text-[#8B827A]">обновляется…</span>
        </div>
        <div className="flex items-center gap-4 mb-7">
          <div className="w-12 h-12 rounded-full bg-[#3A322A] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-3/4 bg-[#3A322A] rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-[#3A322A]/70 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-2 mb-7">
          <div className="h-4 w-full bg-[#3A322A]/70 rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-[#3A322A]/70 rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-[#3A322A]/70 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_2.5rem] items-center gap-3">
              <div className="h-3 bg-[#3A322A]/70 rounded animate-pulse" />
              <div className="h-3 w-[148px] bg-[#3A322A]/40 rounded animate-pulse" />
              <div className="h-3 w-8 bg-[#3A322A]/70 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* — Состояние: нет данных — */
  if (featured.status === 'empty' || !featured.data) {
    return (
      <div className="relative rounded-[28px] bg-[#24201C] border border-[#3A322A] p-8 md:p-10 animate-fade-up flex flex-col items-center text-center" style={{ animationDelay: '120ms' }}>
        <div className="w-14 h-14 rounded-full bg-[#3A322A] flex items-center justify-center mb-5">
          <Award size={26} className="text-[var(--color-rust-soft)]" strokeWidth={1.5} />
        </div>
        <span className="label-eyebrow mb-3" style={{ color: 'var(--color-rust-soft)' }}>
          Преподаватель месяца
        </span>
        <h3 className="font-display italic text-[26px] leading-tight text-[#F4EBDB] mb-3 max-w-xs">
          Скоро здесь появится первый номинант.
        </h3>
        <p className="text-[13px] leading-relaxed text-[#B8A999] max-w-sm mb-7">
          Преподаватель попадает в номинацию, когда у него на платформе наберётся минимум{' '}
          <span className="text-[#F4EBDB] font-semibold">{FEATURED_MIN_REVIEWS} одобренных отзыва</span>.
        </p>
        <Link
          to="/teachers"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#3A322A] text-[#E6D9C9] text-[13px] font-semibold hover:border-[var(--color-rust-soft)] hover:text-[#F4EBDB] transition-colors"
        >
          Все преподаватели
          <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  /* — Состояние: реальные данные — */
  const { teacher, quote, criteria } = featured.data
  const fullName = [teacher.firstName, teacher.middleName, teacher.lastName].filter(Boolean).join(' ')
                || `${teacher.lastName || ''} ${teacher.firstName || ''}`.trim()
                || 'Преподаватель'
  const initials = [teacher.firstName?.[0], teacher.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const rating   = Math.round((teacher.averageRating || 0) * 10) / 10
  const subtitle = teacher.disciplines?.[0] || teacher.department || teacher.position || 'Преподаватель'

  return (
    <Link
      to={`/teachers/${teacher.id}`}
      className="group relative block rounded-[28px] bg-[#24201C] border border-[#3A322A] p-7 md:p-8 animate-fade-up hover:border-[var(--color-rust-soft)] transition-colors"
      style={{ animationDelay: '120ms' }}
    >
      {/* Top row: eyebrow + score pill */}
      <div className="flex items-center justify-between mb-8">
        <span className="label-eyebrow inline-flex items-center gap-1.5" style={{ color: 'var(--color-rust-soft)' }}>
          <Trophy size={11} />
          Преподаватель месяца
        </span>
        <span className="label-eyebrow" style={{ color: 'var(--color-rust)' }}>
          рейтинг {rating.toString().replace('.', ',')}
        </span>
      </div>

      {/* Avatar + name */}
      <div className="flex items-center gap-4 mb-7">
        <div className="w-12 h-12 rounded-full bg-[#3A322A] flex items-center justify-center text-[#F4EBDB] font-display text-sm tracking-wide overflow-hidden flex-shrink-0">
          {teacher.avatarUrl
            ? <img src={teacher.avatarUrl} alt="" className="w-full h-full object-cover" />
            : initials}
        </div>
        <div className="min-w-0">
          <h3 className="font-display italic text-[22px] leading-tight text-[#F4EBDB] truncate">
            {fullName}
          </h3>
          <p className="text-xs text-[#B8A999] mt-1 truncate">
            {subtitle} · {teacher.ratingsCount} {pluralRu(teacher.ratingsCount, 'отзыв', 'отзыва', 'отзывов')}
          </p>
        </div>
      </div>

      {/* Quote — только если есть реальная цитата */}
      {quote ? (
        <>
          <blockquote className="border-l-2 border-[var(--color-rust)] pl-4 mb-3">
            <p className="font-display italic text-[17px] leading-relaxed text-[#E6D9C9] line-clamp-4">
              «{quote.text}»
            </p>
          </blockquote>
          <p className="text-[11px] tracking-[0.18em] uppercase text-[#B8A999] mb-7">
            — {quote.isAnonymous ? 'Анонимный отзыв' : 'Студент'}
            {quote.discipline && <> · {quote.discipline}</>}
            {' · '}
            <span className="text-[var(--color-rust)]">
              {Math.round(quote.score * 10) / 10 % 1 === 0
                ? Math.round(quote.score)
                : (Math.round(quote.score * 10) / 10).toString().replace('.', ',')}
            </span>
            {' / 10'}
          </p>
        </>
      ) : (
        <p className="text-[12px] text-[#8B827A] italic mb-7 leading-relaxed">
          Развёрнутых отзывов пока нет — но средние оценки уже впечатляют.
        </p>
      )}

      {/* Criteria bars — только реальные критерии */}
      {criteria.length > 0 && (
        <div className="space-y-3">
          {criteria.map(c => (
            <CriterionRow key={c.key} label={c.label} score={c.score} />
          ))}
        </div>
      )}

      {/* Стрелка-CTA при ховере */}
      <div className="mt-6 pt-5 border-t border-[#3A322A] flex items-center justify-between">
        <span className="text-[11px] tracking-[0.18em] uppercase text-[#8B827A]">
          Профиль преподавателя
        </span>
        <ArrowRight size={14} className="text-[var(--color-rust)] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </div>
    </Link>
  )
}

function CriterionRow({ label, score }) {
  const filled = Math.round(score)
  return (
    <div className="grid grid-cols-[1fr_auto_2.5rem] items-center gap-2 sm:gap-3">
      <span className="text-[12px] sm:text-[13px] text-[#E6D9C9] truncate">{label}</span>
      <div className="bar-segments w-[100px] sm:w-[148px]" style={{ '--seg': 'var(--color-sepia-2)' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className={`bar-seg ${i < filled ? 'on' : ''}`} style={{ background: i < filled ? 'var(--color-rust)' : '#3A322A' }} />
        ))}
      </div>
      <span className="text-[13px] font-mono text-[#F4EBDB] text-right">{score.toString().replace('.', ',')}</span>
    </div>
  )
}

/* ────────────────────────────────────────────────
   Статистика — три состояния:
     value === null      → загрузка (skeleton)
     value === undefined → недоступно (прочерк)
     иначе               → реальное число
   ──────────────────────────────────────────────── */
function Stat({ value, label, format, accent }) {
  let content
  if (value === null) {
    content = (
      <span className="inline-block h-10 md:h-12 w-20 rounded-md bg-[#3A322A]/60 animate-pulse align-bottom" />
    )
  } else if (value === undefined || value === 0 && !accent) {
    /* Для счётчиков 0 ≡ «нет данных»; для среднего балла 0 — корректное число */
    content = value === 0
      ? <span className="text-[var(--color-rust)]">{format(0)}</span>
      : <span className="text-[#8B827A]">—</span>
  } else {
    const formatted = format(value)
    content = accent
      ? <span className="text-[var(--color-rust)]">{formatted}</span>
      : formatted
  }

  return (
    <div>
      <div className="font-display text-[36px] sm:text-[44px] md:text-[56px] leading-none tracking-[-0.02em] text-[#F4EBDB]">
        {content}
      </div>
      <div className="mt-2 text-[11px] font-medium tracking-[0.18em] uppercase text-[#B8A999]">
        {label}
      </div>
    </div>
  )
}

function formatRating(n) {
  if (typeof n !== 'number') return '—'
  return n.toFixed(1).replace('.', ',')
}

/* ────────────────────────────────────────────────
   Шаг «как это работает»
   ──────────────────────────────────────────────── */
function StepCard({ step, delay }) {
  const { Icon } = step
  return (
    <div
      className="group rounded-[24px] bg-[var(--color-paper)] border border-[var(--color-sepia)] p-7 hover:border-[var(--color-rust-soft)] transition-colors animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-12">
        <span className="font-display text-[44px] leading-none text-[var(--color-rust)]">{step.n}</span>
        <Icon size={20} className="text-[var(--color-muted)] group-hover:text-[var(--color-rust)] transition-colors" strokeWidth={1.5} />
      </div>
      <h3 className="font-display text-[22px] leading-tight text-[var(--color-ink)] mb-3">{step.title}</h3>
      <p className="text-[13px] leading-relaxed text-[var(--color-muted)]">{step.desc}</p>
    </div>
  )
}

/* ────────────────────────────────────────────────
   Аудитория — карточка (студенты / преподаватели)
   ──────────────────────────────────────────────── */
function AudienceCard({ role, title, bullets, cta, secondary }) {
  return (
    <div className={`rounded-[24px] sm:rounded-[28px] p-6 sm:p-10 flex flex-col ${
      secondary
        ? 'bg-[var(--color-paper-2)] border border-[var(--color-sepia-2)]'
        : 'bg-[var(--color-paper)] border border-[var(--color-sepia)]'
    }`}>
      <span className="label-eyebrow mb-6">{role}</span>
      <h3 className="font-display text-[26px] sm:text-[34px] md:text-[42px] leading-[1.05] tracking-[-0.02em] text-[var(--color-ink)] mb-8">
        {title}
      </h3>
      <ul className="space-y-3 mb-10 flex-1">
        {bullets.map(b => (
          <li key={b} className="flex gap-3 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
            <span className="text-[var(--color-rust)] font-display">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <Link
        to={cta.to}
        className="group inline-flex items-center gap-2 self-start text-sm font-semibold text-[var(--color-rust)] hover:gap-3 transition-all"
      >
        {cta.label}
        <ArrowRight size={16} />
      </Link>
    </div>
  )
}

/* ──────────── Helpers ──────────── */
function formatNum(n) {
  if (n == null) return '—'
  return n.toLocaleString('ru-RU').replace(/,/g, ' ')
}

function pluralRu(n, one, few, many) {
  const num = Number(n) || 0
  const mod10  = num % 10
  const mod100 = num % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
