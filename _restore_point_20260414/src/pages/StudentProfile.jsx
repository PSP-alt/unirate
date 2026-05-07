import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { updateUserDocument } from '../services/firestore'
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
  TrendingUp, Award, Flame, Shield, Zap, Heart, Eye, FileText
} from 'lucide-react'

/* ── Helpers ── */
const COURSE_LABELS = { 1: '1-й курс', 2: '2-й курс', 3: '3-й курс', 4: '4-й курс' }

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

/* ── Level system ── */
const LEVELS = [
  { min: 0,  max: 0,  label: 'Новичок',      color: '#64748b', bg: '#f1f5f9', Icon: Eye   },
  { min: 1,  max: 2,  label: 'Наблюдатель',  color: '#3b82f6', bg: '#eff6ff', Icon: Eye   },
  { min: 3,  max: 5,  label: 'Активный',     color: '#10b981', bg: '#ecfdf5', Icon: Flame },
  { min: 6,  max: 10, label: 'Критик',       color: '#f59e0b', bg: '#fffbeb', Icon: Zap   },
  { min: 11, max: 19, label: 'Эксперт',      color: '#8b5cf6', bg: '#f5f3ff', Icon: Shield},
  { min: 20, max: Infinity, label: 'Легенда',color: '#002366', bg: '#ccff00', Icon: Award },
]
function getLevel(count) {
  return [...LEVELS].reverse().find(l => count >= l.min) || LEVELS[0]
}
function getNextLevel(count) {
  return LEVELS.find(l => l.min > count) || null
}

/* ── Achievements ── */
function getAchievements(ratings) {
  return [
    { id: 'first',    Icon: Star,        label: 'Первый отзыв',     desc: 'Оставил первый отзыв',              unlocked: ratings.length >= 1     },
    { id: 'active',   Icon: Flame,       label: 'Активный',         desc: '5 и более отзывов',                 unlocked: ratings.length >= 5     },
    { id: 'veteran',  Icon: Trophy,      label: 'Ветеран',          desc: '10 и более отзывов',                unlocked: ratings.length >= 10    },
    { id: 'legend',   Icon: Award,       label: 'Легенда',          desc: '20 и более отзывов',                unlocked: ratings.length >= 20    },
    { id: 'critic',   Icon: MessageSquare,label: 'Критик',          desc: 'Развёрнутый комментарий (100+ симв)',unlocked: ratings.some(r => (r.comment?.length||0) > 100) },
    { id: 'fair',     Icon: Shield,      label: 'Справедливый',     desc: 'Средний балл 7–8',                  unlocked: (() => { if (!ratings.length) return false; const a=ratings.reduce((s,r)=>s+(r.averageScore||0),0)/ratings.length; return a>=7&&a<=8 })() },
    { id: 'generous', Icon: Heart,       label: 'Щедрый',           desc: 'Средний балл выше 9',               unlocked: (() => { if (!ratings.length) return false; const a=ratings.reduce((s,r)=>s+(r.averageScore||0),0)/ratings.length; return a>9 })() },
    { id: 'early',    Icon: Zap,         label: 'Ранний пользователь',desc: 'Зарегистрировался одним из первых',unlocked: true },
  ]
}

const inputCls = "w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-on-surface placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] transition-all"

/* ════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════ */
export default function StudentProfile() {
  const { user, userData, refreshUserData } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef()

  const [tab, setTab] = useState('activity')
  const [ratings, setRatings] = useState([])
  const [teacherMap, setTeacherMap] = useState({})
  const [bookmarkMaterials, setBookmarkMaterials] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')

  const [form, setForm] = useState({ firstName:'', lastName:'', middleName:'', nickname:'', bio:'', course:1 })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [pwForm, setPwForm] = useState({ current:'', next:'', confirm:'' })
  const [pwMsg, setPwMsg] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    if (userData) {
      setForm({
        firstName: userData.firstName||'', lastName: userData.lastName||'',
        middleName: userData.middleName||'', nickname: userData.nickname||'',
        bio: userData.bio||'', course: userData.course||1,
      })
    }

    // Fetch ratings + teachers + bookmarks in parallel
    Promise.all([
      getStudentRatings(user.uid),
      getTeachers(),
      getBookmarks(user.uid),
    ]).then(async ([{ ratings: rList }, { teachers: tList }, { bookmarkIds }]) => {
      setRatings(rList)
      // Build teacherId → teacher map
      const map = {}
      tList.forEach(t => { map[t.id] = t })
      setTeacherMap(map)

      // Fetch bookmarked materials
      if (bookmarkIds.length > 0) {
        const { materials } = await getMaterials({ pageSize: 100 })
        const bm = materials.filter(m => bookmarkIds.includes(m.id))
        setBookmarkMaterials(bm)
      }
      setLoading(false)
    })
  }, [user, userData])

  /* Avatar upload */
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
    const { error } = await updateUserDocument(user.uid, {
      firstName: form.firstName, lastName: form.lastName, middleName: form.middleName,
      nickname: form.nickname, bio: form.bio, course: Number(form.course),
    })
    await refreshUserData()
    setSaving(false)
    setSaveMsg(error ? 'Ошибка сохранения' : 'Сохранено!')
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
      setPwMsg('Пароль изменён!')
      setPwForm({ current:'', next:'', confirm:'' })
    } catch { setPwMsg('Неверный текущий пароль') }
    setPwLoading(false)
    setTimeout(() => setPwMsg(''), 4000)
  }

  if (!userData) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#002366] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const fullName  = [userData.lastName, userData.firstName, userData.middleName].filter(Boolean).join(' ')
  const initials  = [userData.firstName?.[0], userData.lastName?.[0]].filter(Boolean).join('')
  const avgScore  = ratings.length ? (ratings.reduce((s,r)=>s+(r.averageScore||0),0)/ratings.length).toFixed(1) : null
  const days      = daysSince(userData.createdAt)
  const level     = getLevel(ratings.length)
  const nextLevel = getNextLevel(ratings.length)
  const xpPct     = nextLevel
    ? Math.round(((ratings.length - level.min) / (nextLevel.min - level.min)) * 100)
    : 100
  const achievements  = getAchievements(ratings)
  const unlockedCount = achievements.filter(a => a.unlocked).length

  const TABS = [
    { id: 'activity',  label: 'Активность', Icon: MessageSquare },
    { id: 'stats',     label: 'Статистика', Icon: BarChart2 },
    { id: 'bookmarks', label: 'Закладки',   Icon: Bookmark },
    { id: 'settings',  label: 'Настройки',  Icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-[#f8f8fa] pt-20 pb-16">
      <div className="max-w-5xl mx-auto px-4 md:px-6">

        {/* ════ HERO ════ */}
        <div className="relative rounded-3xl overflow-hidden mb-6 animate-fade-up" style={{ background: '#002366' }}>
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #ccff00 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[#ccff00] opacity-10 blur-3xl pointer-events-none" />

          <div className="relative px-6 md:px-8 py-7">
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">

              {/* Avatar */}
              <div className="relative flex-shrink-0 cursor-pointer group" onClick={() => fileRef.current?.click()}>
                <div className="w-24 h-24 rounded-2xl border-4 border-white/20 overflow-hidden bg-white/10">
                  {userData.avatarUrl
                    ? <img src={userData.avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white">{initials||'?'}</div>
                  }
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                    <Camera size={20} className="text-white" />
                  </div>
                  {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-2xl">
                      <span className="text-white text-sm font-bold">{uploadProgress}%</span>
                    </div>
                  )}
                </div>
                {/* Level icon badge */}
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full border-2 border-[#002366] flex items-center justify-center"
                  style={{ background: level.color }}>
                  <level.Icon size={13} className="text-white" />
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h1 className="text-2xl font-bold text-white font-headline tracking-tight">{fullName||'Имя не указано'}</h1>
                  <span className="px-2.5 py-0.5 bg-[#ccff00] text-[#002366] text-xs font-bold rounded-full">
                    {COURSE_LABELS[userData.course]||'Студент'}
                  </span>
                </div>
                {userData.nickname && <p className="text-white/50 text-sm mb-1">@{userData.nickname}</p>}
                {userData.bio && <p className="text-white/60 text-sm max-w-lg leading-relaxed mb-2">{userData.bio}</p>}

                {/* Level + XP bar */}
                <div className="mt-3 max-w-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-white/80 text-xs font-semibold flex items-center gap-1.5">
                      <level.Icon size={12} />
                      {level.label}
                    </span>
                    {nextLevel && (
                      <span className="text-white/40 text-[10px]">{ratings.length}/{nextLevel.min} до «{nextLevel.label}»</span>
                    )}
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#ccff00] rounded-full transition-all duration-700"
                      style={{ width: `${xpPct}%` }} />
                  </div>
                </div>

                <p className="text-white/30 text-xs mt-3 flex items-center gap-1.5">
                  <Calendar size={11} />
                  На платформе {days > 0 ? `${days} дн.` : 'сегодня'} · с {formatDate(userData.createdAt)}
                </p>
              </div>

              <button onClick={async () => { await logoutUser(); navigate('/') }}
                className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/70 transition-colors flex-shrink-0 self-start">
                <LogOut size={14} /> Выйти
              </button>
            </div>
          </div>
        </div>

        {/* ════ STATS ROW ════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 animate-fade-up" style={{ animationDelay: '60ms' }}>
          {[
            { Icon: MessageSquare, value: ratings.length, label: 'Отзывов',          color: 'text-blue-500',    bg: 'bg-blue-50'    },
            { Icon: Star,          value: avgScore||'—',  label: 'Средний балл',      color: 'text-amber-500',   bg: 'bg-amber-50'   },
            { Icon: Calendar,      value: days,           label: 'Дней на платформе', color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { Icon: Trophy,        value: `${unlockedCount}/${achievements.length}`, label: 'Достижений', color: 'text-purple-500', bg: 'bg-purple-50' },
          ].map(({ Icon, value, label, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} className={color} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-on-surface leading-tight">{value}</p>
                <p className="text-[11px] text-slate-500 leading-tight">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ════ ACHIEVEMENTS ════ */}
        <div className="bg-white rounded-3xl p-5 mb-6 border border-slate-100 animate-fade-up" style={{ animationDelay: '120ms' }}>
          <h2 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2 uppercase tracking-wide">
            <Trophy size={15} className="text-amber-500" />
            Достижения · {unlockedCount}/{achievements.length}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {achievements.map(ach => (
              <div key={ach.id}
                className={`flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all ${
                  ach.unlocked ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100 opacity-40'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${ach.unlocked ? 'bg-amber-100' : 'bg-slate-200'}`}>
                  <ach.Icon size={15} className={ach.unlocked ? 'text-amber-600' : 'text-slate-400'} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold truncate ${ach.unlocked ? 'text-amber-800' : 'text-slate-500'}`}>{ach.label}</p>
                  <p className="text-[10px] text-slate-400 leading-tight line-clamp-1">{ach.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ════ TABS ════ */}
        <div className="flex gap-1 p-1 bg-white rounded-2xl mb-6 w-fit border border-slate-100 animate-fade-up" style={{ animationDelay: '160ms' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                tab === t.id ? 'bg-[#002366] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}>
              <t.Icon size={15} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ════ TAB: ACTIVITY ════ */}
        {tab === 'activity' && (
          <div className="space-y-3 animate-fade-up">
            {loading ? (
              Array.from({length:3}).map((_,i) => (
                <div key={i} className="bg-white rounded-2xl p-5 animate-pulse border border-slate-100 h-20" />
              ))
            ) : ratings.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-100">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={28} className="text-slate-300" />
                </div>
                <p className="font-semibold text-on-surface mb-1">Ещё нет отзывов</p>
                <p className="text-slate-500 text-sm mb-5">Оцените преподавателей, чтобы здесь появилась активность</p>
                <Link to="/teachers"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#002366] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a7a] transition-colors">
                  Перейти к преподавателям <ChevronRight size={14} />
                </Link>
              </div>
            ) : (
              ratings.map(r => <ActivityCard key={r.id} rating={r} teacher={teacherMap[r.teacherId]} />)
            )}
          </div>
        )}

        {/* ════ TAB: STATS ════ */}
        {tab === 'stats' && (
          <StatsTab ratings={ratings} loading={loading} />
        )}

        {/* ════ TAB: BOOKMARKS ════ */}
        {tab === 'bookmarks' && (
          <BookmarksTab materials={bookmarkMaterials} loading={loading} />
        )}

        {/* ════ TAB: SETTINGS ════ */}
        {tab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-up">

            {/* Profile info */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100">
              <h3 className="text-sm font-bold text-on-surface mb-5 flex items-center gap-2 uppercase tracking-wide">
                <User size={15} className="text-[#002366]" /> Личные данные
              </h3>
              <form onSubmit={saveProfile} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Имя</label>
                    <input value={form.firstName} onChange={e=>setForm(f=>({...f,firstName:e.target.value}))} className={inputCls} placeholder="Иван" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Фамилия</label>
                    <input value={form.lastName} onChange={e=>setForm(f=>({...f,lastName:e.target.value}))} className={inputCls} placeholder="Петров" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Отчество</label>
                  <input value={form.middleName} onChange={e=>setForm(f=>({...f,middleName:e.target.value}))} className={inputCls} placeholder="Сергеевич" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Никнейм</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span>
                    <input value={form.nickname} onChange={e=>setForm(f=>({...f,nickname:e.target.value}))} className={inputCls+' pl-8'} placeholder="username" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">О себе</label>
                  <textarea value={form.bio} onChange={e=>setForm(f=>({...f,bio:e.target.value}))} rows={3} maxLength={200}
                    className={inputCls+' resize-none'} placeholder="Расскажите немного о себе..." />
                  <p className="text-[11px] text-slate-400 mt-1 text-right">{form.bio.length}/200</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Курс</label>
                  <div className="flex gap-2">
                    {[1,2,3,4].map(c => (
                      <button key={c} type="button" onClick={()=>setForm(f=>({...f,course:c}))}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-xl border-2 transition-all ${
                          form.course===c ? 'bg-[#002366] text-white border-[#002366]' : 'bg-white border-slate-200 text-slate-500 hover:border-[#002366]/40'
                        }`}>{c}</button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={saving}
                  className="w-full py-3 bg-[#ccff00] text-[#002366] font-bold rounded-xl hover:brightness-95 transition-all disabled:opacity-50 text-sm shadow-[0_4px_20px_rgba(204,255,0,0.3)]">
                  {saving ? 'Сохранение...' : 'Сохранить изменения'}
                </button>
                {saveMsg && <p className={`text-sm text-center font-medium ${saveMsg.includes('Ошибка')?'text-red-500':'text-emerald-600'}`}>{saveMsg}</p>}
              </form>
            </div>

            <div className="space-y-4">
              {/* Avatar */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100">
                <h3 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2 uppercase tracking-wide">
                  <Camera size={15} className="text-[#002366]" /> Фото профиля
                </h3>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-[#002366] flex items-center justify-center">
                    {userData.avatarUrl
                      ? <img src={userData.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : <span className="text-lg font-bold text-white">{initials}</span>
                    }
                  </div>
                  <div className="flex-1">
                    <button onClick={()=>fileRef.current?.click()}
                      className="w-full py-2 bg-slate-50 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-100 border border-slate-200 transition-colors">
                      {uploading ? `Загрузка ${uploadProgress}%...` : 'Загрузить фото'}
                    </button>
                    <p className="text-[11px] text-slate-400 mt-1.5 text-center">JPG, PNG, WebP · Макс. 5 MB</p>
                    {uploadError && <p className="text-[11px] text-red-500 mt-1 text-center">{uploadError}</p>}
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100">
                <h3 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2 uppercase tracking-wide">
                  <Lock size={15} className="text-[#002366]" /> Смена пароля
                </h3>
                <form onSubmit={changePassword} className="space-y-3">
                  {[['current','Текущий пароль'],['next','Новый пароль'],['confirm','Повторите новый']].map(([field,ph]) => (
                    <input key={field} type="password" value={pwForm[field]}
                      onChange={e=>setPwForm(f=>({...f,[field]:e.target.value}))}
                      className={inputCls} placeholder={ph} />
                  ))}
                  {pwMsg && <p className={`text-sm font-medium ${pwMsg.includes('зменён')?'text-emerald-600':'text-red-500'}`}>{pwMsg}</p>}
                  <button type="submit" disabled={pwLoading}
                    className="w-full py-2.5 bg-slate-50 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50">
                    {pwLoading ? 'Сохранение...' : 'Изменить пароль'}
                  </button>
                </form>
              </div>

              {/* Account info */}
              <div className="bg-white rounded-3xl p-5 border border-slate-100">
                <h3 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2 uppercase tracking-wide">
                  <User size={15} className="text-slate-400" /> Аккаунт
                </h3>
                <div className="space-y-2">
                  {[
                    ['Email', user?.email],
                    ['Роль', 'Студент'],
                    ['Регистрация', formatDate(userData.createdAt)],
                  ].map(([k,v]) => (
                    <div key={k} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                      <span className="text-sm text-slate-500">{k}</span>
                      <span className="text-sm font-medium text-on-surface truncate max-w-[60%]">{v}</span>
                    </div>
                  ))}
                </div>
                <button onClick={async()=>{await logoutUser();navigate('/')}}
                  className="mt-4 w-full py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-red-100 flex items-center justify-center gap-2">
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
   ACTIVITY CARD
════════════════════════════════════════════════ */
function ActivityCard({ rating, teacher }) {
  const statusConfig = {
    pending:  { label: 'На модерации', cls: 'bg-amber-50 text-amber-600 border-amber-100'  },
    approved: { label: 'Опубликован',  cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    rejected: { label: 'Отклонён',     cls: 'bg-red-50 text-red-500 border-red-100'        },
  }
  const s = statusConfig[rating.status] || statusConfig.pending
  const teacherName = teacher
    ? [teacher.lastName, teacher.firstName, teacher.middleName].filter(Boolean).join(' ')
    : 'Преподаватель'

  const criteriaEntries = Object.entries(rating.criteriaScores || {}).slice(0, 4)

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#002366]/10 flex items-center justify-center flex-shrink-0">
            <MessageSquare size={18} className="text-[#002366]" />
          </div>
          <div className="min-w-0">
            {teacher
              ? <Link to={`/teachers/${rating.teacherId}`} className="text-sm font-semibold text-on-surface hover:text-[#002366] transition-colors truncate block">
                  {teacherName}
                </Link>
              : <p className="text-sm font-semibold text-on-surface">{teacherName}</p>
            }
            <p className="text-xs text-slate-400">{formatDateShort(rating.createdAt)}{rating.isAnonymous ? ' · анонимно' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-full">
            <Star size={12} className="fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold text-amber-600">{rating.averageScore?.toFixed(1)}</span>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${s.cls}`}>{s.label}</span>
        </div>
      </div>

      {/* Criteria mini bars */}
      {criteriaEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3 pl-13">
          {criteriaEntries.map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 w-20 truncate capitalize">{key}</span>
              <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-[#002366]" style={{ width: `${(val/10)*100}%` }} />
              </div>
              <span className="text-[10px] text-slate-500 w-4 text-right">{val}</span>
            </div>
          ))}
        </div>
      )}

      {rating.comment && (
        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 border-l-2 border-slate-100 pl-3">
          {rating.comment}
        </p>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════
   STATS TAB
════════════════════════════════════════════════ */
function StatsTab({ ratings, loading }) {
  if (loading) return <div className="bg-white rounded-3xl p-8 border border-slate-100 animate-pulse h-64" />

  if (ratings.length === 0) return (
    <div className="bg-white rounded-3xl p-12 text-center border border-slate-100">
      <BarChart2 size={32} className="text-slate-200 mx-auto mb-4" />
      <p className="font-semibold text-on-surface mb-1">Нет данных для статистики</p>
      <p className="text-slate-400 text-sm">Оставьте хотя бы один отзыв, чтобы увидеть статистику</p>
    </div>
  )

  // Aggregate criteria
  const criteriaAgg = {}
  ratings.forEach(r => {
    Object.entries(r.criteriaScores||{}).forEach(([k,v]) => {
      if (!criteriaAgg[k]) criteriaAgg[k] = { sum: 0, count: 0 }
      criteriaAgg[k].sum += v
      criteriaAgg[k].count++
    })
  })
  const criteriaAvgs = Object.entries(criteriaAgg)
    .map(([k, { sum, count }]) => ({ key: k, avg: sum/count }))
    .sort((a,b) => b.avg - a.avg)

  // Score distribution
  const dist = Array(10).fill(0)
  ratings.forEach(r => {
    const bucket = Math.min(Math.round(r.averageScore||0), 10)
    if (bucket >= 1) dist[bucket-1]++
  })
  const distMax = Math.max(...dist, 1)

  // Monthly activity (last 6 months)
  const now = new Date()
  const months = Array.from({length:6}, (_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1)
    return { label: d.toLocaleDateString('ru-RU',{month:'short'}), year: d.getFullYear(), month: d.getMonth(), count: 0 }
  })
  ratings.forEach(r => {
    if (!r.createdAt) return
    const d = r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt)
    const m = months.find(x => x.year===d.getFullYear() && x.month===d.getMonth())
    if (m) m.count++
  })
  const monthMax = Math.max(...months.map(m=>m.count), 1)

  const CRITERIA_LABELS = {
    knowledge: 'Знания', explanation: 'Объяснение', availability: 'Доступность',
    fairness: 'Справедливость', materials: 'Материалы', practice: 'Практика',
    feedback: 'Обратная связь', engagement: 'Вовлечённость',
  }

  return (
    <div className="space-y-5 animate-fade-up">

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Всего отзывов',   value: ratings.length },
          { label: 'Средний балл',    value: (ratings.reduce((s,r)=>s+(r.averageScore||0),0)/ratings.length).toFixed(1) },
          { label: 'Преподавателей',  value: new Set(ratings.map(r=>r.teacherId)).size },
        ].map(({label,value}) => (
          <div key={label} className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
            <p className="text-2xl font-bold text-[#002366] font-headline">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Criteria breakdown */}
      {criteriaAvgs.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-100">
          <h3 className="text-sm font-bold text-on-surface mb-5 flex items-center gap-2 uppercase tracking-wide">
            <TrendingUp size={15} className="text-[#002366]" /> Средние оценки по критериям
          </h3>
          <div className="space-y-3">
            {criteriaAvgs.map(({key, avg}) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-28 flex-shrink-0">{CRITERIA_LABELS[key]||key}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(avg/10)*100}%`, background: avg>=8?'#002366':avg>=6?'#f59e0b':'#ef4444' }} />
                </div>
                <span className="text-xs font-bold text-on-surface w-8 text-right">{avg.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score distribution */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100">
        <h3 className="text-sm font-bold text-on-surface mb-5 flex items-center gap-2 uppercase tracking-wide">
          <BarChart2 size={15} className="text-[#002366]" /> Распределение оценок
        </h3>
        <div className="flex items-end gap-1.5 h-24">
          {dist.map((count, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-slate-400">{count||''}</span>
              <div className="w-full rounded-t-md transition-all duration-700"
                style={{ height: `${(count/distMax)*64}px`, minHeight: count>0?'4px':0, background: count>0?'#002366':'#f1f5f9' }} />
              <span className="text-[9px] text-slate-400">{i+1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly activity */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100">
        <h3 className="text-sm font-bold text-on-surface mb-5 flex items-center gap-2 uppercase tracking-wide">
          <Calendar size={15} className="text-[#002366]" /> Активность за 6 месяцев
        </h3>
        <div className="flex items-end gap-3 h-20">
          {months.map((m,i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-slate-400">{m.count||''}</span>
              <div
                className={`w-full rounded-t-lg transition-all duration-700 ${m.count===0 ? 'bg-slate-100' : ''}`}
                style={{ height: `${(m.count/monthMax)*52}px`, minHeight: m.count>0 ? '6px' : 0, background: m.count>0 ? '#ccff00' : undefined }}
              />
              <span className="text-[10px] text-slate-400 capitalize">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════
   BOOKMARKS TAB
════════════════════════════════════════════════ */
function BookmarksTab({ materials, loading }) {
  const FILE_COLORS = { pdf:'#ef4444', docx:'#3b82f6', mp4:'#8b5cf6', pptx:'#f97316', xlsx:'#10b981' }

  if (loading) return <div className="bg-white rounded-3xl p-8 border border-slate-100 animate-pulse h-48" />

  if (materials.length === 0) return (
    <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 animate-fade-up">
      <Bookmark size={32} className="text-slate-200 mx-auto mb-4" />
      <p className="font-semibold text-on-surface mb-1">Закладок пока нет</p>
      <p className="text-slate-400 text-sm mb-5">Добавляйте материалы в закладки для быстрого доступа</p>
      <Link to="/materials"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#002366] text-white text-sm font-semibold rounded-xl hover:bg-[#1a3a7a] transition-colors">
        Найти материалы <ChevronRight size={14} />
      </Link>
    </div>
  )

  return (
    <div className="animate-fade-up">
      <p className="text-sm text-slate-500 mb-4">{materials.length} сохранённых материалов</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {materials.map(m => {
          const ft = (m.fileType||m.type||'').toLowerCase()
          const color = FILE_COLORS[ft] || '#64748b'
          return (
            <div key={m.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-sm transition-all flex items-stretch">
              <div className="w-1.5 flex-shrink-0" style={{ background: color }} />
              <div className="p-4 flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface line-clamp-1">{m.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{m.discipline} · {m.teacherName}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: `${color}18`, color }}>{ft.toUpperCase()||'FILE'}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
