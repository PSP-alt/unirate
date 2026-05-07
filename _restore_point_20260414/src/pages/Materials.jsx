import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getMaterials, incrementDownload } from '../services/materials'
import {
  Search, Download, FileText, Film, FileSpreadsheet,
  Presentation, File, ArrowUpDown, BookOpen, ExternalLink
} from 'lucide-react'

/* ── File type config ── */
const FILE_ICONS = {
  pdf:  { Icon: FileText,        gradient: 'linear-gradient(135deg,#ef4444,#e11d48)', label: 'PDF',  accent: '#ef4444' },
  docx: { Icon: FileText,        gradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', label: 'DOCX', accent: '#3b82f6' },
  doc:  { Icon: FileText,        gradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', label: 'DOC',  accent: '#3b82f6' },
  mp4:  { Icon: Film,            gradient: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', label: 'MP4',  accent: '#8b5cf6' },
  pptx: { Icon: Presentation,    gradient: 'linear-gradient(135deg,#f97316,#ea580c)', label: 'PPTX', accent: '#f97316' },
  xlsx: { Icon: FileSpreadsheet, gradient: 'linear-gradient(135deg,#10b981,#059669)', label: 'XLSX', accent: '#10b981' },
}
function getFileIcon(ft = '') {
  return FILE_ICONS[ft?.toLowerCase()] || { Icon: File, gradient: 'linear-gradient(135deg,#64748b,#475569)', label: ft?.toUpperCase() || 'FILE', accent: '#64748b' }
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = Math.floor((Date.now() - d) / 1000)
  if (diff < 3600)   return `${Math.floor(diff / 60)} мин. назад`
  if (diff < 86400)  return `${Math.floor(diff / 3600)} ч. назад`
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн. назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ── Mock data ── */
const MOCK = [
  { id: 'm1', title: 'Высшая математика: полный курс',              discipline: 'Высшая математика',   teacherName: 'Соколов А. Н.',  fileType: 'pdf',  fileSize: 4194304,  downloadCount: 312, createdAt: { seconds: Date.now()/1000 - 3600 }   },
  { id: 'm2', title: 'Линейная алгебра: матрицы и векторы',         discipline: 'Линейная алгебра',    teacherName: 'Соколов А. Н.',  fileType: 'pdf',  fileSize: 2097152,  downloadCount: 189, createdAt: { seconds: Date.now()/1000 - 86400 }  },
  { id: 'm3', title: 'Алгоритмы и структуры данных',                discipline: 'Алгоритмы',           teacherName: 'Сорокина Н. В.', fileType: 'pdf',  fileSize: 3145728,  downloadCount: 254, createdAt: { seconds: Date.now()/1000 - 7200 }   },
  { id: 'm4', title: 'Python для начинающих: от нуля до первой программы', discipline: 'Программирование', teacherName: 'Сорокина Н. В.', fileType: 'docx', fileSize: 1048576, downloadCount: 421, createdAt: { seconds: Date.now()/1000 - 172800 } },
  { id: 'm5', title: 'Микроэкономика: базовый курс',                discipline: 'Микроэкономика',      teacherName: 'Морозов Д. С.',  fileType: 'pdf',  fileSize: 2621440,  downloadCount: 98,  createdAt: { seconds: Date.now()/1000 - 259200 } },
  { id: 'm6', title: 'Финансовая математика: аннуитеты и NPV',       discipline: 'Финансы',             teacherName: 'Морозов Д. С.',  fileType: 'xlsx', fileSize: 512000,   downloadCount: 67,  createdAt: { seconds: Date.now()/1000 - 432000 } },
  { id: 'm7', title: 'Лекция 5: Квантовая физика',                  discipline: 'Физика',              teacherName: 'Волкова И. П.',  fileType: 'mp4',  fileSize: 524288000,downloadCount: 156, createdAt: { seconds: Date.now()/1000 - 518400 } },
  { id: 'm8', title: 'Базы данных: SQL и реляционная модель',        discipline: 'Базы данных',         teacherName: 'Сорокина Н. В.', fileType: 'docx', fileSize: 1572864,  downloadCount: 203, createdAt: { seconds: Date.now()/1000 - 604800 } },
]

const SORT_OPTIONS = [
  { id: 'newest',  label: 'Новые'      },
  { id: 'popular', label: 'Популярные' },
  { id: 'alphabet',label: 'А–Я'        },
]

const FILE_TYPES = ['all', 'pdf', 'docx', 'mp4', 'pptx', 'xlsx']

export default function Materials() {
  const [materials, setMaterials] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [sort,      setSort]      = useState('newest')
  const [typeFilter,setTypeFilter]= useState('all')
  const [page,      setPage]      = useState(12)

  useEffect(() => {
    getMaterials({ sortBy: sort, pageSize: 100 }).then(({ materials: list }) => {
      setMaterials(list.length > 0 ? list : MOCK)
      setLoading(false)
    })
  }, [sort])

  const filtered = useMemo(() => {
    let list = [...materials]
    if (typeFilter !== 'all') list = list.filter(m => (m.fileType || m.type)?.toLowerCase() === typeFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        m.title?.toLowerCase().includes(q) ||
        m.discipline?.toLowerCase().includes(q) ||
        m.teacherName?.toLowerCase().includes(q)
      )
    }
    if (sort === 'newest')   list.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))
    if (sort === 'popular')  list.sort((a,b) => (b.downloadCount||0) - (a.downloadCount||0))
    if (sort === 'alphabet') list.sort((a,b) => (a.title||'').localeCompare(b.title||'', 'ru'))
    return list
  }, [materials, search, typeFilter, sort])

  const shown = filtered.slice(0, page)

  /* Unique disciplines for stats */
  const disciplines = [...new Set(materials.map(m => m.discipline).filter(Boolean))]
  const totalDownloads = materials.reduce((s,m) => s + (m.downloadCount||0), 0)

  return (
    <div className="min-h-screen bg-[#f8f8fa]">

      {/* ══ HERO ══ */}
      <section className="relative bg-[#002366] overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, #ccff00 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#ccff00] opacity-10 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 md:px-12 pt-32 pb-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-[#ccff00]/15 flex items-center justify-center">
              <BookOpen size={20} className="text-[#ccff00]" />
            </div>
            <span className="text-[#ccff00] text-xs font-bold tracking-widest uppercase">Учебная база</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white font-headline mb-3">
            Учебные материалы
          </h1>
          <p className="text-white/60 text-base max-w-xl">
            Конспекты, методички, видеолекции и задачники от преподавателей СПБГУПТД
          </p>

          {/* Search */}
          <form onSubmit={e => e.preventDefault()} className="mt-8 max-w-2xl">
            <div className="relative flex items-center bg-white rounded-2xl overflow-hidden shadow-navy">
              <Search className="absolute left-5 text-slate-400" size={20} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(12) }}
                className="w-full bg-transparent py-4 pl-14 pr-5 focus:outline-none text-on-surface placeholder:text-slate-400 text-base"
                placeholder="Название, дисциплина, преподаватель..."
              />
            </div>
          </form>

          {/* Stats */}
          <div className="flex flex-wrap gap-8 mt-10">
            {[
              { label: 'Материалов',  value: materials.length || '...' },
              { label: 'Дисциплин',   value: disciplines.length || '...' },
              { label: 'Скачиваний',  value: totalDownloads > 0 ? `${totalDownloads}+` : '...' },
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
          {/* File type */}
          <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200/60 overflow-x-auto">
            {FILE_TYPES.map(t => (
              <button key={t} onClick={() => { setTypeFilter(t); setPage(12) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  typeFilter === t
                    ? 'bg-[#002366] text-white'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}>
                {t === 'all' ? 'Все форматы' : t.toUpperCase()}
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

          <span className="text-xs text-on-surface-variant hidden sm:block">
            {filtered.length} материалов
          </span>
        </div>
      </div>

      {/* ══ GRID ══ */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-10">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({length:8}).map((_,i) => (
              <div key={i} className="bg-white rounded-3xl p-5 animate-pulse border border-slate-100">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl mb-4" />
                <div className="h-4 bg-slate-100 rounded w-full mb-2" />
                <div className="h-3 bg-slate-100 rounded w-2/3 mb-4" />
                <div className="h-8 bg-slate-100 rounded-xl mt-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
              <BookOpen size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-on-surface mb-2">Материалы не найдены</h3>
            <p className="text-on-surface-variant text-sm mb-5">Попробуйте изменить поиск или фильтры</p>
            <button onClick={() => { setSearch(''); setTypeFilter('all'); setPage(12) }}
              className="px-5 py-2.5 bg-[#002366] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a7a] transition-colors">
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {shown.map((m, i) => (
                <div key={m.id || i} className="animate-fade-up" style={{ animationDelay: `${(i % 12) * 60}ms` }}>
                  <MaterialCard material={m} />
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

/* ── Material Card ── */
function MaterialCard({ material }) {
  const { Icon, gradient, label, accent } = getFileIcon(material.fileType || material.type)
  const isVideo = material.fileType?.toLowerCase() === 'mp4'

  async function handleDownload() {
    if (material.id && !material.id.startsWith('m')) incrementDownload(material.id)
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden group">

      {/* ── Cover ── */}
      <div className="relative h-[100px] flex items-center px-5 overflow-hidden flex-shrink-0" style={{ background: gradient }}>
        {/* Subtle dot grid */}
        <div className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        {/* Large icon */}
        <div className="relative w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
          <Icon size={26} className="text-white" />
        </div>
        {/* Type badge top-right */}
        <span className="absolute top-3.5 right-4 text-[10px] font-bold text-white/80 bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full tracking-wide">
          {label}
        </span>
        {/* Glow blob */}
        <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-white opacity-10 blur-2xl" />
      </div>

      {/* ── Body ── */}
      <div className="p-4 flex flex-col flex-1">
        {/* Discipline pill */}
        {material.discipline && (
          <span className="self-start text-[10px] font-semibold px-2.5 py-0.5 rounded-full mb-2.5"
            style={{ background: `${accent}18`, color: accent }}>
            {material.discipline}
          </span>
        )}

        {/* Title */}
        <h3 className="font-semibold text-sm text-on-surface leading-snug line-clamp-2 mb-3 font-headline flex-1">
          {material.title}
        </h3>

        {/* Teacher */}
        {material.teacherName && (
          <p className="text-[11px] text-on-surface-variant truncate mb-3">
            {material.teacherName}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-auto">
          <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
            {material.fileSize && <span>{formatSize(material.fileSize)}</span>}
            {material.downloadCount > 0 && (
              <span className="flex items-center gap-1">
                <Download size={11} />
                {material.downloadCount}
              </span>
            )}
          </div>

          {material.fileUrl ? (
            <a href={material.fileUrl} target="_blank" rel="noreferrer" onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-white text-[11px] font-bold rounded-xl transition-all hover:opacity-90"
              style={{ background: accent }}>
              {isVideo ? <ExternalLink size={11} /> : <Download size={11} />}
              {isVideo ? 'Смотреть' : 'Скачать'}
            </a>
          ) : (
            <span className="text-[11px] text-slate-300 italic">Нет файла</span>
          )}
        </div>
      </div>
    </div>
  )
}
