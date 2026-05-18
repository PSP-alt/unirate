import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTeacherById, updateTeacherRating } from '../services/teachers'
import { createRating, getStudentRatingForTeacher, subscribeToApprovedRatings, voteReview, flagReview, addTeacherResponse } from '../services/ratings'
import { getTeacherMaterials } from '../services/materials'
import { addBookmark, removeBookmark, getBookmarks } from '../services/bookmarks'
import { updateTeacherDocument } from '../services/firestore'
import { RATING_CRITERIA, getCriteriaForTeacher } from '../utils/ratingCriteria'
import {
  computeWeightedRating, computeRecentRating, computeDisciplineBreakdown,
  computeSemesterBreakdown, detectManipulation, confidenceLevel,
  validateReview, computeNPS,
  MIN_RATINGS_THRESHOLD, REVIEW_RULES,
} from '../utils/reputationEngine'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '../services/firebase'
import {
  Star, Send, Lock, CheckCircle, ArrowUpDown, ChevronDown, ChevronUp,
  Download, ThumbsUp, ThumbsDown, Flag, MessageCircle, Shield, AlertTriangle,
  Info, BookOpen, TrendingUp, TrendingDown, Eye, Upload,
} from 'lucide-react'

/* ── Constants ── */
const AVATAR_GRADIENTS = [
  ['#6366f1','#8b5cf6'], ['#3b82f6','#0ea5e9'],
  ['#10b981','#14b8a6'], ['#f59e0b','#ef4444'],
  ['#ec4899','#f43f5e'], ['#8b5cf6','#6366f1'],
]
const TEACHER_TYPE_LABELS = {
  lecturer:   'Лектор',
  practice:   'Практик',
  seminar:    'Семинарист',
  supervisor: 'Научный руководитель',
  universal:  'Преподаватель',
}

const FLAG_REASONS = [
  'Оскорбительный контент',
  'Ложная информация',
  'Спам или манипуляция',
  'Личная месть',
  'Не относится к преподавателю',
]

/* ── Helpers ── */
function getGradient(name = '') {
  const g = AVATAR_GRADIENTS[(name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length]
  return `linear-gradient(135deg, ${g[0]}, ${g[1]})`
}
function getFileConfig(ft = '') {
  return FILE_CONFIG[ft?.toLowerCase()] || { icon: 'insert_drive_file', bg: 'bg-slate-100', text: 'text-slate-500' }
}
function timeAgo(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 3600)   return `${Math.floor(diff / 60)} мин. назад`
  if (diff < 86400)  return `${Math.floor(diff / 3600)} ч. назад`
  if (diff < 604800) return `${Math.floor(diff / 86400)} дн. назад`
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}
function workExperience(startDate) {
  if (!startDate) return null
  const start = new Date(startDate)
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  const y = Math.floor(months / 12)
  const m = months % 12
  const yLabel = y === 1 ? 'год' : y < 5 ? 'года' : 'лет'
  const mLabel = m === 1 ? 'месяц' : m < 5 ? 'месяца' : 'месяцев'
  if (y === 0) return `${m} ${mLabel}`
  if (m === 0) return `${y} ${yLabel}`
  return `${y} ${yLabel} ${m} ${mLabel}`
}

/* ── Current academic semester ── */
function getCurrentSemester() {
  const now   = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()
  if (month >= 9 || month === 1) {
    return `Осень ${month >= 9 ? year : year - 1}`
  }
  return `Весна ${year}`
}

/* ── Last 6 selectable semesters (newest first) ── */
function getSemesterOptions() {
  const now   = new Date()
  const month = now.getMonth() + 1
  let year    = now.getFullYear()
  let spring  = month >= 2 && month <= 8 // true = spring current, false = autumn current
  const opts  = []
  for (let i = 0; i < 6; i++) {
    opts.push(`${spring ? 'Весна' : 'Осень'} ${year}`)
    if (spring) { spring = false }
    else { year--; spring = true }
  }
  return opts
}

/* ── NPS label helper ── */
function npsLabel(nps) {
  if (nps === 'yes')   return { text: 'Рекомендует',    cls: 'bg-emerald-50 text-emerald-700' }
  if (nps === 'maybe') return { text: 'Скорее да',      cls: 'bg-amber-50 text-amber-700'     }
  if (nps === 'no')    return { text: 'Не рекомендует', cls: 'bg-red-50 text-red-600'         }
  return null
}

/* ── Attendance label helper ── */
const ATTENDANCE_OPTIONS = [
  { v: 'very_high', l: '81–100%', desc: 'Почти всегда'  },
  { v: 'high',      l: '61–80%',  desc: 'Большинство'   },
  { v: 'medium',    l: '41–60%',  desc: 'Примерно половина' },
  { v: 'low',       l: '21–40%',  desc: 'Меньше половины'  },
  { v: 'very_low',  l: '1–20%',   desc: 'Редко'         },
  { v: 'none',      l: '0%',      desc: 'Не посещал(а)' },
]

/* ── Compute criteria averages from ratings ──
   Принимает либо строку teacherType (legacy), либо teacher-объект.
   Multi-type: critериев берётся union. */
function computeCriteriaAverages(ratings, teacherOrType) {
  const criteria = typeof teacherOrType === 'string'
    ? (RATING_CRITERIA[teacherOrType] || RATING_CRITERIA.universal)
    : getCriteriaForTeacher(teacherOrType)
  const sums = {}
  const counts = {}
  criteria.forEach(c => { sums[c.key] = 0; counts[c.key] = 0 })
  ratings.forEach(r => {
    if (!r.criteriaScores) return
    criteria.forEach(c => {
      if (r.criteriaScores[c.key] != null) {
        sums[c.key] += r.criteriaScores[c.key]
        counts[c.key]++
      }
    })
  })
  return criteria.map(c => ({
    ...c,
    avg:   counts[c.key] > 0 ? (sums[c.key] / counts[c.key]).toFixed(1) : null,
    count: counts[c.key],  // сколько студентов ответили (не нажали «Затрудняюсь»)
  }))
}

/* ── Rating distribution (scores 1-10) ── */
function computeDistribution(ratings) {
  const dist = Array.from({ length: 10 }, (_, i) => ({ score: 10 - i, count: 0 }))
  ratings.forEach(r => {
    const s = Math.round(r.averageScore || 0)
    if (s >= 1 && s <= 10) dist[10 - s].count++
  })
  const max = Math.max(...dist.map(d => d.count), 1)
  return dist.map(d => ({ ...d, pct: Math.round((d.count / max) * 100) }))
}

/* ── Trend: compare last 30 days vs previous 30 days ── */
function computeTrend(ratings) {
  const now = Date.now()
  const d30 = 30 * 86400 * 1000
  const recent = ratings.filter(r => {
    const t = r.createdAt?.toDate?.() || new Date(r.createdAt)
    return now - t.getTime() < d30
  })
  const prev = ratings.filter(r => {
    const t = r.createdAt?.toDate?.() || new Date(r.createdAt)
    const age = now - t.getTime()
    return age >= d30 && age < d30 * 2
  })
  if (!recent.length || !prev.length) return null
  const avgRecent = recent.reduce((s, r) => s + (r.averageScore || 0), 0) / recent.length
  const avgPrev   = prev.reduce((s, r) => s + (r.averageScore || 0), 0) / prev.length
  const diff = avgRecent - avgPrev
  if (Math.abs(diff) < 0.1) return null
  return { up: diff > 0, diff: Math.abs(diff).toFixed(1) }
}

/* ── Achievements ── */
function getAchievements(teacher, ratings, materials) {
  const avg = teacher.averageRating || 0
  const mCount = materials.length
  const lastUpload = materials[0]?.createdAt
  const daysSinceUpload = lastUpload
    ? Math.floor((Date.now() - (lastUpload.toDate?.() || new Date(lastUpload)).getTime()) / 86400000)
    : 999
  return [
    { id: 'top',      icon: 'workspace_premium', label: 'Лучший преподаватель', desc: 'Рейтинг выше 9.0',           unlocked: avg >= 9.0,                    color: 'amber'   },
    { id: 'author',   icon: 'menu_book',          label: 'Активный автор',       desc: 'Загрузил 5+ материалов',      unlocked: mCount >= 5,                   color: 'blue'    },
    { id: 'super',    icon: 'school',             label: 'Научный руководитель', desc: 'Статус научного руководителя',unlocked: (teacher.teacherTypes || []).includes('supervisor') || teacher.teacherType === 'supervisor', color: 'purple' },
    { id: 'active',   icon: 'bolt',               label: 'Активен',              desc: 'Загружал материалы недавно',  unlocked: daysSinceUpload < 14,          color: 'green'   },
    { id: 'growth',   icon: 'trending_up',        label: 'Быстрый рост',         desc: 'Рейтинг растёт',             unlocked: computeTrend(ratings)?.up===true,color: 'emerald' },
    { id: 'popular',  icon: 'groups',             label: 'Популярный',           desc: '10+ отзывов получено',        unlocked: ratings.length >= 10,          color: 'pink'    },
  ]
}

const BADGE_COLORS = {
  amber:   'bg-amber-50 border-amber-100 text-amber-700',
  blue:    'bg-blue-50 border-blue-100 text-blue-700',
  purple:  'bg-purple-50 border-purple-100 text-purple-700',
  green:   'bg-green-50 border-green-100 text-green-700',
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  pink:    'bg-pink-50 border-pink-100 text-pink-700',
}
const BADGE_ICON_COLORS = {
  amber: 'text-amber-500', blue: 'text-blue-500', purple: 'text-purple-500',
  green: 'text-green-500', emerald: 'text-emerald-500', pink: 'text-pink-500',
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
export default function TeacherProfile() {
  const { id } = useParams()
  const { user, userData } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef()

  const [teacher,   setTeacher]   = useState(null)
  const [ratings,   setRatings]   = useState([])
  const [materials, setMaterials] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('rating')

  /* Reviews filters */
  const [reviewSort,   setReviewSort]   = useState('helpful')
  const [reviewPage,   setReviewPage]   = useState(5)

  /* Materials filters */
  const [matFilter, setMatFilter] = useState('all')

  /* Review form */
  // undefined = загрузка, null = не оценивал, object = { status, rejectionReason, ... }
  const [myRating,      setMyRating]      = useState(undefined)
  const [showForm,      setShowForm]      = useState(false)
  const [ratingForm,    setRatingForm]    = useState({})
  const [ratingPositive,   setRatingPositive]   = useState('')
  const [ratingNegative,   setRatingNegative]   = useState('')
  const [ratingNps,        setRatingNps]        = useState(null) // 'yes'|'maybe'|'no'|null
  const [ratingAnon,    setRatingAnon]    = useState(true)
  const [ratingDiscipline, setRatingDiscipline] = useState('')
  const [ratingAttendance, setRatingAttendance] = useState('high')     // общая
  const [ratingAttLecture, setRatingAttLecture] = useState('high')     // лекции
  const [ratingAttSeminar, setRatingAttSeminar] = useState('high')     // семинары
  const [ratingRole,       setRatingRole]       = useState(null)       // 'lecturer'|'seminar'|'both'|'unknown'
  const [ratingSemester,   setRatingSemester]   = useState(getCurrentSemester)
  const [ratingCourseScore, setRatingCourseScore] = useState(0)
  const [submitting,    setSubmitting]    = useState(false)
  const [submitMsg,     setSubmitMsg]     = useState('')
  const [showGuidelines, setShowGuidelines] = useState(false)

  /* Edit mode (own profile) */
  const isOwn = user && teacher && user.uid === teacher.userId
  const isTeacherOwner = isOwn && userData?.role === 'teacher'
  const [editing, setEditing]   = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving,   setSaving]   = useState(false)
  const [saveMsg,  setSaveMsg]  = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')

  /* Teacher response */
  const [respondingTo, setRespondingTo] = useState(null)
  const [responseText, setResponseText] = useState('')
  const [respondSaving, setRespondSaving] = useState(false)

  /* Bookmarks */
  const isStudent = userData?.role === 'student'
  const [bookmarked,  setBookmarked]  = useState(new Set())
  const [bmLoading,   setBmLoading]   = useState(new Set())

  useEffect(() => {
    if (!user || !isStudent) return
    let cancelled = false
    getBookmarks(user.uid).then(({ bookmarkIds }) => {
      if (cancelled) return
      setBookmarked(new Set(bookmarkIds))
    })
    return () => { cancelled = true }
  }, [user?.uid, isStudent])

  async function toggleBookmark(materialId) {
    if (!user || !isStudent || bmLoading.has(materialId)) return
    setBmLoading(prev => new Set(prev).add(materialId))
    const alreadySaved = bookmarked.has(materialId)
    setBookmarked(prev => { const n = new Set(prev); alreadySaved ? n.delete(materialId) : n.add(materialId); return n })
    const { error } = alreadySaved
      ? await removeBookmark(user.uid, materialId)
      : await addBookmark(user.uid, materialId)
    if (error) setBookmarked(prev => { const n = new Set(prev); alreadySaved ? n.add(materialId) : n.delete(materialId); return n })
    setBmLoading(prev => { const n = new Set(prev); n.delete(materialId); return n })
  }

  useEffect(() => {
    let cancelled = false
    let unsubRatings = null
    let hasSynced = false

    async function init() {
      /* Каждый запрос с собственным catch — провал одного не валит другого */
      const [teacherRes, materialsRes] = await Promise.all([
        getTeacherById(id).catch(e => {
          console.error('[getTeacherById]', e)
          return { teacher: null }
        }),
        getTeacherMaterials(id).catch(e => {
          console.error('[getTeacherMaterials]', e)
          return { materials: [] }
        }),
      ])
      if (cancelled) return

      const t = teacherRes.teacher
      const m = materialsRes.materials
      setTeacher(t || null)
      setMaterials(m || [])

      if (t) {
        const criteria = getCriteriaForTeacher(t)
        const initForm = {}
        criteria.forEach(c => { initForm[c.key] = undefined })
        setRatingForm(initForm)
        setEditForm({
          bio:           t.bio           || '',
          position:      t.position      || '',
          department:    t.department    || '',
          workStartDate: t.workStartDate || '',
          linkPortfolio: t.linkPortfolio || '',
          linkResearch:  t.linkResearch  || '',
          linkOrcid:     t.linkOrcid     || '',
          tags:          (t.tags || []).join(', '),
          themeColor:    t.themeColor    || 'blue',
          allowAnon:     t.allowAnon     !== false,
          showStats:     t.showStats     !== false,
        })
      }

      setLoading(false)

      // ── Real-time подписка на одобренные отзывы ──
      unsubRatings = subscribeToApprovedRatings(id, (approvedRatings) => {
        if (cancelled) return
        setRatings(approvedRatings)

        // Один раз за сессию: синхронизируем агрегированные по��я в документе преподавателя
        if (!hasSynced && t) {
          hasSynced = true
          const count = approvedRatings.length
          const avg = count > 0
            ? Math.round((approvedRatings.reduce((s, r) => s + (r.averageScore || 0), 0) / count) * 10) / 10
            : 0
          // Обновляем только если значения расходятся
          if (avg !== (t.averageRating || 0) || count !== (t.ratingsCount || 0)) {
            updateTeacherRating(id, avg, count)
            setTeacher(prev => prev ? { ...prev, averageRating: avg, ratingsCount: count } : prev)
          }
        }
      })
    }

    init()

    return () => {
      cancelled = true
      if (unsubRatings) unsubRatings()
    }
  }, [id])

  // ── Получить статус отзыва текущего студента ──
  useEffect(() => {
    if (!user || userData?.role !== 'student') {
      setMyRating(null)
      return
    }
    let cancelled = false
    setMyRating(undefined) // загрузка
    getStudentRatingForTeacher(id, user.uid).then(({ rating }) => {
      if (cancelled) return
      setMyRating(rating ?? null) // null = не оценивал, объект = статус
    })
    return () => { cancelled = true }
  }, [user?.uid, userData?.role, id])

  /* Submit review */
  async function handleSubmitRating(e) {
    e.preventDefault()
    const criteria = getCriteriaForTeacher(teacher)

    // Every criterion must be answered: either 1–10 or null ("затрудняюсь")
    // undefined = not yet touched
    const hasUnanswered = criteria.some(c => ratingForm[c.key] === undefined)
    if (hasUnanswered) {
      setSubmitMsg('Пожалуйста, оцените все критерии или нажмите «Затрудняюсь ответить»')
      return
    }

    // Average only from numeric scores (skip nulls = затрудняюсь)
    const numericScores = criteria.map(c => ratingForm[c.key]).filter(s => s !== null && s > 0)
    const avg = numericScores.length > 0
      ? numericScores.reduce((a, b) => a + b, 0) / numericScores.length
      : 0

    // Combined comment length for validation
    const validationErrors = validateReview({
      averageScore:    Math.round(avg * 10) / 10,
      positiveComment: ratingPositive,
      negativeComment: ratingNegative,
    })
    if (validationErrors.length > 0) {
      setSubmitMsg(validationErrors[0])
      return
    }

    setSubmitting(true)
    const combinedComment = [ratingPositive.trim(), ratingNegative.trim()].filter(Boolean).join(' | ')

    // Determine primary attendance level based on role
    const primaryAttendance =
      ratingRole === 'lecturer' ? ratingAttLecture :
      ratingRole === 'seminar'  ? ratingAttSeminar :
      ratingRole === 'both'     ? ratingAttLecture  : // lec dominant
      ratingAttendance

    const { error } = await createRating({
      teacherId:         teacher.id,
      studentId:         user.uid,
      criteriaScores:    ratingForm,
      averageScore:      Math.round(avg * 10) / 10,
      positiveComment:   ratingPositive.trim(),
      negativeComment:   ratingNegative.trim(),
      comment:           combinedComment,
      discipline:        ratingDiscipline,
      teacherRole:       ratingRole,
      attendanceLevel:   primaryAttendance,
      attendanceLecture: ratingRole === 'both' || ratingRole === 'lecturer' ? ratingAttLecture : null,
      attendanceSeminar: ratingRole === 'both' || ratingRole === 'seminar'  ? ratingAttSeminar : null,
      semester:          ratingSemester || getCurrentSemester(),
      nps:               ratingNps,
      courseScore:       ratingCourseScore > 0 ? ratingCourseScore : null,
      studentCourse:     userData?.course || null,
      isAnonymous:       ratingAnon,
    })
    setSubmitting(false)
    if (error) {
      setSubmitMsg('Ошибка при отправке. Попробуйте позже.')
    } else {
      // Оптимистично устанавливаем статус «на модерации»
      setMyRating({ status: 'pending', rejectionReason: '' })
      setShowForm(false)
      setSubmitMsg('')
    }
  }

  /* Teacher respond to review */
  async function handleTeacherRespond(ratingId) {
    if (!responseText.trim()) return
    setRespondSaving(true)
    const { error } = await addTeacherResponse(ratingId, user.uid, responseText)
    setRespondSaving(false)
    if (!error) {
      setRatings(prev => prev.map(r =>
        r.id === ratingId ? { ...r, teacherResponse: responseText.trim(), teacherResponseAt: new Date() } : r
      ))
      setRespondingTo(null)
      setResponseText('')
    }
  }

  /* Avatar upload */
  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file || !teacher) return
    if (file.size > 5 * 1024 * 1024) { setUploadError('Макс. 5 MB'); return }
    setUploading(true); setUploadError('')
    const storageRef = ref(storage, `teacher-avatars/${teacher.id}`)
    const task = uploadBytesResumable(storageRef, file)
    task.on('state_changed',
      s => setUploadProgress(Math.round(s.bytesTransferred / s.totalBytes * 100)),
      err => { setUploadError(err.code); setUploading(false) },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        await updateTeacherDocument(teacher.id, { avatarUrl: url })
        setTeacher(t => ({ ...t, avatarUrl: url }))
        setUploading(false); setUploadProgress(0)
      }
    )
  }

  /* Save settings */
  async function saveSettings(e) {
    e.preventDefault()
    setSaving(true); setSaveMsg('')
    const tags = editForm.tags.split(',').map(s => s.trim()).filter(Boolean)
    const { error } = await updateTeacherDocument(teacher.id, {
      bio:           editForm.bio,
      position:      editForm.position,
      department:    editForm.department,
      workStartDate: editForm.workStartDate,
      linkPortfolio: editForm.linkPortfolio,
      linkResearch:  editForm.linkResearch,
      linkOrcid:     editForm.linkOrcid,
      tags,
      themeColor:    editForm.themeColor,
      allowAnon:     editForm.allowAnon,
      showStats:     editForm.showStats,
    })
    setTeacher(t => ({ ...t, ...editForm, tags }))
    setSaving(false)
    setSaveMsg(error ? 'Ошибка сохранения' : 'Сохранено!')
    setTimeout(() => setSaveMsg(''), 3000)
  }

  /* ── Loading ── */
  if (loading) return (
    <div className="min-h-screen bg-[#1A1613] pt-20">
      <div className="max-w-5xl mx-auto px-6 space-y-6">
        <div className="h-56 bg-[#24201C] rounded-3xl animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({length:4}).map((_,i)=>(
            <div key={i} className="h-24 bg-[#24201C] rounded-2xl animate-pulse"/>
          ))}
        </div>
      </div>
    </div>
  )

  if (!teacher) return (
    <div className="min-h-screen bg-[#1A1613] flex items-center justify-center">
      <div className="text-center">
        <span className="material-symbols-outlined text-[48px] text-[#3A322A]">person_off</span>
        <p className="text-[#B8A999] mt-2">Преподаватель не найден</p>
      </div>
    </div>
  )

  /* ── Computed values ── */
  const fullName = [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ')
  const initials = [teacher.firstName?.[0], teacher.lastName?.[0]].filter(Boolean).join('')
  const avgRating = teacher.averageRating || 0
  const experience = workExperience(teacher.workStartDate)
  const trend = computeTrend(ratings)
  const distribution = computeDistribution(ratings)
  const criteriaAvgs = computeCriteriaAverages(ratings, teacher)
  const achievements = getAchievements(teacher, ratings, materials)
  const tags = teacher.tags || teacher.disciplines || []

  /* Reputation engine data */
  const { weighted: weightedRating } = computeWeightedRating(ratings)
  const recentRating = computeRecentRating(ratings)
  const disciplineBreakdown = computeDisciplineBreakdown(ratings)
  const confidence = confidenceLevel(ratings.length)
  const manipulationAlerts   = isTeacherOwner ? detectManipulation(ratings) : []
  const npsData             = computeNPS(ratings)
  const semesterBreakdown   = computeSemesterBreakdown(ratings)

  /* Activity indicator */
  const lastMat = materials[0]?.createdAt
  const daysSinceUpload = lastMat
    ? Math.floor((Date.now() - (lastMat.toDate?.() || new Date(lastMat)).getTime()) / 86400000)
    : 999
  const activityColor = daysSinceUpload < 14 ? 'bg-emerald-400' : daysSinceUpload < 60 ? 'bg-amber-400' : 'bg-slate-300'
  const activityLabel = daysSinceUpload < 14 ? 'Активен' : daysSinceUpload < 60 ? 'Менее активен' : 'Давно не заходил'

  /* Sorted reviews */
  let filteredRatings = [...ratings]
  if (reviewSort === 'helpful')
    filteredRatings.sort((a,b) => ((b.helpfulVotes||0) - (b.unhelpfulVotes||0)) - ((a.helpfulVotes||0) - (a.unhelpfulVotes||0)))
  else if (reviewSort === 'newest')
    filteredRatings.sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))
  else if (reviewSort === 'oldest')
    filteredRatings.sort((a,b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0))
  else if (reviewSort === 'score_desc')
    filteredRatings.sort((a,b) => (b.averageScore||0) - (a.averageScore||0))
  const shownRatings = filteredRatings.slice(0, reviewPage)

  /* Materials disciplines */
  const matDisciplines = [...new Set(materials.map(m => m.discipline).filter(Boolean))]
  const filteredMaterials = matFilter === 'all'
    ? materials
    : materials.filter(m => m.discipline === matFilter || m.fileType === matFilter)

  /* Disciplines for rating form */
  const teacherDisciplines = teacher.disciplines || []

  const inputCls = "w-full px-4 py-3 rounded-xl bg-[#2E2824] border border-[#3A322A]/80 text-[#F4EBDB] placeholder:text-[#B8A999]/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"

  return (
    <div className="min-h-screen bg-[#1A1613] text-[#E6D9C9] pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-6">

        {/* ── Назад к каталогу ── */}
        <Link to="/teachers" className="inline-flex items-center gap-2 mb-6 text-[13px] text-[#B8A999] hover:text-[var(--color-rust)] transition-colors">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          К каталогу
        </Link>

        {/* ══ HERO CARD (Unirate) ══ */}
        <div className="rounded-[20px] sm:rounded-[28px] bg-[#24201C] border border-[#3A322A] p-4 sm:p-8 md:p-10 mb-8 animate-fade-up">
          <div className="grid md:grid-cols-[1.1fr_1fr] gap-8 md:gap-10">

            {/* Левая колонка — аватар и описание */}
            <div className="flex gap-4 sm:gap-6">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div
                  className={`w-[72px] h-[72px] sm:w-[104px] sm:h-[104px] rounded-full overflow-hidden bg-[#3A322A] border border-[#3A322A] flex items-center justify-center ${isOwn ? 'cursor-pointer group' : ''}`}
                  onClick={() => isOwn && fileRef.current?.click()}
                >
                  {teacher.avatarUrl ? (
                    <img src={teacher.avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-display text-[32px] text-[#F4EBDB]">{initials || '?'}</span>
                  )}
                  {isOwn && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                      <span className="material-symbols-outlined text-[#F4EBDB] text-[22px]">photo_camera</span>
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-full">
                      <span className="text-[#F4EBDB] text-sm font-bold">{uploadProgress}%</span>
                    </div>
                  )}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#24201C] ${activityColor}`} title={activityLabel} />
                {isOwn && <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />}
              </div>

              {/* Name & meta */}
              <div className="flex-1 min-w-0">
                {teacher.disciplines?.[0] && (
                  <div className="label-eyebrow mb-3">{teacher.disciplines[0]}</div>
                )}

                <h1 className="font-display text-[24px] sm:text-[34px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-[#F4EBDB] mb-4">
                  {fullName || 'Без имени'}
                </h1>

                {teacher.disciplines?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-5">
                    {teacher.disciplines.map(d => (
                      <span key={d} className="px-3 py-1 border border-[#3A322A] text-[#E6D9C9] text-[12px] rounded-full">
                        {d}
                      </span>
                    ))}
                  </div>
                )}

                {teacher.bio && (
                  <p className="font-display italic text-[15px] leading-relaxed text-[#B8A999] mb-5 max-w-md line-clamp-3">
                    {teacher.bio}
                  </p>
                )}

                {/* Meta: кафедра / расписание */}
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-[#B8A999] mb-6">
                  {teacher.department && (
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">apartment</span>
                      {teacher.department}
                    </span>
                  )}
                  {experience && (
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      Стаж: {experience}
                    </span>
                  )}
                  {teacher.position && (
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">badge</span>
                      {teacher.position}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  {!isOwn && (
                    <button
                      onClick={() => setTab('reviews')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--color-rust)] text-[#FFFDF7] text-[13px] font-semibold hover:bg-[#C55830] transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      Оставить отзыв
                    </button>
                  )}
                  {isOwn && (
                    <button
                      onClick={() => { setEditing(v=>!v); setTab('settings') }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--color-rust)] text-[#FFFDF7] text-[13px] font-semibold hover:bg-[#C55830] transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                      Редактировать
                    </button>
                  )}
                </div>

                {(teacher.linkPortfolio || teacher.linkResearch || teacher.linkOrcid) && (
                  <div className="flex flex-wrap gap-4 mt-5">
                    {teacher.linkPortfolio && <a href={teacher.linkPortfolio} target="_blank" rel="noreferrer" className="text-[12px] text-[var(--color-rust-soft)] hover:text-[var(--color-rust)] hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">link</span>Портфолио</a>}
                    {teacher.linkResearch  && <a href={teacher.linkResearch}  target="_blank" rel="noreferrer" className="text-[12px] text-[var(--color-rust-soft)] hover:text-[var(--color-rust)] hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">science</span>ResearchGate</a>}
                    {teacher.linkOrcid     && <a href={teacher.linkOrcid}     target="_blank" rel="noreferrer" className="text-[12px] text-[var(--color-rust-soft)] hover:text-[var(--color-rust)] hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">badge</span>ORCID</a>}
                  </div>
                )}
              </div>
            </div>

            {/* Правая колонка — рейтинг, гистограмма, критерии */}
            <div className="border-t md:border-t-0 md:border-l border-[#3A322A] md:pl-10 pt-8 md:pt-0">
              {/* Big rating */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[52px] sm:text-[72px] leading-none tracking-[-0.02em] text-[#F4EBDB]">
                    {avgRating > 0 ? avgRating.toFixed(1).replace('.', ',') : '—'}
                  </span>
                  <span className="font-display text-[20px] sm:text-[28px] text-[#8B827A]">/ 10</span>
                </div>
                <div className="text-right mt-3">
                  <div className="label-eyebrow">Средний рейтинг</div>
                  <div className="text-[12px] text-[#B8A999] mt-1">
                    из {ratings.length > 0 ? ratings.length : '—'} {ratings.length === 1 ? 'отзыва' : ratings.length < 5 ? 'отзывов' : 'отзывов'}
                  </div>
                </div>
              </div>

              {/* Distribution histogram */}
              {ratings.length > 0 && (
                <div className="flex items-end gap-1 h-16 mb-6">
                  {distribution.map(d => {
                    const maxPct = Math.max(...distribution.map(x => x.pct))
                    const h = maxPct > 0 ? Math.max(4, (d.pct / maxPct) * 56) : 4
                    return (
                      <div key={d.score} className="flex-1 flex flex-col items-center gap-1.5">
                        <div
                          className="w-full rounded-sm transition-all"
                          style={{
                            height: `${h}px`,
                            background: d.score >= 7
                              ? 'var(--color-rust)'
                              : d.score >= 4 ? 'var(--color-gold)' : 'var(--color-danger)',
                            opacity: d.count > 0 ? 1 : 0.25,
                          }}
                        />
                        <span className="text-[10px] font-mono text-[#8B827A]">{d.score}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Criteria bars */}
              {ratings.length > 0 && (
                <div className="space-y-3">
                  {criteriaAvgs.slice(0, 5).map(c => {
                    const avg = Number(c.avg) || 0
                    const filled = Math.round(avg)
                    return (
                      <div key={c.key} className="grid grid-cols-[1fr_auto_2rem] items-center gap-2 sm:gap-3">
                        <span className="text-[11px] sm:text-[12px] text-[#E6D9C9] truncate">{c.label}</span>
                        <div className="bar-segments w-[80px] sm:w-[120px]">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <span key={i} className="bar-seg" style={{
                              background: i < filled ? 'var(--color-rust)' : '#3A322A'
                            }} />
                          ))}
                        </div>
                        <span className="text-[12px] font-mono text-[#F4EBDB] text-right">
                          {avg > 0 ? avg.toFixed(1).replace('.', ',') : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* No ratings fallback */}
              {ratings.length === 0 && (
                <p className="text-[13px] text-[#8B827A] italic">
                  Пока нет отзывов. Станьте первым, кто оставит отзыв об этом преподавателе.
                </p>
              )}
            </div>
          </div>

          {/* Теги (рейтинг-теги) */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-[#3A322A]">
              <span className="label-muted mr-2 self-center">Часто упоминают:</span>
              {tags.map((tag) => (
                <span key={tag} className="px-3 py-1 text-[12px] rounded-full bg-[#1A1613] text-[#E6D9C9] border border-[#3A322A]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ══ MANIPULATION ALERTS (for teacher owner) ══ */}
        {manipulationAlerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {manipulationAlerts.map((alert, i) => (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-2xl border ${
                alert.severity === 'high' ? 'bg-red-950/40 border-red-500/30' :
                alert.severity === 'medium' ? 'bg-amber-950/40 border-amber-500/30' :
                'bg-blue-950/40 border-blue-500/30'
              }`}>
                <AlertTriangle size={18} className={
                  alert.severity === 'high' ? 'text-red-400 flex-shrink-0 mt-0.5' :
                  alert.severity === 'medium' ? 'text-amber-400 flex-shrink-0 mt-0.5' : 'text-blue-400 flex-shrink-0 mt-0.5'
                } />
                <div>
                  <p className="text-sm font-medium text-[#F4EBDB]">{alert.message}</p>
                  <p className="text-xs text-[#B8A999] mt-0.5">
                    Если вы считаете это манипуляцией, обратитесь к администрации
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ STATS (Unirate minimal) ══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <UnirateMetric
            value={avgRating > 0 ? avgRating.toFixed(1).replace('.', ',') : '—'}
            label="Средний рейтинг"
            hint={confidence.label}
            accent
            trend={trend}
          />
          {npsData ? (
            <UnirateMetric
              value={`${npsData.pctPromoters}%`}
              label="Рекомендуют"
              hint={`${npsData.total} ответов`}
            />
          ) : (
            <UnirateMetric
              value={ratings.length}
              label="Отзывов"
              hint={ratings.length > 0 ? 'подписано псевдонимом' : 'пока нет'}
            />
          )}
          <UnirateMetric value={materials.length} label="Материалов" />
          <UnirateMetric value={teacher.disciplines?.length || 0} label="Дисциплин" />
        </div>

        {/* ══ ACHIEVEMENTS ══ */}
        {achievements.some(a => a.unlocked) && (
          <div className="flex flex-wrap gap-2 mb-8">
            {achievements.filter(a => a.unlocked).map((a, i) => {
              const gradMap = {
                gold: 'from-amber-400 to-orange-400',
                blue: 'from-blue-500 to-indigo-500',
                green: 'from-emerald-500 to-teal-500',
                purple: 'from-purple-500 to-violet-500',
                red: 'from-rose-500 to-pink-500',
              }
              const grad = gradMap[a.color] || 'from-slate-500 to-slate-600'
              return (
                <div key={a.id}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold text-white shadow-md animate-spring-scale bg-gradient-to-r ${grad}`}
                  style={{animationDelay:`${i * 60}ms`}}>
                  <span className="material-symbols-outlined text-[15px]" style={{fontVariationSettings:"'FILL' 1"}}>{a.icon}</span>
                  {a.label}
                </div>
              )
            })}
          </div>
        )}

        {/* ══ TABS ══ */}
        <div className="flex gap-1 p-1 bg-[#24201C] border border-[#3A322A] rounded-full mb-8 w-full sm:w-fit overflow-x-auto no-scrollbar">
          {[
            { id: 'rating',    icon: 'star',     label: 'Рейтинг'   },
            { id: 'reviews',   icon: 'chat',     label: 'Отзывы'    },
            { id: 'materials', icon: 'folder',   label: 'Материалы' },
            ...(isOwn ? [{ id: 'settings', icon: 'settings', label: 'Настройки' }] : []),
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full text-[12px] sm:text-[13px] font-semibold whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'bg-[var(--color-rust)] text-[#FFFDF7]'
                  : 'text-[#B8A999] hover:text-[#F4EBDB]'
              }`}>
              <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ TAB: RATING ══ */}
        {tab === 'rating' && (
          <div className="space-y-6 animate-slide-up">

            {/* Minimum threshold warning */}
            {ratings.length < MIN_RATINGS_THRESHOLD && ratings.length > 0 && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <Info size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Недостаточно данных для достоверного рейтинга</p>
                  <p className="text-xs text-amber-600 mt-0.5">Для формирования объективной оценки необходимо минимум {MIN_RATINGS_THRESHOLD} отзывов. Сейчас: {ratings.length}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Distribution */}
              <div className="bg-[#24201C] rounded-3xl p-6 border border-[#3A322A]">
                <h3 className="text-base font-semibold text-[#F4EBDB] mb-5">Распределение оценок</h3>
                {ratings.length === 0 ? (
                  <p className="text-[#B8A999] text-sm">Ещё нет оценок</p>
                ) : (
                  <div className="space-y-2">
                    {distribution.map((d, i) => (
                      <div key={d.score} className="flex items-center gap-3">
                        <span className="w-4 text-xs font-medium text-[#B8A999] text-right">{d.score}</span>
                        <div className="flex-1 h-5 bg-[#2E2824] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary bar-fill-in"
                            style={{ width: `${d.pct}%`, opacity: d.count ? 1 : 0.2, animationDelay: `${i * 35}ms` }}
                          />
                        </div>
                        <span className="w-5 text-xs text-[#B8A999]">{d.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Criteria */}
              <div className="bg-[#24201C] rounded-3xl p-6 border border-[#3A322A]">
                <h3 className="text-base font-semibold text-[#F4EBDB] mb-5">Критерии оценки</h3>
                {ratings.length === 0 ? (
                  <p className="text-[#B8A999] text-sm">Ещё нет оценок</p>
                ) : (
                  <div className="space-y-4">
                    {criteriaAvgs.map((c, idx) => (
                      <div key={c.key}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-[#B8A999] flex-1 pr-2">{c.label}</span>
                          <div className="flex items-baseline gap-1 flex-shrink-0">
                            <span className="text-xs font-bold text-[#F4EBDB]">{c.avg ?? '—'}</span>
                            {c.count > 0 && (
                              <span className="text-[10px] text-[#B8A999]">n={c.count}</span>
                            )}
                          </div>
                        </div>
                        <div className="h-2 bg-[#2E2824] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary bar-fill-in"
                            style={{ width: c.avg ? `${Number(c.avg) * 10}%` : '0%', animationDelay: `${idx * 55}ms` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Weighted & Recent Rating ── */}
              {ratings.length >= MIN_RATINGS_THRESHOLD && (
                <div className="bg-[#24201C] rounded-3xl p-6 border border-[#3A322A]">
                  <h3 className="text-base font-semibold text-[#F4EBDB] mb-4 flex items-center gap-2">
                    <Shield size={18} className="text-blue-500" />
                    Взвешенный рейтинг
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#B8A999]">С учётом свежести и качества отзывов</p>
                        <p className="text-[11px] text-[#B8A999]/60 mt-0.5">Новые и развёрнутые отзывы весят больше</p>
                      </div>
                      <span className="text-2xl font-bold text-[#F4EBDB]">{weightedRating.toFixed(1)}</span>
                    </div>
                    {recentRating && (
                      <div className="flex items-center justify-between pt-3 border-t border-[#3A322A]">
                        <div>
                          <p className="text-sm text-[#B8A999]">За последний год</p>
                          <p className="text-[11px] text-[#B8A999]/60 mt-0.5">{recentRating.count} отзывов</p>
                        </div>
                        <span className="text-2xl font-bold text-[#F4EBDB]">{recentRating.avg.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Discipline Breakdown ── */}
              {disciplineBreakdown.length > 1 && (
                <div className="bg-[#24201C] rounded-3xl p-6 border border-[#3A322A]">
                  <h3 className="text-base font-semibold text-[#F4EBDB] mb-4 flex items-center gap-2">
                    <BookOpen size={18} className="text-purple-500" />
                    Рейтинг по дисциплинам
                  </h3>
                  <div className="space-y-3">
                    {disciplineBreakdown.map(d => (
                      <div key={d.name}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-[#B8A999]">{d.name}</span>
                          <span className="text-xs font-bold text-[#F4EBDB]">{d.avg} <span className="text-[#B8A999] font-normal">({d.count})</span></span>
                        </div>
                        <div className="h-2 bg-[#2E2824] rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-purple-400 transition-all duration-500" style={{ width: `${d.avg * 10}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Semester dynamics */}
              {semesterBreakdown.length > 1 && (
                <div className="bg-[#24201C] rounded-3xl p-6 border border-[#3A322A]">
                  <h3 className="text-base font-semibold text-[#F4EBDB] mb-5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500 text-[20px]">calendar_month</span>
                    Динамика по семестрам
                  </h3>
                  <div className="space-y-3">
                    {semesterBreakdown.map((s, i) => {
                      const isLatest = i === 0
                      const prev     = semesterBreakdown[i - 1]
                      const delta    = prev ? +(s.avg - prev.avg).toFixed(1) : 0
                      const barColor = s.avg >= 8 ? 'bg-emerald-400' : s.avg >= 6 ? 'bg-blue-400' : s.avg >= 4 ? 'bg-amber-400' : 'bg-red-400'
                      return (
                        <div key={s.semester}>
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#B8A999]">{s.semester}</span>
                              {delta !== 0 && (
                                <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${delta > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                  {delta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                  {delta > 0 ? '+' : ''}{delta}
                                </span>
                              )}
                              {isLatest && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-rust)]/20 text-[var(--color-rust)] rounded-full">Актуальный</span>
                              )}
                            </div>
                            <span className="text-xs font-bold text-[#F4EBDB]">
                              {s.avg} <span className="text-[#B8A999] font-normal">({s.count})</span>
                            </span>
                          </div>
                          <div className="h-2 bg-[#2E2824] rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${s.avg * 10}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* NPS breakdown */}
              {npsData && (
                <div className="lg:col-span-2 bg-[#24201C] rounded-3xl p-6 border border-[#3A322A]">
                  <h3 className="text-base font-semibold text-[#F4EBDB] mb-5 flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-[20px]" style={{fontVariationSettings:"'FILL' 1"}}>recommend</span>
                    Готовы рекомендовать коллегам
                    <span className="text-xs font-normal text-[#B8A999] ml-auto">{npsData.total} ответов</span>
                  </h3>
                  <div className="flex items-stretch gap-4 mb-4">
                    {[
                      { label: 'Рекомендуют',    pct: npsData.pctPromoters,  bar: 'bg-emerald-400', text: 'text-emerald-600' },
                      { label: 'Нейтрально',     pct: npsData.pctNeutral,    bar: 'bg-amber-400',   text: 'text-amber-600'   },
                      { label: 'Не рекомендуют', pct: npsData.pctDetractors, bar: 'bg-red-400',     text: 'text-red-500'     },
                    ].map(s => (
                      <div key={s.label} className="flex-1 flex flex-col items-center gap-1">
                        <span className={`text-2xl font-bold ${s.text}`}>{s.pct}%</span>
                        <span className="text-[11px] text-[#B8A999] text-center">{s.label}</span>
                        <div className="w-full h-2 bg-[#2E2824] rounded-full mt-1 overflow-hidden">
                          <div className={`h-full rounded-full ${s.bar} transition-all duration-500`} style={{ width: `${s.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#B8A999] text-center">
                    NPS-индекс: <span className={`font-bold ${npsData.score >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{npsData.score > 0 ? '+' : ''}{npsData.score}</span>
                    <span className="ml-1">(от −100 до +100)</span>
                  </p>
                </div>
              )}

              {/* Top reviews */}
              {ratings.length > 0 && (
                <div className="lg:col-span-2 bg-[#24201C] rounded-3xl p-6 border border-[#3A322A]">
                  <h3 className="text-base font-semibold text-[#F4EBDB] mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-400 text-[20px]" style={{fontVariationSettings:"'FILL' 1"}}>stars</span>
                    Самые полезные отзывы
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[...ratings]
                      .sort((a,b) => ((b.helpfulVotes||0)-(b.unhelpfulVotes||0)) - ((a.helpfulVotes||0)-(a.unhelpfulVotes||0)))
                      .filter(r => r.positiveComment || r.negativeComment || r.comment)
                      .slice(0,3).map(r => (
                      <div key={r.id} className="bg-[#2A2520] border border-[#3A322A] rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex items-center gap-1 bg-[var(--color-rust)]/20 text-[var(--color-rust)] px-2 py-0.5 rounded-full">
                            <span className="material-symbols-outlined text-[13px]" style={{fontVariationSettings:"'FILL' 1"}}>star</span>
                            <span className="text-xs font-bold">{r.averageScore?.toFixed(1)}</span>
                          </div>
                          <span className="text-xs text-[#B8A999]">{timeAgo(r.createdAt)}</span>
                          {(r.helpfulVotes || 0) > 0 && (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 ml-auto">
                              <ThumbsUp size={10} /> {r.helpfulVotes}
                            </span>
                          )}
                        </div>
                        {r.positiveComment && (
                          <p className="text-xs text-emerald-400 leading-relaxed line-clamp-2">+ {r.positiveComment}</p>
                        )}
                        {r.negativeComment && (
                          <p className="text-xs text-amber-400 leading-relaxed line-clamp-2 mt-1">△ {r.negativeComment}</p>
                        )}
                        {!r.positiveComment && !r.negativeComment && r.comment && (
                          <p className="text-xs text-[#B8A999] leading-relaxed line-clamp-3">«{r.comment}»</p>
                        )}
                        {r.discipline && <p className="text-[10px] text-[#B8A999] mt-2">{r.discipline}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ TAB: REVIEWS ══ */}
        {tab === 'reviews' && (
          <div className="space-y-6 animate-slide-up">

            {/* ── Write review CTA / Form ── */}
            {!user ? (
              <div className="bg-[var(--color-rust)] rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Lock size={20} className="text-[#FFFDF7] flex-shrink-0" />
                  <p className="text-sm text-white/80">Чтобы оставить отзыв, войдите в аккаунт студента</p>
                </div>
                <Link to="/login" className="px-4 py-2 bg-[#FFFDF7] text-[var(--color-rust)] text-xs font-bold rounded-xl whitespace-nowrap hover:brightness-95">
                  Войти
                </Link>
              </div>
            ) : userData?.role !== 'student' ? (
              <div className="bg-slate-50 border border-[#3A322A] rounded-2xl p-5 flex items-center gap-3">
                <Lock size={18} className="text-slate-400 flex-shrink-0" />
                <p className="text-sm text-[#B8A999]">Оставлять отзывы могут только студенты</p>
              </div>
            ) : !userData?.isActive && (userData?.blockReason || userData?.isDeleted) ? (
              /* ── Заблокирован ── */
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
                <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield size={17} className="text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-700">Аккаунт заблокирован</p>
                  <p className="text-xs text-red-500 mt-0.5">
                    {userData?.blockReason
                      ? `Причина: ${userData.blockReason}`
                      : 'Оставлять отзывы недоступно. Обратитесь к администратору.'}
                  </p>
                </div>
              </div>
            ) : isOwn ? null : myRating?.status === 'pending' ? (
              /* ── Отзыв на модерации ── */
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3 animate-slide-up">
                <CheckCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Отзыв отправлен на проверку</p>
                  <p className="text-xs text-amber-600 mt-0.5">После одобрения модератором он появится в списке отзывов</p>
                </div>
              </div>
            ) : myRating?.status === 'approved' ? (
              /* ── Уже оценил ── */
              <div className="bg-[var(--color-ok)]/10 border border-[var(--color-ok)]/30 rounded-2xl p-5 flex items-center gap-3">
                <CheckCircle size={18} className="text-[var(--color-ok)] flex-shrink-0" />
                <p className="text-sm text-[var(--color-ok)]">Вы уже оценили этого преподавателя</p>
              </div>
            ) : myRating?.status === 'rejected' ? (
              /* ── Отзыв отклонён ── */
              <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-2xl p-5 space-y-2">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-[var(--color-danger)] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[var(--color-danger)]">Ваш отзыв был отклонён</p>
                    {myRating.rejectionReason && (
                      <p className="text-xs text-[var(--color-danger)]/80 mt-0.5">Причина: {myRating.rejectionReason}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setMyRating(null); setShowForm(true) }}
                  className="text-xs font-semibold text-[var(--color-danger)] hover:opacity-80 underline underline-offset-2 ml-7 transition-opacity"
                >
                  Написать новый отзыв
                </button>
              </div>
            ) : myRating === undefined ? null : (
              <div className="bg-[#24201C] border border-[#3A322A] rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowForm(v => !v)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#2E2824] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[var(--color-rust)] flex items-center justify-center">
                      <Star size={15} className="text-[#FFFDF7]" />
                    </div>
                    <span className="text-sm font-semibold text-[#F4EBDB]">Оставить отзыв</span>
                  </div>
                  {showForm ? <ChevronUp size={18} className="text-[#B8A999]" /> : <ChevronDown size={18} className="text-[#B8A999]" />}
                </button>

                {showForm && (
                  <form onSubmit={handleSubmitRating} className="px-6 pb-6 border-t border-[#3A322A]">
                    <RatingForm
                      teacher={teacher}
                      ratingForm={ratingForm}
                      setRatingForm={setRatingForm}
                      positiveComment={ratingPositive}
                      setPositiveComment={setRatingPositive}
                      negativeComment={ratingNegative}
                      setNegativeComment={setRatingNegative}
                      nps={ratingNps}
                      setNps={setRatingNps}
                      anon={ratingAnon}
                      setAnon={setRatingAnon}
                      discipline={ratingDiscipline}
                      setDiscipline={setRatingDiscipline}
                      disciplines={teacherDisciplines}
                      attendance={ratingAttendance}
                      setAttendance={setRatingAttendance}
                      attendanceLecture={ratingAttLecture}
                      setAttendanceLecture={setRatingAttLecture}
                      attendanceSeminar={ratingAttSeminar}
                      setAttendanceSeminar={setRatingAttSeminar}
                      role={ratingRole}
                      setRole={setRatingRole}
                      semester={ratingSemester}
                      setSemester={setRatingSemester}
                      courseScore={ratingCourseScore}
                      setCourseScore={setRatingCourseScore}
                      showGuidelines={showGuidelines}
                      setShowGuidelines={setShowGuidelines}
                      submitting={submitting}
                      error={submitMsg !== 'success' ? submitMsg : ''}
                    />
                  </form>
                )}
              </div>
            )}

            {/* ── Sort ── */}
            <div className="flex items-center gap-2">
              <ArrowUpDown size={13} className="text-[#B8A999]" />
              {[
                { v: 'helpful',    l: 'Полезные'  },
                { v: 'newest',     l: 'Новые'     },
                { v: 'oldest',     l: 'Старые'    },
                { v: 'score_desc', l: 'По оценке' },
              ].map(({v,l}) => (
                <button key={v} onClick={() => setReviewSort(v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    reviewSort === v
                      ? 'bg-[var(--color-rust)] text-[#FFFDF7] border-[var(--color-rust)]'
                      : 'bg-[#24201C] text-[#B8A999] border-[#3A322A] hover:border-[var(--color-rust)]/40 hover:text-[#F4EBDB]'
                  }`}>
                  {l}
                </button>
              ))}
            </div>

            {/* ── List ── */}
            <div className="space-y-4">
              {filteredRatings.length === 0 ? (
                <div className="bg-[#24201C] rounded-3xl p-12 text-center border border-[#3A322A]">
                  <span className="material-symbols-outlined text-[40px] text-[#6B625A]">rate_review</span>
                  <p className="text-[#B8A999] mt-2 text-sm">Отзывов не найдено</p>
                </div>
              ) : shownRatings.map(r => (
                <ReviewCard
                  key={r.id}
                  rating={r}
                  teacher={teacher}
                  user={user}
                  userData={userData}
                  isTeacherOwner={isTeacherOwner}
                  onRespond={(id) => { setRespondingTo(id); setResponseText('') }}
                  respondingTo={respondingTo}
                  responseText={responseText}
                  setResponseText={setResponseText}
                  onSubmitResponse={handleTeacherRespond}
                  respondSaving={respondSaving}
                  onCancelRespond={() => setRespondingTo(null)}
                />
              ))}
            </div>

            {reviewPage < filteredRatings.length && (
              <button onClick={() => setReviewPage(p => p + 5)}
                className="w-full py-3 bg-[#24201C] border border-[#3A322A] text-[#F4EBDB] text-sm font-semibold rounded-2xl hover:border-[var(--color-rust)] hover:text-[var(--color-rust)] transition-all">
                Показать ещё ({filteredRatings.length - reviewPage} отзывов)
              </button>
            )}
          </div>
        )}

        {/* ══ TAB: MATERIALS ══ */}
        {tab === 'materials' && (
          <div className="animate-slide-up">

            {/* Шапка вкладки — фильтры + кнопка загрузки */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              {matDisciplines.length > 0 && (
                <>
                  {['all', ...matDisciplines].map(d => (
                    <button key={d} onClick={() => setMatFilter(d)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                        matFilter === d
                          ? 'bg-[var(--color-rust)] text-white border-[var(--color-rust)]'
                          : 'bg-[#24201C] border-[#3A322A] text-[#B8A999] hover:border-[var(--color-rust)]/40 hover:text-[#F4EBDB]'
                      }`}>
                      {d === 'all' ? 'Все материалы' : d}
                    </button>
                  ))}
                </>
              )}
              {/* Кнопка загрузки — только для владельца профиля */}
              {isOwn && (
                <Link
                  to="/materials/upload"
                  className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-[var(--color-rust)] text-white text-xs font-semibold rounded-xl hover:brightness-95 transition-all"
                >
                  <Upload size={13} />
                  Загрузить материал
                </Link>
              )}
            </div>

            {filteredMaterials.length === 0 ? (
              <div className="bg-[#24201C] rounded-3xl p-12 text-center border border-[#3A322A]">
                <span className="material-symbols-outlined text-[40px] text-[#6B625A]">folder_open</span>
                <p className="text-[#B8A999] mt-2 text-sm">
                  {isOwn ? 'Вы пока не загрузили ни одного материала' : 'Материалы не найдены'}
                </p>
                {isOwn && (
                  <Link
                    to="/materials/upload"
                    className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-[var(--color-rust)] text-white text-sm font-semibold rounded-xl hover:brightness-95 transition-all"
                  >
                    <Upload size={15} />
                    Загрузить первый материал
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMaterials.map(m => (
                  <MaterialCard
                    key={m.id}
                    material={m}
                    isBookmarked={bookmarked.has(m.id)}
                    onBookmark={isStudent ? () => toggleBookmark(m.id) : null}
                    bmPending={bmLoading.has(m.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: SETTINGS (own profile only) ══ */}
        {tab === 'settings' && isOwn && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">

            <div className="bg-[#24201C] rounded-3xl p-6 border border-[#3A322A]">
              <h3 className="text-base font-semibold text-[#F4EBDB] mb-5 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">person</span>
                Информация о профиле
              </h3>
              <form onSubmit={saveSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#B8A999] mb-1.5">Должность</label>
                  <input value={editForm.position} onChange={e=>setEditForm(f=>({...f,position:e.target.value}))} className={inputCls} placeholder="Доцент кафедры..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#B8A999] mb-1.5">Кафедра / Факультет</label>
                  <input value={editForm.department} onChange={e=>setEditForm(f=>({...f,department:e.target.value}))} className={inputCls} placeholder="Кафедра математики..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#B8A999] mb-1.5">Дата начала работы</label>
                  <input type="date" value={editForm.workStartDate} onChange={e=>setEditForm(f=>({...f,workStartDate:e.target.value}))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#B8A999] mb-1.5">О себе</label>
                  <textarea value={editForm.bio} onChange={e=>setEditForm(f=>({...f,bio:e.target.value}))} rows={4} maxLength={1000} className={inputCls+' resize-none'} placeholder="Ваша специализация, опыт, научные интересы..." />
                  <p className="text-[11px] text-[#B8A999] mt-1 text-right">{editForm.bio.length}/1000</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#B8A999] mb-1.5">Теги / Ключевые навыки (через запятую)</label>
                  <input value={editForm.tags} onChange={e=>setEditForm(f=>({...f,tags:e.target.value}))} className={inputCls} placeholder="Макроэкономика, Финансовый анализ..." />
                </div>

                {saveMsg && <p className={`text-sm font-medium ${saveMsg.includes('Ошибка') ? 'text-red-500' : 'text-emerald-600'}`}>{saveMsg}</p>}
                <button type="submit" disabled={saving} className="w-full py-3 bg-[var(--color-rust)] text-[#FFFDF7] text-sm font-semibold rounded-xl hover:brightness-95 transition-colors disabled:opacity-50">
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </form>
            </div>

            <div className="space-y-5">
              <div className="bg-[#24201C] rounded-3xl p-6 border border-[#3A322A]">
                <h3 className="text-base font-semibold text-[#F4EBDB] mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">link</span>
                  Ссылки
                </h3>
                <div className="space-y-3">
                  {[
                    { key: 'linkPortfolio', label: 'Портфолио', placeholder: 'https://...' },
                    { key: 'linkResearch',  label: 'ResearchGate', placeholder: 'https://researchgate.net/...' },
                    { key: 'linkOrcid',     label: 'ORCID', placeholder: 'https://orcid.org/...' },
                  ].map(l => (
                    <div key={l.key}>
                      <label className="block text-xs font-medium text-[#B8A999] mb-1">{l.label}</label>
                      <input value={editForm[l.key]} onChange={e=>setEditForm(f=>({...f,[l.key]:e.target.value}))} className={inputCls} placeholder={l.placeholder} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#24201C] rounded-3xl p-6 border border-[#3A322A]">
                <h3 className="text-base font-semibold text-[#F4EBDB] mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">photo_camera</span>
                  Фото профиля
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0"
                    style={!teacher.avatarUrl ? { background: getGradient(teacher.firstName) } : {}}>
                    {teacher.avatarUrl
                      ? <img src={teacher.avatarUrl} alt="" className="w-full h-full object-cover"/>
                      : <div className="w-full h-full flex items-center justify-center text-xl font-bold text-white">{initials}</div>
                    }
                  </div>
                  <div className="flex-1">
                    <button onClick={() => fileRef.current?.click()}
                      className="w-full py-2.5 bg-[#2E2824] text-[#F4EBDB] text-sm font-medium rounded-xl hover:bg-surface-container border border-[#3A322A]/80 transition-colors">
                      {uploading ? `Загрузка ${uploadProgress}%...` : 'Загрузить фото'}
                    </button>
                    {uploadError && <p className="text-[11px] text-red-500 mt-1">{uploadError}</p>}
                    <p className="text-[11px] text-[#B8A999] mt-1 text-center">JPG, PNG · Макс. 5 MB</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#24201C] rounded-3xl p-6 border border-[#3A322A]">
                <h3 className="text-base font-semibold text-[#F4EBDB] mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">shield</span>
                  Конфиденциальность
                </h3>
                <div className="space-y-4">
                  {[
                    { key: 'allowAnon', label: 'Разрешить анонимные отзывы' },
                    { key: 'showStats', label: 'Показывать статистику просмотров' },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-[#F4EBDB]">{opt.label}</span>
                      <div
                        onClick={() => setEditForm(f=>({...f,[opt.key]:!f[opt.key]}))}
                        className={`w-10 h-6 rounded-full transition-colors cursor-pointer relative ${editForm[opt.key] ? 'bg-[var(--color-rust)]' : 'bg-[#3A322A]'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-[#24201C] rounded-full shadow transition-transform ${editForm[opt.key] ? 'translate-x-5' : 'translate-x-1'}`} />
                      </div>
                    </label>
                  ))}
                </div>
                <button onClick={saveSettings} disabled={saving}
                  className="mt-4 w-full py-2.5 bg-[#2E2824] text-[#F4EBDB] text-sm font-medium rounded-xl hover:bg-[#3A322A] border border-[#3A322A]/80 transition-colors">
                  Сохранить настройки
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   ATTENDANCE PICKER — reusable 6-level grid
══════════════════════════════════════════════════════ */
function AttendancePicker({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#F4EBDB] mb-2">{label}</label>
      <div className="grid grid-cols-3 gap-2">
        {ATTENDANCE_OPTIONS.map(opt => (
          <button key={opt.v} type="button" onClick={() => onChange(opt.v)}
            className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center ${
              value === opt.v
                ? 'bg-[var(--color-rust)] text-white border-[var(--color-rust)]'
                : 'bg-[#1A1613] text-[#B8A999] border-[#3A322A] hover:text-[#E6D9C9] hover:border-[#6B625A]'
            }`}>
            <div className="font-bold">{opt.l}</div>
            <div className={`text-[10px] mt-0.5 ${value === opt.v ? 'text-white/70' : 'text-[#6B625A]'}`}>{opt.desc}</div>
          </button>
        ))}
      </div>
      {(value === 'very_low' || value === 'none') && (
        <p className="text-[11px] text-amber-600 mt-2 flex items-center gap-1">
          <AlertTriangle size={11} />
          {value === 'none'
            ? 'Отзывы без посещения имеют минимальный вес в рейтинге'
            : 'Отзывы с низкой посещаемостью имеют уменьшенный вес'}
        </p>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   RATING FORM — 3-step wizard (HSE-inspired)
   Шаг 1: Контекст  →  Шаг 2: Критерии  →  Шаг 3: Отзыв
══════════════════════════════════════════════════════ */
function RatingForm({
  teacher, ratingForm, setRatingForm,
  positiveComment, setPositiveComment,
  negativeComment, setNegativeComment,
  nps, setNps,
  anon, setAnon,
  discipline, setDiscipline, disciplines,
  attendance, setAttendance,
  attendanceLecture, setAttendanceLecture,
  attendanceSeminar, setAttendanceSeminar,
  role, setRole,
  semester, setSemester,
  courseScore, setCourseScore,
  showGuidelines, setShowGuidelines,
  submitting, error,
}) {
  const [formStep,   setFormStep]   = useState(1)
  const [stepError,  setStepError]  = useState('')
  const TOTAL_STEPS = 3
  const STEP_LABELS = ['Контекст', 'Критерии', 'Отзыв']

  const criteria = getCriteriaForTeacher(teacher)

  const avg = (() => {
    const scores = criteria.map(c => ratingForm[c.key]).filter(s => s !== null && s !== undefined && s > 0)
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  })()

  const needsLongComment  = avg > 0 && avg <= 3
  const combinedLen       = positiveComment.trim().length + negativeComment.trim().length
  const unansweredCount   = criteria.filter(c => ratingForm[c.key] === undefined).length

  function advanceStep() {
    if (formStep === 2 && unansweredCount > 0) {
      setStepError(`Пожалуйста, оцените все критерии (${unansweredCount} без ответа) или нажмите «Затрудняюсь ответить»`)
      return
    }
    setStepError('')
    setFormStep(s => Math.min(s + 1, TOTAL_STEPS))
  }
  function retreatStep() { setStepError(''); setFormStep(s => Math.max(s - 1, 1)) }

  return (
    <div className="pt-5 space-y-5">

      {/* ── Step indicator ── */}
      <div className="flex items-center">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="contents">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i + 1 === formStep ? 'bg-[var(--color-rust)] text-[#FFFDF7]' :
                i + 1 < formStep  ? 'bg-[var(--color-rust)] text-[#FFFDF7]' :
                'bg-[#1A1613] border border-[#3A322A] text-[#6B625A]'
              }`}>
                {i + 1 < formStep ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${i + 1 === formStep ? 'text-[#F4EBDB]' : 'text-[#B8A999]'}`}>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${i + 1 < formStep ? 'bg-[var(--color-rust)]' : 'bg-[#3A322A]'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ════ ШАГ 1: Контекст ════ */}
      {formStep === 1 && (
        <div className="space-y-5">
          {/* Guidelines */}
          <button type="button" onClick={() => setShowGuidelines(v => !v)}
            className="flex items-center gap-2 text-xs text-[#B8A999] hover:text-[var(--color-rust-soft)] transition-colors">
            <Info size={14} />
            {showGuidelines ? 'Скрыть правила оценивания' : 'Как правильно оценивать преподавателя?'}
          </button>
          {showGuidelines && (
            <div className="bg-[#1A1613] border border-[#3A322A] rounded-2xl p-5 space-y-3">
              <h4 className="text-sm font-semibold text-[#F4EBDB] flex items-center gap-2">
                <Info size={13} className="text-[var(--color-rust-soft)]" />
                Правила честного оценивания
              </h4>
              <ul className="text-xs text-[#B8A999] space-y-1.5 list-disc list-inside">
                <li>Оценивайте <strong className="text-[#E6D9C9]">преподавание</strong>, а не личность преподавателя</li>
                <li>Строгость — это не минус</li>
                <li>Будьте конкретны: «не объясняет формулы» лучше, чем «всё плохо»</li>
                <li>Если не посещали — нажмите «Затрудняюсь ответить» в критериях</li>
                <li>Отзыв проверяется модератором перед публикацией</li>
              </ul>
              <p className="text-[11px] text-[#8B827A] italic">Нарушения → отклонение. Повторные → блокировка аккаунта.</p>
            </div>
          )}

          {/* Semester selector */}
          <div>
            <label className="block text-sm font-semibold text-[#F4EBDB] mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-[#B8A999]">calendar_month</span>
              За какой период вы оцениваете?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {getSemesterOptions().map(sem => (
                <button key={sem} type="button" onClick={() => setSemester(sem)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    semester === sem
                      ? 'bg-[var(--color-rust)] text-white border-[var(--color-rust)]'
                      : 'bg-[#1A1613] text-[#B8A999] border-[#3A322A] hover:text-[#E6D9C9] hover:border-[#6B625A]'
                  }`}>
                  {sem}
                </button>
              ))}
            </div>
          </div>

          {/* Teacher role */}
          <div>
            <label className="block text-sm font-semibold text-[#F4EBDB] mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-[#B8A999]">school</span>
              Кем этот преподаватель был для вас?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: 'lecturer', l: 'Лектор',                icon: 'record_voice_over' },
                { v: 'seminar',  l: 'Семинарист / Практик',  icon: 'groups'            },
                { v: 'both',     l: 'Лектор и семинарист',   icon: 'diversity_3'       },
                { v: 'unknown',  l: 'Затрудняюсь ответить',  icon: 'help_outline'      },
              ].map(opt => (
                <button key={opt.v} type="button" onClick={() => setRole(role === opt.v ? null : opt.v)}
                  className={`flex items-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    role === opt.v
                      ? 'bg-[var(--color-rust)]/10 text-[var(--color-rust-soft)] border-[var(--color-rust)]/30'
                      : 'bg-[#1A1613] text-[#B8A999] border-[#3A322A] hover:text-[#E6D9C9] hover:border-[#6B625A]'
                  }`}>
                  <span className="material-symbols-outlined text-[15px]">{opt.icon}</span>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          {/* Discipline */}
          {disciplines.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-[#F4EBDB] mb-2">Дисциплина</label>
              <div className="flex flex-wrap gap-2">
                {disciplines.map(d => (
                  <button key={d} type="button" onClick={() => setDiscipline(discipline === d ? '' : d)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      discipline === d
                        ? 'bg-[var(--color-rust)]/10 text-[var(--color-rust-soft)] border-[var(--color-rust)]/30'
                        : 'bg-[#1A1613] text-[#B8A999] border-[#3A322A] hover:text-[#E6D9C9] hover:border-[#6B625A]'
                    }`}>{d}</button>
                ))}
              </div>
            </div>
          )}

          {/* Attendance — conditional on role */}
          {(role === 'lecturer' || role === 'both') && (
            <AttendancePicker
              label={role === 'both' ? 'Посещаемость лекций' : 'Посещаемость занятий'}
              value={attendanceLecture}
              onChange={setAttendanceLecture}
            />
          )}
          {(role === 'seminar' || role === 'both') && (
            <AttendancePicker
              label={role === 'both' ? 'Посещаемость семинаров / практик' : 'Посещаемость занятий'}
              value={attendanceSeminar}
              onChange={setAttendanceSeminar}
            />
          )}
          {(!role || role === 'unknown') && (
            <AttendancePicker
              label="Посещаемость занятий"
              value={attendance}
              onChange={setAttendance}
            />
          )}
        </div>
      )}

      {/* ════ ШАГ 2: Критерии ════ */}
      {formStep === 2 && (
        <div className="space-y-4">
          {unansweredCount > 0 && (
            <p className="text-[11px] text-[#B8A999] flex items-center gap-1.5">
              <Info size={11} className="text-[#8B827A]" />
              Осталось ответить: <span className="font-semibold">{unansweredCount}</span> из {criteria.length}. Если не уверены — нажмите «Затрудняюсь».
            </p>
          )}
          {criteria.map(c => {
            const val     = ratingForm[c.key]
            const isSkipped = val === null
            const numVal  = typeof val === 'number' ? val : 0
            const color   = numVal >= 8 ? '#4A7A3C' : numVal >= 6 ? '#B84A1E' : numVal >= 4 ? '#C29A2A' : numVal > 0 ? '#9A2B1A' : '#3A322A'
            return (
              <div key={c.key} className={`rounded-2xl p-4 border transition-all ${
                val === undefined ? 'border-[#3A322A] bg-[#24201C]' :
                isSkipped        ? 'border-[#3A322A] bg-[#2E2824]' :
                                   'border-[#3A322A] bg-[#24201C]'
              }`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 pr-2">
                    <label className="text-sm font-semibold text-[#F4EBDB]">{c.label}</label>
                    {c.hint && <p className="text-xs text-[#B8A999] mt-0.5">{c.hint}</p>}
                  </div>
                  {isSkipped ? (
                    <span className="flex-shrink-0 px-2.5 py-1 rounded-xl bg-[#1A1613] border border-[#3A322A] text-[#8B827A] text-[11px] font-medium">Затрудняюсь</span>
                  ) : numVal > 0 ? (
                    <span className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-[#FFFDF7]" style={{ background: color }}>{numVal}</span>
                  ) : (
                    <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#1A1613] border border-[#3A322A] flex items-center justify-center text-xs text-[#6B625A]">—</span>
                  )}
                </div>
                {!isSkipped && (
                  <div className="flex gap-1 mb-2">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                      <button key={n} type="button"
                        onClick={() => setRatingForm(f => ({ ...f, [c.key]: n }))}
                        className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all ${numVal === n ? 'text-[#FFFDF7] shadow-sm' : 'bg-[#1A1613] text-[#8B827A] hover:bg-[#2E2824] hover:text-[#E6D9C9]'}`}
                        style={numVal === n ? { background: color } : {}}>{n}</button>
                    ))}
                  </div>
                )}
                {c.examples && numVal > 0 && !isSkipped && (
                  <p className="text-[11px] italic mb-2" style={{ color: numVal <= 3 ? '#D84A34' : numVal >= 8 ? '#7CB554' : '#8B827A' }}>
                    {numVal <= 3 ? `1–3: ${c.examples.low}` : numVal >= 8 ? `8–10: ${c.examples.high}` : ''}
                  </p>
                )}
                <button type="button"
                  onClick={() => setRatingForm(f => ({ ...f, [c.key]: isSkipped ? undefined : null }))}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                    isSkipped
                      ? 'bg-[var(--color-rust)]/10 text-[var(--color-rust-soft)] border-[var(--color-rust)]/30 hover:bg-[var(--color-rust)]/15'
                      : 'bg-[#1A1613] text-[#8B827A] border-[#3A322A] hover:bg-[#2E2824] hover:text-[#B8A999]'
                  }`}>
                  <span className="material-symbols-outlined text-[15px]">{isSkipped ? 'undo' : 'help_outline'}</span>
                  {isSkipped ? 'Всё же оценить' : 'Затрудняюсь ответить'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ════ ШАГ 3: Отзыв ════ */}
      {formStep === 3 && (
        <div className="space-y-5">
          {/* Score summary card */}
          {avg > 0 && (
            <div className="flex items-center gap-3 p-3 bg-[#1A1613] rounded-xl border border-[#3A322A]">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0 ${
                avg >= 8 ? 'bg-emerald-600' : avg >= 6 ? 'bg-[#B84A1E]' : avg >= 4 ? 'bg-amber-600' : 'bg-red-700'
              }`}>{avg.toFixed(1)}</div>
              <div>
                <p className="text-sm font-semibold text-[#F4EBDB]">Ваша средняя оценка</p>
                <p className="text-xs text-[#B8A999]">
                  {semester} · {discipline || 'Дисциплина не выбрана'}
                </p>
              </div>
            </div>
          )}

          {/* Positive comment */}
          <div>
            <label className="block text-sm font-semibold text-[#F4EBDB] mb-1.5 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#1A2A1A] text-emerald-400 flex items-center justify-center text-[11px] font-bold border border-emerald-800/50">+</span>
              Что понравилось?
              <span className="text-[#B8A999] font-normal text-xs">(необязательно)</span>
            </label>
            <textarea value={positiveComment} onChange={e => setPositiveComment(e.target.value)} rows={2}
              maxLength={REVIEW_RULES.maxCommentLength}
              placeholder="Что было особенно хорошо: объяснения, материалы, отношение..."
              className="w-full px-4 py-3 rounded-xl border border-[#3A4A3A] bg-[#1A1C1A] text-[#F4EBDB] placeholder:text-[#5A5A52] text-sm focus:outline-none focus:shadow-[0_0_0_3px_rgba(74,122,60,0.25)] focus:border-[#4A7A3C] transition-all resize-none" />
            <p className="text-[11px] text-[#B8A999] mt-1 text-right">{positiveComment.length}/{REVIEW_RULES.maxCommentLength}</p>
          </div>

          {/* Negative comment */}
          <div>
            <label className="block text-sm font-semibold text-[#F4EBDB] mb-1.5 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#2A1E0A] text-amber-400 flex items-center justify-center text-[11px] font-bold border border-amber-800/50">△</span>
              Что можно улучшить?
              {needsLongComment
                ? <span className="text-red-500 font-normal text-xs">(обязательно при оценке ≤3, мин. {REVIEW_RULES.minCommentForLowScore} симв.)</span>
                : <span className="text-[#B8A999] font-normal text-xs">(необязательно)</span>}
            </label>
            <textarea value={negativeComment} onChange={e => setNegativeComment(e.target.value)} rows={2}
              maxLength={REVIEW_RULES.maxCommentLength}
              placeholder={needsLongComment ? 'Опишите подробно, что именно не понравилось...' : 'Что можно было сделать лучше...'}
              className={`w-full px-4 py-3 rounded-xl border text-[#F4EBDB] placeholder:text-[#5A5A52] text-sm focus:outline-none transition-all resize-none ${
                needsLongComment && combinedLen < REVIEW_RULES.minCommentForLowScore
                  ? 'bg-[#1C1818] border-[#5A2A2A] focus:shadow-[0_0_0_3px_rgba(154,43,26,0.25)] focus:border-[#7A2A1A]'
                  : 'bg-[#1C1A14] border-[#4A3A22] focus:shadow-[0_0_0_3px_rgba(194,154,42,0.2)] focus:border-[#7A6030]'
              }`} />
            <div className="flex justify-between mt-1">
              {needsLongComment && combinedLen < REVIEW_RULES.minCommentForLowScore && (
                <p className="text-[11px] text-red-500">Ещё {REVIEW_RULES.minCommentForLowScore - combinedLen} символов (суммарно)</p>
              )}
              <p className="text-[11px] text-[#B8A999] ml-auto">{negativeComment.length}/{REVIEW_RULES.maxCommentLength}</p>
            </div>
          </div>

          {/* NPS */}
          <div className="p-4 bg-[var(--color-rust)]/5 rounded-2xl border border-[var(--color-rust)]/10">
            <label className="block text-sm font-semibold text-[#F4EBDB] mb-3">
              Порекомендуете ли вы этого преподавателя однокурсникам?
            </label>
            <div className="flex gap-2">
              {[
                { v: 'yes',   l: 'Да, однозначно',  icon: 'thumb_up',       cls: 'bg-emerald-600 text-white border-emerald-600', base: 'bg-[#1A1613] text-[#B8A999] border-[#3A322A] hover:text-[#E6D9C9] hover:border-emerald-800' },
                { v: 'maybe', l: 'Скорее да',        icon: 'thumbs_up_down', cls: 'bg-amber-600 text-white border-amber-600',     base: 'bg-[#1A1613] text-[#B8A999] border-[#3A322A] hover:text-[#E6D9C9] hover:border-amber-800'   },
                { v: 'no',    l: 'Нет',              icon: 'thumb_down',     cls: 'bg-red-700 text-white border-red-700',          base: 'bg-[#1A1613] text-[#B8A999] border-[#3A322A] hover:text-[#E6D9C9] hover:border-red-900'     },
              ].map(opt => (
                <button key={opt.v} type="button" onClick={() => setNps(nps === opt.v ? null : opt.v)}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all text-center flex flex-col items-center gap-1 ${nps === opt.v ? opt.cls : opt.base}`}>
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{opt.icon}</span>
                  {opt.l}
                </button>
              ))}
            </div>
            {nps == null && <p className="text-[11px] text-[#B8A999] mt-2 text-center">Не обязательно, но очень помогает другим студентам</p>}
          </div>

          {/* Course score */}
          <div>
            <label className="block text-sm font-semibold text-[#F4EBDB] mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-[#B8A999]">school</span>
              Оценка курса в целом
              <span className="text-[#B8A999] font-normal text-xs">(содержание, программа — необязательно)</span>
            </label>
            <div className="flex gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                const cColor = n >= 8 ? '#4A7A3C' : n >= 6 ? '#B84A1E' : n >= 4 ? '#C29A2A' : '#9A2B1A'
                return (
                  <button key={n} type="button" onClick={() => setCourseScore(courseScore === n ? 0 : n)}
                    className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all ${courseScore === n ? 'text-[#FFFDF7] shadow-sm' : 'bg-[#1A1613] text-[#8B827A] hover:bg-[#2E2824] hover:text-[#E6D9C9]'}`}
                    style={courseScore === n ? { background: cColor } : {}}>{n}</button>
                )
              })}
            </div>
          </div>

          {/* Anonymity */}
          <label className="flex items-center justify-between cursor-pointer p-4 bg-[#1A1613] rounded-xl border border-[#3A322A]">
            <div>
              <p className="text-sm font-semibold text-[#F4EBDB]">Анонимный отзыв</p>
              <p className="text-xs text-[#B8A999] mt-0.5">Имя не отображается, но модераторы могут идентифицировать вас</p>
            </div>
            <div onClick={() => setAnon(v => !v)}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${anon ? 'bg-[var(--color-rust)]' : 'bg-[#3A322A]'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-[#E6D9C9] rounded-full shadow transition-transform ${anon ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
          </label>

          {error && (
            <p className="text-sm text-red-500 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {error}
            </p>
          )}
        </div>
      )}

      {/* Step error */}
      {stepError && (
        <p className="text-sm text-[#D4A832] flex items-center gap-2 bg-[#2A200A] border border-[#5A4010] rounded-xl px-4 py-3">
          <AlertTriangle size={15} className="flex-shrink-0" />
          {stepError}
        </p>
      )}

      {/* ── Navigation ── */}
      <div className="flex gap-3 pt-1">
        {formStep > 1 && (
          <button type="button" onClick={retreatStep}
            className="flex items-center gap-1.5 px-5 py-2.5 border border-[#3A322A] text-[#F4EBDB] text-sm font-semibold rounded-xl hover:border-[#6B625A] transition-all">
            ← Назад
          </button>
        )}
        {formStep < TOTAL_STEPS ? (
          <button type="button" onClick={advanceStep}
            className="flex-1 py-2.5 bg-[var(--color-rust)] text-white text-sm font-bold rounded-xl hover:bg-[#C55830] transition-all">
            Далее →
          </button>
        ) : (
          <button type="submit" disabled={submitting}
            className="flex-1 py-3 bg-[var(--color-rust)] text-[#FFFDF7] font-bold text-sm rounded-xl hover:brightness-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            <Send size={16} />
            {submitting ? 'Отправка...' : 'Отправить отзыв'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   REVIEW CARD — with votes, flags, teacher response
══════════════════════════════════════════════════════ */
function ReviewCard({
  rating, teacher, user, userData,
  isTeacherOwner, onRespond, respondingTo, responseText, setResponseText,
  onSubmitResponse, respondSaving, onCancelRespond,
}) {
  const [expanded, setExpanded] = useState(false)
  const [showFlagMenu, setShowFlagMenu] = useState(false)
  const [voteStatus, setVoteStatus] = useState(null) // 'voted' | 'flagged'

  const score = rating.averageScore || 0
  const scoreColor =
    score >= 8.5 ? { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-200', bar: 'bg-emerald-400' } :
    score >= 7   ? { bg: 'bg-blue-50',    text: 'text-blue-600',    ring: 'ring-blue-200',    bar: 'bg-blue-400'    } :
    score >= 5   ? { bg: 'bg-amber-50',   text: 'text-amber-600',   ring: 'ring-amber-200',   bar: 'bg-amber-400'   } :
                   { bg: 'bg-red-50',     text: 'text-red-500',     ring: 'ring-red-200',     bar: 'bg-red-400'     }

  const criteria = getCriteriaForTeacher(teacher)
  const hasCriteria = rating.criteriaScores && criteria.some(c => rating.criteriaScores[c.key] != null)

  const authorLabel = rating.isAnonymous
    ? 'Анонимный студент'
    : `Студент${rating.studentCourse ? `, ${rating.studentCourse} курс` : ''}`

  const hasLongPositive  = (rating.positiveComment || '').length > 200
  const hasLongNegative  = (rating.negativeComment || '').length > 200
  const hasLongComment   = !rating.positiveComment && !rating.negativeComment && (rating.comment || '').length > 200
  const npsInfo = npsLabel(rating.nps)

  async function handleVote(isHelpful) {
    if (!user || voteStatus || userData?.isActive === false) return
    const { error } = await voteReview(rating.id, user.uid, isHelpful)
    if (!error) {
      setVoteStatus('voted')
      if (isHelpful) rating.helpfulVotes = (rating.helpfulVotes || 0) + 1
      else rating.unhelpfulVotes = (rating.unhelpfulVotes || 0) + 1
    }
  }

  async function handleFlag(reason) {
    if (!user || userData?.isActive === false) return
    const { error } = await flagReview(rating.id, user.uid, reason)
    if (!error) {
      setVoteStatus('flagged')
      setShowFlagMenu(false)
    }
  }

  return (
    <div className="bg-[#24201C] rounded-2xl border border-[#3A322A] hover:shadow-md transition-all duration-200 overflow-hidden">

      {/* Score bar accent at top */}
      <div className={`h-1 w-full ${scoreColor.bar} opacity-60`} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${scoreColor.bg} flex items-center justify-center flex-shrink-0`}>
              <span className={`material-symbols-outlined text-[20px] ${scoreColor.text}`}>
                {rating.isAnonymous ? 'person_off' : 'person'}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#F4EBDB]">{authorLabel}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                <p className="text-xs text-[#B8A999]">{timeAgo(rating.createdAt)}</p>
                {rating.semester && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                    {rating.semester}
                  </span>
                )}
                {rating.discipline && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded-full">{rating.discipline}</span>
                )}
                {(rating.attendanceLevel === 'low' || rating.attendanceLevel === 'very_low' || rating.attendanceLevel === 'none') && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full flex items-center gap-0.5">
                    <Eye size={9} />
                    {rating.attendanceLevel === 'none' ? 'Не посещал' :
                     rating.attendanceLevel === 'very_low' ? '1–20%' : '21–40%'}
                  </span>
                )}
                {npsInfo && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${npsInfo.cls}`}>
                    {npsInfo.text}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Score badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ring-1 ${scoreColor.bg} ${scoreColor.text} ${scoreColor.ring} flex-shrink-0`}>
            <span className="material-symbols-outlined text-[15px]" style={{fontVariationSettings:"'FILL' 1"}}>star</span>
            <span className="text-sm font-bold">{score.toFixed(1)}</span>
            <span className="text-[11px] opacity-70">/10</span>
          </div>
        </div>

        {/* Criteria bars */}
        {hasCriteria && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-4 p-3 bg-[#2E2824] rounded-xl">
            {criteria.map(c => {
              const val = rating.criteriaScores?.[c.key]
              if (val == null) return null
              return (
                <div key={c.key}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] text-[#B8A999] truncate pr-2">{c.label}</span>
                    <span className="text-[11px] font-bold text-[#F4EBDB] flex-shrink-0">{val}</span>
                  </div>
                  <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${scoreColor.bar}`}
                      style={{ width: `${val * 10}%`, opacity: 0.8 }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Two-field comments (new format) */}
        {(rating.positiveComment || rating.negativeComment) ? (
          <div className="space-y-2">
            {rating.positiveComment && (
              <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 px-4 py-3">
                <p className="text-[11px] font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center text-[9px] font-bold">+</span>
                  Что понравилось
                </p>
                <p className={`text-sm text-emerald-900 leading-relaxed ${!expanded && hasLongPositive ? 'line-clamp-3' : ''}`}>
                  {rating.positiveComment}
                </p>
                {hasLongPositive && (
                  <button onClick={() => setExpanded(v => !v)} className="mt-1 text-xs text-emerald-700 font-medium hover:underline">
                    {expanded ? 'Свернуть' : 'Читать полностью'}
                  </button>
                )}
              </div>
            )}
            {rating.negativeComment && (
              <div className="rounded-xl bg-amber-50/60 border border-amber-100 px-4 py-3">
                <p className="text-[11px] font-semibold text-amber-700 mb-1 flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center text-[9px] font-bold">△</span>
                  Что можно улучшить
                </p>
                <p className={`text-sm text-amber-900 leading-relaxed ${!expanded && hasLongNegative ? 'line-clamp-3' : ''}`}>
                  {rating.negativeComment}
                </p>
                {hasLongNegative && (
                  <button onClick={() => setExpanded(v => !v)} className="mt-1 text-xs text-amber-700 font-medium hover:underline">
                    {expanded ? 'Свернуть' : 'Читать полностью'}
                  </button>
                )}
              </div>
            )}
            {/* Course score if set */}
            {rating.courseScore != null && (
              <div className="flex items-center gap-2 text-[11px] text-[#B8A999] pl-1">
                <span className="material-symbols-outlined text-[13px] text-purple-400">school</span>
                Курс в целом: <span className="font-bold text-[#F4EBDB]">{rating.courseScore}/10</span>
              </div>
            )}
          </div>
        ) : rating.comment ? (
          /* Legacy single-comment format */
          <div className="relative">
            <span className="absolute -top-1 -left-0.5 text-3xl text-slate-200 font-serif leading-none select-none">"</span>
            <p className={`text-sm text-[#B8A999] leading-relaxed pl-4 ${!expanded && hasLongComment ? 'line-clamp-3' : ''}`}>
              {rating.comment}
            </p>
            {hasLongComment && (
              <button onClick={() => setExpanded(v => !v)} className="mt-1.5 ml-4 text-xs text-primary font-medium hover:underline">
                {expanded ? 'Свернуть' : 'Читать полностью'}
              </button>
            )}
          </div>
        ) : null}

        {/* ── Teacher response ── */}
        {rating.teacherResponse && (
          <div className="mt-4 ml-4 pl-4 border-l-2 border-[var(--color-rust)]/20">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle size={13} className="text-[var(--color-rust)]" />
              <span className="text-xs font-semibold text-[var(--color-rust)]">Ответ преподавателя</span>
              {rating.teacherResponseAt && (
                <span className="text-[10px] text-[#B8A999]">{timeAgo(rating.teacherResponseAt)}</span>
              )}
            </div>
            <p className="text-sm text-[#B8A999] leading-relaxed">{rating.teacherResponse}</p>
          </div>
        )}

        {/* ── Teacher respond form ── */}
        {isTeacherOwner && !rating.teacherResponse && respondingTo === rating.id && (
          <div className="mt-4 ml-4 pl-4 border-l-2 border-[var(--color-rust)]/20 space-y-2">
            <textarea
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Ваш ответ на этот отзыв..."
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-[#3A322A] text-sm focus:outline-none focus:border-[var(--color-rust)] focus:shadow-[0_0_0_3px_rgba(184,74,30,0.15)] resize-none transition-all"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onSubmitResponse(rating.id)}
                disabled={respondSaving || !responseText.trim()}
                className="px-4 py-1.5 bg-[var(--color-rust)] text-white text-xs font-semibold rounded-lg disabled:opacity-50"
              >
                {respondSaving ? 'Отправка...' : 'Ответить'}
              </button>
              <button type="button" onClick={onCancelRespond} className="px-4 py-1.5 text-xs text-slate-500 hover:text-slate-700">
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* ── Actions: vote, flag, respond ── */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[#3A322A]">
          {/* Helpful votes */}
          {user && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleVote(true)}
                disabled={voteStatus !== null}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  voteStatus ? 'text-slate-300 cursor-default' : 'text-slate-400 hover:text-emerald-500'
                }`}
                title="Полезный отзыв"
              >
                <ThumbsUp size={13} />
                {(rating.helpfulVotes || 0) > 0 && <span>{rating.helpfulVotes}</span>}
              </button>
              <button
                onClick={() => handleVote(false)}
                disabled={voteStatus !== null}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  voteStatus ? 'text-slate-300 cursor-default' : 'text-slate-400 hover:text-red-400'
                }`}
                title="Неполезный отзыв"
              >
                <ThumbsDown size={13} />
                {(rating.unhelpfulVotes || 0) > 0 && <span>{rating.unhelpfulVotes}</span>}
              </button>
            </div>
          )}

          {/* Flag button */}
          {user && userData?.role === 'student' && (
            <div className="relative ml-auto">
              <button
                onClick={() => setShowFlagMenu(v => !v)}
                disabled={voteStatus === 'flagged'}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  voteStatus === 'flagged' ? 'text-red-300 cursor-default' : 'text-slate-400 hover:text-red-400'
                }`}
                title="Пожаловаться"
              >
                <Flag size={13} />
                {voteStatus === 'flagged' ? 'Жалоба отправлена' : 'Пожаловаться'}
              </button>

              {showFlagMenu && (
                <div className="absolute right-0 bottom-full mb-2 w-56 bg-[#24201C] rounded-xl shadow-lg border border-[#3A322A] p-2 z-50">
                  <p className="text-xs font-semibold text-[#F4EBDB] px-2 py-1.5">Причина жалобы:</p>
                  {FLAG_REASONS.map(reason => (
                    <button
                      key={reason}
                      onClick={() => handleFlag(reason)}
                      className="w-full text-left px-2 py-1.5 text-xs text-[#B8A999] hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      {reason}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowFlagMenu(false)}
                    className="w-full text-center px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 mt-1"
                  >
                    Отмена
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Teacher respond button */}
          {isTeacherOwner && !rating.teacherResponse && respondingTo !== rating.id && (
            <button
              onClick={() => onRespond(rating.id)}
              className="flex items-center gap-1 text-xs text-[var(--color-rust)] hover:text-[#C55830] transition-colors ml-auto"
            >
              <MessageCircle size={13} />
              Ответить
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Material Card ── */
function MaterialCard({ material, isBookmarked = false, onBookmark = null, bmPending = false }) {
  const { icon, bg, text } = getFileConfig(material.fileType)
  return (
    <div className="bg-[#2E2824] p-5 rounded-2xl hover:bg-[#24201C] hover:shadow-sm transition-all group border border-transparent hover:border-[#3A322A]/60 relative">
      {/* Bookmark button */}
      {onBookmark && (
        <button
          onClick={() => onBookmark()}
          disabled={bmPending}
          title={isBookmarked ? 'Убрать из закладок' : 'В закладки'}
          className="absolute top-4 right-4 p-1 rounded-lg transition-colors disabled:opacity-50 z-10"
        >
          <span className={`material-symbols-outlined text-[18px] ${isBookmarked ? 'text-[var(--color-rust)]' : 'text-[#6B625A] hover:text-[var(--color-rust-soft)]'}`}>
            {isBookmarked ? 'bookmark' : 'bookmark_border'}
          </span>
        </button>
      )}
      <a
        href={material.fileUrl}
        target="_blank"
        rel="noreferrer"
        className="block"
      >
        <div className={`w-11 h-11 ${bg} ${text} rounded-xl flex items-center justify-center mb-3`}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <h4 className="text-sm font-semibold text-[#F4EBDB] line-clamp-2 mb-1 pr-6">{material.title}</h4>
        <p className="text-[11px] text-[#B8A999] uppercase tracking-wide">
          {[material.discipline, material.fileType?.toUpperCase(), formatSize(material.fileSize)].filter(Boolean).join(' · ')}
        </p>
        <div className="flex items-center justify-between mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-xs text-[#B8A999]">{timeAgo(material.createdAt)}</span>
          <span className="material-symbols-outlined text-primary text-[18px]">download</span>
        </div>
      </a>
    </div>
  )
}

/* ── Unirate-метрика: тёмная карточка с большим числом ── */
function UnirateMetric({ value, label, hint, accent, trend }) {
  return (
    <div className="rounded-[20px] bg-[#24201C] border border-[#3A322A] p-5">
      <div className="flex items-baseline gap-2 mb-3">
        <span className={`font-display text-[36px] leading-none tracking-[-0.02em] ${accent ? 'text-[var(--color-rust)]' : 'text-[#F4EBDB]'}`}>
          {value}
        </span>
        {trend && (
          <span className={`text-[12px] font-mono font-semibold ${trend.up ? 'text-[var(--color-ok)]' : 'text-[var(--color-danger)]'}`}>
            {trend.up ? '+' : '−'}{trend.diff}
          </span>
        )}
      </div>
      <div className="text-[11px] font-medium tracking-[0.18em] uppercase text-[#B8A999]">{label}</div>
      {hint && <div className="text-[11px] text-[#8B827A] mt-1">{hint}</div>}
    </div>
  )
}
