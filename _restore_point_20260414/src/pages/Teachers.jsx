import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getTeachers } from '../services/teachers'
import { Search, Star, ArrowUpDown, SlidersHorizontal, Users, ChevronRight } from 'lucide-react'

/* ── Constants ── */
const TYPE_FILTERS = [
  { id: 'all',        label: 'Все'                   },
  { id: 'lecturer',   label: 'Лекторы'               },
  { id: 'practice',   label: 'Практики'              },
  { id: 'seminar',    label: 'Семинаристы'           },
  { id: 'supervisor', label: 'Науч. руководители'    },
  { id: 'universal',  label: 'Универсальные'         },
]

const SORT_OPTIONS = [
  { id: 'rating',  label: 'По рейтингу'  },
  { id: 'reviews', label: 'По отзывам'   },
  { id: 'name',    label: 'По алфавиту'  },
]

const TYPE_LABELS = {
  lecturer:   'Лектор',
  practice:   'Практик',
  seminar:    'Семинарист',
  supervisor: 'Науч. руководитель',
  universal:  'Преподаватель',
}

const TYPE_COLORS = {
  lecturer:   'bg-blue-50 text-blue-700',
  practice:   'bg-emerald-50 text-emerald-700',
  seminar:    'bg-purple-50 text-purple-700',
  supervisor: 'bg-amber-50 text-amber-700',
  universal:  'bg-slate-100 text-slate-600',
}

/* ── Mock data (fallback when Firebase offline) ── */
const MOCK = [
  { id: 'm1', firstName: 'Александр', lastName: 'Соколов',  middleName: 'Николаевич', position: 'Доцент', department: 'Высшая математика',      teacherType: 'lecturer',   averageRating: 9.2, ratingsCount: 124, disciplines: ['Высшая математика', 'Линейная алгебра'] },
  { id: 'm2', firstName: 'Наталья',   lastName: 'Сорокина', middleName: 'Владимировна',position: 'Доцент', department: 'Кафедра информатики',    teacherType: 'practice',   averageRating: 8.8, ratingsCount: 98,  disciplines: ['Алгоритмы', 'Программирование'] },
  { id: 'm3', firstName: 'Дмитрий',   lastName: 'Морозов',  middleName: 'Сергеевич',  position: 'Профессор',department: 'Кафедра экономики',     teacherType: 'lecturer',   averageRating: 8.5, ratingsCount: 210, disciplines: ['Микроэкономика', 'Финансовая математика'] },
  { id: 'm4', firstName: 'Ирина',     lastName: 'Волкова',  middleName: 'Петровна',   position: 'Старший преподаватель', department: 'Физика',   teacherType: 'seminar',    averageRating: 8.1, ratingsCount: 67,  disciplines: ['Общая физика', 'Оптика'] },
  { id: 'm5', firstName: 'Павел',     lastName: 'Козлов',   middleName: 'Андреевич',  position: 'Доцент', department: 'Кафедра химии',           teacherType: 'supervisor', averageRating: 7.9, ratingsCount: 45,  disciplines: ['Органическая химия'] },
  { id: 'm6', firstName: 'Елена',     lastName: 'Новикова', middleName: 'Юрьевна',    position: 'Профессор',department: 'Кафедра психологии',    teacherType: 'universal',  averageRating: 9.5, ratingsCount: 183, disciplines: ['Психология', 'Социология'] },
  { id: 'm7', firstName: 'Андрей',    lastName: 'Петров',   middleName: 'Викторович', position: 'Доцент', department: 'Кафедра истории',         teacherType: 'seminar',    averageRating: 7.5, ratingsCount: 32,  disciplines: ['История России', 'Культурология'] },
  { id: 'm8', firstName: 'Мария',     lastName: 'Федорова', middleName: 'Ивановна',   position: 'Ассистент',department: 'Кафедра философии',     teacherType: 'practice',   averageRating: 8.3, ratingsCount: 54,  disciplines: ['Философия', 'Логика'] },
  { id: 'm9', firstName: 'Сергей',    lastName: 'Зайцев',   middleName: 'Михайлович', position: 'Профессор',department: 'Кафедра физики',        teacherType: 'lecturer',   averageRating: 6.8, ratingsCount: 88,  disciplines: ['Термодинамика', 'Квантовая физика'] },
]

/* ── Helpers ── */
function getNavyGradient(name = '') {
  const shades = [
    ['#002366','#1a3a7a'],
    ['#003080','#0a2d6e'],
    ['#001a55','#0d2d80'],
    ['#002880','#1a4090'],
  ]
  const g = shades[(name.charCodeAt(0) || 0) % shades.length]
  return `linear-gradient(135deg, ${g[0]}, ${g[1]})`
}

function scoreColor(score) {
  if (score >= 9)  return 'text-emerald-600'
  if (score >= 7.5) return 'text-blue-600'
  if (score >= 6)  return 'text-amber-600'
  return 'text-red-500'
}

function scoreBg(score) {
  if (score >= 9)  return 'bg-emerald-50 border-emerald-100'
  if (score >= 7.5) return 'bg-blue-50 border-blue-100'
  if (score >= 6)  return 'bg-amber-50 border-amber-100'
  return 'bg-red-50 border-red-100'
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function Teachers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [teachers, setTeachers]   = useState([])
  const [loading,  setLoading]    = useState(true)

  const [search,   setSearch]     = useState(searchParams.get('q') || '')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sort,     setSort]       = useState('rating')
  const [page,     setPage]       = useState(12)

  useEffect(() => {
    getTeachers().then(({ teachers: list }) => {
      setTeachers(list.length > 0 ? list : MOCK)
      setLoading(false)
    })
  }, [])

  /* Filter + sort on client */
  const filtered = useMemo(() => {
    let list = [...teachers]

    if (typeFilter !== 'all') list = list.filter(t => t.teacherType === typeFilter)

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t => {
        const name = `${t.lastName} ${t.firstName} ${t.middleName || ''}`.toLowerCase()
        const disc = (t.disciplines || []).join(' ').toLowerCase()
        const dept = (t.department || '').toLowerCase()
        return name.includes(q) || disc.includes(q) || dept.includes(q)
      })
    }

    if (sort === 'rating')  list.sort((a,b) => (b.averageRating||0) - (a.averageRating||0))
    if (sort === 'reviews') list.sort((a,b) => (b.ratingsCount||0)  - (a.ratingsCount||0))
    if (sort === 'name')    list.sort((a,b) => (a.lastName||'').localeCompare(b.lastName||'', 'ru'))

    return list
  }, [teachers, search, typeFilter, sort])

  const shown = filtered.slice(0, page)

  function handleSearch(e) {
    e.preventDefault()
    setSearchParams(search ? { q: search } : {})
    setPage(12)
  }

  /* Stats */
  const totalRatings = teachers.reduce((s,t) => s + (t.ratingsCount||0), 0)
  const avgRating    = teachers.length
    ? (teachers.reduce((s,t) => s + (t.averageRating||0), 0) / teachers.length).toFixed(1)
    : '—'

  return (
    <div className="min-h-screen bg-[#f8f8fa]">

      {/* ══ HERO ══ */}
      <section className="relative bg-[#002366] overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, #ccff00 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#ccff00] opacity-10 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 md:px-12 pt-32 pb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white font-headline mb-3">
            Преподаватели
          </h1>
          <p className="text-white/60 text-base max-w-xl">
            Найдите преподавателя, посмотрите его рейтинг и отзывы студентов
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="mt-8 max-w-2xl">
            <div className="relative flex items-center bg-white rounded-2xl overflow-hidden shadow-navy">
              <Search className="absolute left-5 text-slate-400" size={20} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(12) }}
                className="w-full bg-transparent py-4 pl-14 pr-36 focus:outline-none text-on-surface placeholder:text-slate-400 text-base"
                placeholder="Имя, дисциплина, кафедра..."
              />
              <button type="submit"
                className="absolute right-2 px-5 py-2.5 bg-[#ccff00] text-[#002366] text-sm font-bold rounded-xl hover:brightness-95 transition-all">
                Найти
              </button>
            </div>
          </form>

          {/* Stats row */}
          <div className="flex flex-wrap gap-8 mt-10">
            {[
              { label: 'Преподавателей', value: teachers.length || '...' },
              { label: 'Средний рейтинг', value: avgRating },
              { label: 'Всего отзывов', value: totalRatings > 0 ? `${totalRatings}+` : '...' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-white font-headline">{s.value}</p>
                <p className="text-white/50 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FILTERS ══ */}
      <div className="sticky top-16 z-40 bg-[#f8f8fa]/90 backdrop-blur-md border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 md:px-12 py-3 flex flex-wrap items-center gap-3">
          {/* Type tabs */}
          <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200/60 overflow-x-auto flex-shrink-0">
            {TYPE_FILTERS.map(f => (
              <button key={f.id} onClick={() => { setTypeFilter(f.id); setPage(12) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  typeFilter === f.id
                    ? 'bg-[#002366] text-white'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown size={14} className="text-on-surface-variant" />
            <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200/60">
              {SORT_OPTIONS.map(s => (
                <button key={s.id} onClick={() => setSort(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    sort === s.id
                      ? 'bg-[#002366] text-white'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results count */}
          <span className="text-xs text-on-surface-variant ml-1 hidden sm:block">
            {filtered.length} преподавателей
          </span>
        </div>
      </div>

      {/* ══ GRID ══ */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-10">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({length: 8}).map((_,i) => (
              <div key={i} className="bg-white rounded-3xl p-6 animate-pulse border border-slate-100">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl mb-4" />
                <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/2 mb-4" />
                <div className="h-8 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
              <Users size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-on-surface mb-2">Никого не найдено</h3>
            <p className="text-on-surface-variant text-sm">Попробуйте изменить фильтры или поисковый запрос</p>
            <button onClick={() => { setSearch(''); setTypeFilter('all'); setPage(12) }}
              className="mt-5 px-5 py-2.5 bg-[#002366] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a7a] transition-colors">
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {shown.map((t, i) => (
                <div key={t.id || i} className="animate-fade-up" style={{ animationDelay: `${(i % 12) * 60}ms` }}>
                  <TeacherCard teacher={t} />
                </div>
              ))}
            </div>

            {page < filtered.length && (
              <div className="text-center mt-10">
                <button onClick={() => setPage(p => p + 12)}
                  className="px-8 py-3 bg-white border border-slate-200 text-on-surface text-sm font-semibold rounded-2xl hover:border-[#002366] hover:text-[#002366] transition-all">
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

/* ── Teacher Card ── */
function TeacherCard({ teacher }) {
  const fullName = [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ')
  const initials = [teacher.firstName?.[0], teacher.lastName?.[0]].filter(Boolean).join('')
  const score    = teacher.averageRating || 0
  const typeLabel = TYPE_LABELS[teacher.teacherType] || 'Преподаватель'
  const typeColor = TYPE_COLORS[teacher.teacherType] || TYPE_COLORS.universal

  return (
    <Link
      to={`/teachers/${teacher.id}`}
      className="bg-white rounded-3xl p-5 border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col group"
    >
      {/* Avatar + score */}
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white overflow-hidden flex-shrink-0"
          style={!teacher.avatarUrl ? { background: getNavyGradient(teacher.firstName) } : {}}
        >
          {teacher.avatarUrl
            ? <img src={teacher.avatarUrl} alt="" className="w-full h-full object-cover" />
            : initials || '?'
          }
        </div>

        {score > 0 && (
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-bold ${scoreBg(score)} ${scoreColor(score)}`}>
            <Star size={11} className="fill-current" />
            {score.toFixed(1)}
          </div>
        )}
      </div>

      {/* Name & position */}
      <h3 className="font-semibold text-sm text-on-surface leading-tight line-clamp-2 mb-1 font-headline">
        {fullName || 'Без имени'}
      </h3>
      <p className="text-xs text-on-surface-variant truncate mb-3">
        {teacher.position || ''}{teacher.department ? ` · ${teacher.department}` : ''}
      </p>

      {/* Type badge */}
      <span className={`inline-block self-start px-2.5 py-0.5 text-[11px] font-semibold rounded-full mb-3 ${typeColor}`}>
        {typeLabel}
      </span>

      {/* Disciplines */}
      {teacher.disciplines?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {teacher.disciplines.slice(0,2).map(d => (
            <span key={d} className="px-2 py-0.5 bg-[#e6e6fa] text-[#4a3d80] text-[10px] font-medium rounded-full">{d}</span>
          ))}
          {teacher.disciplines.length > 2 && (
            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full">+{teacher.disciplines.length - 2}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-100">
        <span className="text-xs text-on-surface-variant">
          {teacher.ratingsCount || 0} отзывов
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-[#002366] opacity-0 group-hover:opacity-100 transition-opacity">
          Профиль <ChevronRight size={13} />
        </span>
      </div>
    </Link>
  )
}
