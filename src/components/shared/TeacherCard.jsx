/* ═══════════════════════════════════════════════════
   Компонент TeacherCard — карточка преподавателя (Apple Style)

   Компактный стиль: квадратный аватар 2xl, verified badge,
   тип/рейтинг справа, дисциплины как pills, кнопка профиля.
   ═══════════════════════════════════════════════════ */

import { Link } from 'react-router-dom'
import { Star, EyeOff, ChevronRight } from 'lucide-react'

import { TEACHER_TYPES } from '../../constants/teacherTypes'
import { useSettings } from '../../context/SettingsContext'

export default function TeacherCard({ teacher }) {
  const { t } = useSettings()
  /* Поддержка нового поля teacherTypes (массив) с fallback на legacy teacherType */
  const typeKeys = teacher.teacherTypes?.length
    ? teacher.teacherTypes
    : [teacher.teacherType || 'universal']
  const primaryType = TEACHER_TYPES[typeKeys[0]] || TEACHER_TYPES.universal
  const extraCount  = typeKeys.length - 1
  const fullName = `${teacher.lastName} ${teacher.firstName} ${teacher.middleName || ''}`.trim()

  const visibleDisciplines = (teacher.disciplines || []).slice(0, 2)
  const hiddenCount = (teacher.disciplines || []).length - 2
  const showRating = teacher.ratingsEnabled && teacher.ratingsCount > 0

  return (
    <Link to={`/teachers/${teacher.id}`} className="block h-full">
      <div className="group bg-surface-container-lowest border border-border rounded-xl p-6 transition-all duration-300 hover:shadow-apple-hover hover:-translate-y-1 flex flex-col h-full">
        {/* Header: avatar + type/rating */}
        <div className="flex items-start justify-between mb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-inner ring-1 ring-black/5 bg-surface-high">
              {teacher.avatarUrl ? (
                <img
                  src={teacher.avatarUrl}
                  alt={fullName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-surface-high">
                  <span className="text-2xl font-heading font-bold text-on-surface-variant/30">
                    {fullName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap gap-1 justify-end">
              <span className="px-2.5 py-1 bg-black/5 dark:bg-white/10 text-[10px] font-bold tracking-wider uppercase text-secondary rounded-full">
                {t(`typeBadge.${primaryType.key}`) || primaryType.label}
              </span>
              {extraCount > 0 && (
                <span className="px-2 py-1 bg-black/5 dark:bg-white/10 text-[10px] font-bold text-secondary rounded-full">
                  +{extraCount}
                </span>
              )}
            </div>
            {showRating ? (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-600 rounded-md">
                <Star size={14} className="fill-current" />
                <span className="text-[11px] font-bold">
                  {Number(teacher.averageRating).toFixed(1)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-surface-high text-secondary rounded-md">
                <EyeOff size={12} />
                <span className="text-[10px] font-bold uppercase">{t('td.ratingsOff')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Name + position */}
        <div className="space-y-1 mb-4">
          <h3 className="font-heading text-xl font-bold text-on-surface leading-tight">
            {fullName}
          </h3>
          <p className="text-xs font-medium text-secondary/70">
            {teacher.position}
          </p>
        </div>

        {/* Discipline tags */}
        {visibleDisciplines.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {visibleDisciplines.map((d) => (
              <span
                key={d}
                className="px-3 py-1 bg-surface border border-border/50 rounded-full text-[11px] font-semibold text-secondary"
              >
                {d}
              </span>
            ))}
            {hiddenCount > 0 && (
              <span className="px-3 py-1 bg-surface border border-border/50 rounded-full text-[11px] font-semibold text-secondary">
                +{hiddenCount}
              </span>
            )}
          </div>
        )}

        {/* Profile button */}
        <div className="mt-auto">
          <div className="flex items-center justify-between group/link py-3 px-4 bg-surface hover:bg-on-surface hover:text-white rounded-lg transition-all duration-200">
            <span className="text-sm font-bold">{t('tp.profile') || 'Профиль'}</span>
            <ChevronRight size={18} className="group-hover/link:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  )
}
