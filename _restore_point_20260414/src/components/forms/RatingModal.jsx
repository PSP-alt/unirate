/* ═══════════════════════════════════════════════════
   RatingModal — модальное окно оценки преподавателя

   Отображает критерии в зависимости от типа
   преподавателя. Каждый критерий оценивается
   от 1 до 10. Внизу — текстовый комментарий.
   Отправляет данные на модерацию.
   ═══════════════════════════════════════════════════ */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

import Button from '../ui/Button'
import { Textarea } from '../ui/Input'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { createRating } from '../../services/ratings'
import { updateTeacherRating } from '../../services/teachers'
import { getApprovedRatings } from '../../services/ratings'
import { RATING_CRITERIA } from '../../utils/ratingCriteria'
import { cn } from '../../utils/cn'

/* Анимации модалки */
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}
const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
}

export default function RatingModal({ teacher, isOpen, onClose, onSuccess }) {
  const { user, userData } = useAuth()
  const { t } = useSettings()

  /* Оценки по каждому критерию: { key: number } */
  const [scores, setScores] = useState({})
  /* Текст комментария */
  const [comment, setComment] = useState('')
  /* Состояние отправки */
  const [isSubmitting, setIsSubmitting] = useState(false)
  /* Успешная отправка */
  const [submitted, setSubmitted] = useState(false)

  /* Критерии для данного типа преподавателя */
  const criteria = RATING_CRITERIA[teacher?.teacherType] || RATING_CRITERIA.universal

  /* Сброс формы при открытии */
  useEffect(() => {
    if (isOpen) {
      setScores({})
      setComment('')
      setSubmitted(false)
    }
  }, [isOpen])

  /* Средняя оценка (обновляется при изменении критериев) */
  const scoreValues = Object.values(scores)
  const averageScore =
    scoreValues.length > 0
      ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
      : 0

  /* Все ли критерии заполнены */
  const allCriteriaFilled = scoreValues.length === criteria.length

  /* Комментарий достаточной длины */
  const commentValid = comment.trim().length >= 30

  /* ── Установить оценку по критерию ── */
  const setScore = (key, value) => {
    setScores((prev) => ({ ...prev, [key]: value }))
  }

  /* ── Отправка ── */
  const handleSubmit = async () => {
    if (!allCriteriaFilled) {
      toast.error(t('rm.allCriteria'))
      return
    }
    if (!commentValid) {
      toast.error(t('rm.commentMin'))
      return
    }

    setIsSubmitting(true)
    try {
      /* 1. Создаём оценку */
      const { error } = await createRating({
        teacherId: teacher.id,
        studentId: user.uid,
        criteriaScores: scores,
        averageScore: Number(averageScore.toFixed(1)),
        comment: comment.trim(),
        studentCourse: userData?.course || 0,
      })

      if (error) {
        toast.error(error)
        return
      }

      /* 2. Пересчитываем средний рейтинг преподавателя
            (учитываем только одобренные + новая на модерации) */
      const { ratings: approved } = await getApprovedRatings(teacher.id)
      const allScores = [...approved.map((r) => r.averageScore), averageScore]
      const newAvg = allScores.reduce((a, b) => a + b, 0) / allScores.length

      await updateTeacherRating(
        teacher.id,
        Number(newAvg.toFixed(1)),
        allScores.length,
      )

      setSubmitted(true)
      if (onSuccess) onSuccess()
    } catch {
      toast.error('Произошла ошибка')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        /* ═══ OVERLAY ═══ */
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          {/* ═══ МОДАЛЬНОЕ ОКНО ═══ */}
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="bg-white rounded-card shadow-card-hover w-full max-w-xl max-h-[90vh] overflow-y-auto"
          >
            {submitted ? (
              /* ═══ ЭКРАН УСПЕХА ═══ */
              <div className="p-10 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', duration: 0.5 }}
                >
                  <CheckCircle size={64} className="mx-auto text-success mb-4" />
                </motion.div>
                <h2 className="font-heading text-2xl text-accent-blue mb-2">
                  {t('rm.successTitle')}
                </h2>
                <p className="text-text-secondary mb-6">
                  {t('rm.successDesc')}
                </p>
                <Button onClick={onClose}>{t('rm.close')}</Button>
              </div>
            ) : (
              /* ═══ ФОРМА ОЦЕНКИ ═══ */
              <>
                {/* Шапка */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                  <div>
                    <h2 className="font-heading text-xl text-accent-blue">
                      {t('rm.title')}
                    </h2>
                    <p className="text-sm text-text-secondary mt-0.5">
                      {teacher?.lastName} {teacher?.firstName} {teacher?.middleName || ''}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Критерии */}
                <div className="p-6 space-y-6">
                  {criteria.map((c) => (
                    <div key={c.key}>
                      {/* Название критерия */}
                      <p className="text-sm font-medium text-text-primary mb-1">
                        {c.label}
                      </p>
                      {/* Подсказка */}
                      <p className="text-xs text-text-secondary mb-2.5">
                        {c.hint}
                      </p>
                      {/* Шкала 1-10 */}
                      <div className="flex gap-1.5">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setScore(c.key, num)}
                            className={cn(
                              'w-9 h-9 rounded-lg text-sm font-semibold transition-all',
                              'border flex items-center justify-center',
                              scores[c.key] === num
                                ? 'bg-accent-gold text-white border-accent-gold shadow-md scale-110'
                                : scores[c.key] > num
                                  ? 'bg-accent-gold/10 text-accent-gold border-accent-gold/30'
                                  : 'bg-gray-50 text-text-secondary border-border hover:border-accent-gold hover:text-accent-gold',
                            )}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Средняя оценка */}
                  {scoreValues.length > 0 && (
                    <div className="bg-accent-blue-light rounded-lg p-4 text-center">
                      <p className="text-sm text-text-secondary mb-1">
                        {t('rm.avgScore')}
                      </p>
                      <span className="text-3xl font-bold text-accent-blue font-body">
                        {averageScore.toFixed(1)}
                      </span>
                      <span className="text-lg text-text-secondary ml-1">/ 10</span>
                    </div>
                  )}

                  {/* Комментарий */}
                  <div>
                    <Textarea
                      label={t('rm.comment')}
                      placeholder={t('rm.commentPlaceholder')}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <div className="flex justify-between mt-1.5">
                      <span className={cn(
                        'text-xs',
                        commentValid ? 'text-success' : 'text-text-secondary',
                      )}>
                        {comment.trim().length}/30 {commentValid ? '✓' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Предупреждение */}
                  <div className="flex items-start gap-2 bg-[#FFF8E1] border border-accent-gold/20 rounded-lg p-3">
                    <AlertTriangle size={16} className="text-accent-gold mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-text-primary">
                      {t('rm.warning')}
                    </p>
                  </div>
                </div>

                {/* Кнопки */}
                <div className="flex gap-3 p-6 border-t border-border">
                  <Button variant="secondary" onClick={onClose} className="flex-1">
                    {t('rm.cancel')}
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !allCriteriaFilled || !commentValid}
                    className="flex-1"
                  >
                    {isSubmitting ? t('rm.submitting') : t('rm.submit')}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
