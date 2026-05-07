/* ═══════════════════════════════════════════════════
   FeatureModal — мини-окно с описанием возможности

   Открывается при клике на карточку в секции
   «Возможности портала» на главной странице.
   ═══════════════════════════════════════════════════ */

import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import Button from '../ui/Button'
import { cn } from '../../utils/cn'

/* Анимации */
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}
const modalVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
}

/* Контент каждой возможности */
const FEATURE_DETAILS = {
  'Учебные материалы': {
    heading: 'Учебные материалы',
    bullets: [
      'Скачивайте методички, лекции, лабораторные работы и справочные пособия',
      'Фильтруйте материалы по курсу, дисциплине и категории',
      'Сохраняйте нужные файлы в закладки для быстрого доступа',
      'Ищите по названию и дисциплине с мгновенной фильтрацией',
      'Преподаватели загружают новые материалы — вы первыми получаете к ним доступ',
    ],
    linkText: 'Перейти к материалам',
    linkTo: '/materials',
  },
  'Рейтинг преподавателей': {
    heading: 'Рейтинг преподавателей',
    bullets: [
      'Оценивайте преподавателей по 6 уникальным критериям (зависят от типа преподавателя)',
      'Смотрите средний балл и детальную разбивку по каждому критерию',
      'Читайте отзывы других студентов перед выбором курса',
      'Каждая оценка выставляется по шкале от 1 до 10 — максимально объективно',
      'Ваша оценка анонимна — преподаватели не видят, кто именно оценил',
    ],
    linkText: 'Смотреть преподавателей',
    linkTo: '/teachers',
  },
  'Личный кабинет': {
    heading: 'Личный кабинет',
    bullets: [
      'Редактируйте свой профиль — имя, фамилию и курс обучения',
      'Отслеживайте статус ваших оценок: на модерации, одобрена или отклонена',
      'Храните избранные материалы в закладках — они всегда под рукой',
      'Преподаватели могут управлять своими материалами и видеть статистику оценок',
      'Безопасный вход через email и пароль с возможностью восстановления',
    ],
    linkText: 'Войти в кабинет',
    linkTo: '/login',
  },
  'Надёжная модерация': {
    heading: 'Надёжная модерация',
    bullets: [
      'Каждый отзыв и оценка проходят проверку администрацией перед публикацией',
      'Отклонённые оценки сопровождаются объяснением причины',
      'Преподаватели сами решают, включить или выключить оценивание',
      'Администраторы следят за качеством контента и объективностью оценок',
      'Только одобренные отзывы влияют на рейтинг преподавателя',
    ],
    linkText: null,
    linkTo: null,
  },
}

export default function FeatureModal({ feature, isOpen, onClose }) {
  if (!feature) return null

  const details = FEATURE_DETAILS[feature.title]
  if (!details) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="bg-white rounded-card shadow-card-hover w-full max-w-lg max-h-[85vh] overflow-y-auto"
          >
            {/* Шапка */}
            <div className="flex items-center gap-4 p-6 pb-4">
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
                  feature.color,
                )}
              >
                <feature.icon size={24} className={feature.iconColor} />
              </div>
              <div className="flex-1">
                <h2 className="font-heading text-xl text-accent-blue">
                  {details.heading}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary transition-colors flex-shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Содержимое */}
            <div className="px-6 pb-6">
              <p className="text-sm text-text-secondary mb-4">
                Что вы можете делать:
              </p>

              <ul className="space-y-3">
                {details.bullets.map((bullet, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-3"
                  >
                    <span
                      className={cn(
                        'mt-1.5 w-2 h-2 rounded-full flex-shrink-0',
                        feature.iconColor === 'text-accent-blue' && 'bg-accent-blue',
                        feature.iconColor === 'text-accent-gold' && 'bg-accent-gold',
                        feature.iconColor === 'text-success' && 'bg-success',
                        feature.iconColor === 'text-error' && 'bg-error',
                      )}
                    />
                    <span className="text-sm text-text-primary leading-relaxed">
                      {bullet}
                    </span>
                  </motion.li>
                ))}
              </ul>

              {/* Кнопка-ссылка */}
              {details.linkTo && (
                <div className="mt-6 pt-4 border-t border-border">
                  <Link to={details.linkTo} onClick={onClose}>
                    <Button className="w-full">
                      {details.linkText}
                      <ArrowRight size={16} />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
