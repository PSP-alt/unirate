/* ═══════════════════════════════════════════════════
   Компонент StarRating — звёздный рейтинг

   Два режима:
   1. Отображение: показывает заполненные звёзды
      <StarRating value={7.4} max={10} />
   2. Интерактивный: пользователь кликает для оценки
      <StarRating value={score} onChange={setScore} interactive max={10} />

   Поддерживает дробные значения (7.4 из 10 = 3.7 из 5 звёзд)
   ═══════════════════════════════════════════════════ */

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '../../utils/cn'

export default function StarRating({
  value = 0,
  max = 10,
  onChange,
  interactive = false,
  showValue = true,
  size = 20,
  className,
}) {
  const [hoverValue, setHoverValue] = useState(null)

  /* Переводим значение из шкалы max в шкалу 5 звёзд */
  const starCount = 5
  const filledStars = ((hoverValue ?? value) / max) * starCount

  /* Обработчик клика по звезде */
  const handleClick = (starIndex) => {
    if (!interactive || !onChange) return
    /* Переводим индекс звезды обратно в шкалу max */
    const newValue = Math.round(((starIndex + 1) / starCount) * max)
    onChange(newValue)
  }

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      {/* Рисуем 5 звёзд */}
      <div className="flex gap-0.5">
        {Array.from({ length: starCount }).map((_, i) => {
          /* Определяем степень заполнения каждой звезды */
          const fill = Math.min(1, Math.max(0, filledStars - i))

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleClick(i)}
              onMouseEnter={() => interactive && setHoverValue(((i + 1) / starCount) * max)}
              onMouseLeave={() => interactive && setHoverValue(null)}
              className={cn(
                'relative',
                interactive ? 'cursor-pointer' : 'cursor-default',
                'transition-transform duration-150',
                interactive && 'hover:scale-110',
              )}
              disabled={!interactive}
              tabIndex={interactive ? 0 : -1}
            >
              {/* Серая звезда (фон) */}
              <Star
                size={size}
                className="text-gray-200"
                fill="#E5E7EB"
                strokeWidth={0}
              />

              {/* Золотая звезда (заполнение) — обрезается по ширине */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  size={size}
                  className="text-accent-gold"
                  fill="#C5A028"
                  strokeWidth={0}
                />
              </div>
            </button>
          )
        })}
      </div>

      {/* Числовое значение рядом со звёздами */}
      {showValue && (
        <span className="text-sm font-medium text-text-secondary ml-1">
          {Number(value).toFixed(1)} / {max}
        </span>
      )}
    </div>
  )
}
