/* ═══════════════════════════════════════════════════
   Страница загрузки материала — /materials/upload

   Доступна только авторизованным преподавателям.
   Загружает файл в Firebase Storage, создаёт документ
   в коллекции materials в Firestore.
   ═══════════════════════════════════════════════════ */

import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { uploadFile, createMaterial } from '../services/materials'
import {
  ArrowLeft, Upload, X, CheckCircle, AlertCircle,
  BookOpen, GraduationCap, Paperclip,
} from 'lucide-react'

/* ── Допустимые типы файлов ── */
const ACCEPT = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png', 'image/jpeg', 'image/webp',
  'text/plain',
  'video/mp4', 'video/webm', 'video/x-msvideo',
].join(',')

const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

const CATEGORIES = [
  { value: 'lecture',    label: 'Лекция' },
  { value: 'seminar',    label: 'Семинар' },
  { value: 'lab',        label: 'Лабораторная' },
  { value: 'task',       label: 'Задание / Контрольная' },
  { value: 'exam',       label: 'Экзамен / Зачёт' },
  { value: 'methodical', label: 'Методичка' },
  { value: 'other',      label: 'Другое' },
]

const COURSE_OPTIONS = [
  { value: '1',   label: '1 курс' },
  { value: '2',   label: '2 курс' },
  { value: '3',   label: '3 курс' },
  { value: '4',   label: '4 курс' },
  { value: 'all', label: 'Все курсы' },
]

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function getFileIcon(type = '') {
  if (type.includes('pdf'))           return '📄'
  if (type.includes('word') || type.includes('wordprocessing')) return '📝'
  if (type.includes('excel') || type.includes('spreadsheet'))   return '📊'
  if (type.includes('powerpoint') || type.includes('presentation')) return '📑'
  if (type.includes('image'))         return '🖼️'
  if (type.includes('video'))         return '🎥'
  if (type.includes('text'))          return '📃'
  return '📎'
}

export default function MaterialUpload() {
  const { user, userData } = useAuth()
  const navigate = useNavigate()

  /* ── Поля формы ── */
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [category,    setCategory]    = useState('lecture')
  const [discipline,  setDiscipline]  = useState('')
  const [courses,     setCourses]     = useState([])
  const [file,        setFile]        = useState(null)

  /* ── Состояние загрузки ── */
  const [uploading,   setUploading]   = useState(false)
  const [progress,    setProgress]    = useState(0)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState(false)
  const [dragOver,    setDragOver]    = useState(false)

  const fileRef = useRef()

  /* ── Выбор / смена файла ── */
  function pickFile(f) {
    setError('')
    if (!f) return
    if (f.size > MAX_SIZE) {
      setError(`Файл слишком большой. Максимум — ${formatBytes(MAX_SIZE)}`)
      return
    }
    setFile(f)
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    pickFile(e.dataTransfer.files?.[0])
  }, [])

  /* ── Переключение курса ── */
  function toggleCourse(value) {
    if (value === 'all') {
      setCourses(prev => prev.includes('all') ? [] : ['all'])
    } else {
      setCourses(prev => {
        const next = prev.filter(v => v !== 'all')
        return next.includes(value)
          ? next.filter(v => v !== value)
          : [...next, value]
      })
    }
  }

  /* ── Отправка формы ── */
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!title.trim())        return setError('Укажите название материала')
    if (!discipline.trim())   return setError('Укажите дисциплину')
    if (courses.length === 0) return setError('Выберите хотя бы один курс')
    if (!file)                return setError('Прикрепите файл')
    if (!user)                return setError('Не авторизован')

    setUploading(true)
    setProgress(0)

    try {
      const safeName    = file.name.replace(/[^a-zA-Z0-9._\-а-яёА-ЯЁ ]/g, '_')
      const storagePath = `materials/${user.uid}/${Date.now()}_${safeName}`

      /* 1. Загружаем файл в Storage */
      const fileUrl = await uploadFile(file, storagePath, (pct) => {
        setProgress(Math.round(pct))
      })

      /* 2. Сохраняем метаданные в Firestore */
      const teacherName = userData
        ? [userData.firstName, userData.lastName].filter(Boolean).join(' ') || userData.email
        : 'Преподаватель'

      const { error: fsErr } = await createMaterial({
        title:       title.trim(),
        description: description.trim(),
        category,
        discipline:  discipline.trim(),
        courses:     courses.includes('all') ? ['all'] : courses,
        teacherId:   user.uid,
        teacherName,
        fileUrl,
        fileName:    file.name,
        fileSize:    file.size,
        fileType:    file.type,
      })

      if (fsErr) throw new Error(fsErr)

      setSuccess(true)
    } catch (err) {
      console.error('[MaterialUpload] code:', err.code, 'message:', err.message)
      const msg = (() => {
        switch (err.code) {
          case 'storage/unauthorized':
            return 'Нет прав на загрузку файлов. Убедитесь, что Firebase Storage Rules опубликованы в Firebase Console (Storage → Rules).'
          case 'storage/canceled':
            return 'Загрузка отменена.'
          case 'storage/quota-exceeded':
            return 'Превышена квота Firebase Storage.'
          case 'storage/invalid-checksum':
            return 'Файл повреждён при передаче. Попробуйте ещё раз.'
          case 'storage/retry-limit-exceeded':
            return 'Превышен лимит попыток. Проверьте интернет-соединение.'
          case 'storage/timeout':
            return err.message
          default:
            return err.message || 'Не удалось загрузить материал'
        }
      })()
      setError(msg)
    } finally {
      setUploading(false)
    }
  }

  /* ── Экран успеха ── */
  if (success) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-ok)]/15 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={32} className="text-[var(--color-ok)]" />
          </div>
          <h2 className="font-display text-2xl font-bold text-[var(--color-ink)] mb-2">
            Материал загружен!
          </h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-8">
            Файл успешно добавлен в библиотеку и теперь доступен студентам.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/teachers/${user?.uid}`)}
              className="flex-1 py-3 bg-[var(--color-rust)] text-[var(--color-paper)] text-sm font-semibold rounded-xl hover:brightness-95 transition-all"
            >
              Мой профиль
            </button>
            <button
              onClick={() => {
                setSuccess(false)
                setTitle(''); setDescription(''); setDiscipline('')
                setCourses([]); setFile(null); setProgress(0)
              }}
              className="flex-1 py-3 border border-[var(--color-sepia)] text-[var(--color-ink)] text-sm font-semibold rounded-xl hover:bg-[var(--color-paper-2)] transition-all"
            >
              Ещё один
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Классы ── */
  const cardCls = "bg-[var(--color-paper)] rounded-2xl p-5 border border-[var(--color-sepia)]"
  const inputCls = "w-full px-4 py-3 rounded-xl bg-[var(--color-paper-2)] border border-[var(--color-sepia)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/60 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-rust)]/20 focus:border-[var(--color-rust)]/50 transition-all"
  const labelCls = "block text-[11px] font-semibold text-[var(--color-muted)] mb-1.5 uppercase tracking-widest"

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">

        {/* ── Шапка ── */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-[var(--color-paper)] border border-[var(--color-sepia)] flex items-center justify-center hover:bg-[var(--color-paper-2)] transition-colors"
          >
            <ArrowLeft size={18} className="text-[var(--color-ink)]" />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold text-[var(--color-ink)]">
              Загрузить материал
            </h1>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              Добавьте учебный материал для студентов
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Название ── */}
          <div className={cardCls}>
            <label className={labelCls}>Название материала *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={inputCls}
              placeholder="Например: Лекция 5 — Методы машинного обучения"
              maxLength={200}
              disabled={uploading}
            />
            <p className="text-[11px] text-[var(--color-muted)] mt-1.5 text-right">
              {title.length}/200
            </p>
          </div>

          {/* ── Тип + Дисциплина ── */}
          <div className={`${cardCls} grid grid-cols-1 sm:grid-cols-2 gap-4`}>
            <div>
              <label className={labelCls}>
                <BookOpen size={10} className="inline mr-1 opacity-70" />
                Тип материала *
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                disabled={uploading}
                className={inputCls + ' cursor-pointer'}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                <GraduationCap size={10} className="inline mr-1 opacity-70" />
                Дисциплина *
              </label>
              <input
                value={discipline}
                onChange={e => setDiscipline(e.target.value)}
                className={inputCls}
                placeholder="Математический анализ"
                maxLength={100}
                disabled={uploading}
              />
            </div>
          </div>

          {/* ── Курсы ── */}
          <div className={cardCls}>
            <label className={labelCls}>Для каких курсов *</label>
            <div className="flex flex-wrap gap-2">
              {COURSE_OPTIONS.map(c => {
                const active = courses.includes(c.value)
                return (
                  <button
                    key={c.value}
                    type="button"
                    disabled={uploading}
                    onClick={() => toggleCourse(c.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      active
                        ? 'bg-[var(--color-rust)] text-[var(--color-paper)] border-[var(--color-rust)]'
                        : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] border-[var(--color-sepia)] hover:border-[var(--color-rust)]/40 hover:text-[var(--color-ink)]'
                    }`}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Описание ── */}
          <div className={cardCls}>
            <label className={labelCls}>
              Описание{' '}
              <span className="normal-case font-normal tracking-normal text-[var(--color-muted)]/70">
                (необязательно)
              </span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              disabled={uploading}
              className={inputCls + ' resize-none'}
              placeholder="Кратко опишите содержание материала..."
            />
            <p className="text-[11px] text-[var(--color-muted)] mt-1 text-right">
              {description.length}/1000
            </p>
          </div>

          {/* ── Файл ── */}
          <div className={cardCls}>
            <label className={labelCls}>
              <Paperclip size={10} className="inline mr-1 opacity-70" />
              Файл *
            </label>

            {file ? (
              /* Файл выбран */
              <div className="flex items-center gap-3 p-3 bg-[var(--color-paper-2)] rounded-xl border border-[var(--color-sepia)]">
                <span className="text-xl flex-shrink-0">{getFileIcon(file.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-ink)] truncate">{file.name}</p>
                  <p className="text-[11px] text-[var(--color-muted)] mt-0.5">{formatBytes(file.size)}</p>
                </div>
                {!uploading && (
                  <button
                    type="button"
                    onClick={() => { setFile(null); setError('') }}
                    className="w-7 h-7 rounded-full bg-[var(--color-sepia)] hover:bg-[var(--color-danger)]/20 flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <X size={13} className="text-[var(--color-muted)]" />
                  </button>
                )}
              </div>
            ) : (
              /* Drag & drop зона */
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-[var(--color-rust)] bg-[var(--color-rust-wash)]'
                    : 'border-[var(--color-sepia-2)] hover:border-[var(--color-rust)]/50 hover:bg-[var(--color-paper-2)]'
                }`}
              >
                <div className="w-11 h-11 rounded-xl bg-[var(--color-rust-wash)] flex items-center justify-center mx-auto mb-3">
                  <Upload size={20} className="text-[var(--color-rust)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--color-ink)]">
                  Перетащите файл сюда
                </p>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  или нажмите для выбора
                </p>
                <p className="text-[11px] text-[var(--color-muted)]/60 mt-3">
                  PDF, Word, Excel, PPT, изображения, видео · Макс. 50 МБ
                </p>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={e => pickFile(e.target.files?.[0])}
              disabled={uploading}
            />
          </div>

          {/* ── Прогресс ── */}
          {uploading && (
            <div className={cardCls}>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold text-[var(--color-ink)]">Загрузка файла...</span>
                <span className="text-[var(--color-rust)] font-bold">{progress}%</span>
              </div>
              <div className="h-2 bg-[var(--color-paper-2)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--color-rust)] rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-[var(--color-muted)] mt-2 text-center">
                Пожалуйста, не закрывайте страницу
              </p>
            </div>
          )}

          {/* ── Ошибка ── */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-2xl">
              <AlertCircle size={17} className="text-[var(--color-danger)] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
            </div>
          )}

          {/* ── Кнопки ── */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={uploading}
              className="flex-1 py-3.5 border border-[var(--color-sepia)] text-[var(--color-ink)] text-sm font-semibold rounded-xl hover:bg-[var(--color-paper)] transition-all disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="flex-1 py-3.5 bg-[var(--color-rust)] text-[var(--color-paper)] text-sm font-semibold rounded-xl hover:brightness-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <span className="w-4 h-4 border-2 border-[var(--color-paper)]/30 border-t-[var(--color-paper)] rounded-full animate-spin" />
                  Загрузка {progress}%
                </>
              ) : (
                <>
                  <Upload size={15} />
                  Загрузить материал
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
