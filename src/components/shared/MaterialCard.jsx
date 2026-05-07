/* ═══════════════════════════════════════════════════
   Компонент MaterialCard — карточка материала (Apple Style)

   Чистый стиль: иконка типа с цветным фоном, заголовок,
   автор, дисциплина, действие скачивания.
   ═══════════════════════════════════════════════════ */

import { Link } from 'react-router-dom'
import { FileText, Download, Bookmark, BookmarkCheck, ArrowRight } from 'lucide-react'

import { useSettings } from '../../context/SettingsContext'
import { cn } from '../../utils/cn'

/* Цвета иконок по типу */
const fileTypeColors = {
  PDF: 'bg-blue-50 text-blue-600',
  DOC: 'bg-orange-50 text-orange-600',
  DOCX: 'bg-orange-50 text-orange-600',
  PPT: 'bg-purple-50 text-purple-600',
  PPTX: 'bg-purple-50 text-purple-600',
  XLS: 'bg-emerald-50 text-emerald-600',
  XLSX: 'bg-emerald-50 text-emerald-600',
}

/* Форматирование размера файла */
function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' Б'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ'
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ'
}

/* Форматирование даты */
function formatDate(timestamp) {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function MaterialCard({
  material,
  isBookmarked = false,
  onBookmark,
  onDownload,
  showAuthor = true,
}) {
  const { t } = useSettings()
  const type = material.fileType || 'PDF'
  const iconColors = fileTypeColors[type] || 'bg-blue-50 text-blue-600'

  return (
    <div className="apple-card rounded-xl p-6 flex flex-col group h-full">
      {/* Header: icon + course + bookmark */}
      <div className="flex justify-between items-start mb-5">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconColors)}>
          <FileText size={20} />
        </div>
        <div className="flex items-center gap-2">
          {material.courses?.map((c) => (
            <span key={c} className="text-[10px] font-bold uppercase tracking-wider text-secondary/50">
              {c === 'all' ? t('mat.allCourses') : t(`course.${c}`) || `${c} курс`}
            </span>
          ))}
          {onBookmark && (
            <button
              onClick={(e) => { e.stopPropagation(); onBookmark(material.id) }}
              className={cn(
                'transition-colors',
                isBookmarked ? 'text-primary' : 'text-outline-variant hover:text-primary',
              )}
            >
              {isBookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        <h3 className="text-[14px] font-bold text-on-surface tracking-tight mb-2 leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {material.title}
        </h3>

        <p className="text-[12px] text-on-surface-variant font-medium mb-1">
          {material.discipline}
        </p>

        {showAuthor && material.teacherName && (
          <Link
            to={`/teachers/${material.teacherId}`}
            className="text-[13px] font-medium text-on-surface/80 hover:text-primary transition-colors block"
            onClick={(e) => e.stopPropagation()}
          >
            {material.teacherName}
          </Link>
        )}
      </div>

      {/* Footer */}
      <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between">
        <span className="text-[13px] font-medium text-on-surface-variant">
          {formatDate(material.createdAt)}
          {material.fileSize ? ` · ${formatFileSize(material.fileSize)}` : ''}
        </span>
        <button
          onClick={() => onDownload?.(material)}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-black/[0.04] dark:bg-white/10 text-on-surface font-bold text-[11px] hover:bg-primary hover:text-white transition-all uppercase tracking-wider"
        >
          <Download size={14} />
          {t('mat.download')}
        </button>
      </div>
    </div>
  )
}
