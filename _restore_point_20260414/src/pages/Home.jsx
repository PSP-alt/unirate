import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTeachers } from '../services/teachers'
import { getMaterials } from '../services/materials'
import { collection, getCountFromServer } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useInView } from '../hooks/useInView'
import { Search, ArrowRight, Star, FileText, Film, FileSpreadsheet, Presentation, File, Download } from 'lucide-react'

/* ── File icon map ── */
const FILE_ICONS = {
  pdf:  { Icon: FileText,       bg: 'bg-red-50',    text: 'text-red-500'    },
  docx: { Icon: FileText,       bg: 'bg-blue-50',   text: 'text-blue-500'   },
  doc:  { Icon: FileText,       bg: 'bg-blue-50',   text: 'text-blue-500'   },
  mp4:  { Icon: Film,           bg: 'bg-purple-50', text: 'text-purple-500' },
  pptx: { Icon: Presentation,   bg: 'bg-orange-50', text: 'text-orange-500' },
  xlsx: { Icon: FileSpreadsheet, bg: 'bg-green-50', text: 'text-green-500'  },
}
function getFileIcon(ft = '') {
  return FILE_ICONS[ft?.toLowerCase()] || { Icon: File, bg: 'bg-slate-100', text: 'text-slate-500' }
}
function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 3600)   return `${Math.floor(diff / 60)} мин. назад`
  if (diff < 86400)  return `${Math.floor(diff / 3600)} ч. назад`
  if (diff < 172800) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

/* ── Avatar gradient per name ── */
const GRADIENTS = [
  ['#002366','#1a4a9f'],
  ['#1a3a7a','#2d5bbf'],
  ['#002366','#003d99'],
  ['#0d2d66','#1a4a8a'],
]
function avatarGradient(name = '') {
  const g = GRADIENTS[(name.charCodeAt(0) || 0) % GRADIENTS.length]
  return `linear-gradient(135deg, ${g[0]}, ${g[1]})`
}

/* ── Mock data ── */
const MOCK_TEACHERS = [
  { firstName: 'Александр', lastName: 'Соколов',  position: 'Кафедра высшей математики',  averageRating: 9.2, ratingsCount: 124 },
  { firstName: 'Наталья',   lastName: 'Сорокина', position: 'Кафедра информатики',         averageRating: 8.8, ratingsCount: 98  },
  { firstName: 'Дмитрий',   lastName: 'Морозов',  position: 'Кафедра экономики',           averageRating: 8.5, ratingsCount: 210 },
]
const MOCK_MATERIALS = [
  { title: 'Основы теории цвета',     fileType: 'pdf',  teacher: 'Соколов А.Н.',  size: '12 MB',  date: '2 ч. назад'  },
  { title: 'Руководство к экзамену',  fileType: 'docx', teacher: 'Сорокина Н.В.', size: '2 MB',   date: 'Вчера'       },
  { title: 'Лекция: Ренессанс',       fileType: 'mp4',  teacher: 'Морозов Д.С.',  size: '450 MB', date: '2 дня назад' },
  { title: 'UI Design Systems 101',   fileType: 'pdf',  teacher: 'Попов А.В.',    size: '8 MB',   date: '12 окт.'     },
]

const HERO_VARIANTS = [
  { line1: 'Коллективный разум',    line2: 'вашего университета' },
  { line1: 'Знания всего',          line2: 'университета — здесь' },
  { line1: 'Честные оценки.',       line2: 'Лучшие материалы.' },
  { line1: 'Рейтинги, которым',     line2: 'можно доверять' },
]
const heroVariant = HERO_VARIANTS[Math.floor(Math.random() * HERO_VARIANTS.length)]

export default function Home() {
  const { user, userData } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch]     = useState('')
  const [teachers, setTeachers] = useState([])
  const [materials, setMaterials] = useState([])
  const [loadingT, setLoadingT] = useState(true)
  const [loadingM, setLoadingM] = useState(true)
  const [stats, setStats] = useState({ teachers: null, ratings: null, materials: null })

  useEffect(() => {
    async function fetchStats() {
      try {
        const [tSnap, rSnap, mSnap] = await Promise.all([
          getCountFromServer(collection(db, 'teachers')),
          getCountFromServer(collection(db, 'ratings')),
          getCountFromServer(collection(db, 'materials')),
        ])
        setStats({
          teachers: tSnap.data().count,
          ratings:  rSnap.data().count,
          materials: mSnap.data().count,
        })
      } catch {
        // Firebase offline — stats stay null (hardcoded fallback shown)
      }
    }
    fetchStats()
  }, [])

  useEffect(() => {
    getTeachers().then(({ teachers: list }) => {
      setTeachers([...list].sort((a,b) => (b.averageRating||0)-(a.averageRating||0)).slice(0,3))
      setLoadingT(false)
    })
  }, [])

  useEffect(() => {
    getMaterials({ pageSize: 4, sortBy: 'newest' }).then(({ materials: list }) => {
      setMaterials((list||[]).slice(0,4))
      setLoadingM(false)
    })
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    if (search.trim()) navigate(`/teachers?q=${encodeURIComponent(search.trim())}`)
  }

  const showTeachers  = teachers.length  > 0 ? teachers  : MOCK_TEACHERS
  const showMaterials = materials.length > 0 ? materials : MOCK_MATERIALS

  const [teachersRef, teachersInView]   = useInView()
  const [materialsRef, materialsInView] = useInView()

  return (
    <div className="min-h-screen bg-[#f8f8fa]">

      {/* ══ HERO ══ */}
      <section className="relative bg-[#002366] overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, #ccff00 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        {/* Lime glow */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#ccff00] opacity-10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full bg-[#ccff00] opacity-5 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 md:px-12 pt-36 pb-24">
          {/* Label */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#ccff00]/30 bg-[#ccff00]/10 mb-8 animate-fade-up" style={{ animationDelay: '0ms' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#ccff00] animate-pulse" />
            <span className="text-[#ccff00] text-xs font-semibold tracking-wide uppercase">СПБГУПТД · Рейтинги 2026</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-[-0.03em] text-white leading-[1.05] font-headline max-w-3xl animate-fade-up" style={{ animationDelay: '80ms' }}>
            {user ? (
              <>С возвращением,{' '}
                <span className="text-[#ccff00]">{userData?.firstName || 'студент'}</span>
              </>
            ) : (
              <>{heroVariant.line1}<br />
                <span className="text-[#ccff00]">{heroVariant.line2}</span>
              </>
            )}
          </h1>

          <p className="text-white/60 text-lg max-w-xl mt-5 leading-relaxed animate-fade-up" style={{ animationDelay: '160ms' }}>
            Оценивайте преподавателей, делитесь учебными материалами
            и открывайте знания всего университета.
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="mt-10 max-w-2xl animate-fade-up" style={{ animationDelay: '240ms' }}>
            <div className="relative flex items-center bg-white rounded-2xl shadow-navy overflow-hidden">
              <Search className="absolute left-5 text-slate-400" size={20} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-transparent py-4 pl-14 pr-36 focus:outline-none text-on-surface placeholder:text-slate-400 text-base"
                placeholder="Поиск преподавателя или курса..."
              />
              <button
                type="submit"
                className="absolute right-2 px-5 py-2.5 bg-[#ccff00] text-[#002366] text-sm font-bold rounded-xl hover:brightness-95 transition-all"
              >
                Найти
              </button>
            </div>
          </form>

          {/* Stats */}
          <div className="flex flex-wrap gap-8 mt-12 animate-fade-up" style={{ animationDelay: '320ms' }}>
            {[
              { value: stats.teachers,  fallback: '200+',   label: 'Преподавателей' },
              { value: stats.ratings,   fallback: '1 200+', label: 'Отзывов' },
              { value: stats.materials, fallback: '500+',   label: 'Материалов' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-white font-headline">
                  {s.value === null ? s.fallback : s.value.toLocaleString('ru-RU')}
                </p>
                <p className="text-white/50 text-sm mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TOP TEACHERS ══ */}
      <section ref={teachersRef} className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.02em] text-on-surface font-headline">Лучшие преподаватели</h2>
            <p className="text-on-surface-variant text-sm mt-1">Самые высокие оценки по отзывам студентов</p>
          </div>
          <Link to="/teachers" className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all">
            Все преподаватели <ArrowRight size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {loadingT ? (
            Array.from({length:3}).map((_,i) => (
              <div key={i} className="bg-white rounded-3xl p-6 animate-pulse border border-slate-100">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl mb-4" />
                <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-1/2 mb-4" />
                <div className="h-10 bg-slate-100 rounded-xl" />
              </div>
            ))
          ) : showTeachers.map((t, i) => (
            <div key={t.id||i}
              className={teachersInView ? 'animate-fade-up' : 'opacity-0'}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <TeacherCard teacher={t} />
            </div>
          ))}
        </div>
      </section>

      {/* ══ LATEST MATERIALS ══ */}
      <section ref={materialsRef} className="max-w-7xl mx-auto px-6 md:px-12 pb-20">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.02em] text-on-surface font-headline">Последние материалы</h2>
            <p className="text-on-surface-variant text-sm mt-1">Конспекты, методички и видеозаписи лекций</p>
          </div>
          <Link to="/materials" className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all">
            Все материалы <ArrowRight size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loadingM ? (
            Array.from({length:4}).map((_,i) => (
              <div key={i} className="bg-white rounded-3xl p-5 animate-pulse border border-slate-100">
                <div className="w-11 h-11 bg-slate-100 rounded-xl mb-4" />
                <div className="h-4 bg-slate-100 rounded mb-2" />
                <div className="h-3 bg-slate-100 rounded w-2/3" />
              </div>
            ))
          ) : showMaterials.map((m, i) => (
            <div key={m.id||i}
              className={materialsInView ? 'animate-fade-up' : 'opacity-0'}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <MatCard material={m} />
            </div>
          ))}
        </div>
      </section>

      {/* ══ CTA ══ */}
      {!user && (
        <section className="max-w-7xl mx-auto px-6 md:px-12 pb-20">
          <div className="bg-[#002366] rounded-3xl p-10 md:p-14 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-[#ccff00]/10 blur-3xl" />
            <div className="relative">
              <h3 className="text-3xl font-bold text-white font-headline tracking-tight">Присоединяйтесь сейчас</h3>
              <p className="text-white/60 mt-2">Зарегистрируйтесь бесплатно и начните оценивать преподавателей</p>
            </div>
            <div className="flex gap-3 relative flex-shrink-0">
              <Link to="/register"
                className="px-6 py-3 bg-[#ccff00] text-[#002366] font-bold rounded-xl hover:brightness-95 transition-all shadow-lime">
                Зарегистрироваться
              </Link>
              <Link to="/login"
                className="px-6 py-3 bg-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-all border border-white/20">
                Войти
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

/* ── Teacher Card ── */
function TeacherCard({ teacher }) {
  const name     = [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ') || `${teacher.firstName} ${teacher.lastName}`
  const initials = [teacher.firstName?.[0], teacher.lastName?.[0]].filter(Boolean).join('')
  const score    = teacher.averageRating || 0
  const scoreColor = score >= 9 ? 'text-emerald-500' : score >= 7 ? 'text-amber-500' : 'text-slate-400'

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
      {/* Top row */}
      <div className="flex items-start gap-4 mb-5">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
          style={{ background: avatarGradient(teacher.firstName) }}
        >
          {teacher.avatarUrl
            ? <img src={teacher.avatarUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
            : initials || '?'
          }
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-on-surface leading-tight line-clamp-2 text-sm">{name}</h3>
          <p className="text-on-surface-variant text-xs mt-0.5 truncate">
            {teacher.position || teacher.disciplines?.[0] || 'Преподаватель'}
          </p>
        </div>
      </div>

      {/* Score */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-1">
          <Star size={14} className="fill-amber-400 text-amber-400" />
          <span className={`text-xl font-bold font-headline ${scoreColor}`}>
            {score > 0 ? score.toFixed(1) : '—'}
          </span>
          <span className="text-on-surface-variant text-xs">/10</span>
        </div>
        <span className="text-on-surface-variant text-xs">·</span>
        <span className="text-on-surface-variant text-xs">{teacher.ratingsCount || 0} отзывов</span>
      </div>

      {/* Disciplines */}
      {teacher.disciplines?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {teacher.disciplines.slice(0,2).map(d => (
            <span key={d} className="px-2.5 py-0.5 bg-[#e6e6fa] text-[#4a3d80] text-[11px] font-medium rounded-full">{d}</span>
          ))}
        </div>
      )}

      <Link
        to={teacher.id ? `/teachers/${teacher.id}` : '/teachers'}
        className="mt-auto block w-full py-2.5 text-center bg-[#002366] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a7a] transition-colors"
      >
        Открыть профиль
      </Link>
    </div>
  )
}

/* ── Material Card ── */
function MatCard({ material }) {
  const ft = material.fileType || material.type
  const { Icon, bg, text } = getFileIcon(ft)
  const teacherName = material.teacherName || material.teacher || ''
  const size = material.fileSize ? formatSize(material.fileSize) : (material.size || '')
  const date = material.createdAt ? formatDate(material.createdAt) : (material.date || '')

  return (
    <a
      href={material.fileUrl || '#'}
      target="_blank"
      rel="noreferrer"
      className="bg-white rounded-3xl p-5 border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group flex flex-col"
    >
      <div className={`w-11 h-11 ${bg} ${text} rounded-xl flex items-center justify-center mb-4 flex-shrink-0`}>
        <Icon size={20} />
      </div>
      <h4 className="font-semibold text-sm text-on-surface line-clamp-2 flex-1 mb-2">{material.title}</h4>
      <p className="text-[11px] text-on-surface-variant uppercase tracking-wide">
        {[teacherName, ft?.toUpperCase(), size].filter(Boolean).join(' · ')}
      </p>
      <div className="flex items-center justify-between mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs text-on-surface-variant">{date}</span>
        <Download size={16} className="text-primary" />
      </div>
    </a>
  )
}
