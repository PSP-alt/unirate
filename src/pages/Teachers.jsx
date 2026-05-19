import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams, useLocation } from 'react-router-dom'
import { getTeachers } from '../services/teachers'
import {
  Search, ArrowRight, Users,
  TrendingUp, MessageSquare, ArrowDownAZ,
  ArrowDown, ArrowUp,
} from 'lucide-react'

/* ════════════════════════════════════════════════════════════
   UNIRATE · Каталог преподавателей
   Тёмная тема, серифный курсив для имён, сегментные бары.
════════════════════════════════════════════════════════════ */

const TYPE_FILTERS = [
  { id: 'all',        label: 'Все'             },
  { id: 'lecturer',   label: 'Лекторы'         },
  { id: 'practice',   label: 'Практики'        },
  { id: 'seminar',    label: 'Семинаристы'     },
  { id: 'supervisor', label: 'Науч. рук.'      },
  { id: 'universal',  label: 'Универсальные'   },
]

const SORT_OPTIONS = [
  { id: 'rating',  label: 'По рейтингу', icon: TrendingUp,    defaultDir: 'desc' },
  { id: 'reviews', label: 'По отзывам',  icon: MessageSquare, defaultDir: 'desc' },
  { id: 'name',    label: 'По алфавиту', icon: ArrowDownAZ,   defaultDir: 'asc'  },
]

const SORT_IDS = SORT_OPTIONS.map(s => s.id)
const DEFAULT_DIR = Object.fromEntries(SORT_OPTIONS.map(s => [s.id, s.defaultDir]))

function scoreTone(score) {
  if (score >= 9)   return 'text-[var(--color-ok)]'
  if (score >= 7.5) return 'text-[var(--color-rust)]'
  if (score >= 6)   return 'text-[var(--color-warn)]'
  return 'text-[var(--color-danger)]'
}

/* ══════════════════════════════════════════ */
export default function Teachers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [teachers, setTeachers] = useState([])
  const [loading,  setLoading]  = useState(true)
  const location = useLocation()

  const [search,     setSearch]     = useState(searchParams.get('q') || '')
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all')
  const [sort,       setSort]       = useState(() => {
    const s = searchParams.get('sort')
    return SORT_IDS.includes(s) ? s : 'rating'
  })
  const [sortDir,    setSortDir]    = useState(() => {
    const d = searchParams.get('dir')
    if (d === 'asc' || d === 'desc') return d
    return DEFAULT_DIR[searchParams.get('sort')] || 'desc'
  })
  const [page,       setPage]       = useState(12)

  /* ── синхронизация фильтров с URL (sort/dir/type/q).
     Включаем search в deps — раньше при смене сортировки терялся ?q. */
  useEffect(() => {
    const next = {}
    if (search.trim())                 next.q    = search.trim()
    if (typeFilter !== 'all')          next.type = typeFilter
    if (sort !== 'rating')             next.sort = sort
    if (sortDir !== DEFAULT_DIR[sort]) next.dir  = sortDir
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, sort, sortDir, search])

  /* ── обработчик клика по кнопке сортировки ── */
  function handleSortClick(id) {
    if (sort === id) {
      // повторный клик — переключение направления
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(id)
      setSortDir(DEFAULT_DIR[id])
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getTeachers()
      .then(({ teachers: list, error }) => {
        if (cancelled) return
        if (error) console.error('[Teachers] getTeachers:', error)
        /* Раньше при пустом ответе подставлялся MOCK с фейковыми ID
           m1..m8 — клик по такой карточке вёл на /teachers/m1 → 404.
           Теперь пустой результат показывается честно: «никого не найдено». */
        setTeachers(list || [])
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        console.error('[Teachers] load failed:', err)
        setTeachers([])
        setLoading(false)
      })
    return () => { cancelled = true }
  // location.key меняется при каждом переходе — гарантирует рефетч
  }, [location.key])

  const filtered = useMemo(() => {
    let list = [...teachers]

    /* Фильтр по типу — поддержка нового массива teacherTypes и legacy teacherType */
    if (typeFilter !== 'all') {
      list = list.filter(t => {
        const types = t.teacherTypes?.length ? t.teacherTypes : [t.teacherType]
        return types.includes(typeFilter)
      })
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t => {
        const name = `${t.lastName} ${t.firstName} ${t.middleName || ''}`.toLowerCase()
        const disc = (t.disciplines || []).join(' ').toLowerCase()
        const dept = (t.department || '').toLowerCase()
        return name.includes(q) || disc.includes(q) || dept.includes(q)
      })
    }

    /* Сортировка с учётом направления */
    const dir = sortDir === 'asc' ? 1 : -1
    if (sort === 'rating') {
      list.sort((a, b) => ((a.averageRating || 0) - (b.averageRating || 0)) * dir)
    } else if (sort === 'reviews') {
      list.sort((a, b) => ((a.ratingsCount || 0) - (b.ratingsCount || 0)) * dir)
    } else if (sort === 'name') {
      list.sort((a, b) =>
        (a.lastName || '').localeCompare(b.lastName || '', 'ru') * dir
      )
    }
    return list
  }, [teachers, search, typeFilter, sort, sortDir])

  const shown = filtered.slice(0, page)

  function handleSearch(e) {
    e.preventDefault()
    /* search — единственный параметр, который выставляется по submit формы;
       прочие (sort/dir/type) синхронизируются собственным useEffect */
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (search.trim()) next.set('q', search.trim())
      else next.delete('q')
      return next
    }, { replace: true })
    setPage(12)
  }

  const totalRatings = teachers.reduce((s,t) => s + (t.ratingsCount||0), 0)
  const ratedTeachers = teachers.filter(t => (t.averageRating || 0) > 0)
  const avgRating    = ratedTeachers.length
    ? (ratedTeachers.reduce((s,t) => s + (t.averageRating||0), 0) / ratedTeachers.length).toFixed(1).replace('.', ',')
    : '—'

  return (
    <div className="min-h-screen bg-[#1A1613] text-[#E6D9C9]">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-[var(--color-rust)]/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 md:px-12 pt-24 pb-16">
          <div className="label-eyebrow mb-6">Каталог · Живой разговор</div>

          <h1 className="font-display text-[36px] sm:text-[48px] md:text-[72px] leading-[1.0] tracking-[-0.02em] text-[#F4EBDB] mb-8">
            <span className="italic text-[var(--color-rust)]">Преподаватели</span>,{' '}
            <span className="sm:block">о которых говорят.</span>
          </h1>

          <p className="text-[15px] leading-relaxed text-[#B8A999] max-w-lg mb-10">
            Найдите преподавателя по имени, дисциплине или кафедре. Открытые отзывы студентов, подписанные псевдонимом.
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="max-w-2xl">
            <div className="relative flex items-center bg-[#24201C] border border-[#3A322A] rounded-full overflow-hidden focus-within:border-[var(--color-rust-soft)] transition-colors">
              <Search className="absolute left-5 text-[#8B827A]" size={18} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(12) }}
                className="w-full bg-transparent py-4 pl-14 pr-32 focus:outline-none text-[#F4EBDB] placeholder:text-[#8B827A] text-[14px]"
                placeholder="Имя, дисциплина, кафедра..."
              />
              <button type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-[var(--color-rust)] text-[#FFFDF7] text-[13px] font-semibold rounded-full hover:bg-[#C55830] transition-colors">
                Найти
              </button>
            </div>
          </form>

          {/* Stats */}
          <div className="flex flex-wrap gap-10 mt-12">
            {[
              { value: teachers.length || '—',                                                             label: 'преподавателей' },
              { value: avgRating,                                                                          label: 'средний балл', accent: true },
              { value: totalRatings > 0 ? totalRatings.toLocaleString('ru-RU').replace(/,/g, ' ') : '—',  label: 'всего отзывов' },
            ].map(s => (
              <div key={s.label}>
                <div className={`font-display text-[36px] leading-none tracking-[-0.02em] ${s.accent ? 'text-[var(--color-rust)]' : 'text-[#F4EBDB]'}`}>
                  {s.value}
                </div>
                <div className="mt-2 text-[11px] font-medium tracking-[0.18em] uppercase text-[#B8A999]">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Filters ── */}
      <div className="sticky top-0 z-30 bg-[#1A1613]/95 backdrop-blur-xl border-y border-[#3A322A]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-3 md:py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="flex gap-1 p-1 bg-[#24201C] rounded-full border border-[#3A322A] overflow-x-auto no-scrollbar flex-shrink-0">
            {TYPE_FILTERS.map(f => (
              <button key={f.id} onClick={() => { setTypeFilter(f.id); setPage(12) }}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors ${
                  typeFilter === f.id
                    ? 'bg-[var(--color-rust)] text-[#FFFDF7]'
                    : 'text-[#B8A999] hover:text-[#F4EBDB]'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="hidden sm:block flex-1" />

          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1 p-1 bg-[#24201C] rounded-full border border-[#3A322A]">
              {SORT_OPTIONS.map(s => {
                const active = sort === s.id
                const Icon   = s.icon
                const DirIcon = sortDir === 'asc' ? ArrowUp : ArrowDown
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSortClick(s.id)}
                    title={active ? `Нажмите ещё раз — сменить направление (${sortDir === 'asc' ? 'возр.' : 'убыв.'})` : `Сортировать ${s.label.toLowerCase()}`}
                    className={`group flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-[var(--color-rust)] text-[#FFFDF7]'
                        : 'text-[#B8A999] hover:text-[#F4EBDB]'
                    }`}
                  >
                    <Icon size={13} className={active ? 'opacity-100' : 'opacity-70'} />
                    <span className="hidden sm:inline">{s.label}</span>
                    {active && <DirIcon size={12} className="ml-0.5 opacity-90" />}
                  </button>
                )
              })}
            </div>

            <span className="text-[11px] tracking-[0.15em] uppercase text-[#8B827A] hidden sm:block">
              {filtered.length} найдено
            </span>
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 pb-24">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({length: 6}).map((_,i) => (
              <div key={i} className="rounded-[24px] bg-[#24201C] border border-[#3A322A] p-7 h-[280px] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-full bg-[#24201C] flex items-center justify-center mx-auto mb-5 border border-[#3A322A]">
              <Users size={28} className="text-[#8B827A]" />
            </div>
            <h3 className="font-display italic text-[28px] text-[#F4EBDB] mb-2">Никого не найдено</h3>
            <p className="text-[#B8A999] text-[14px]">Попробуйте изменить фильтры или запрос</p>
            <button onClick={() => { setSearch(''); setTypeFilter('all'); setPage(12) }}
              className="mt-6 px-6 py-3 bg-[var(--color-rust)] text-[#FFFDF7] text-[13px] font-semibold rounded-full hover:bg-[#C55830] transition-colors">
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {shown.map((t, i) => (
                <div key={t.id || i} className="animate-fade-up" style={{ animationDelay: `${(i % 12) * 50}ms` }}>
                  <TeacherCard teacher={t} />
                </div>
              ))}
            </div>

            {page < filtered.length && (
              <div className="text-center mt-14">
                <button onClick={() => setPage(p => p + 12)}
                  className="px-8 py-3 bg-[#24201C] border border-[#3A322A] text-[#F4EBDB] text-[13px] font-semibold rounded-full hover:border-[var(--color-rust-soft)] transition-colors">
                  Показать ещё ({filtered.length - page})
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ── Карточка преподавателя ── */
function TeacherCard({ teacher }) {
  const fullName = [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ')
  const initials = [teacher.firstName?.[0], teacher.lastName?.[0]].filter(Boolean).join('')
  const score    = teacher.averageRating || 0

  return (
    <Link
      to={`/teachers/${teacher.id}`}
      className="group block rounded-[24px] bg-[#24201C] border border-[#3A322A] p-6 hover:border-[var(--color-rust-soft)] transition-colors h-full flex flex-col"
    >
      <div className="flex items-start gap-4 mb-5">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-[#3A322A] flex items-center justify-center text-[#F4EBDB] font-display text-[16px] flex-shrink-0 overflow-hidden">
          {teacher.avatarUrl
            ? <img src={teacher.avatarUrl} alt="" className="w-full h-full object-cover" />
            : (initials || '?')
          }
        </div>

        {/* Name & position */}
        <div className="min-w-0 flex-1">
          <h3 className="font-display italic text-[18px] leading-tight text-[#F4EBDB] line-clamp-2">
            {fullName || 'Без имени'}
          </h3>
          <p className="text-[12px] text-[#B8A999] mt-1 truncate">
            {teacher.disciplines?.[0] || teacher.department || 'Преподаватель'}
          </p>
        </div>
      </div>

      {/* Score row */}
      <div className="flex items-baseline gap-2 mb-5">
        {score > 0 ? (
          <>
            <span className={`font-display text-[44px] leading-none tracking-[-0.02em] ${scoreTone(score)}`}>
              {score.toFixed(1).replace('.', ',')}
            </span>
            <span className="text-[13px] text-[#B8A999]">/ 10</span>
            <span className="ml-auto text-[11px] tracking-[0.18em] uppercase text-[#8B827A]">
              {teacher.ratingsCount || 0} отз.
            </span>
          </>
        ) : (
          <>
            <span className="font-display text-[28px] text-[#8B827A]">Нет оценок</span>
          </>
        )}
      </div>

      {/* Score bar */}
      {score > 0 && (
        <div className="bar-segments mb-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className="bar-seg" style={{
              background: i < Math.round(score) ? 'var(--color-rust)' : '#3A322A'
            }} />
          ))}
        </div>
      )}

      {/* Disciplines */}
      {teacher.disciplines?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {teacher.disciplines.slice(0, 3).map(d => (
            <span key={d} className="px-2.5 py-1 border border-[#3A322A] text-[#E6D9C9] text-[11px] rounded-full">
              {d}
            </span>
          ))}
          {teacher.disciplines.length > 3 && (
            <span className="px-2.5 py-1 text-[#8B827A] text-[11px]">
              +{teacher.disciplines.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-[#3A322A] flex items-center justify-between">
        <span className="text-[11px] tracking-[0.18em] uppercase text-[#8B827A]">
          {teacher.position || teacher.teacherType || 'Преподаватель'}
        </span>
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-rust)] opacity-0 group-hover:opacity-100 transition-opacity">
          Профиль <ArrowRight size={12} />
        </span>
      </div>
    </Link>
  )
}
