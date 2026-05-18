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
  ArrowLeft, Upload, FileText, X, CheckCircle, AlertCircle,
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
  { value: '1', label: '1 курс' },
  { value: '2', label: '2 курс' },
  { value: '3', label: '3 курс' },
  { value: '4', label: '4 курс' },
  { value: 'all', label: 'Все курсы' },
]

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function getFileIcon(type = '') {
  if (type.includes('pdf'))   return '📄'
  if (type.includes('word') || type.includes('wordprocessing')) return '📝'
  if (type.includes('excel') || type.includes('spreadsheet'))   return '📊'
  if (type.includes('powerpoint') || type.includes('presentation')) return '📊'
  if (type.includes('image')) return '🖼️'
  if (type.includes('video')) return '🎥'
  if (type.includes('text'))  return '📃'
  return '📎'
}

const inputCls = "w-full px-4 py-3 rounded-xl bg-[#2E2824] border border-[#3A322A]/80 text-[#F4EBDB] placeholder:text-[#B8A999]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-rust)]/20 focus:border-[var(--color-rust)]/60 transition-all"
const labelCls = "block text-xs font-semibold text-[#B8A999] mb-1.5 uppercase tracking-wide"

export default function MaterialUpload() {
  const { user, userData } = useAuth()
  const navigate = useNavigate()

  /* ── Форма ── */
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [category,    setCategory]    = useState('lecture')
  const [discipline,  setDiscipline]  = useState('')
  const [courses,     setCourses]     = useState([])
  const [file,        setFile]        = useState(null)

  /* ── Загрузка ── */
  const [uploading,   setUploading]   = useState(false)
  const [progress,    setProgress]    = useState(0)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState(false)
  const [dragOver,    setDragOver]    = useState(false)

  const fileRef = useRef()

  /* ── Выбор файла ── */
  function pickFile(f) {
    setError('')
    if (!f) return
    if (f.size > MAX_SIZE) {
      setError(`Файл слишком большой. Максимум — ${formatBytes(MAX_SIZE)}`)
      return
    }
    setFile(f)
  }

  /* ── Drag & drop ── */
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

    if (!title.trim())      return setError('Укажите название материала')
    if (!discipline.trim()) return setError('Укажите дисциплину')
    if (courses.length === 0) return setError('Выберите хотя бы один курс')
    if (!file)              return setError('Прикрепите файл')
    if (!user)              return setError('Не авторизован')

    setUploading(true)
    setProgress(0)

    try {
      /* Уникальное имя файла: timestamp + оригинальное имя */
      const safeName = file.name.replace(/[^a-zA-Z0-9._\-а-яёА-ЯЁ ]/g, '_')
      const storagePath = `materials/${user.uid}/${Date.now()}_${safeName}`

      /* 1. Загрузка файла в Storage */
      const fileUrl = await uploadFile(file, storagePath, (pct) => {
        setProgress(Math.round(pct))
      })

      /* 2. Сохранение метаданных в Firestore */
      const teacherName = userData
        ? [userData.firstName, userData.lastName].filter(Boolean).join(' ') || userData.email
        : 'Преподаватель'

      const { error: fsErr } = await createMaterial({
        title:        title.trim(),
        description:  description.trim(),
        category,
        discipline:   discipline.trim(),
        courses:      courses.includes('all') ? ['all'] : courses,
        teacherId:    user.uid,
        teacherName,
        fileUrl,
        fileName:     file.name,
        fileSize:     file.size,
        fileType:     file.type,
      })

      if (fsErr) throw new Error(fsErr)

      setSuccess(true)
    } catch (err) {
      console.error('[MaterialUpload]', err)
      if (err.code === 'storage/unauthorized') {
        setError('Нет прав на загрузку. Убедитесь, что ваш аккаунт активирован.')
      } else if (err.code === 'storage/canceled') {
        setError('Загрузка отменена.')
      } else {
        setError(err.message || 'Не удалось загрузить материал')
      }
    } finally {
      setUploading(false)
    }
  }

  /* ── Успешная загрузка ── */
  if (success) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={32} className="text-emerald-400" />
          </div>
          <h2 className="font-display text-2xl font-bold text-[var(--color-ink)] mb-2">
            Материал загружен!
          </h2>
          <p className="text-sm text-[var(--color-muted)] mb-8">
            Файл успешно добавлен в библиотеку и теперь доступен студентам.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/teachers/${user?.uid}`)}
              className="flex-1 py-3 bg-[var(--color-rust)] text-white text-sm font-semibold rounded-xl hover:brightness-95 transition-all"
            >
              Мой профиль
            </button>
            <button
              onClick={() => {
                setSuccess(false)
                setTitle(''); setDescription(''); setDiscipline('')
                setCourses([]); setFile(null); setProgress(0)
              }}
              className="flex-1 py-3 border border-[var(--color-ink)]/20 text-[var(--color-ink)] text-sm font-semibold rounded-xl hover:bg-[var(--color-ink)]/5 transition-all"
            >
              Ещё один
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">

        {/* Шапка */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-[var(--color-ink)]/8 hover:bg-[var(--color-ink)]/12 flex items-center justify-center transition-colors"
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

        {/* Форма */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Название */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[var(--color-ink)]/6">
            <label className={labelCls}>Название материала *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#F5F0E8] border border-[var(--color-ink)]/10 text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/50 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-rust)]/20 focus:border-[var(--color-rust)]/40 transition-all"
              placeholder="Например: Лекция 5 — Методы машинного обучения"
              maxLength={200}
              disabled={uploading}
            />
            <p className="text-[11px] text-[var(--color-muted)] mt-1.5 text-right">{title.length}/200</p>
          </div>

          {/* Категория + Дисциплина */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[var(--color-ink)]/6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                <BookOpen size={11} className="inline mr-1" />
                Тип материала *
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                disabled={uploading}
                className="w-full px-4 py-3 rounded-xl bg-[#F5F0E8] border border-[var(--color-ink)]/10 text-[var(--color-ink)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-rust)]/20 focus:border-[var(--color-rust)]/40 transition-all appearance-none cursor-pointer"
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                <GraduationCap size={11} className="inline mr-1" />
                Дисциплина *
              </label>
              <input
                value={discipline}
                onChange={e => setDiscipline(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#F5F0E8] border border-[var(--color-ink)]/10 text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/50 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-rust)]/20 focus:border-[var(--color-rust)]/40 transition-all"
                placeholder="Математический анализ"
                maxLength={100}
                disabled={uploading}
              />
            </div>
          </div>

          {/* Курсы */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[var(--color-ink)]/6">
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
                        ? 'bg-[var(--color-rust)] text-white border-[var(--color-rust)]'
                        : 'bg-[#F5F0E8] text-[var(--color-muted)] border-[var(--color-ink)]/10 hover:border-[var(--color-rust)]/30 hover:text-[var(--color-ink)]'
                    }`}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Описание */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[var(--color-ink)]/6">
            <label className={labelCls}>Описание <span className="normal-case font-normal text-[var(--color-muted)]">(необязательно)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              disabled={uploading}
              className="w-full px-4 py-3 rounded-xl bg-[#F5F0E8] border border-[var(--color-ink)]/10 text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/50 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-rust)]/20 focus:border-[var(--color-rust)]/40 transition-all resize-none"
              placeholder="Кратко опишите содержание материала..."
            />
            <p className="text-[11px] text-[var(--color-muted)] mt-1 text-right">{description.length}/1000</p>
          </div>

          {/* Файл */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-[var(--color-ink)]/6">
            <label className={labelCls}>
              <Paperclip size={11} className="inline mr-1" />
              Файл *
            </label>

            {file ? (
              /* Файл выбран */
              <div className="flex items-center gap-3 p-4 bg-[#F5F0E8] rounded-xl border border-[var(--color-ink)]/10">
                <span className="text-2xl flex-shrink-0">{getFileIcon(file.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-ink)] truncate">{file.name}</p>
                  <p className="text-[11px] text-[var(--color-muted)] mt-0.5">{formatBytes(file.size)}</p>
                </div>
                {!uploading && (
                  <button type="button" onClick={() => { setFile(null); setError('') }}
                    className="w-7 h-7 rounded-full bg-[var(--color-ink)]/10 hover:bg-red-100 flex items-center justify-center transition-colors flex-shrink-0">
                    <X size={14} className="text-[var(--color-ink)]" />
                  </button>
                )}
              </div>
            ) : (
              /* Дропзона */
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-[var(--color-rust)] bg-[var(--color-rust)]/5'
                    : 'border-[var(--color-ink)]/15 hover:border-[var(--color-rust)]/40 hover:bg-[#F5F0E8]/60'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-rust)]/10 flex items-center justify-center mx-auto mb-3">
                  <Upload size={22} className="text-[var(--color-rust)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--color-ink)]">
                  Перетащите файл сюда
                </p>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  или нажмите для выбора
                </p>
                <p className="text-[11px] text-[var(--color-muted)]/70 mt-3">
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

          {/* Прогресс загрузки */}
          {uploading && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-[var(--color-ink)]/6">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold text-[var(--color-ink)]">Загрузка файла...</span>
                <span className="text-[var(--color-rust)] font-bold">{progress}%</span>
              </div>
              <div className="h-2 bg-[#F5F0E8] rounded-full overflow-hidden">
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

          {/* Ошибка */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={uploading}
              className="flex-1 py-3.5 border border-[var(--color-ink)]/20 text-[var(--color-ink)] text-sm font-semibold rounded-xl hover:bg-[var(--color-ink)]/5 transition-all disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="flex-1 py-3.5 bg-[var(--color-rust)] text-white text-sm font-semibold rounded-xl hover:brightness-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Загрузка {progress}%
                </>
              ) : (
                <>
                  <Upload size={16} />
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
