/* ═══════════════════════════════════════════════════
   Компонент Input — текстовое поле ввода

   Поддерживает: label, ошибку валидации, иконку.
   Работает с react-hook-form через forwardRef.
   ═══════════════════════════════════════════════════ */

import { forwardRef } from 'react'
import { cn } from '../../utils/cn'

const Input = forwardRef(function Input(
  {
    label,
    error,
    icon: Icon,
    className,
    type = 'text',
    ...props
  },
  ref,
) {
  return (
    <div className="w-full">
      {/* Подпись поля */}
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        {/* Иконка слева (если передана) */}
        {Icon && (
          <Icon
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
          />
        )}

        <input
          ref={ref}
          type={type}
          className={cn(
            'w-full',
            'bg-bg-card',
            'border border-border rounded-[8px]',
            'px-3.5 py-2.5',
            'text-text-primary text-base font-body',
            'placeholder:text-text-secondary/60',
            'transition-all duration-200',
            /* Стиль при фокусе */
            'focus:outline-none focus:border-accent-blue focus:ring-[3px] focus:ring-accent-blue/10',
            /* Если есть иконка — добавляем отступ слева */
            Icon && 'pl-10',
            /* Стиль при ошибке */
            error && 'border-error focus:border-error focus:ring-error/10',
            className,
          )}
          {...props}
        />
      </div>

      {/* Текст ошибки */}
      {error && (
        <p className="mt-1 text-sm text-error">{error}</p>
      )}
    </div>
  )
})

export default Input

/* ═══════════════════════════════════════════════════
   Компонент Textarea — многострочное поле ввода
   ═══════════════════════════════════════════════════ */

export const Textarea = forwardRef(function Textarea(
  { label, error, className, ...props },
  ref,
) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-1.5">
          {label}
        </label>
      )}

      <textarea
        ref={ref}
        className={cn(
          'w-full',
          'bg-bg-card',
          'border border-border rounded-[8px]',
          'px-3.5 py-2.5',
          'text-text-primary text-base font-body',
          'placeholder:text-text-secondary/60',
          'transition-all duration-200',
          'focus:outline-none focus:border-accent-blue focus:ring-[3px] focus:ring-accent-blue/10',
          'resize-y min-h-[100px]',
          error && 'border-error focus:border-error focus:ring-error/10',
          className,
        )}
        {...props}
      />

      {error && (
        <p className="mt-1 text-sm text-error">{error}</p>
      )}
    </div>
  )
})

/* ═══════════════════════════════════════════════════
   Компонент Select — выпадающий список
   ═══════════════════════════════════════════════════ */

export const Select = forwardRef(function Select(
  { label, error, children, className, ...props },
  ref,
) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-text-primary mb-1.5">
          {label}
        </label>
      )}

      <select
        ref={ref}
        className={cn(
          'w-full',
          'border border-border rounded-[8px]',
          'px-3.5 py-2.5',
          'text-text-primary text-base font-body',
          'bg-bg-card',
          'transition-all duration-200',
          'focus:outline-none focus:border-accent-blue focus:ring-[3px] focus:ring-accent-blue/10',
          'cursor-pointer',
          error && 'border-error focus:border-error focus:ring-error/10',
          className,
        )}
        {...props}
      >
        {children}
      </select>

      {error && (
        <p className="mt-1 text-sm text-error">{error}</p>
      )}
    </div>
  )
})
