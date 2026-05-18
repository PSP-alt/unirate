import { useState, useEffect, useMemo } from 'react'
import { subscribeToMaterials, incrementDownload } from '../services/materials'
import { addBookmark, removeBookmark, getBookmarks } from '../services/bookmarks'
import { useAuth } from '../context/AuthContext'
import {
  Search, Download, FileText, Film, FileSpreadsheet,
  Presentation, File, BookOpen, ExternalLink, Bookmark, BookmarkCheck
} from 'lucide-react'

/* ════════════════════════════════════════════════════════════
   UNIRATE · Материалы
   Тёмная тема, rust-акценты, без ярких цветных обложек.
════════════════════════════════════════════════════════════ */

const FILE_ICONS = {
  pdf:  { Icon: FileText,         label: 'PDF'  },
  docx: { Icon: FileText,         label: 'DOC'  },
  doc:  { Icon: FileText,         label: 'DOC'  },
  mp4:  { Icon: Film,             label: 'VID'  },
  pptx: { Icon: Presentation,     label: 'PPT'  },
  xlsx: { Icon: FileSpreadsheet,  label: 'XLS'  },
}
function getFileIcon(ft = '') {
  return FILE_ICONS[ft?.toLowerCase()] || { Icon: File, label: ft?.toUpperCase() || 'FILE' }
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
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

const SORT_OPTIONS = [
  { id: 'newest',  label: 'Новые'      },
  { id: 'popular', label: 'Популярные' },
  { id: 'alphabet',label: 'А–Я'        },
]

const FILE_TYPES = [
  { id: 'all',  label: 'Все форматы' },
  { id: 'pdf',  label: 'PDF'  },
  { id: 'docx', label: 'DOC'  },
  { id: 'mp4',  label: 'VID'  },
  { id: 'pptx', label: 'PPT'  },
  { id: 'xlsx', label: 'XLS'  },
]

export default function Materials() {
  const { user, userData } = useAuth()
  const isStudent = userData?.role === 'student'

  const [materials,  setMaterials]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [sort,       setSort]       = useState('newest')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page,       setPage]       = useState(12)
  const [bookmarked, setBookmarked] = useState(new Set()) // Set<materialId>
  const [bmLoading,  setBmLoading]  = useState(new Set()) // ids в процессе

  useEffect(() => {
    setLoading(true)
    const unsub = subscribeToMaterials((list) => {
      setMaterials(list)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  /* Загружаем закладки студента */
  useEffect(() => {
    if (!user || !isStudent) return
    getBookmarks(user.uid).then(({ bookmarkIds }) => {
      setBookmarked(new Set(bookmarkIds || []))
    })
  }, [user, isStudent])

  async function toggleBookmark(materialId) {
    if (!user || !isStudent) return
    if (bmLoading.has(materialId)) return
    setBmLoading(prev => new Set(prev).add(materialId))

    const alreadySaved = bookmarked.has(materialId)
    /* Оптимистичное обновление */
    setBookmarked(prev => {
      const next = new Set(prev)
      alreadySaved ? next.delete(materialId) : next.add(materialId)
      return next
    })

    const { error } = alreadySaved
      ? await removeBookmark(user.uid, materialId)
      : await addBookmark(user.uid, materialId)

    if (error) {
      /* Откат при ошибке */
      setBookmarked(prev => {
        const next = new Set(prev)
        alreadySaved ? next.add(materialId) : next.delete(materialId)
        return next
      })
    }

    setBmLoading(prev => { const next = new Set(prev); next.delete(materialId); return next })
  }

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

  const disciplines    = [...new Set(materials.map(m => m.discipline).filter(Boolean))]
  const totalDownloads = materials.reduce((s,m) => s + (m.downloadCount||0), 0)

  return (
    <div className="min-h-screen bg-[#1A1613] text-[#E6D9C9]">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-[var(--color-rust)]/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 md:px-12 pt-24 pb-16">
          <div className="label-eyebrow mb-6">Учебная база · Поделиться знанием</div>

          <h1 className="font-display text-[36px] sm:text-[48px] md:text-[72px] leading-[1.0] tracking-[-0.02em] text-[#F4EBDB] mb-8">
            <span className="italic text-[var(--color-rust)]">Материалы</span>{' '}
            <span className="sm:block">для глубокого чтения.</span>
          </h1>

          <p className="text-[15px] leading-relaxed text-[#B8A999] max-w-lg mb-10">
            Конспекты, методички, видеолекции и задачники. Всё — от преподавателей платформы, которые делятся своим курсом открыто.
          </p>

          {/* Search */}
          <form onSubmit={e => e.preventDefault()} className="max-w-2xl">
            <div className="relative flex items-center bg-[#24201C] border border-[#3A322A] rounded-full overflow-hidden focus-within:border-[var(--color-rust-soft)] transition-colors">
              <Search className="absolute left-5 text-[#8B827A]" size={18} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(12) }}
                className="w-full bg-transparent py-4 pl-14 pr-5 focus:outline-none text-[#F4EBDB] placeholder:text-[#8B827A] text-[14px]"
                placeholder="Название, дисциплина, преподаватель..."
              />
            </div>
          </form>

          {/* Stats */}
          <div className="flex flex-wrap gap-10 mt-12">
            {[
              { value: materials.length || '—',                                                                label: 'материалов' },
              { value: disciplines.length || '—',                                                              label: 'дисциплин' },
              { value: totalDownloads > 0 ? totalDownloads.toLocaleString('ru-RU').replace(/,/g, ' ') : '—',  label: 'скачиваний', accent: true },
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
            {FILE_TYPES.map(t => (
              <button key={t.id} onClick={() => { setTypeFilter(t.id); setPage(12) }}
                className={`px-3 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors ${
                  typeFilter === t.id
                    ? 'bg-[var(--color-rust)] text-[#FFFDF7]'
                    : 'text-[#B8A999] hover:text-[#F4EBDB]'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="hidden sm:block flex-1" />

          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1 p-1 bg-[#24201C] rounded-full border border-[#3A322A]">
              {SORT_OPTIONS.map(s => (
                <button key={s.id} onClick={() => setSort(s.id)}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors ${
                    sort === s.id
                      ? 'bg-[var(--color-rust)] text-[#FFFDF7]'
                      : 'text-[#B8A999] hover:text-[#F4EBDB]'
                  }`}>
                  {s.label}
                </button>
              ))}
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
              <div key={i} className="rounded-[24px] bg-[#24201C] border border-[#3A322A] p-6 h-[200px] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-full bg-[#24201C] flex items-center justify-center mx-auto mb-5 border border-[#3A322A]">
              <BookOpen size={28} className="text-[#8B827A]" />
            </div>
            <h3 className="font-display italic text-[28px] text-[#F4EBDB] mb-2">Ничего не найдено</h3>
            <p className="text-[#B8A999] text-[14px]">Попробуйте изменить поиск или фильтры</p>
            <button onClick={() => { setSearch(''); setTypeFilter('all'); setPage(12) }}
              className="mt-6 px-6 py-3 bg-[var(--color-rust)] text-[#FFFDF7] text-[13px] font-semibold rounded-full hover:bg-[#C55830] transition-colors">
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {shown.map((m, i) => (
                <div key={m.id || i} className="animate-fade-up" style={{ animationDelay: `${(i % 12) * 50}ms` }}>
                  <MaterialCard
                    material={m}
                    isBookmarked={bookmarked.has(m.id)}
                    onBookmark={isStudent ? () => toggleBookmark(m.id) : null}
                    bmPending={bmLoading.has(m.id)}
                  />
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

/* ── Карточка материала ── */
function MaterialCard({ material, isBookmarked = false, onBookmark = null, bmPending = false }) {
  const { Icon, label } = getFileIcon(material.fileType || material.type)
  const isVideo = material.fileType?.toLowerCase() === 'mp4'

  async function handleDownload() {
    /* Мок-IDs имеют вид m1, m2, mat-1 (короткие, регулярные) — а
       Firestore auto-IDs всегда длиной 20 символов. Используем длину,
       а не startsWith('m'): раньше реальный материал с id вроде
       'mWzKr2…' молча не считал скачивания. */
    if (material.id && material.id.length >= 20) {
      incrementDownload(material.id)
    }
  }

  return (
    <div className="group rounded-[24px] bg-[#24201C] border border-[#3A322A] p-6 hover:border-[var(--color-rust-soft)] transition-colors flex flex-col h-full">
      {/* Top row: type icon + label + bookmark */}
      <div className="flex items-start justify-between mb-5">
        <div className="w-11 h-11 rounded-full bg-[#1A1613] border border-[#3A322A] flex items-center justify-center flex-shrink-0 group-hover:border-[var(--color-rust)] transition-colors">
          <Icon size={18} className="text-[var(--color-rust-soft)]" strokeWidth={1.5} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--color-rust)]">
            {label}
          </span>
          {onBookmark && (
            <button
              onClick={e => { e.stopPropagation(); onBookmark() }}
              disabled={bmPending}
              title={isBookmarked ? 'Убрать из закладок' : 'В закладки'}
              className="p-1 rounded-lg transition-colors disabled:opacity-50"
            >
              {isBookmarked
                ? <BookmarkCheck size={16} className="text-[var(--color-rust)]" />
                : <Bookmark size={16} className="text-[#6B625A] hover:text-[var(--color-rust-soft)]" />
              }
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="font-display text-[20px] leading-tight text-[#F4EBDB] mb-3 line-clamp-2 flex-1">
        {material.title || 'Без названия'}
      </h3>

      {/* Teacher & discipline */}
      <div className="mb-5">
        {material.teacherName && (
          <p className="text-[12px] text-[#E6D9C9] mb-1">{material.teacherName}</p>
        )}
        {material.discipline && (
          <p className="text-[11px] tracking-[0.15em] uppercase text-[#8B827A]">{material.discipline}</p>
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-[#3A322A] flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-[#8B827A]">
          {material.fileSize && <span>{formatSize(material.fileSize)}</span>}
          {material.downloadCount > 0 && (
            <span className="flex items-center gap-1">
              <Download size={11} />
              {material.downloadCount}
            </span>
          )}
          {material.createdAt && <span>{formatDate(material.createdAt)}</span>}
        </div>

        {material.fileUrl ? (
          <a href={material.fileUrl} target="_blank" rel="noreferrer" onClick={handleDownload}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--color-rust)] text-[#FFFDF7] text-[11px] font-semibold rounded-full hover:bg-[#C55830] transition-colors">
            {isVideo ? <ExternalLink size={11} /> : <Download size={11} />}
            {isVideo ? 'Смотреть' : 'Скачать'}
          </a>
        ) : (
          <span className="text-[11px] text-[#8B827A] italic">Нет файла</span>
        )}
      </div>
    </div>
  )
}
