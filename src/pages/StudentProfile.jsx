import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { updateOwnUserProfile } from '../services/firestore'
import { getStudentRatings } from '../services/ratings'
import { getBookmarks } from '../services/bookmarks'
import { getTeachers } from '../services/teachers'
import { getMaterials } from '../services/materials'
import { logoutUser } from '../services/auth'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { storage } from '../services/firebase'
import {
  Star, MessageSquare, Calendar, Trophy, BookOpen, BarChart2,
  Bookmark, Settings, LogOut, Camera, Lock, User, ChevronRight,
  TrendingUp, Award, Flame, Shield, Zap, Eye, FileText,
  Ban, Clock, History, Share2, Edit3, Check,
} from 'lucide-react'

/* ════════════════════════════════════════════════════════════
   UNIRATE · ЛИЧНЫЙ ФОРМУЛЯР СТУДЕНТА
   Тёмная палитра, серифный курсив, сегментированные бары.
════════════════════════════════════════════════════════════ */

const COURSE_LABELS = { 1: '1 курс', 2: '2 курс', 3: '3 курс', 4: '4 курс' }
const GENDER_LABELS = { male: 'он/его', female: 'она/её', other: 'они/их' }

/* ── Темы кастомизации (свотчи и цвета цифр)
   accent  — основной цвет (бары/границы/иконки/подчёркивания)
   text    — цвет крупных цифр
   tint    — мягкая заливка для активных зон
   glow    — для верхнего градиентного аксана карточки             */
const PROFILE_THEMES = {
  rust: {
    swatch: '#B84A1E', accent: '#B84A1E', text: '#D46240',
    tint: 'rgba(184, 74, 30, 0.14)', glow: 'rgba(184, 74, 30, 0.85)',
    ring: 'rgba(184, 74, 30, 0.55)',
  },
  sage: {
    swatch: '#7A8F6F', accent: '#8FA380', text: '#9AB089',
    tint: 'rgba(143, 163, 128, 0.15)', glow: 'rgba(143, 163, 128, 0.85)',
    ring: 'rgba(143, 163, 128, 0.55)',
  },
  gold: {
    swatch: '#C9A14A', accent: '#C9A14A', text: '#D8B55C',
    tint: 'rgba(201, 161, 74, 0.16)', glow: 'rgba(216, 181, 92, 0.85)',
    ring: 'rgba(201, 161, 74, 0.55)',
  },
  mono: {
    swatch: '#1A1613', accent: '#E6D9C9', text: '#EADDC9',
    tint: 'rgba(230, 217, 201, 0.10)', glow: 'rgba(230, 217, 201, 0.8)',
    ring: 'rgba(230, 217, 201, 0.45)',
  },
}
const THEME_ORDER = ['rust', 'sage', 'gold', 'mono']

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}
function formatDateShort(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
function daysSince(ts) {
  if (!ts) return 0
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}
function daysSinceShort(ts) {
  const n = daysSince(ts)
  if (n === 0) return 'сегодня'
  const rem10 = n % 10, rem100 = n % 100
  if (rem10 === 1 && rem100 !== 11) return `${n} день`
  if ([2, 3, 4].includes(rem10) && ![12, 13, 14].includes(rem100)) return `${n} дня`
  return `${n} дней`
}

/* ── Система уровней (переосмыслено под «хрониста») ── */
const LEVELS = [
  { min: 0,  label: 'Новичок',       desc: 'от 0 отзывов',  Icon: Eye     },
  { min: 3,  label: 'Внимательный',  desc: 'от 3 отзывов',  Icon: BookOpen},
  { min: 10, label: 'Хронист',       desc: 'от 10 отзывов', Icon: FileText},
  { min: 25, label: 'Эрудит',        desc: 'от 25 отзывов', Icon: Flame   },
  { min: 50, label: 'Мастер',        desc: 'от 50 отзывов', Icon: Trophy  },
  { min: 100,label: 'Легенда',       desc: 'от 100 отзывов',Icon: Award   },
]
function getLevelIdx(count) {
  let idx = 0
  for (let i = 0; i < LEVELS.length; i++) if (count >= LEVELS[i].min) idx = i
  return idx
}

/* ── Достижения ── */
function getAchievements(ratings, bookmarkCount) {
  const uniqueTeachers = new Set(ratings.map(r => r.teacherId).filter(Boolean)).size
  const approvedCount  = ratings.filter(r => r.status === 'approved').length
  const hasAnonymous   = ratings.some(r => r.isAnonymous)
  const hasLongComment = ratings.some(r =>
    ((r.comment || '') + (r.positiveComment || '') + (r.negativeComment || '')).length >= 100
  )

  return [
    { id: 'first',     Icon: Star,        label: 'Первый отзыв',     desc: 'Оставил первый отзыв на платформе',     unlocked: ratings.length >= 1 },
    { id: 'active',    Icon: Flame,       label: 'Активный',         desc: 'Оставил 5 и более отзывов',              unlocked: ratings.length >= 5 },
    { id: 'veteran',   Icon: Trophy,      label: 'Ветеран',          desc: 'Оставил 10 и более отзывов',             unlocked: ratings.length >= 10 },
    { id: 'legend',    Icon: Award,       label: 'Легенда',          desc: 'Оставил 20 и более отзывов',             unlocked: ratings.length >= 20 },
    { id: 'critic',    Icon: MessageSquare,label:'Критик',           desc: 'Развёрнутый комментарий на 100+ знаков', unlocked: hasLongComment },
    { id: 'explorer',  Icon: TrendingUp,  label: 'Исследователь',    desc: 'Оценил 5 и более разных преподавателей', unlocked: uniqueTeachers >= 5 },
    { id: 'approved',  Icon: Shield,      label: 'Проверенный',      desc: '3 и более отзыва прошли модерацию',      unlocked: approvedCount >= 3 },
    { id: 'incognito', Icon: Lock,        label: 'Инкогнито',        desc: 'Оставил хотя бы один анонимный отзыв',   unlocked: hasAnonymous },
    { id: 'reader',    Icon: Bookmark,    label: 'Книжная полка',    desc: 'Добавил 3 и более материала в закладки', unlocked: bookmarkCount >= 3 },
  ]
}

/* ── Инпут тёмной темы ── */
const inputCls = "w-full px-4 py-3 rounded-xl bg-[#1A1613] border border-[#3A322A] text-[#F4EBDB] placeholder:text-[#6B625A] text-sm focus:outline-none focus:border-[var(--color-rust)] focus:shadow-[0_0_0_3px_rgba(184,74,30,0.2)] transition-all"

/* ════════════════════════════════════════════════
   ГЛАВНЫЙ КОМПОНЕНТ
════════════════════════════════════════════════ */
export default function StudentProfile() {
  const { user, userData, refreshUserData } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef()

  const [tab, setTab] = useState('about')
  const [ratings, setRatings] = useState([])
  const [teacherMap, setTeacherMap] = useState({})
  const [bookmarkMaterials, setBookmarkMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [copied, setCopied] = useState(false)

  const [form, setForm] = useState({ firstName:'', lastName:'', middleName:'', nickname:'', bio:'', course:1 })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [pwForm, setPwForm] = useState({ current:'', next:'', confirm:'' })
  const [pwMsg, setPwMsg] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const [themeId, setThemeId] = useState('rust')
  const theme = PROFILE_THEMES[themeId] || PROFILE_THEMES.rust

  async function changeTheme(id) {
    if (!PROFILE_THEMES[id] || id === themeId) return
    setThemeId(id)
    try {
      await updateUserDocument(user.uid, { profileTheme: id })
    } catch {/* игнор — цвет всё равно останется в памяти сессии */}
  }

  /* Заполнение формы из userData — отдельным эффектом,
     чтобы каждый snapshot из onSnapshot не перезапускал тяжёлые
     запросы (раньше userData как объектная зависимость пересчитывала
     эффект на каждое касание admin-ом, гоня лишние Firestore-чтения). */
  useEffect(() => {
    if (!userData) return
    setForm({
      firstName: userData.firstName||'', lastName: userData.lastName||'',
      middleName: userData.middleName||'', nickname: userData.nickname||'',
      bio: userData.bio||'', course: userData.course||1,
    })
    if (userData.profileTheme && PROFILE_THEMES[userData.profileTheme]) {
      setThemeId(userData.profileTheme)
    }
  }, [userData])

  /* Тяжёлая загрузка зависит ТОЛЬКО от user.uid + флаг cancelled
     для безопасного unmount во время async-цепочки.
     Дополнительный safeguard: timeout 15с, если что-то упало вне catch
     (например, сеть зависла) — снимаем спиннер вместо вечной загрузки. */
  useEffect(() => {
    if (!user) { navigate('/login'); return }
    let cancelled = false

    const timeoutId = setTimeout(() => {
      if (cancelled) return
      console.warn('[StudentProfile] загрузка превысила 15с — снимаем спиннер')
      setLoading(false)
    }, 15000)

    ;(async () => {
      try {
        const [ratingsRes, teachersRes, bookmarksRes] = await Promise.all([
          getStudentRatings(user.uid).catch(e => { console.error('[ratings]', e); return { ratings: [] } }),
          getTeachers().catch(e => { console.error('[teachers]', e); return { teachers: [] } }),
          getBookmarks(user.uid).catch(e => { console.error('[bookmarks]', e); return { bookmarkIds: [] } }),
        ])
        if (cancelled) return

        setRatings(ratingsRes.ratings || [])
        const map = {}
        ;(teachersRes.teachers || []).forEach(t => { map[t.id] = t })
        setTeacherMap(map)

        if (bookmarksRes.bookmarkIds?.length > 0) {
          try {
            const { materials } = await getMaterials({ pageSize: 100 })
            if (cancelled) return
            setBookmarkMaterials(materials.filter(m => bookmarksRes.bookmarkIds.includes(m.id)))
          } catch (e) {
            console.error('[materials]', e)
          }
        }
      } catch (e) {
        if (cancelled) return
        console.error('[StudentProfile load]', e)
      } finally {
        if (!cancelled) {
          clearTimeout(timeoutId)
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [user?.uid, navigate])

  /* Загрузка аватара */
  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setUploadError('Файл слишком большой (макс. 5 MB)'); return }
    setUploading(true); setUploadError('')
    try {
      const task = uploadBytesResumable(ref(storage, `avatars/${user.uid}`), file)
      task.on('state_changed',
        s => setUploadProgress(Math.round(s.bytesTransferred/s.totalBytes*100)),
        err => { setUploadError(`Ошибка: ${err.code}`); setUploading(false); setUploadProgress(0) },
        async () => {
          await updateUserDocument(user.uid, { avatarUrl: await getDownloadURL(task.snapshot.ref) })
          await refreshUserData()
          setUploading(false); setUploadProgress(0)
        }
      )
    } catch { setUploadError('Не удалось загрузить фото'); setUploading(false) }
  }

  async function saveProfile(e) {
    e.preventDefault(); setSaving(true); setSaveMsg('')
    const { error } = await updateOwnUserProfile(user.uid, {
      firstName: form.firstName, lastName: form.lastName, middleName: form.middleName,
      nickname: form.nickname, bio: form.bio, course: Number(form.course),
    })
    await refreshUserData()
    setSaving(false)
    setSaveMsg(error ? 'Ошибка сохранения' : 'Сохранено')
    setTimeout(() => setSaveMsg(''), 3000)
  }

  async function changePassword(e) {
    e.preventDefault()
    if (pwForm.next !== pwForm.confirm) { setPwMsg('Пароли не совпадают'); return }
    if (pwForm.next.length < 6) { setPwMsg('Минимум 6 символов'); return }
    setPwLoading(true); setPwMsg('')
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pwForm.current))
      await updatePassword(user, pwForm.next)
      setPwMsg('Пароль изменён')
      setPwForm({ current:'', next:'', confirm:'' })
    } catch { setPwMsg('Неверный текущий пароль') }
    setPwLoading(false)
    setTimeout(() => setPwMsg(''), 4000)
  }

  async function copyProfileLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/profile`)
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  if (!userData) return (
    <div className="min-h-screen bg-[#1A1613] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[var(--color-rust)] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  /* ── Метрики ── */
  const fullName  = [userData.lastName, userData.firstName, userData.middleName].filter(Boolean).join(' ')
  const displayName = userData.nickname
    ? `${userData.nickname} #${(user.uid||'').slice(-4).toUpperCase()}`
    : fullName || `Студент #${(user.uid||'').slice(-4).toUpperCase()}`
  const initials = (userData.firstName?.[0] || userData.nickname?.[0] || user.email?.[0] || '?').toUpperCase()

  const profileId = `UR-STU · #${(user.uid||'').slice(-4).toUpperCase()}`
  const days      = daysSince(userData.createdAt)
  const updatedAgo = userData.updatedAt ? daysSince(userData.updatedAt) : 0

  const approvedRatings = ratings.filter(r => r.status === 'approved')
  const helpfulVotes    = ratings.reduce((s, r) => s + (r.helpfulCount || r.usefulCount || 0), 0)

  const avgScore  = ratings.length ? (ratings.reduce((s,r)=>s+(r.averageScore||0),0)/ratings.length) : null
  const longShare = ratings.length
    ? Math.round(ratings.filter(r => ((r.comment||'') + (r.positiveComment||'') + (r.negativeComment||'')).length >= 80).length / ratings.length * 100)
    : 0

  const levelIdx = getLevelIdx(ratings.length)
  const currentLevel = LEVELS[levelIdx]
  const nextLevel    = LEVELS[levelIdx + 1]
  const xpProgress = nextLevel
    ? Math.min(100, Math.max(0, ((ratings.length - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100))
    : 100

  const achievements  = getAchievements(ratings, bookmarkMaterials.length)
  const unlockedCount = achievements.filter(a => a.unlocked).length

  /* Дисциплины из отзывов (топ-4 по частоте) */
  const disciplines = useMemo(() => {
    const bag = {}
    ratings.forEach(r => {
      const t = teacherMap[r.teacherId]
      const list = t?.disciplines || (t?.discipline ? [t.discipline] : []) || (r.discipline ? [r.discipline] : [])
      list.forEach(d => { if (d) bag[d] = (bag[d] || 0) + 1 })
    })
    return Object.entries(bag).sort((a,b) => b[1] - a[1]).slice(0, 4).map(([k]) => k)
  }, [ratings, teacherMap])

  /* Рейтинг доверия: % одобренных отзывов, маппим в букву */
  const approvedShare = ratings.length ? approvedRatings.length / ratings.length : 0
  const trustLetter =
    approvedShare >= 0.95 ? 'A+' :
    approvedShare >= 0.85 ? 'A' :
    approvedShare >= 0.7  ? 'B' :
    approvedShare >= 0.5  ? 'C' : 'D'

  const TABS = [
    { id: 'about',       label: 'О себе и уровень' },
    { id: 'achievements',label: `Достижения · ${unlockedCount} / ${achievements.length}` },
    { id: 'activity',    label: 'Активность' },
    { id: 'bookmarks',   label: 'Закладки' },
    { id: 'settings',    label: 'Настройки' },
  ]

  function fmtIso(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div
      className="min-h-screen bg-[#1A1613] text-[#F4EBDB]"
      style={{
        '--profile-accent':      theme.accent,
        '--profile-accent-text': theme.text,
        '--profile-accent-tint': theme.tint,
        '--profile-accent-soft': theme.accent + '66', // ~40% alpha
        '--profile-accent-weak': theme.accent + '33', // ~20% alpha
        '--profile-accent-glow': theme.glow,
      }}
    >

      {/* Тонкая декор-сетка */}
      <div className="absolute inset-x-0 top-0 h-[520px] pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle, #F4EBDB 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">

        {/* ═══════════ БАН-БАННЕР ═══════════ */}
        {!userData.isActive && (userData.blockReason || userData.isDeleted) && (
          <div className="mb-6 rounded-2xl border border-[#3A322A] bg-[#24201C] overflow-hidden animate-fade-up">
            <div className="flex items-start gap-4 px-5 py-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-rust)]/15 flex items-center justify-center flex-shrink-0">
                <Ban size={18} className="text-[var(--color-rust)]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#F4EBDB]">
                  {userData.isDeleted ? 'Аккаунт удалён' : 'Ваш аккаунт заблокирован'}
                </p>
                {userData.blockReason && !userData.isDeleted && (
                  <p className="text-sm text-[#B8A999] mt-0.5">Причина: {userData.blockReason}</p>
                )}
                {userData.blockedUntil && !userData.isDeleted && (() => {
                  const d = userData.blockedUntil.toDate ? userData.blockedUntil.toDate() : new Date(userData.blockedUntil)
                  const daysLeft = Math.max(0, Math.ceil((d - Date.now()) / 86400000))
                  return (
                    <p className="text-xs text-[#8B827A] mt-1.5 flex items-center gap-1.5">
                      <Clock size={11} />
                      До {d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })} · осталось {daysLeft} дн.
                    </p>
                  )
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ ИСТОРИЯ БЛОКИРОВОК ═══════════ */}
        {userData.banHistory?.length > 0 && (
          <div className="mb-6 rounded-2xl border border-[#3A322A] bg-[#24201C] p-5 animate-fade-up">
            <h3 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#B8A999] flex items-center gap-2 mb-4">
              <History size={13} />
              История блокировок
              <span className="ml-auto px-2 py-0.5 bg-[#1A1613] text-[#B8A999] text-xs font-semibold rounded-full">
                {userData.banHistory.length}
              </span>
            </h3>
            <div className="space-y-3">
              {[...userData.banHistory]
                .sort((a, b) => new Date(b.unblockedAt || b.blockedAt) - new Date(a.unblockedAt || a.blockedAt))
                .map((entry, i) => (
                <div key={i} className="flex gap-3 p-3 bg-[#1A1613] rounded-xl border border-[#3A322A]">
                  <div className="w-8 h-8 bg-[var(--color-rust)]/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Ban size={13} className="text-[var(--color-rust)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#F4EBDB] truncate">{entry.reason}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      <span className="text-[11px] text-[#8B827A]">Заблокирован: {fmtIso(entry.blockedAt)}</span>
                      {entry.unblockedAt && (
                        <span className="text-[11px] text-[var(--color-ok)]">Разблокирован: {fmtIso(entry.unblockedAt)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════ ВЕРХНЯЯ ПОЛОСКА ═══════════ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-5 text-[11px] tracking-[0.18em] uppercase text-[#8B827A]">
          <span>Личный формуляр &nbsp;·&nbsp; <span className="transition-colors" style={{ color: theme.accent }}>{profileId}</span></span>
          <span className="hidden sm:inline">На платформе {daysSinceShort(userData.createdAt)} · обновлено {updatedAgo === 0 ? 'сегодня' : updatedAgo === 1 ? 'вчера' : `${updatedAgo} дн. назад`}</span>
        </div>

        {/* ═══════════ ГЛАВНАЯ КАРТОЧКА ═══════════ */}
        <div className="relative rounded-[20px] sm:rounded-[24px] border border-[#3A322A] bg-[#24201C] p-4 sm:p-6 md:p-8 animate-fade-up overflow-hidden">

          {/* Градиентный аксан сверху — в цвете выбранной темы */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] transition-colors duration-500"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${theme.glow} 20%, ${theme.glow} 80%, transparent 100%)`,
            }}
          />
          {/* Мягкое свечение под аксаном */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-32 transition-colors duration-500 opacity-60"
            style={{
              background: `radial-gradient(ellipse 50% 100% at 50% 0%, ${theme.tint} 0%, transparent 70%)`,
            }}
          />

          <div className="flex flex-col md:flex-row gap-6 md:gap-8">

            {/* ── Левая колонка: аватар ── */}
            <div className="flex md:flex-col items-center md:items-stretch gap-4 md:w-48 flex-shrink-0">
              <div className="relative group cursor-pointer flex-shrink-0" onClick={() => fileRef.current?.click()}>
                <div
                  className="w-32 h-32 md:w-44 md:h-44 rounded-full bg-[#1A1613] overflow-hidden flex items-center justify-center transition-colors"
                  style={{ boxShadow: `inset 0 0 0 2px ${theme.ring}` }}
                >
                  {userData.avatarUrl
                    ? <img src={userData.avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    : <span className="font-display italic text-5xl md:text-6xl text-[#F4EBDB]">{initials}</span>}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                    <Camera size={22} className="text-white" />
                  </div>
                  {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
                      <span className="text-white text-sm font-semibold">{uploadProgress}%</span>
                    </div>
                  )}
                </div>
                {/* Бейдж уровня — тонируется темой */}
                <div
                  className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full border-2 border-[#24201C] flex items-center justify-center font-display italic text-[#FFFDF7] text-sm leading-none transition-colors"
                  style={{ background: theme.swatch }}
                >
                  {['I','II','III','IV','V','VI'][levelIdx]}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full border border-[#3A322A] bg-[#1A1613] hover:bg-[#2E2824] text-xs font-medium tracking-wider uppercase text-[#B8A999] transition-colors"
              >
                <Camera size={13} />
                Фото
              </button>
            </div>

            {/* ── Центр: имя, мета, био, дисциплины ── */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h1 className="font-display italic text-[28px] sm:text-[38px] md:text-[46px] leading-[1.05] tracking-[-0.02em] text-[#F4EBDB]">
                  {displayName}
                </h1>
                {userData.isAnonymousProfile !== false && userData.nickname && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#3A322A] bg-[#1A1613] text-[11px] tracking-wider uppercase text-[#B8A999]">
                    <Lock size={11} />
                    Анонимно
                  </span>
                )}
              </div>

              {/* Мета-строка */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#B8A999] mb-4">
                {userData.gender && (
                  <span className="flex items-center gap-1.5">
                    <User size={14} className="opacity-60" />
                    {GENDER_LABELS[userData.gender] || userData.gender}
                  </span>
                )}
                {userData.faculty && (
                  <span className="flex items-center gap-1.5">
                    <BookOpen size={14} className="opacity-60" />
                    {userData.faculty}
                  </span>
                )}
                {userData.course && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} className="opacity-60" />
                    {COURSE_LABELS[userData.course]}, бакалавриат
                  </span>
                )}
              </div>

              {/* Био */}
              {userData.bio && (
                <p className="font-display italic text-[18px] leading-[1.5] text-[#E6D9C9] max-w-xl mb-5">
                  {userData.bio}
                </p>
              )}

              {/* Дисциплины */}
              {disciplines.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {disciplines.map(d => (
                    <span key={d} className="px-3.5 py-1.5 rounded-full border border-[#3A322A] bg-[#1A1613] text-[13px] text-[#E6D9C9]">
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Правая колонка: действия + кастомизация ── */}
            <div className="md:w-56 flex-shrink-0 flex flex-col gap-3">
              <button
                onClick={() => setTab('settings')}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[#F4EBDB] text-[#1A1613] text-[13px] font-semibold hover:bg-white transition-colors"
              >
                <Edit3 size={14} />
                Редактировать
              </button>
              <button
                onClick={copyProfileLink}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full border border-[#3A322A] bg-[#1A1613] hover:bg-[#2E2824] text-[13px] font-medium text-[#E6D9C9] transition-colors"
              >
                {copied ? <Check size={14} /> : <Share2 size={14} />}
                {copied ? 'Скопировано' : 'Поделиться профилем'}
              </button>

              {/* Кастомизация цвета */}
              <div className="mt-2 p-4 rounded-2xl border border-[#3A322A] bg-[#1A1613]">
                <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#8B827A] mb-3">
                  Цвет <span className="text-[#B8A999]">профиля</span>
                </p>
                <div className="flex items-center gap-2.5">
                  {THEME_ORDER.map(id => {
                    const th = PROFILE_THEMES[id]
                    const active = id === themeId
                    return (
                      <button
                        key={id}
                        onClick={() => changeTheme(id)}
                        aria-label={`Тема ${id}`}
                        className="relative w-7 h-7 rounded-full transition-transform hover:scale-110"
                        style={{
                          background: th.swatch,
                          boxShadow: active
                            ? `0 0 0 2px #24201C, 0 0 0 4px ${th.ring}`
                            : id === 'mono'
                              ? 'inset 0 0 0 1px #3A322A'
                              : 'none',
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── Нижняя полоса: 4 метрики ── */}
          <div className="mt-8 pt-6 border-t border-[#3A322A] grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <ProfileStat value={approvedRatings.length} label="одобренных отзывов" accent={theme.text} />
            <ProfileStat value={helpfulVotes} label="голосов «полезно»" accent={theme.text} />
            <ProfileStat value={unlockedCount} label={`достижений · из ${achievements.length}`} accent={theme.text} />
            <ProfileStat value={bookmarkMaterials.length} label="в закладках" accent={theme.text} />
          </div>
        </div>

        {/* ═══════════ ТАБЫ ═══════════ */}
        <div className="mt-8 mb-6 border-b border-[#3A322A] flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                "relative px-4 py-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                tab === t.id ? '' : 'text-[#B8A999] hover:text-[#F4EBDB]',
              ].join(' ')}
              style={tab === t.id ? { color: theme.accent } : {}}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute inset-x-3 -bottom-px h-[2px] transition-colors" style={{ background: theme.accent }} />
              )}
            </button>
          ))}
        </div>

        {/* ═══════════ КОНТЕНТ ТАБОВ ═══════════ */}
        {tab === 'about' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5 animate-fade-up">

            {/* Путь — уровни */}
            <div className="rounded-[22px] border border-[#3A322A] bg-[#24201C] p-6">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--profile-accent)] mb-3">
                Путь на платформе
              </p>
              <h2 className="font-display italic text-[32px] sm:text-[40px] leading-[1] tracking-[-0.02em] text-[#F4EBDB] mb-2">
                {currentLevel.label}
              </h2>
              <p className="text-sm text-[#B8A999] mb-5">
                {levelIdx + 1}-й уровень
                {nextLevel && <> · следующий — <span className="text-[#F4EBDB] font-semibold">{nextLevel.label}</span> ещё через {nextLevel.min - ratings.length} отзывов</>}
              </p>

              {/* Прогресс-бар */}
              <div className="h-2 bg-[#1A1613] rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${xpProgress}%`, background: theme.accent }} />
              </div>
              <div className="flex justify-between text-[11px] text-[#8B827A] mb-6">
                <span>{ratings.length} отз.</span>
                {nextLevel && <span>{nextLevel.min} отз.</span>}
              </div>

              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#8B827A] mb-4">
                Все уровни
              </p>

              <div className="space-y-2">
                {LEVELS.map((lv, i) => {
                  const unlocked = i <= levelIdx
                  const active = i === levelIdx
                  return (
                    <div key={lv.label}
                      className="flex items-center gap-4 px-4 py-3 rounded-2xl border transition-colors"
                      style={active
                        ? { borderColor: theme.accent + '80', background: theme.tint }
                        : { borderColor: '#3A322A', background: '#1A1613' }
                      }
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-display italic text-sm leading-none transition-colors"
                        style={unlocked
                          ? { background: theme.accent, color: '#FFFDF7' }
                          : { background: '#1A1613', border: '1px solid #3A322A', color: '#6B625A' }
                        }
                      >
                        {unlocked && !active ? <Check size={15} /> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-display italic text-[20px] leading-[1.1] ${unlocked ? 'text-[#F4EBDB]' : 'text-[#6B625A]'}`}>
                          {lv.label}
                        </p>
                        <p className={`text-[11px] tracking-wider uppercase ${unlocked ? 'text-[#B8A999]' : 'text-[#6B625A]'}`}>
                          {lv.desc}
                        </p>
                      </div>
                      {active && (
                        <span className="px-3 py-1 rounded-full text-[#FFFDF7] text-[11px] font-semibold tracking-wider uppercase transition-colors"
                          style={{ background: theme.accent }}>
                          сейчас здесь
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Правая колонка: цифры + анонимность */}
            <div className="space-y-5">
              {/* Цифры о вас */}
              <div className="rounded-[22px] border border-[#3A322A] bg-[#24201C] p-6">
                <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--profile-accent)] mb-5">
                  Цифры о вас
                </p>
                <MetricBar label="Средний балл, который вы ставите" value={avgScore ? avgScore.toFixed(1).replace('.', ',') : '—'} pct={avgScore ? (avgScore/10)*100 : 0} accent={theme.accent} />
                <MetricBar label="Доля развёрнутых отзывов" value={`${longShare}%`} pct={longShare} accent={theme.accent} />
                <MetricBar label="Рейтинг доверия · на основе голосов" value={trustLetter} pct={Math.round(approvedShare * 100)} accent={theme.accent} />
                <MetricBar label="Дней на платформе" value={`${days}`} pct={Math.min(100, (days / 365) * 100)} accent={theme.accent} last />
              </div>

              {/* Анонимность */}
              <div className="rounded-[22px] border border-[#3A322A] bg-[#24201C] p-6">
                <div className="flex items-center gap-2 mb-3" style={{ color: theme.accent }}>
                  <Shield size={15} />
                  <p className="font-display italic text-[22px] leading-none text-[#F4EBDB]">Ваша анонимность</p>
                </div>
                <p className="text-sm text-[#B8A999] leading-relaxed mb-5">
                  Преподаватели и другие студенты видят только <span className="text-[#F4EBDB] font-semibold">{displayName}</span>.
                  Ваша почта видна лишь администратору — только при разборе жалобы.
                </p>
                <Link to="/privacy" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#3A322A] bg-[#1A1613] hover:bg-[#2E2824] text-[13px] font-medium text-[#E6D9C9] transition-colors">
                  Правила анонимности
                  <ChevronRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        )}

        {tab === 'achievements' && (
          <div className="rounded-[22px] border border-[#3A322A] bg-[#24201C] p-6 animate-fade-up">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--profile-accent)] mb-1">
                  Достижения
                </p>
                <h2 className="font-display italic text-[32px] leading-[1] tracking-[-0.02em] text-[#F4EBDB]">
                  {unlockedCount} из {achievements.length}
                </h2>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl transition-colors" style={{ color: theme.accent }}>
                  {Math.round((unlockedCount / achievements.length) * 100)}%
                </p>
                <p className="text-[11px] tracking-wider uppercase text-[#8B827A]">открыто</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {achievements.map(ach => (
                <div key={ach.id}
                  className="flex items-start gap-3 p-4 rounded-2xl border transition-colors"
                  style={ach.unlocked
                    ? { borderColor: theme.accent + '66', background: theme.tint }
                    : { borderColor: '#3A322A', background: '#1A1613', opacity: 0.6 }
                  }
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                    style={ach.unlocked
                      ? { background: theme.accent }
                      : { background: '#24201C', border: '1px solid #3A322A' }
                    }
                  >
                    <ach.Icon size={18} className={ach.unlocked ? 'text-[#FFFDF7]' : 'text-[#6B625A]'} />
                  </div>
                  <div className="min-w-0">
                    <p className={`font-display italic text-[18px] leading-tight mb-1 ${ach.unlocked ? 'text-[#F4EBDB]' : 'text-[#8B827A]'}`}>
                      {ach.label}
                    </p>
                    <p className="text-[12px] text-[#8B827A] leading-relaxed">{ach.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'activity' && (
          <div className="animate-fade-up space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_,i) => (
                <div key={i} className="h-24 rounded-2xl border border-[#3A322A] bg-[#24201C] animate-pulse" />
              ))
            ) : ratings.length === 0 ? (
              <div className="rounded-[22px] border border-[#3A322A] bg-[#24201C] p-12 text-center">
                <MessageSquare size={32} className="text-[#6B625A] mx-auto mb-4" />
                <p className="font-display italic text-[24px] text-[#F4EBDB] mb-1">Пока нет отзывов</p>
                <p className="text-sm text-[#B8A999] mb-5">Оцените преподавателей, чтобы здесь появилась активность</p>
                <Link to="/teachers" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--color-rust)] text-[#FFFDF7] text-[13px] font-semibold hover:bg-[#C55830] transition-colors">
                  Перейти к преподавателям <ChevronRight size={14} />
                </Link>
              </div>
            ) : (
              ratings.map(r => <ActivityCard key={r.id} rating={r} teacher={teacherMap[r.teacherId]} accent={theme.accent} />)
            )}
          </div>
        )}

        {tab === 'bookmarks' && (
          <BookmarksTab materials={bookmarkMaterials} loading={loading} accent={theme.accent} />
        )}

        {tab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-up">

            {/* Профиль */}
            <div className="rounded-[22px] border border-[#3A322A] bg-[#24201C] p-6">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--profile-accent)] mb-4">
                Личные данные
              </p>
              <form onSubmit={saveProfile} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#8B827A] mb-1.5">Имя</label>
                    <input value={form.firstName} onChange={e=>setForm(f=>({...f,firstName:e.target.value}))} className={inputCls} placeholder="Иван" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#8B827A] mb-1.5">Фамилия</label>
                    <input value={form.lastName} onChange={e=>setForm(f=>({...f,lastName:e.target.value}))} className={inputCls} placeholder="Петров" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#8B827A] mb-1.5">Отчество</label>
                  <input value={form.middleName} onChange={e=>setForm(f=>({...f,middleName:e.target.value}))} className={inputCls} placeholder="Сергеевич" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#8B827A] mb-1.5">Никнейм</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B625A] text-sm">@</span>
                    <input value={form.nickname} onChange={e=>setForm(f=>({...f,nickname:e.target.value}))} className={inputCls+' pl-8'} placeholder="username" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#8B827A] mb-1.5">О себе</label>
                  <textarea value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} rows={3} maxLength={200}
                    className={inputCls+' resize-none'} placeholder="Расскажите немного о себе..." />
                  <p className="text-[11px] text-[#6B625A] mt-1 text-right">{form.bio.length}/200</p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#8B827A] mb-2">Курс</label>
                  <div className="flex gap-2">
                    {[1,2,3,4].map(c => (
                      <button key={c} type="button" onClick={()=>setForm(f=>({...f,course:c}))}
                        className="flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-colors"
                        style={form.course===c
                          ? { background: theme.accent, color: '#FFFDF7', borderColor: theme.accent }
                          : { background: '#1A1613', borderColor: '#3A322A', color: '#B8A999' }
                        }
                      >{c}</button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={saving}
                  className="w-full py-3 rounded-full bg-[var(--color-rust)] text-[#FFFDF7] font-semibold hover:bg-[#C55830] transition-colors disabled:opacity-50 text-sm">
                  {saving ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
                {saveMsg && <p className={`text-sm text-center font-medium ${saveMsg.includes('Ошибка')?'text-[var(--color-danger)]':'text-[var(--color-ok)]'}`}>{saveMsg}</p>}
              </form>
            </div>

            {/* Правый столбец */}
            <div className="space-y-5">
              {/* Аватар */}
              <div className="rounded-[22px] border border-[#3A322A] bg-[#24201C] p-6">
                <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--profile-accent)] mb-4">
                  Фото профиля
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-[#1A1613] border border-[#3A322A] flex items-center justify-center">
                    {userData.avatarUrl
                      ? <img src={userData.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : <span className="font-display italic text-xl text-[#F4EBDB]">{initials}</span>}
                  </div>
                  <div className="flex-1">
                    <button onClick={()=>fileRef.current?.click()}
                      className="w-full py-2.5 rounded-full border border-[#3A322A] bg-[#1A1613] hover:bg-[#2E2824] text-sm font-medium text-[#E6D9C9] transition-colors">
                      {uploading ? `Загрузка ${uploadProgress}%...` : 'Загрузить фото'}
                    </button>
                    <p className="text-[11px] text-[#6B625A] mt-1.5 text-center">JPG, PNG, WebP · Макс. 5 MB</p>
                    {uploadError && <p className="text-[11px] text-[var(--color-danger)] mt-1 text-center">{uploadError}</p>}
                  </div>
                </div>
              </div>

              {/* Пароль */}
              <div className="rounded-[22px] border border-[#3A322A] bg-[#24201C] p-6">
                <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--profile-accent)] mb-4">
                  Смена пароля
                </p>
                <form onSubmit={changePassword} className="space-y-3">
                  {[['current','Текущий пароль'],['next','Новый пароль'],['confirm','Повторите новый']].map(([field,ph]) => (
                    <input key={field} type="password" value={pwForm[field]}
                      onChange={e=>setPwForm(f=>({...f,[field]:e.target.value}))}
                      className={inputCls} placeholder={ph} />
                  ))}
                  {pwMsg && <p className={`text-sm font-medium ${pwMsg.includes('зменён')?'text-[var(--color-ok)]':'text-[var(--color-danger)]'}`}>{pwMsg}</p>}
                  <button type="submit" disabled={pwLoading}
                    className="w-full py-2.5 rounded-full border border-[#3A322A] bg-[#1A1613] hover:bg-[#2E2824] text-sm font-medium text-[#E6D9C9] transition-colors disabled:opacity-50">
                    {pwLoading ? 'Сохранение...' : 'Изменить пароль'}
                  </button>
                </form>
              </div>

              {/* Аккаунт */}
              <div className="rounded-[22px] border border-[#3A322A] bg-[#24201C] p-6">
                <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#8B827A] mb-4">
                  Аккаунт
                </p>
                <div className="space-y-1">
                  {[
                    ['Email', user?.email],
                    ['Роль', 'Студент'],
                    ['Регистрация', formatDate(userData.createdAt)],
                  ].map(([k,v]) => (
                    <div key={k} className="flex justify-between items-center py-2.5 border-b border-[#3A322A]/60 last:border-0">
                      <span className="text-sm text-[#8B827A]">{k}</span>
                      <span className="text-sm font-medium text-[#F4EBDB] truncate max-w-[60%]">{v}</span>
                    </div>
                  ))}
                </div>
                <button onClick={async()=>{await logoutUser();navigate('/')}}
                  className="mt-4 w-full py-2.5 rounded-full border border-[var(--color-rust)]/40 bg-[var(--color-rust)]/10 text-[var(--color-rust)] text-sm font-semibold hover:bg-[var(--color-rust)]/20 transition-colors flex items-center justify-center gap-2">
                  <LogOut size={14} /> Выйти из аккаунта
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════
   ПОДЭЛЕМЕНТЫ
════════════════════════════════════════════════ */

function ProfileStat({ value, label, accent }) {
  return (
    <div>
      <p
        className="font-display italic text-[28px] sm:text-[40px] leading-[1] tracking-[-0.02em] mb-1.5 transition-colors"
        style={{ color: accent || 'var(--color-rust)' }}
      >
        {value}
      </p>
      <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#8B827A]">
        {label}
      </p>
    </div>
  )
}

function MetricBar({ label, value, pct, last, accent }) {
  const color = accent || 'var(--color-rust)'
  return (
    <div className={last ? '' : 'mb-5'}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm text-[#E6D9C9]">{label}</span>
        <span className="font-mono text-sm font-semibold transition-colors" style={{ color }}>{value}</span>
      </div>
      <div className="h-[6px] bg-[#1A1613] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
      </div>
    </div>
  )
}

/* ── Карточка отзыва в ленте активности ── */
function ActivityCard({ rating, teacher, accent }) {
  const color = accent || 'var(--color-rust)'
  const statusConfig = {
    pending:  { label: 'На модерации', cls: 'border-[#3A322A] text-[#B8A999] bg-[#1A1613]' },
    approved: { label: 'Опубликован',  cls: 'border-[var(--color-ok)]/40 text-[var(--color-ok)] bg-[var(--color-ok)]/10' },
    rejected: { label: 'Отклонён',     cls: 'border-[var(--color-danger)]/40 text-[var(--color-danger)] bg-[var(--color-danger)]/10' },
  }
  const s = statusConfig[rating.status] || statusConfig.pending
  const teacherName = teacher
    ? [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ')
    : 'Преподаватель'

  const criteriaEntries = Object.entries(rating.criteriaScores || {}).slice(0, 4)
  const score = rating.averageScore || 0

  const CRITERIA_LABELS = {
    knowledge: 'Знания', explanation: 'Объяснение', availability: 'Доступность',
    fairness: 'Справедливость', materials: 'Материалы', practice: 'Практика',
    feedback: 'Обратная связь', engagement: 'Вовлечённость',
  }

  return (
    <div className="rounded-2xl border border-[#3A322A] bg-[#24201C] hover:border-[var(--profile-accent-soft)] transition-colors p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex-shrink-0">
            <p className="font-display italic text-[32px] leading-none tracking-[-0.02em] transition-colors"
              style={{ color }}>
              {score.toFixed(1).replace('.', ',')}
            </p>
            <p className="text-[10px] tracking-wider uppercase text-[#8B827A] mt-1">из 10</p>
          </div>
          <div className="min-w-0">
            {teacher
              ? <Link to={`/teachers/${rating.teacherId}`} className="font-display italic text-[20px] leading-tight text-[#F4EBDB] hover:text-[var(--profile-accent)] transition-colors block truncate">
                  {teacherName}
                </Link>
              : <p className="font-display italic text-[20px] text-[#F4EBDB]">{teacherName}</p>
            }
            <p className="text-xs text-[#8B827A] mt-0.5">
              {formatDateShort(rating.createdAt)}{rating.isAnonymous ? ' · анонимно' : ''}
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border tracking-wider uppercase flex-shrink-0 ${s.cls}`}>
          {s.label}
        </span>
      </div>

      {criteriaEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 mb-3">
          {criteriaEntries.map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[11px] text-[#8B827A] w-24 truncate">{CRITERIA_LABELS[key] || key}</span>
              <div className="flex-1 h-[5px] bg-[#1A1613] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(val/10)*100}%`, background: color }} />
              </div>
              <span className="font-mono text-[11px] text-[#E6D9C9] w-5 text-right">{val}</span>
            </div>
          ))}
        </div>
      )}

      {rating.comment && (
        <p className="text-sm text-[#B8A999] leading-relaxed line-clamp-2 pl-3 border-l-2 border-[#3A322A]">
          {rating.comment}
        </p>
      )}
    </div>
  )
}

/* ── Закладки ── */
function BookmarksTab({ materials, loading, accent }) {
  const color = accent || 'var(--color-rust)'
  const TYPE_LABELS = { pdf:'PDF', docx:'DOC', mp4:'VID', pptx:'PPT', xlsx:'XLS' }

  if (loading) return <div className="rounded-[22px] border border-[#3A322A] bg-[#24201C] h-48 animate-pulse" />

  if (materials.length === 0) return (
    <div className="rounded-[22px] border border-[#3A322A] bg-[#24201C] p-12 text-center animate-fade-up">
      <Bookmark size={32} className="text-[#6B625A] mx-auto mb-4" />
      <p className="font-display italic text-[24px] text-[#F4EBDB] mb-1">Закладок пока нет</p>
      <p className="text-sm text-[#B8A999] mb-5">Добавляйте материалы для быстрого доступа</p>
      <Link to="/materials" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--color-rust)] text-[#FFFDF7] text-[13px] font-semibold hover:bg-[#C55830] transition-colors">
        Найти материалы <ChevronRight size={14} />
      </Link>
    </div>
  )

  return (
    <div className="animate-fade-up">
      <p className="text-sm text-[#B8A999] mb-4">{materials.length} сохранённых материалов</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {materials.map(m => {
          const ft = (m.fileType || m.type || '').toLowerCase()
          const label = TYPE_LABELS[ft] || (ft ? ft.slice(0,3).toUpperCase() : 'FILE')
          return (
            <div key={m.id} className="rounded-2xl border border-[#3A322A] bg-[#24201C] hover:border-[var(--profile-accent-soft)] transition-colors p-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display italic text-[20px] leading-tight text-[#F4EBDB] line-clamp-1 mb-1">
                  {m.title}
                </p>
                <p className="text-xs text-[#8B827A] line-clamp-1">
                  {m.discipline}{m.teacherName ? ` · ${m.teacherName}` : ''}
                </p>
              </div>
              <span className="text-[10px] font-semibold tracking-[0.18em] uppercase flex-shrink-0 transition-colors"
                style={{ color }}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
