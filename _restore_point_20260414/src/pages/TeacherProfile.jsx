import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTeacherById } from '../services/teachers'
import { getApprovedRatings, createRating, hasStudentRated } from '../services/ratings'
import { getTeacherMaterials } from '../services/materials'
import { updateTeacherDocument } from '../services/firestore'
import { RATING_CRITERIA } from '../utils/ratingCriteria'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '../services/firebase'
import { Star, Send, Lock, CheckCircle, ArrowUpDown, ChevronDown, ChevronUp, Download } from 'lucide-react'

/* ── Constants ── */
const FILE_CONFIG = {
  pdf:  { icon: 'picture_as_pdf', bg: 'bg-red-50',    text: 'text-red-500'    },
  docx: { icon: 'description',    bg: 'bg-blue-50',   text: 'text-blue-500'   },
  doc:  { icon: 'description',    bg: 'bg-blue-50',   text: 'text-blue-500'   },
  mp4:  { icon: 'play_circle',    bg: 'bg-purple-50', text: 'text-purple-500' },
  pptx: { icon: 'slideshow',      bg: 'bg-orange-50', text: 'text-orange-500' },
  xlsx: { icon: 'table_chart',    bg: 'bg-green-50',  text: 'text-green-500'  },
}
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
const TAG_COLORS = [
  'bg-blue-50 text-blue-700', 'bg-purple-50 text-purple-700',
  'bg-emerald-50 text-emerald-700', 'bg-amber-50 text-amber-700',
  'bg-pink-50 text-pink-700', 'bg-indigo-50 text-indigo-700',
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

/* ── Compute criteria averages from ratings ── */
function computeCriteriaAverages(ratings, teacherType) {
  const criteria = RATING_CRITERIA[teacherType] || RATING_CRITERIA.universal
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
    avg: counts[c.key] > 0 ? (sums[c.key] / counts[c.key]).toFixed(1) : null,
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
    { id: 'super',    icon: 'school',             label: 'Научный руководитель', desc: 'Статус научного руководителя',unlocked: teacher.teacherType==='supervisor', color: 'purple' },
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
  const [reviewFilter, setReviewFilter] = useState('all') // all | high | low
  const [reviewSort,   setReviewSort]   = useState('newest')
  const [reviewPage,   setReviewPage]   = useState(5)

  /* Materials filters */
  const [matFilter, setMatFilter] = useState('all')

  /* Review form */
  const [hasRated,      setHasRated]      = useState(false)
  const [showForm,      setShowForm]      = useState(false)
  const [ratingForm,    setRatingForm]    = useState({})
  const [ratingComment, setRatingComment] = useState('')
  const [ratingAnon,    setRatingAnon]    = useState(true)
  const [submitting,    setSubmitting]    = useState(false)
  const [submitMsg,     setSubmitMsg]     = useState('')

  /* Edit mode (own profile) */
  const isOwn = user && teacher && user.uid === teacher.userId
  const [editing, setEditing]   = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving,   setSaving]   = useState(false)
  const [saveMsg,  setSaveMsg]  = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    Promise.all([
      getTeacherById(id),
      getApprovedRatings(id),
      getTeacherMaterials(id),
    ]).then(([{ teacher: t }, { ratings: r }, { materials: m }]) => {
      setTeacher(t)
      setRatings(r || [])
      setMaterials(m || [])
      /* Init criteria form */
      const criteria = RATING_CRITERIA[t?.teacherType] || RATING_CRITERIA.universal
      const init = {}
      criteria.forEach(c => { init[c.key] = 0 })
      setRatingForm(init)
      if (t) setEditForm({
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
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    if (user && userData?.role === 'student' && teacher) {
      hasStudentRated(teacher.id, user.uid).then(({ hasRated: h }) => setHasRated(h))
    }
  }, [user, userData, teacher])

  /* Submit review */
  async function handleSubmitRating(e) {
    e.preventDefault()
    const criteria = RATING_CRITERIA[teacher.teacherType] || RATING_CRITERIA.universal
    const scores = criteria.map(c => ratingForm[c.key] || 0)
    if (scores.some(s => s === 0)) {
      setSubmitMsg('Пожалуйста, оцените все критерии')
      return
    }
    const avg = scores.reduce((a,b) => a + b, 0) / scores.length
    setSubmitting(true)
    const { error } = await createRating({
      teacherId:      teacher.id,
      studentId:      user.uid,
      criteriaScores: ratingForm,
      averageScore:   Math.round(avg * 10) / 10,
      comment:        ratingComment.trim(),
      studentCourse:  userData?.course || null,
      isAnonymous:    ratingAnon,
    })
    setSubmitting(false)
    if (error) {
      setSubmitMsg('Ошибка при отправке. Попробуйте позже.')
    } else {
      setSubmitMsg('success')
      setHasRated(true)
      setShowForm(false)
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
    <div className="min-h-screen bg-surface pt-20">
      <div className="max-w-5xl mx-auto px-6 space-y-6">
        <div className="h-56 bg-surface-container rounded-3xl animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({length:4}).map((_,i)=>(
            <div key={i} className="h-24 bg-surface-container rounded-2xl animate-pulse"/>
          ))}
        </div>
      </div>
    </div>
  )

  if (!teacher) return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center">
        <span className="material-symbols-outlined text-[48px] text-slate-300">person_off</span>
        <p className="text-on-surface-variant mt-2">Преподаватель не найден</p>
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
  const criteriaAvgs = computeCriteriaAverages(ratings, teacher.teacherType)
  const achievements = getAchievements(teacher, ratings, materials)
  const tags = teacher.tags || teacher.disciplines || []

  /* Activity indicator */
  const lastMat = materials[0]?.createdAt
  const daysSinceUpload = lastMat
    ? Math.floor((Date.now() - (lastMat.toDate?.() || new Date(lastMat)).getTime()) / 86400000)
    : 999
  const activityColor = daysSinceUpload < 14 ? 'bg-emerald-400' : daysSinceUpload < 60 ? 'bg-amber-400' : 'bg-slate-300'
  const activityLabel = daysSinceUpload < 14 ? 'Активен' : daysSinceUpload < 60 ? 'Менее активен' : 'Давно не заходил'

  /* Sorted reviews */
  let filteredRatings = [...ratings]
  if (reviewSort === 'newest')
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

  const inputCls = "w-full px-4 py-3 rounded-xl bg-surface-container-low border border-slate-200/80 text-on-surface placeholder:text-on-surface-variant/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"

  return (
    <div className="min-h-screen bg-surface pt-20 pb-16">
      <div className="max-w-5xl mx-auto px-6">

        {/* ══ HERO CARD ══ */}
        <div className="relative rounded-3xl overflow-hidden mb-8" style={{ background: '#002366' }}>
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #ccff00 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          {/* Glow */}
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[#ccff00] opacity-10 blur-3xl pointer-events-none" />

          <div className="relative px-8 pt-8 pb-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">

              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div
                  className={`w-28 h-28 rounded-2xl border-4 border-white/20 overflow-hidden ${isOwn ? 'cursor-pointer group' : ''}`}
                  style={!teacher.avatarUrl ? { background: 'rgba(255,255,255,0.15)' } : {}}
                  onClick={() => isOwn && fileRef.current?.click()}
                >
                  {teacher.avatarUrl ? (
                    <img src={teacher.avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white">
                      {initials || '?'}
                    </div>
                  )}
                  {isOwn && (
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-[22px]">photo_camera</span>
                    </div>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">{uploadProgress}%</span>
                    </div>
                  )}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#002366] ${activityColor}`} title={activityLabel} />
                {isOwn && <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold tracking-tight text-white font-headline">{fullName || 'Без имени'}</h1>
                  {achievements.find(a=>a.id==='top')?.unlocked && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 bg-[#ccff00] text-[#002366] text-xs font-bold rounded-full">
                      <span className="material-symbols-outlined text-[13px]" style={{fontVariationSettings:"'FILL' 1"}}>workspace_premium</span>
                      Лучший
                    </span>
                  )}
                </div>

                <p className="text-white/70 text-sm">
                  {teacher.position || TEACHER_TYPE_LABELS[teacher.teacherType] || 'Преподаватель'}
                  {teacher.department && <span className="text-white/40"> · {teacher.department}</span>}
                </p>

                {experience && (
                  <p className="text-white/50 text-xs mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    Стаж: {experience}
                  </p>
                )}

                {teacher.bio && (
                  <p className="text-white/60 text-sm mt-3 max-w-2xl leading-relaxed line-clamp-2">{teacher.bio}</p>
                )}

                {/* Links */}
                {(teacher.linkPortfolio || teacher.linkResearch || teacher.linkOrcid) && (
                  <div className="flex gap-3 mt-3">
                    {teacher.linkPortfolio && <a href={teacher.linkPortfolio} target="_blank" rel="noreferrer" className="text-xs text-[#ccff00] hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">link</span>Портфолио</a>}
                    {teacher.linkResearch  && <a href={teacher.linkResearch}  target="_blank" rel="noreferrer" className="text-xs text-[#ccff00] hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">science</span>ResearchGate</a>}
                    {teacher.linkOrcid     && <a href={teacher.linkOrcid}     target="_blank" rel="noreferrer" className="text-xs text-[#ccff00] hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">badge</span>ORCID</a>}
                  </div>
                )}
              </div>

              {/* Edit button */}
              {isOwn && (
                <button
                  onClick={() => { setEditing(v=>!v); setTab('settings') }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#ccff00] text-[#002366] text-sm font-bold rounded-xl hover:brightness-95 transition-all flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  Редактировать
                </button>
              )}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-white/10">
                {tags.map((tag, i) => (
                  <span key={tag} className="px-3 py-1 text-xs font-medium rounded-full bg-white/10 text-white/80 border border-white/10">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══ STATS ══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {/* Big rating */}
          <div className="col-span-2 sm:col-span-1 bg-surface-container-lowest rounded-2xl p-5 border border-slate-100 flex flex-col items-center gap-1">
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-on-surface">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
              {avgRating > 0 && <span className="text-on-surface-variant text-sm mb-1">/10</span>}
            </div>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-amber-400 text-[18px]" style={{fontVariationSettings:"'FILL' 1"}}>star</span>
              {trend && (
                <span className={`flex items-center text-xs font-semibold ${trend.up ? 'text-emerald-500' : 'text-red-400'}`}>
                  <span className="material-symbols-outlined text-[14px]">{trend.up ? 'trending_up' : 'trending_down'}</span>
                  {trend.diff}
                </span>
              )}
            </div>
            <span className="text-xs text-on-surface-variant">Средний рейтинг</span>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-5 border border-slate-100 flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-blue-500 text-[26px]">rate_review</span>
            <span className="text-2xl font-bold text-on-surface">{ratings.length}</span>
            <span className="text-xs text-on-surface-variant text-center">Отзывов получено</span>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-5 border border-slate-100 flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-purple-500 text-[26px]">folder</span>
            <span className="text-2xl font-bold text-on-surface">{materials.length}</span>
            <span className="text-xs text-on-surface-variant text-center">Материалов</span>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-5 border border-slate-100 flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-emerald-500 text-[26px]">library_books</span>
            <span className="text-2xl font-bold text-on-surface">{teacher.disciplines?.length || 0}</span>
            <span className="text-xs text-on-surface-variant text-center">Дисциплин</span>
          </div>
        </div>

        {/* ══ ACHIEVEMENTS ══ */}
        {achievements.some(a => a.unlocked) && (
          <div className="flex flex-wrap gap-2 mb-8">
            {achievements.filter(a => a.unlocked).map(a => (
              <div key={a.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${BADGE_COLORS[a.color]}`}>
                <span className={`material-symbols-outlined text-[16px] ${BADGE_ICON_COLORS[a.color]}`} style={{fontVariationSettings:"'FILL' 1"}}>{a.icon}</span>
                {a.label}
              </div>
            ))}
          </div>
        )}

        {/* ══ TABS ══ */}
        <div className="flex gap-1 p-1 bg-surface-container-low rounded-2xl mb-8 w-fit overflow-x-auto">
          {[
            { id: 'rating',    icon: 'star',     label: 'Рейтинг'   },
            { id: 'reviews',   icon: 'chat',     label: 'Отзывы'    },
            { id: 'materials', icon: 'folder',   label: 'Материалы' },
            ...(isOwn ? [{ id: 'settings', icon: 'settings', label: 'Настройки' }] : []),
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                tab === t.id
                  ? 'bg-[#002366] text-white shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-white/60'
              }`}>
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ TAB: RATING ══ */}
        {tab === 'rating' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Distribution */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 border border-slate-100">
              <h3 className="text-base font-semibold text-on-surface mb-5">Распределение оценок</h3>
              {ratings.length === 0 ? (
                <p className="text-on-surface-variant text-sm">Ещё нет оценок</p>
              ) : (
                <div className="space-y-2">
                  {distribution.map(d => (
                    <div key={d.score} className="flex items-center gap-3">
                      <span className="w-4 text-xs font-medium text-on-surface-variant text-right">{d.score}</span>
                      <div className="flex-1 h-5 bg-surface-container-low rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${d.pct}%`, opacity: d.count ? 1 : 0.2 }}
                        />
                      </div>
                      <span className="w-5 text-xs text-on-surface-variant">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Criteria */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 border border-slate-100">
              <h3 className="text-base font-semibold text-on-surface mb-5">Критерии оценки</h3>
              {ratings.length === 0 ? (
                <p className="text-on-surface-variant text-sm">Ещё нет оценок</p>
              ) : (
                <div className="space-y-4">
                  {criteriaAvgs.map(c => (
                    <div key={c.key}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-on-surface-variant">{c.label}</span>
                        <span className="text-xs font-bold text-on-surface">{c.avg ?? '—'}</span>
                      </div>
                      <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: c.avg ? `${Number(c.avg) * 10}%` : '0%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top reviews */}
            {ratings.length > 0 && (
              <div className="lg:col-span-2 bg-surface-container-lowest rounded-3xl p-6 border border-slate-100">
                <h3 className="text-base font-semibold text-on-surface mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-[20px]" style={{fontVariationSettings:"'FILL' 1"}}>stars</span>
                  Лучшие отзывы
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[...ratings].sort((a,b)=>(b.averageScore||0)-(a.averageScore||0)).slice(0,3).map(r => (
                    <div key={r.id} className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          <span className="material-symbols-outlined text-[13px]" style={{fontVariationSettings:"'FILL' 1"}}>star</span>
                          <span className="text-xs font-bold">{r.averageScore?.toFixed(1)}</span>
                        </div>
                        <span className="text-xs text-on-surface-variant">{timeAgo(r.createdAt)}</span>
                      </div>
                      {r.comment && <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-3">«{r.comment}»</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: REVIEWS ══ */}
        {tab === 'reviews' && (
          <div className="space-y-6">

            {/* ── Write review CTA / Form ── */}
            {submitMsg === 'success' ? (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-center gap-3">
                <CheckCircle size={22} className="text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700">Отзыв отправлен на проверку</p>
                  <p className="text-xs text-emerald-600 mt-0.5">Он появится здесь после одобрения модератором</p>
                </div>
              </div>
            ) : !user ? (
              <div className="bg-[#002366] rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Lock size={20} className="text-[#ccff00] flex-shrink-0" />
                  <p className="text-sm text-white/80">Чтобы оставить отзыв, войдите в аккаунт студента</p>
                </div>
                <Link to="/login" className="px-4 py-2 bg-[#ccff00] text-[#002366] text-xs font-bold rounded-xl whitespace-nowrap hover:brightness-95">
                  Войти
                </Link>
              </div>
            ) : userData?.role !== 'student' ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-center gap-3">
                <Lock size={18} className="text-slate-400 flex-shrink-0" />
                <p className="text-sm text-on-surface-variant">Оставлять отзывы могут только студенты</p>
              </div>
            ) : isOwn ? null : hasRated ? (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-center gap-3">
                <CheckCircle size={18} className="text-blue-400 flex-shrink-0" />
                <p className="text-sm text-blue-700">Вы уже оценили этого преподавателя</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowForm(v => !v)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#002366] flex items-center justify-center">
                      <Star size={15} className="text-[#ccff00]" />
                    </div>
                    <span className="text-sm font-semibold text-on-surface">Оставить отзыв</span>
                  </div>
                  {showForm ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </button>

                {showForm && (
                  <form onSubmit={handleSubmitRating} className="px-6 pb-6 border-t border-slate-100">
                    <RatingForm
                      teacherType={teacher.teacherType}
                      ratingForm={ratingForm}
                      setRatingForm={setRatingForm}
                      comment={ratingComment}
                      setComment={setRatingComment}
                      anon={ratingAnon}
                      setAnon={setRatingAnon}
                      submitting={submitting}
                      error={submitMsg !== 'success' ? submitMsg : ''}
                    />
                  </form>
                )}
              </div>
            )}

            {/* ── Sort ── */}
            <div className="flex items-center gap-2">
              <ArrowUpDown size={13} className="text-on-surface-variant" />
              {[
                { v: 'newest',     l: 'Новые'     },
                { v: 'oldest',     l: 'Старые'    },
                { v: 'score_desc', l: 'По оценке' },
              ].map(({v,l}) => (
                <button key={v} onClick={() => setReviewSort(v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    reviewSort === v
                      ? 'bg-[#ccff00] text-[#002366] border-[#ccff00]'
                      : 'bg-white text-on-surface-variant border-slate-200 hover:border-slate-300'
                  }`}>
                  {l}
                </button>
              ))}
            </div>

            {/* ── List ── */}
            <div className="space-y-4">
              {filteredRatings.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-100">
                  <span className="material-symbols-outlined text-[40px] text-slate-300">rate_review</span>
                  <p className="text-on-surface-variant mt-2 text-sm">Отзывов не найдено</p>
                </div>
              ) : shownRatings.map(r => (
                <ReviewCard key={r.id} rating={r} teacherType={teacher.teacherType} />
              ))}
            </div>

            {reviewPage < filteredRatings.length && (
              <button onClick={() => setReviewPage(p => p + 5)}
                className="w-full py-3 bg-white border border-slate-200 text-on-surface text-sm font-semibold rounded-2xl hover:border-[#002366] hover:text-[#002366] transition-all">
                Показать ещё ({filteredRatings.length - reviewPage} отзывов)
              </button>
            )}
          </div>
        )}

        {/* ══ TAB: MATERIALS ══ */}
        {tab === 'materials' && (
          <div>
            {/* Discipline filter */}
            {matDisciplines.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-6">
                {['all', ...matDisciplines].map(d => (
                  <button key={d} onClick={() => setMatFilter(d)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                      matFilter === d
                        ? 'bg-[#002366] text-white border-[#002366]'
                        : 'bg-white border-slate-200 text-on-surface-variant hover:border-slate-300'
                    }`}>
                    {d === 'all' ? 'Все материалы' : d}
                  </button>
                ))}
              </div>
            )}

            {filteredMaterials.length === 0 ? (
              <div className="bg-surface-container-lowest rounded-3xl p-12 text-center border border-slate-100">
                <span className="material-symbols-outlined text-[40px] text-slate-300">folder_open</span>
                <p className="text-on-surface-variant mt-2 text-sm">Материалы не найдены</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMaterials.map(m => <MaterialCard key={m.id} material={m} />)}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB: SETTINGS (own profile only) ══ */}
        {tab === 'settings' && isOwn && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Main info */}
            <div className="bg-surface-container-lowest rounded-3xl p-6 border border-slate-100">
              <h3 className="text-base font-semibold text-on-surface mb-5 flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">person</span>
                Информация о профиле
              </h3>
              <form onSubmit={saveSettings} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Должность</label>
                  <input value={editForm.position} onChange={e=>setEditForm(f=>({...f,position:e.target.value}))} className={inputCls} placeholder="Доцент кафедры..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Кафедра / Факультет</label>
                  <input value={editForm.department} onChange={e=>setEditForm(f=>({...f,department:e.target.value}))} className={inputCls} placeholder="Кафедра математики..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Дата начала работы</label>
                  <input type="date" value={editForm.workStartDate} onChange={e=>setEditForm(f=>({...f,workStartDate:e.target.value}))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5">О себе</label>
                  <textarea value={editForm.bio} onChange={e=>setEditForm(f=>({...f,bio:e.target.value}))} rows={4} maxLength={1000} className={inputCls+' resize-none'} placeholder="Ваша специализация, опыт, научные интересы..." />
                  <p className="text-[11px] text-on-surface-variant mt-1 text-right">{editForm.bio.length}/1000</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Теги / Ключевые навыки (через запятую)</label>
                  <input value={editForm.tags} onChange={e=>setEditForm(f=>({...f,tags:e.target.value}))} className={inputCls} placeholder="Макроэкономика, Финансовый анализ..." />
                </div>

                {saveMsg && <p className={`text-sm font-medium ${saveMsg.includes('Ошибка') ? 'text-red-500' : 'text-emerald-600'}`}>{saveMsg}</p>}
                <button type="submit" disabled={saving} className="w-full py-3 bg-primary text-on-primary text-sm font-semibold rounded-xl hover:bg-primary-container transition-colors disabled:opacity-50">
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </form>
            </div>

            <div className="space-y-5">
              {/* Links */}
              <div className="bg-surface-container-lowest rounded-3xl p-6 border border-slate-100">
                <h3 className="text-base font-semibold text-on-surface mb-4 flex items-center gap-2">
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
                      <label className="block text-xs font-medium text-on-surface-variant mb-1">{l.label}</label>
                      <input value={editForm[l.key]} onChange={e=>setEditForm(f=>({...f,[l.key]:e.target.value}))} className={inputCls} placeholder={l.placeholder} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Avatar */}
              <div className="bg-surface-container-lowest rounded-3xl p-6 border border-slate-100">
                <h3 className="text-base font-semibold text-on-surface mb-4 flex items-center gap-2">
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
                      className="w-full py-2.5 bg-surface-container-low text-on-surface text-sm font-medium rounded-xl hover:bg-surface-container border border-slate-200/80 transition-colors">
                      {uploading ? `Загрузка ${uploadProgress}%...` : 'Загрузить фото'}
                    </button>
                    {uploadError && <p className="text-[11px] text-red-500 mt-1">{uploadError}</p>}
                    <p className="text-[11px] text-on-surface-variant mt-1 text-center">JPG, PNG · Макс. 5 MB</p>
                  </div>
                </div>
              </div>

              {/* Privacy */}
              <div className="bg-surface-container-lowest rounded-3xl p-6 border border-slate-100">
                <h3 className="text-base font-semibold text-on-surface mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">shield</span>
                  Конфиденциальность
                </h3>
                <div className="space-y-4">
                  {[
                    { key: 'allowAnon', label: 'Разрешить анонимные отзывы' },
                    { key: 'showStats', label: 'Показывать статистику просмотров' },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-on-surface">{opt.label}</span>
                      <div
                        onClick={() => setEditForm(f=>({...f,[opt.key]:!f[opt.key]}))}
                        className={`w-10 h-6 rounded-full transition-colors cursor-pointer relative ${editForm[opt.key] ? 'bg-primary' : 'bg-slate-200'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${editForm[opt.key] ? 'translate-x-5' : 'translate-x-1'}`} />
                      </div>
                    </label>
                  ))}
                </div>
                <button onClick={saveSettings} disabled={saving}
                  className="mt-4 w-full py-2.5 bg-surface-container-low text-on-surface text-sm font-medium rounded-xl hover:bg-surface-container border border-slate-200/80 transition-colors">
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

/* ── Rating Form ── */
function RatingForm({ teacherType, ratingForm, setRatingForm, comment, setComment, anon, setAnon, submitting, error }) {
  const criteria = RATING_CRITERIA[teacherType] || RATING_CRITERIA.universal

  return (
    <div className="pt-5 space-y-6">
      {/* Criteria sliders */}
      <div className="space-y-5">
        {criteria.map(c => {
          const val = ratingForm[c.key] || 0
          const color = val >= 8 ? '#10b981' : val >= 6 ? '#3b82f6' : val >= 4 ? '#f59e0b' : val > 0 ? '#ef4444' : '#e2e8f0'
          return (
            <div key={c.key}>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-on-surface">{c.label}</label>
                <div className="flex items-center gap-1.5">
                  {val > 0 ? (
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ background: color }}>
                      {val}
                    </span>
                  ) : (
                    <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-xs text-slate-400">—</span>
                  )}
                </div>
              </div>
              {/* Score buttons 1–10 */}
              <div className="flex gap-1">
                {Array.from({length:10},(_,i)=>i+1).map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRatingForm(f => ({...f, [c.key]: n}))}
                    className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all ${
                      val === n
                        ? 'text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                    style={val === n ? { background: color } : {}}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {c.hint && <p className="text-[11px] text-on-surface-variant mt-1.5">{c.hint}</p>}
            </div>
          )
        })}
      </div>

      {/* Comment */}
      <div>
        <label className="block text-sm font-medium text-on-surface mb-2">Комментарий <span className="text-on-surface-variant font-normal">(необязательно)</span></label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Расскажите подробнее о преподавателе..."
          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-on-surface placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] transition-all resize-none"
        />
        <p className="text-[11px] text-on-surface-variant text-right mt-1">{comment.length}/1000</p>
      </div>

      {/* Anonymity toggle */}
      <label className="flex items-center justify-between cursor-pointer p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div>
          <p className="text-sm font-medium text-on-surface">Анонимный отзыв</p>
          <p className="text-xs text-on-surface-variant mt-0.5">Ваше имя не будет видно</p>
        </div>
        <div
          onClick={() => setAnon(v => !v)}
          className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative flex-shrink-0 ${anon ? 'bg-[#002366]' : 'bg-slate-200'}`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${anon ? 'translate-x-6' : 'translate-x-1'}`} />
        </div>
      </label>

      {error && (
        <p className="text-sm text-red-500 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error</span>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-[#ccff00] text-[#002366] font-bold text-sm rounded-xl hover:brightness-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Send size={16} />
        {submitting ? 'Отправка...' : 'Отправить отзыв'}
      </button>
    </div>
  )
}

/* ── Review Card ── */
function ReviewCard({ rating, teacherType }) {
  const [expanded, setExpanded] = useState(false)
  const score = rating.averageScore || 0
  const scoreColor =
    score >= 8.5 ? { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-200', bar: 'bg-emerald-400' } :
    score >= 7   ? { bg: 'bg-blue-50',    text: 'text-blue-600',    ring: 'ring-blue-200',    bar: 'bg-blue-400'    } :
    score >= 5   ? { bg: 'bg-amber-50',   text: 'text-amber-600',   ring: 'ring-amber-200',   bar: 'bg-amber-400'   } :
                   { bg: 'bg-red-50',     text: 'text-red-500',     ring: 'ring-red-200',     bar: 'bg-red-400'     }

  const criteria = RATING_CRITERIA[teacherType] || RATING_CRITERIA.universal
  const hasCriteria = rating.criteriaScores && criteria.some(c => rating.criteriaScores[c.key] != null)

  const authorLabel = rating.isAnonymous
    ? 'Анонимный студент'
    : `Студент${rating.studentCourse ? `, ${rating.studentCourse} курс` : ''}`

  const hasLongComment = rating.comment && rating.comment.length > 200

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-slate-100 hover:shadow-md transition-all duration-200 overflow-hidden">

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
              <p className="text-sm font-semibold text-on-surface">{authorLabel}</p>
              <p className="text-xs text-on-surface-variant">{timeAgo(rating.createdAt)}</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-4 p-3 bg-surface-container-low rounded-xl">
            {criteria.map(c => {
              const val = rating.criteriaScores?.[c.key]
              if (val == null) return null
              return (
                <div key={c.key}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] text-on-surface-variant truncate pr-2">{c.label}</span>
                    <span className="text-[11px] font-bold text-on-surface flex-shrink-0">{val}</span>
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

        {/* Comment */}
        {rating.comment && (
          <div className="relative">
            <span className="absolute -top-1 -left-0.5 text-3xl text-slate-200 font-serif leading-none select-none">"</span>
            <p className={`text-sm text-on-surface-variant leading-relaxed pl-4 ${!expanded && hasLongComment ? 'line-clamp-3' : ''}`}>
              {rating.comment}
            </p>
            {hasLongComment && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="mt-1.5 ml-4 text-xs text-primary font-medium hover:underline"
              >
                {expanded ? 'Свернуть' : 'Читать полностью'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Material Card ── */
function MaterialCard({ material }) {
  const { icon, bg, text } = getFileConfig(material.fileType)
  return (
    <a
      href={material.fileUrl}
      target="_blank"
      rel="noreferrer"
      className="bg-surface-container-low p-5 rounded-2xl hover:bg-surface-container-lowest hover:shadow-sm transition-all group border border-transparent hover:border-slate-200/60 block"
    >
      <div className={`w-11 h-11 ${bg} ${text} rounded-xl flex items-center justify-center mb-3`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </div>
      <h4 className="text-sm font-semibold text-on-surface line-clamp-2 mb-1">{material.title}</h4>
      <p className="text-[11px] text-on-surface-variant uppercase tracking-wide">
        {[material.discipline, material.fileType?.toUpperCase(), formatSize(material.fileSize)].filter(Boolean).join(' · ')}
      </p>
      <div className="flex items-center justify-between mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs text-on-surface-variant">{timeAgo(material.createdAt)}</span>
        <span className="material-symbols-outlined text-primary text-[18px]">download</span>
      </div>
    </a>
  )
}
