/* ═══════════════════════════════════════════════════
   Панель администратора — /admin

   Секции:
   1. Обзор — статистика + график активности
   2. Модерация — pending отзывы с полным превью
   3. Жалобы — flagged отзывы
   4. Пользователи — управление, смена роли, бан
   5. Преподаватели — одобрение + полный список
   6. Материалы — просмотр + удаление
   ═══════════════════════════════════════════════════ */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  LayoutDashboard, Shield, AlertTriangle, Users, GraduationCap,
  FolderOpen, CheckCircle, XCircle, Clock, Star, Download, BookOpen,
  ToggleLeft, ToggleRight, Search, ChevronDown, Trash2, Eye,
  ThumbsUp, ThumbsDown, RefreshCw, UserCog, Zap, TrendingUp,
  Ban, UserX, LockOpen, Timer, MessageSquarePlus, Lightbulb,
  Send, MessageCircle, Upload, Plus, FileText, Loader,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getPendingRatings, approveRating, rejectRating,
  getAllUsers, toggleUserActive, getPendingTeachers, approveTeacher,
  getPlatformStats, getFlaggedRatings, dismissFlags, warnStudent,
  changeUserRole, deleteRatingPermanently, getAllTeachersFull,
  getAllMaterialsAdmin, deleteMaterialAdmin, uploadMaterialAdmin, bulkApproveAllPending,
  getRecentRatings, blockUserTemporarily, unblockUser, deleteUserAccount,
  getAllSupportMessages, markSupportRead, resolveSupportMessage, deleteSupportMessage,
  cleanupOrphanedTeachers,
} from '../services/admin'

/* ─── Constants ─── */
const SECTIONS = [
  { key: 'overview',    label: 'Обзор',          icon: LayoutDashboard   },
  { key: 'moderation',  label: 'Модерация',       icon: Shield            },
  { key: 'flagged',     label: 'Жалобы',          icon: AlertTriangle     },
  { key: 'users',       label: 'Пользователи',    icon: Users             },
  { key: 'teachers',    label: 'Преподаватели',   icon: GraduationCap     },
  { key: 'materials',   label: 'Материалы',       icon: FolderOpen        },
  { key: 'support',     label: 'Поддержка',       icon: MessageSquarePlus },
]

const ROLE_OPTIONS = [
  { value: 'student', label: 'Студент'        },
  { value: 'teacher', label: 'Преподаватель'  },
  { value: 'admin',   label: 'Администратор'  },
]

const NPS_COLORS = {
  yes:   'text-[var(--color-ok)] bg-[var(--color-ok)]/10',
  maybe: 'text-[var(--color-warn)] bg-[var(--color-warn)]/10',
  no:    'text-[var(--color-danger)] bg-[var(--color-danger)]/10',
}
const NPS_LABELS = { yes: 'Рекомендует', maybe: 'Скорее да', no: 'Не рекомендует' }
const ATTENDANCE_LABELS = {
  very_high: '81–100%', high: '61–80%', medium: '41–60%',
  low: '21–40%', very_low: '1–20%', none: '0%',
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function dayLabel(offsetDays) {
  const d = new Date(Date.now() - offsetDays * 86400000)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
export default function Admin() {
  const { user, userData } = useAuth()
  const navigate = useNavigate()
  const [section, setSection]   = useState('overview')
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  /* Data */
  const [stats,           setStats]           = useState(null)
  const [pendingRatings,  setPendingRatings]  = useState([])
  const [flaggedRatings,  setFlaggedRatings]  = useState([])
  const [users,           setUsers]           = useState([])
  const [pendingTeachers, setPendingTeachers] = useState([])
  const [allTeachers,     setAllTeachers]     = useState([])
  const [materials,       setMaterials]       = useState([])
  const [recentActivity,  setRecentActivity]  = useState([])
  const [supportMessages, setSupportMessages] = useState([])

  /* Moderation */
  const [expandedRating,  setExpandedRating]  = useState(null)
  const [rejectingId,     setRejectingId]     = useState(null)
  const [rejectReason,    setRejectReason]    = useState('')
  const [bulkLoading,     setBulkLoading]     = useState(false)

  /* Users */
  const [userSearch,      setUserSearch]      = useState('')
  const [roleChanging,    setRoleChanging]    = useState(null)
  const [userRoleFilter,  setUserRoleFilter]  = useState('all')
  /* Ban modal */
  const [banTarget,       setBanTarget]       = useState(null)   // { id, name }
  const [banDays,         setBanDays]         = useState(7)      // 0 = навсегда
  const [banReason,       setBanReason]       = useState('')
  const [banLoading,      setBanLoading]      = useState(false)
  /* Delete confirm */
  const [deleteTarget,    setDeleteTarget]    = useState(null)   // { id, name }
  const [deleteLoading,   setDeleteLoading]   = useState(false)

  /* Teachers */
  const [teacherSearch,   setTeacherSearch]   = useState('')
  const [teacherTab,      setTeacherTab]      = useState('pending') // pending | all

  /* Materials */
  const [matSearch,       setMatSearch]       = useState('')
  const [showUploadForm,  setShowUploadForm]  = useState(false)
  const [uploadData,      setUploadData]      = useState({
    title: '', description: '', discipline: '', course: '', teacherId: '', file: null,
  })
  const [uploadProgress,  setUploadProgress]  = useState(0)
  const [uploading,       setUploading]       = useState(false)

  /* Support */
  const [supportTab,      setSupportTab]      = useState('complaints')  // complaints | suggestions
  const [supportExpanded, setSupportExpanded] = useState(null)
  const [replyingId,      setReplyingId]      = useState(null)
  const [replyText,       setReplyText]       = useState('')

  /* ── Load all data ── */
  async function loadData(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const [
      statsRes, pendRes, flagRes, usersRes, pendTeachRes,
      allTeachRes, matsRes, recentRes, supportRes,
    ] = await Promise.all([
      getPlatformStats(),
      getPendingRatings(),
      getFlaggedRatings(),
      getAllUsers(),
      getPendingTeachers(),
      getAllTeachersFull(),
      getAllMaterialsAdmin(),
      getRecentRatings(14),
      getAllSupportMessages(),
    ])

    setStats(statsRes.stats)
    setPendingRatings(pendRes.ratings)
    setFlaggedRatings(flagRes.ratings)
    setUsers(usersRes.users)
    setPendingTeachers(pendTeachRes.teachers)
    setAllTeachers(allTeachRes.teachers)
    setMaterials(matsRes.materials)
    setSupportMessages(supportRes.messages)

    /* Сводим активность по дням (последние 14 дней) */
    const buckets = {}
    for (let i = 13; i >= 0; i--) {
      const label = dayLabel(i)
      buckets[label] = { day: label, всего: 0, одобрено: 0 }
    }
    recentRes.ratings.forEach(r => {
      const d = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0)
      const label = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
      if (buckets[label]) {
        buckets[label].всего++
        if (r.status === 'approved') buckets[label].одобрено++
      }
    })
    setRecentActivity(Object.values(buckets))

    if (!silent) setLoading(false)
    else setRefreshing(false)
  }

  useEffect(() => { loadData() }, [])

  /* ═══ MODERATION ACTIONS ═══ */

  async function handleApprove(ratingId) {
    const { error } = await approveRating(ratingId)
    if (error) { toast.error(error); return }
    setPendingRatings(p => p.filter(r => r.id !== ratingId))
    setStats(s => s ? { ...s, pendingRatings: s.pendingRatings - 1, approvedRatings: s.approvedRatings + 1 } : s)
    toast.success('Отзыв одобрен')
  }

  async function handleReject(ratingId) {
    if (!rejectReason.trim()) { toast.error('Укажите причину'); return }
    const { error } = await rejectRating(ratingId, rejectReason.trim())
    if (error) { toast.error(error); return }
    setPendingRatings(p => p.filter(r => r.id !== ratingId))
    setStats(s => s ? { ...s, pendingRatings: s.pendingRatings - 1 } : s)
    setRejectingId(null); setRejectReason('')
    toast.success('Отзыв отклонён')
  }

  async function handleBulkApprove() {
    setBulkLoading(true)
    const { count, error } = await bulkApproveAllPending()
    setBulkLoading(false)
    if (error) { toast.error(error); return }
    setPendingRatings([])
    setStats(s => s ? { ...s, pendingRatings: 0, approvedRatings: (s.approvedRatings || 0) + count } : s)
    toast.success(`Одобрено ${count} отзывов`)
  }

  async function handleCleanupOrphans() {
    const { deleted, error } = await cleanupOrphanedTeachers()
    if (error) { toast.error(error); return }
    if (deleted.length === 0) {
      toast.success('Нет призрачных преподавателей')
    } else {
      toast.success(`Удалено ${deleted.length}: ${deleted.map(d => d.name).join(', ')}`)
    }
  }

  /* ═══ FLAGGED ACTIONS ═══ */

  async function handleDismissFlags(ratingId) {
    const { error } = await dismissFlags(ratingId)
    if (error) { toast.error(error); return }
    setFlaggedRatings(p => p.filter(r => r.id !== ratingId))
    toast.success('Жалобы сняты, отзыв восстановлен')
  }

  async function handleDeleteFlagged(ratingId) {
    const { error } = await deleteRatingPermanently(ratingId)
    if (error) { toast.error(error); return }
    setFlaggedRatings(p => p.filter(r => r.id !== ratingId))
    toast.success('Отзыв удалён')
  }

  async function handleWarn(studentId) {
    const { error, autoBanned } = await warnStudent(studentId, 'Жалобы на отзыв')
    if (error) { toast.error(error); return }
    toast.success(autoBanned ? 'Автоматическая блокировка (3 предупреждения)' : 'Предупреждение выдано')
  }

  /* ═══ USER ACTIONS ═══ */

  async function handleToggleUser(userId, current) {
    const { error } = await toggleUserActive(userId, !current)
    if (error) { toast.error(error); return }
    setUsers(p => p.map(u => u.id === userId ? { ...u, isActive: !current } : u))
    toast.success(!current ? 'Активирован' : 'Заблокирован')
  }

  async function handleChangeRole(userId, newRole) {
    const { error } = await changeUserRole(userId, newRole)
    if (error) { toast.error(error); return }
    setUsers(p => p.map(u => u.id === userId ? { ...u, role: newRole } : u))
    setRoleChanging(null)
    toast.success('Роль изменена')
  }

  async function handleUnblock(userId) {
    const { error } = await unblockUser(userId)
    if (error) { toast.error(error); return }
    setUsers(p => p.map(u => u.id === userId
      ? { ...u, isActive: true, blockReason: null, blockedUntil: null } : u))
    toast.success('Пользователь разблокирован')
  }

  async function handleBanConfirm() {
    if (!banTarget) return
    if (!banReason.trim()) { toast.error('Укажите причину блокировки'); return }
    setBanLoading(true)
    const { error } = await blockUserTemporarily(banTarget.id, banDays, banReason.trim())
    setBanLoading(false)
    if (error) { toast.error(error); return }
    const blockedUntil = banDays > 0
      ? { seconds: Math.floor((Date.now() + banDays * 86400000) / 1000) }
      : null
    setUsers(p => p.map(u => u.id === banTarget.id
      ? { ...u, isActive: false, blockReason: banReason.trim(), blockedUntil } : u))
    setBanTarget(null); setBanReason(''); setBanDays(7)
    toast.success(banDays === 0 ? 'Заблокирован навсегда' : `Заблокирован на ${banDays} дн.`)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleteLoading(true)

    if (deleteTarget.type === 'support') {
      const { error } = await deleteSupportMessage(deleteTarget.id)
      setDeleteLoading(false)
      if (error) { toast.error(error); return }
      setSupportMessages(p => p.filter(m => m.id !== deleteTarget.id))
      toast.success('Обращение удалено')
      setDeleteTarget(null)
      return
    }

    if (deleteTarget.type === 'material') {
      const { error } = await deleteMaterialAdmin(deleteTarget.id, deleteTarget.storagePath)
      setDeleteLoading(false)
      if (error) { toast.error(error); return }
      setMaterials(p => p.filter(m => m.id !== deleteTarget.id))
      toast.success('Материал удалён')
      setDeleteTarget(null)
      return
    }

    const { error } = await deleteUserAccount(deleteTarget.id)
    setDeleteLoading(false)
    if (error) { toast.error(error); return }
    setUsers(p => p.map(u => u.id === deleteTarget.id
      ? { ...u, isActive: false, isDeleted: true, blockReason: 'Аккаунт удалён администратором' } : u))
    setDeleteTarget(null)
    toast.success('Аккаунт удалён')
  }

  /* ═══ TEACHER ACTIONS ═══ */

  async function handleApproveTeacher(teacherId) {
    const { error } = await approveTeacher(teacherId)
    if (error) { toast.error(error); return }
    setPendingTeachers(p => p.filter(t => t.id !== teacherId))
    setUsers(p => p.map(u => u.id === teacherId ? { ...u, isActive: true } : u))
    toast.success('Преподаватель одобрен')
  }

  /* ═══ SUPPORT ACTIONS ═══ */

  async function handleMarkRead(msgId) {
    const { error } = await markSupportRead(msgId)
    if (error) { toast.error(error); return }
    setSupportMessages(p => p.map(m => m.id === msgId ? { ...m, status: 'read' } : m))
    toast.success('Отмечено как прочитанное')
  }

  async function handleReplySupport(msgId) {
    if (!replyText.trim()) { toast.error('Напишите ответ'); return }
    const { error } = await resolveSupportMessage(msgId, replyText.trim())
    if (error) { toast.error(error); return }
    setSupportMessages(p => p.map(m => m.id === msgId
      ? { ...m, status: 'resolved', adminResponse: replyText.trim() } : m))
    setReplyingId(null)
    setReplyText('')
    toast.success('Ответ отправлен, обращение закрыто')
  }

  async function handleDeleteSupport(msgId, subject) {
    setDeleteTarget({ id: msgId, name: subject || 'обращение', type: 'support' })
  }

  /* ═══ MATERIAL ACTIONS ═══ */

  async function handleDeleteMaterial(matId, storagePath, title) {
    setDeleteTarget({ id: matId, name: title || 'материал', type: 'material', storagePath })
  }

  async function handleUploadMaterial(e) {
    e.preventDefault()
    if (!uploadData.file || !uploadData.title.trim()) {
      toast.error('Укажите название и выберите файл')
      return
    }
    setUploading(true)
    setUploadProgress(0)

    /* Определяем имя преподавателя по teacherId */
    const teacher = allTeachers.find(t => t.id === uploadData.teacherId)
    const teacherName = teacher
      ? `${teacher.lastName || ''} ${(teacher.firstName || '')[0] || ''}. ${(teacher.middleName || '')[0] ? (teacher.middleName[0] + '.') : ''}`.trim()
      : 'Администратор'

    const { error } = await uploadMaterialAdmin({
      file: uploadData.file,
      title: uploadData.title.trim(),
      description: uploadData.description.trim(),
      discipline: uploadData.discipline.trim(),
      course: uploadData.course,
      teacherId: uploadData.teacherId || user.uid,
      teacherName,
    }, (p) => setUploadProgress(Math.round(p)))

    setUploading(false)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Материал загружен!')
      setShowUploadForm(false)
      setUploadData({ title: '', description: '', discipline: '', course: '', teacherId: '', file: null })
      setUploadProgress(0)
      /* Обновляем список */
      const res = await getAllMaterialsAdmin()
      if (!res.error) setMaterials(res.materials)
    }
  }

  /* ═══ FILTERS ═══ */

  const filteredUsers = useMemo(() => {
    let list = users
    if (userRoleFilter !== 'all') list = list.filter(u => u.role === userRoleFilter)
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase()
      list = list.filter(u =>
        `${u.lastName || ''} ${u.firstName || ''} ${u.email || ''}`.toLowerCase().includes(q),
      )
    }
    return list
  }, [users, userSearch, userRoleFilter])

  const filteredTeachers = useMemo(() => {
    const q = teacherSearch.toLowerCase()
    return allTeachers.filter(t =>
      !q || `${t.lastName || ''} ${t.firstName || ''} ${t.department || ''}`.toLowerCase().includes(q),
    )
  }, [allTeachers, teacherSearch])

  const filteredMaterials = useMemo(() => {
    const q = matSearch.toLowerCase()
    return materials.filter(m =>
      !q || (m.title || '').toLowerCase().includes(q) || (m.teacherName || '').toLowerCase().includes(q),
    )
  }, [materials, matSearch])

  /* ═══ LOADING ═══ */
  if (loading) return (
    <div className="min-h-screen bg-[var(--color-cream)] pt-20 flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-rust-wash)] flex items-center justify-center mx-auto mb-5 animate-pulse">
          <Shield size={24} className="text-[var(--color-rust)]" />
        </div>
        <p className="font-display italic text-[18px] text-[var(--color-ink)]">Загрузка панели…</p>
      </div>
    </div>
  )

  /* ═══════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[var(--color-cream)] pt-20 pb-16">

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden border-b border-[var(--color-sepia)]">
        <div className="absolute -top-20 -right-20 w-[28rem] h-[28rem] rounded-full bg-[var(--color-rust)]/8 blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6 md:px-12 py-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--color-sepia)] bg-[var(--color-paper)] mb-4">
              <Shield size={12} className="text-[var(--color-rust)]" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--color-muted)]">
                Только для администраторов
              </span>
            </div>
            <h1 className="font-display italic text-[44px] md:text-[56px] leading-[1.0] tracking-[-0.02em] text-[var(--color-ink)]">
              Панель <span className="text-[var(--color-rust)]">администратора</span>
            </h1>
            <p className="mt-3 text-[13px] text-[var(--color-muted)]">
              {userData?.firstName} {userData?.lastName}
              {(user?.email || userData?.email) && <> · <span className="text-[var(--color-muted-2)]">{user?.email || userData?.email}</span></>}
            </p>
          </div>
          <button
            onClick={() => loadData(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full border border-[var(--color-sepia)] bg-[var(--color-paper)] text-[var(--color-ink)] text-[12px] font-semibold hover:border-[var(--color-rust)]/40 hover:bg-[var(--color-rust-wash)] transition-colors ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-[var(--color-rust)]' : 'text-[var(--color-rust)]'} />
            Обновить
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 mt-6">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ═══ SIDEBAR ═══ */}
          <aside className="lg:w-52 flex-shrink-0">
            <div className="bg-[var(--color-paper)] rounded-2xl border border-[var(--color-sepia)] p-2 lg:sticky lg:top-24">
              <nav className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
                {SECTIONS.map(s => {
                  let badge = null
                  if (s.key === 'moderation') badge = pendingRatings.length
                  if (s.key === 'flagged')    badge = flaggedRatings.length
                  if (s.key === 'teachers')   badge = pendingTeachers.length
                  if (s.key === 'support')    badge = supportMessages.filter(m => m.status === 'new').length

                  return (
                    <button
                      key={s.key}
                      onClick={() => setSection(s.key)}
                      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all w-full text-left ${
                        section === s.key
                          ? 'bg-[var(--color-rust)] text-[#FFFDF7]'
                          : 'text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)]/50'
                      }`}
                    >
                      <s.icon size={16} className="flex-shrink-0" />
                      <span className="flex-1">{s.label}</span>
                      {badge > 0 && (
                        <span className={`text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ${
                          section === s.key ? 'bg-[#FFFDF7]/20 text-[#FFFDF7]' : 'bg-[var(--color-danger)] text-[#FFFDF7]'
                        }`}>
                          {badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* ═══ MAIN CONTENT ═══ */}
          <main className="flex-1 min-w-0 animate-slide-up">

            {/* ════════ OVERVIEW ════════ */}
            {section === 'overview' && (
              <div className="space-y-6">
                <SectionHeader title="Обзор платформы" icon={LayoutDashboard} />

                {/* Stat cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { icon: Users,        label: 'Студентов',      value: stats?.students      || 0 },
                    { icon: GraduationCap,label: 'Преподавателей', value: stats?.teachers      || 0 },
                    { icon: BookOpen,     label: 'Материалов',     value: stats?.totalMaterials|| 0 },
                    { icon: Download,     label: 'Скачиваний',     value: stats?.totalDownloads|| 0 },
                  ].map((c, i) => (
                    <div key={i} className="bg-[var(--color-paper)] rounded-2xl p-5 border border-[var(--color-sepia)] animate-fade-up" style={{animationDelay:`${i*60}ms`}}>
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-rust-wash)] flex items-center justify-center mb-3">
                        <c.icon size={18} className="text-[var(--color-rust)]" />
                      </div>
                      <p className="font-display text-[36px] leading-none tracking-[-0.02em] text-[var(--color-ink)]">
                        {c.value.toLocaleString('ru-RU')}
                      </p>
                      <p className="text-[11px] tracking-[0.15em] uppercase text-[var(--color-muted)] mt-2">{c.label}</p>
                    </div>
                  ))}
                </div>

                {/* Ratings stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { icon: Star,         label: 'Всего отзывов',   value: stats?.totalRatings    || 0, tone: 'rust'   },
                    { icon: Clock,        label: 'На модерации',    value: stats?.pendingRatings  || 0, tone: 'warn'   },
                    { icon: CheckCircle,  label: 'Одобрено',        value: stats?.approvedRatings || 0, tone: 'ok'     },
                    { icon: AlertTriangle,label: 'С жалобами',      value: stats?.flaggedRatings  || 0, tone: 'danger' },
                  ].map((c, i) => {
                    const tones = {
                      rust:   { bg: 'bg-[var(--color-rust-wash)]',     fg: 'text-[var(--color-rust)]',   accent: 'text-[var(--color-rust)]' },
                      warn:   { bg: 'bg-[var(--color-warn)]/15',       fg: 'text-[var(--color-warn)]',   accent: 'text-[var(--color-warn)]' },
                      ok:     { bg: 'bg-[var(--color-ok)]/12',         fg: 'text-[var(--color-ok)]',     accent: 'text-[var(--color-ok)]' },
                      danger: { bg: 'bg-[var(--color-danger)]/12',     fg: 'text-[var(--color-danger)]', accent: 'text-[var(--color-danger)]' },
                    }
                    const t = tones[c.tone]
                    return (
                      <div key={i} className="bg-[var(--color-paper)] rounded-2xl p-5 border border-[var(--color-sepia)] animate-fade-up" style={{animationDelay:`${(i+4)*60}ms`}}>
                        <div className={`w-10 h-10 ${t.bg} rounded-xl flex items-center justify-center mb-3`}>
                          <c.icon size={18} className={t.fg} />
                        </div>
                        <p className={`font-display text-[36px] leading-none tracking-[-0.02em] ${c.value > 0 ? t.accent : 'text-[var(--color-ink)]'}`}>
                          {c.value.toLocaleString('ru-RU')}
                        </p>
                        <p className="text-[11px] tracking-[0.15em] uppercase text-[var(--color-muted)] mt-2">{c.label}</p>
                      </div>
                    )
                  })}
                </div>

                {/* Quick actions */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleCleanupOrphans}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--color-paper)] border border-[var(--color-sepia)] text-[var(--color-ink)] hover:border-[var(--color-rust)]/40 transition-colors"
                  >
                    Очистить призрачных преподавателей
                  </button>
                </div>

                {/* Activity chart */}
                <div className="bg-[var(--color-paper)] rounded-2xl border border-[var(--color-sepia)] p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-display italic text-[20px] text-[var(--color-ink)] flex items-center gap-2">
                      <TrendingUp size={17} className="text-[var(--color-rust)]" />
                      Активность за 14 дней
                    </h3>
                    <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--color-muted)]">отзывы</span>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={recentActivity} barSize={18} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(232, 220, 198, 0.55)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8B827A' }} tickLine={false} axisLine={false} interval={2} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#8B827A' }} tickLine={false} axisLine={false} width={24} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-paper)',
                          border: '1px solid var(--color-sepia)',
                          borderRadius: 10,
                          fontSize: 12,
                          color: 'var(--color-ink)',
                        }}
                        cursor={{ fill: 'rgba(184, 74, 30, 0.08)' }}
                      />
                      <Bar dataKey="всего"    fill="var(--color-rust-soft)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="одобрено" fill="var(--color-rust)"      radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex gap-5 mt-3 justify-center">
                    <span className="flex items-center gap-1.5 text-[11px] tracking-[0.06em] uppercase text-[var(--color-muted)]">
                      <span className="w-3 h-3 rounded-sm bg-[var(--color-rust-soft)] inline-block" /> Всего подано
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] tracking-[0.06em] uppercase text-[var(--color-muted)]">
                      <span className="w-3 h-3 rounded-sm bg-[var(--color-rust)] inline-block" /> Одобрено
                    </span>
                  </div>
                </div>

                {/* Attention needed */}
                {(pendingRatings.length > 0 || pendingTeachers.length > 0 || flaggedRatings.length > 0) && (
                  <div className="bg-[var(--color-rust-wash)] border border-[var(--color-rust)]/25 rounded-2xl p-5">
                    <p className="text-sm font-semibold text-[var(--color-ink)] mb-3 flex items-center gap-2">
                      <Zap size={15} className="text-[var(--color-rust)]" /> Требуют внимания
                    </p>
                    <div className="space-y-2">
                      {pendingRatings.length > 0 && (
                        <button onClick={() => setSection('moderation')}
                          className="flex items-center gap-2 text-sm text-[var(--color-rust)] hover:text-[var(--color-ink)] w-full text-left transition-colors">
                          <Shield size={14} /> {pendingRatings.length} отзывов на модерации
                        </button>
                      )}
                      {pendingTeachers.length > 0 && (
                        <button onClick={() => setSection('teachers')}
                          className="flex items-center gap-2 text-sm text-[var(--color-rust)] hover:text-[var(--color-ink)] w-full text-left transition-colors">
                          <GraduationCap size={14} /> {pendingTeachers.length} преподавателей ожидают одобрения
                        </button>
                      )}
                      {flaggedRatings.length > 0 && (
                        <button onClick={() => setSection('flagged')}
                          className="flex items-center gap-2 text-sm text-[var(--color-rust)] hover:text-[var(--color-ink)] w-full text-left transition-colors">
                          <AlertTriangle size={14} /> {flaggedRatings.length} отзывов с жалобами
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ════════ MODERATION ════════ */}
            {section === 'moderation' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <SectionHeader title="Модерация отзывов" icon={Shield} />
                  <div className="flex-1" />
                  {pendingRatings.length > 0 && (
                    <button
                      onClick={handleBulkApprove}
                      disabled={bulkLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--color-ok)] hover:brightness-95 text-[#FFFDF7] text-xs font-bold rounded-xl transition-all disabled:opacity-60"
                    >
                      <CheckCircle size={14} />
                      {bulkLoading ? 'Одобряем...' : `Одобрить все (${pendingRatings.length})`}
                    </button>
                  )}
                </div>

                {pendingRatings.length === 0 ? (
                  <EmptyState icon={CheckCircle} text="Нет отзывов на модерации" />
                ) : (
                  <div className="space-y-4">
                    {pendingRatings.map(r => {
                      const t = allTeachers.find(t => t.id === r.teacherId)
                      const tName = t ? [t.lastName, t.firstName, t.middleName].filter(Boolean).join(' ') : r.teacherId
                      return (
                        <RatingCard
                          key={r.id}
                          rating={r}
                          teacherName={tName}
                          expanded={expandedRating === r.id}
                          onToggleExpand={() => setExpandedRating(expandedRating === r.id ? null : r.id)}
                          rejectingId={rejectingId}
                          rejectReason={rejectReason}
                          setRejectReason={setRejectReason}
                          onApprove={() => handleApprove(r.id)}
                          onStartReject={() => { setRejectingId(r.id); setRejectReason('') }}
                          onConfirmReject={() => handleReject(r.id)}
                          onCancelReject={() => { setRejectingId(null); setRejectReason('') }}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ════════ FLAGGED ════════ */}
            {section === 'flagged' && (
              <div className="space-y-5">
                <SectionHeader title="Жалобы на отзывы" icon={AlertTriangle} />
                {flaggedRatings.length === 0 ? (
                  <EmptyState icon={CheckCircle} text="Нет отзывов с жалобами" />
                ) : (
                  <div className="space-y-4">
                    {flaggedRatings.map(r => (
                      <div key={r.id} className="bg-[var(--color-paper)] rounded-2xl border border-[var(--color-danger)]/20 overflow-hidden">
                        {/* Flags header */}
                        <div className="px-5 py-3 bg-[var(--color-danger)]/8 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-danger)]">
                            <AlertTriangle size={14} />
                            {r.flags} {r.flags === 1 ? 'жалоба' : r.flags < 5 ? 'жалобы' : 'жалоб'}
                          </span>
                          <span className="text-xs text-[var(--color-muted)]">{formatDate(r.createdAt)}</span>
                        </div>

                        <div className="p-5 space-y-3">
                          {/* Score */}
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-[var(--color-ink)]">{Number(r.averageScore || 0).toFixed(1)}</span>
                            <span className="text-[var(--color-muted)] text-sm">/10</span>
                            {r.discipline && <span className="px-2 py-0.5 bg-[var(--color-rust-wash)] text-[var(--color-rust)] text-xs rounded-full">{r.discipline}</span>}
                          </div>

                          {/* Comments */}
                          {(r.positiveComment || r.negativeComment || r.comment) && (
                            <div className="space-y-1">
                              {r.positiveComment && <p className="text-sm text-[var(--color-ink)] bg-[var(--color-ok)]/10 rounded-xl px-3 py-2">✅ {r.positiveComment}</p>}
                              {r.negativeComment && <p className="text-sm text-[var(--color-ink)] bg-[var(--color-danger)]/8 rounded-xl px-3 py-2">⚠️ {r.negativeComment}</p>}
                              {!r.positiveComment && !r.negativeComment && r.comment && (
                                <p className="text-sm text-[var(--color-ink)] bg-[var(--color-paper-2)]/50 rounded-xl px-3 py-2">{r.comment}</p>
                              )}
                            </div>
                          )}

                          {/* Flag reasons */}
                          {r.flagReasons?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-[var(--color-muted)] mb-1.5">Причины жалоб:</p>
                              <div className="flex flex-wrap gap-1">
                                {r.flagReasons.map((fr, i) => (
                                  <span key={i} className="text-xs bg-[var(--color-danger)]/8 text-[var(--color-danger)] rounded-full px-2 py-0.5">{fr.reason}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2 pt-1">
                            <ActionBtn icon={CheckCircle} label="Снять жалобы" color="emerald" onClick={() => handleDismissFlags(r.id)} />
                            <ActionBtn icon={Trash2}      label="Удалить"       color="red"     onClick={() => handleDeleteFlagged(r.id)} />
                            {r.studentId && (
                              <ActionBtn icon={AlertTriangle} label="Предупредить" color="amber" onClick={() => handleWarn(r.studentId)} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ════════ USERS ════════ */}
            {section === 'users' && (
              <div className="space-y-5">
                <SectionHeader title="Пользователи" icon={Users} count={filteredUsers.length} />

                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-48">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                    <input
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                      placeholder="Имя, email..."
                      className="w-full pl-9 pr-4 py-2.5 bg-[var(--color-paper)] border border-[var(--color-sepia)] rounded-xl text-sm focus:outline-none focus:border-[var(--color-rust)] focus:shadow-[0_0_0_3px_rgba(184,74,30,0.15)]"
                    />
                  </div>
                  <div className="flex gap-1 p-1 bg-[var(--color-paper)] border border-[var(--color-sepia)] rounded-xl">
                    {[
                      { v: 'all',     l: 'Все'           },
                      { v: 'student', l: 'Студенты'      },
                      { v: 'teacher', l: 'Преподаватели' },
                      { v: 'admin',   l: 'Админы'        },
                    ].map(f => (
                      <button key={f.v} onClick={() => setUserRoleFilter(f.v)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${userRoleFilter === f.v ? 'bg-[var(--color-rust)] text-[#FFFDF7]' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}>
                        {f.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table */}
                <div className="bg-[var(--color-paper)] rounded-2xl border border-[var(--color-sepia)] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--color-paper-2)]/50 border-b border-[var(--color-sepia)]">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-muted)]">Пользователь</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)]">Роль</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] hidden sm:table-cell">Регистрация</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)]">Статус</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-muted)]">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map(u => {
                          const fullName = `${u.lastName || ''} ${u.firstName || ''}`.trim()
                          const initials = `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase()
                          const isAdmin  = u.role === 'admin'
                          const isBlocked = !u.isActive && !u.isDeleted
                          const isDeleted = !!u.isDeleted

                          /* Считаем дней до разблокировки */
                          let daysLeft = null
                          if (isBlocked && u.blockedUntil) {
                            const ms = (u.blockedUntil.seconds * 1000) - Date.now()
                            daysLeft = Math.ceil(ms / 86400000)
                            if (daysLeft < 0) daysLeft = 0
                          }

                          return (
                            <tr key={u.id} className={`border-b border-[var(--color-sepia)]/50 last:border-0 hover:bg-[var(--color-paper-2)]/30 transition-colors ${isDeleted ? 'opacity-50' : ''}`}>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[#FFFDF7] text-xs font-bold flex-shrink-0 ${isDeleted ? 'bg-[var(--color-muted-2)]' : 'bg-[var(--color-rust)]'}`}>
                                    {initials || '?'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-[var(--color-ink)] text-sm truncate">{fullName || 'Без имени'}</p>
                                    <p className="text-xs text-[var(--color-muted)] truncate">{u.email}</p>
                                    {u.role === 'student' && (
                                      <p className="text-[11px] mt-0.5 truncate">
                                        {u.studentId
                                          ? <span className="text-[var(--color-ok)] font-mono font-semibold">№ {u.studentId}</span>
                                          : <span className="text-[var(--color-muted)]/50 italic">Билет не указан</span>
                                        }
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                {roleChanging === u.id ? (
                                  <div className="flex items-center gap-1">
                                    <select
                                      defaultValue={u.role}
                                      onChange={e => handleChangeRole(u.id, e.target.value)}
                                      className="text-xs border border-[var(--color-sepia)] rounded-lg px-2 py-1 focus:outline-none focus:border-[var(--color-rust)] focus:shadow-[0_0_0_2px_rgba(184,74,30,0.15)]"
                                    >
                                      {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                    <button onClick={() => setRoleChanging(null)} className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)] ml-1">✕</button>
                                  </div>
                                ) : (
                                  <RoleBadge role={u.role} />
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-xs text-[var(--color-muted)] hidden sm:table-cell">
                                {formatDate(u.createdAt)}
                              </td>
                              <td className="px-4 py-3.5">
                                {u.isActive ? (
                                  <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-ok)]">
                                    <CheckCircle size={12} /> Активен
                                  </span>
                                ) : isDeleted ? (
                                  <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-muted-2)]">
                                    <UserX size={12} /> Удалён
                                  </span>
                                ) : u.blockedUntil ? (
                                  <span className="flex flex-col gap-0.5">
                                    <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-danger)]">
                                      <Timer size={12} />
                                      {daysLeft !== null ? `Ещё ${daysLeft} дн.` : 'Временно'}
                                    </span>
                                    {u.blockReason && (
                                      <span className="text-[10px] text-[var(--color-muted)] line-clamp-1 max-w-[120px]">{u.blockReason}</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="flex flex-col gap-0.5">
                                    <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-danger)]">
                                      <Ban size={12} /> Навсегда
                                    </span>
                                    {u.blockReason && (
                                      <span className="text-[10px] text-[var(--color-muted)] line-clamp-1 max-w-[120px]">{u.blockReason}</span>
                                    )}
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                {!isAdmin && !isDeleted && (
                                  <div className="flex items-center justify-end gap-1.5">
                                    {/* Изменить роль */}
                                    <button
                                      onClick={() => setRoleChanging(roleChanging === u.id ? null : u.id)}
                                      title="Изменить роль"
                                      className="p-1.5 rounded-lg hover:bg-[var(--color-paper-2)] text-[var(--color-muted)] transition-colors"
                                    >
                                      <UserCog size={15} />
                                    </button>

                                    {/* Разблокировать / Заблокировать */}
                                    {isBlocked ? (
                                      <button
                                        onClick={() => handleUnblock(u.id)}
                                        title="Разблокировать"
                                        className="p-1.5 rounded-lg hover:bg-[var(--color-ok)]/10 text-[var(--color-ok)] transition-colors"
                                      >
                                        <LockOpen size={15} />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => { setBanTarget({ id: u.id, name: fullName || u.email }); setBanReason(''); setBanDays(7) }}
                                        title="Заблокировать"
                                        className="p-1.5 rounded-lg hover:bg-[var(--color-danger)]/8 text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors"
                                      >
                                        <Ban size={15} />
                                      </button>
                                    )}

                                    {/* Удалить аккаунт */}
                                    <button
                                      onClick={() => setDeleteTarget({ id: u.id, name: fullName || u.email })}
                                      title="Удалить аккаунт"
                                      className="p-1.5 rounded-lg hover:bg-[var(--color-danger)]/8 text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors"
                                    >
                                      <UserX size={15} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                      <div className="p-10 text-center text-sm text-[var(--color-muted)]">Пользователи не найдены</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ════════ TEACHERS ════════ */}
            {section === 'teachers' && (
              <div className="space-y-5">
                <SectionHeader title="Преподаватели" icon={GraduationCap} />

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-[var(--color-paper)] border border-[var(--color-sepia)] rounded-xl w-fit">
                  {[
                    { v: 'pending', l: `Ожидают одобрения${pendingTeachers.length > 0 ? ` (${pendingTeachers.length})` : ''}` },
                    { v: 'all',     l: `Все (${allTeachers.length})` },
                  ].map(t => (
                    <button key={t.v} onClick={() => setTeacherTab(t.v)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${teacherTab === t.v ? 'bg-[var(--color-rust)] text-[#FFFDF7]' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}>
                      {t.l}
                    </button>
                  ))}
                </div>

                {teacherTab === 'pending' && (
                  <>
                    {pendingTeachers.length === 0 ? (
                      <EmptyState icon={GraduationCap} text="Нет преподавателей, ожидающих одобрения" />
                    ) : (
                      <div className="space-y-3">
                        {pendingTeachers.map(t => {
                          const fullName = `${t.lastName || ''} ${t.firstName || ''}`.trim()
                          return (
                            <div key={t.id} className="bg-[var(--color-paper)] rounded-2xl border border-[var(--color-sepia)] p-5 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="w-12 h-12 rounded-xl bg-[var(--color-rust)]/10 flex items-center justify-center text-[var(--color-rust)] font-bold text-sm flex-shrink-0">
                                  {(t.firstName?.[0] || '') + (t.lastName?.[0] || '')}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-[var(--color-ink)]">{fullName || 'Без имени'}</p>
                                  <p className="text-xs text-[var(--color-muted)]">{t.email}</p>
                                  <p className="text-xs text-[var(--color-muted)] mt-0.5">Зарегистрирован: {formatDate(t.createdAt)}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleApproveTeacher(t.id)}
                                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-ok)] hover:brightness-95 text-[#FFFDF7] text-xs font-bold rounded-xl transition-all flex-shrink-0"
                              >
                                <CheckCircle size={14} /> Одобрить
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}

                {teacherTab === 'all' && (
                  <>
                    <div className="relative">
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                      <input
                        value={teacherSearch}
                        onChange={e => setTeacherSearch(e.target.value)}
                        placeholder="Имя, кафедра..."
                        className="w-full pl-9 pr-4 py-2.5 bg-[var(--color-paper)] border border-[var(--color-sepia)] rounded-xl text-sm focus:outline-none focus:border-[var(--color-rust)] focus:shadow-[0_0_0_3px_rgba(184,74,30,0.15)]"
                      />
                    </div>
                    <div className="bg-[var(--color-paper)] rounded-2xl border border-[var(--color-sepia)] overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[var(--color-paper-2)]/50 border-b border-[var(--color-sepia)]">
                            <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-muted)]">Преподаватель</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] hidden sm:table-cell">Кафедра</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)]">Рейтинг</th>
                            <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-muted)]">Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTeachers.map(t => {
                            const fullName = `${t.lastName || ''} ${t.firstName || ''} ${t.middleName || ''}`.trim()
                            return (
                              <tr key={t.id} className="border-b border-[var(--color-sepia)]/50 last:border-0 hover:bg-[var(--color-paper-2)]/30">
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-[var(--color-rust-wash)] flex items-center justify-center text-[var(--color-rust)] text-xs font-bold flex-shrink-0">
                                      {(t.firstName?.[0] || '') + (t.lastName?.[0] || '')}
                                    </div>
                                    <div>
                                      <p className="font-medium text-[var(--color-ink)] text-sm">{fullName || 'Без имени'}</p>
                                      <p className="text-xs text-[var(--color-muted)]">{t.position || '—'}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-xs text-[var(--color-muted)] hidden sm:table-cell">{t.department || '—'}</td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-1.5">
                                    <Star size={12} className="text-[var(--color-gold)] fill-[var(--color-gold)]" />
                                    <span className="text-sm font-semibold text-[var(--color-ink)]">{t.averageRating > 0 ? t.averageRating.toFixed(1) : '—'}</span>
                                    <span className="text-xs text-[var(--color-muted)]">({t.ratingsCount || 0})</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  <button
                                    onClick={() => window.open(`/teachers/${t.id}`, '_blank')}
                                    className="p-1.5 rounded-lg hover:bg-[var(--color-paper-2)] text-[var(--color-muted)] transition-colors"
                                    title="Открыть профиль"
                                  >
                                    <Eye size={15} />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                          {filteredTeachers.length === 0 && (
                            <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-[var(--color-muted)]">Преподаватели не найдены</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ════════ MATERIALS ════════ */}
            {section === 'materials' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <SectionHeader title="Материалы" icon={FolderOpen} count={materials.length} />
                  <button
                    onClick={() => setShowUploadForm(!showUploadForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-rust)] text-white text-sm font-semibold rounded-xl hover:bg-[#C55830] transition-colors"
                  >
                    <Plus size={16} />
                    Загрузить
                  </button>
                </div>

                {/* ── Форма загрузки ── */}
                {showUploadForm && (
                  <form onSubmit={handleUploadMaterial} className="bg-[var(--color-paper)] border border-[var(--color-sepia)] rounded-2xl p-5 space-y-4">
                    <h3 className="font-semibold text-[var(--color-ink)] flex items-center gap-2">
                      <Upload size={16} className="text-[var(--color-rust)]" />
                      Загрузка материала
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Название *</label>
                        <input
                          value={uploadData.title}
                          onChange={e => setUploadData(d => ({ ...d, title: e.target.value }))}
                          placeholder="Конспект лекций по математике"
                          className="w-full px-3 py-2 bg-[var(--color-cream)] border border-[var(--color-sepia)] rounded-xl text-sm focus:outline-none focus:border-[var(--color-rust)]"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Дисциплина</label>
                        <input
                          value={uploadData.discipline}
                          onChange={e => setUploadData(d => ({ ...d, discipline: e.target.value }))}
                          placeholder="Высшая математика"
                          className="w-full px-3 py-2 bg-[var(--color-cream)] border border-[var(--color-sepia)] rounded-xl text-sm focus:outline-none focus:border-[var(--color-rust)]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Описание</label>
                      <textarea
                        value={uploadData.description}
                        onChange={e => setUploadData(d => ({ ...d, description: e.target.value }))}
                        placeholder="Краткое описание содержания..."
                        rows={2}
                        className="w-full px-3 py-2 bg-[var(--color-cream)] border border-[var(--color-sepia)] rounded-xl text-sm focus:outline-none focus:border-[var(--color-rust)] resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Курс</label>
                        <select
                          value={uploadData.course}
                          onChange={e => setUploadData(d => ({ ...d, course: e.target.value }))}
                          className="w-full px-3 py-2 bg-[var(--color-cream)] border border-[var(--color-sepia)] rounded-xl text-sm focus:outline-none focus:border-[var(--color-rust)]"
                        >
                          <option value="">Все курсы</option>
                          <option value="1">1 курс</option>
                          <option value="2">2 курс</option>
                          <option value="3">3 курс</option>
                          <option value="4">4 курс</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Преподаватель</label>
                        <select
                          value={uploadData.teacherId}
                          onChange={e => setUploadData(d => ({ ...d, teacherId: e.target.value }))}
                          className="w-full px-3 py-2 bg-[var(--color-cream)] border border-[var(--color-sepia)] rounded-xl text-sm focus:outline-none focus:border-[var(--color-rust)]"
                        >
                          <option value="">— От имени админа —</option>
                          {allTeachers.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.lastName} {t.firstName} {t.middleName || ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[var(--color-muted)] mb-1">Файл *</label>
                      <label className="flex items-center gap-3 px-4 py-3 bg-[var(--color-cream)] border-2 border-dashed border-[var(--color-sepia)] rounded-xl cursor-pointer hover:border-[var(--color-rust)] transition-colors">
                        <FileText size={20} className="text-[var(--color-muted)]" />
                        <span className="text-sm text-[var(--color-muted)]">
                          {uploadData.file ? `${uploadData.file.name} (${(uploadData.file.size / 1024 / 1024).toFixed(1)} МБ)` : 'Выберите файл (PDF, DOCX, PPTX — до 50 МБ)'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.txt,.zip"
                          onChange={e => setUploadData(d => ({ ...d, file: e.target.files?.[0] || null }))}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {uploading && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-[var(--color-muted)]">
                          <span>Загрузка...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-2 bg-[var(--color-sepia)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--color-rust)] rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="submit"
                        disabled={uploading || !uploadData.file || !uploadData.title.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-rust)] text-white text-sm font-semibold rounded-xl hover:bg-[#C55830] transition-colors disabled:opacity-50"
                      >
                        {uploading ? <Loader size={15} className="animate-spin" /> : <Upload size={15} />}
                        {uploading ? 'Загружаем...' : 'Загрузить материал'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowUploadForm(false); setUploadData({ title: '', description: '', discipline: '', course: '', teacherId: '', file: null }) }}
                        className="px-4 py-2.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
                      >
                        Отмена
                      </button>
                    </div>
                  </form>
                )}

                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                  <input
                    value={matSearch}
                    onChange={e => setMatSearch(e.target.value)}
                    placeholder="Название, автор..."
                    className="w-full pl-9 pr-4 py-2.5 bg-[var(--color-paper)] border border-[var(--color-sepia)] rounded-xl text-sm focus:outline-none focus:border-[var(--color-rust)] focus:shadow-[0_0_0_3px_rgba(184,74,30,0.15)]"
                  />
                </div>

                <div className="bg-[var(--color-paper)] rounded-2xl border border-[var(--color-sepia)] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--color-paper-2)]/50 border-b border-[var(--color-sepia)]">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-muted)]">Материал</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] hidden md:table-cell">Автор</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)] hidden sm:table-cell">Загружен</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-muted)]">Размер</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-muted)]">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMaterials.map(m => (
                          <tr key={m.id} className="border-b border-[var(--color-sepia)]/50 last:border-0 hover:bg-[var(--color-paper-2)]/30">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-lg bg-[var(--color-rust-wash)] flex items-center justify-center flex-shrink-0">
                                  <BookOpen size={13} className="text-[var(--color-rust)]" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-[var(--color-ink)] text-sm truncate max-w-[180px]">{m.title || 'Без названия'}</p>
                                  {m.discipline && <p className="text-xs text-[var(--color-muted)]">{m.discipline}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-xs text-[var(--color-muted)] hidden md:table-cell">{m.teacherName || '—'}</td>
                            <td className="px-4 py-3.5 text-xs text-[var(--color-muted)] hidden sm:table-cell">{formatDate(m.createdAt)}</td>
                            <td className="px-4 py-3.5 text-xs text-[var(--color-muted)]">{formatSize(m.fileSize)}</td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {m.fileUrl && (
                                  <a href={m.fileUrl} target="_blank" rel="noreferrer"
                                    className="p-1.5 rounded-lg hover:bg-[var(--color-paper-2)] text-[var(--color-muted)] transition-colors"
                                    title="Открыть">
                                    <Eye size={15} />
                                  </a>
                                )}
                                <button
                                  onClick={() => handleDeleteMaterial(m.id, m.storagePath, m.title)}
                                  className="p-1.5 rounded-lg hover:bg-[var(--color-danger)]/8 text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors"
                                  title="Удалить"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredMaterials.length === 0 && (
                          <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-[var(--color-muted)]">Материалы не найдены</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════ ПОДДЕРЖКА ════════════════════ */}
            {section === 'support' && (
              <div className="space-y-6 animate-fade-up">
                <div className="flex items-center justify-between">
                  <SectionHeader icon={MessageSquarePlus} title="Обращения в поддержку" />
                  <div className="flex gap-2">
                    {['complaints', 'suggestions'].map(tab => (
                      <button key={tab} onClick={() => setSupportTab(tab)}
                        className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
                          supportTab === tab
                            ? 'bg-[var(--color-rust)] text-[#FFFDF7]'
                            : 'bg-[var(--color-paper-2)] text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                        }`}
                      >
                        {tab === 'complaints' ? 'Жалобы' : 'Предложения'}
                        {(() => {
                          const cnt = supportMessages.filter(m => m.type === (tab === 'complaints' ? 'complaint' : 'suggestion') && m.status === 'new').length
                          return cnt > 0 ? ` (${cnt})` : ''
                        })()}
                      </button>
                    ))}
                  </div>
                </div>

                {(() => {
                  const typeFilter = supportTab === 'complaints' ? 'complaint' : 'suggestion'
                  const filtered = supportMessages
                    .filter(m => m.type === typeFilter)
                    .sort((a, b) => {
                      const order = { new: 0, read: 1, resolved: 2 }
                      return (order[a.status] ?? 3) - (order[b.status] ?? 3)
                        || (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
                    })

                  if (filtered.length === 0) {
                    return <EmptyState icon={MessageSquarePlus} text={`Нет ${supportTab === 'complaints' ? 'жалоб' : 'предложений'}`} />
                  }

                  return (
                    <div className="space-y-3">
                      {filtered.map(msg => {
                        const isExpanded = supportExpanded === msg.id
                        const isReplying = replyingId === msg.id
                        const statusBadge =
                          msg.status === 'new'      ? { label: 'Новое',    cls: 'bg-[var(--color-rust)]/15 text-[var(--color-rust)]' } :
                          msg.status === 'read'     ? { label: 'Прочитано', cls: 'bg-blue-500/15 text-blue-400' } :
                                                      { label: 'Решено',    cls: 'bg-emerald-500/15 text-emerald-400' }
                        return (
                          <div key={msg.id} className="bg-[var(--color-paper)] rounded-2xl border border-[var(--color-sepia)] overflow-hidden">
                            {/* Header */}
                            <div className="px-5 py-4 flex items-start justify-between gap-3 cursor-pointer"
                              onClick={() => {
                                setSupportExpanded(isExpanded ? null : msg.id)
                                if (msg.status === 'new') handleMarkRead(msg.id)
                              }}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusBadge.cls}`}>
                                    {statusBadge.label}
                                  </span>
                                  <span className="text-[10px] text-[var(--color-muted)]">{formatDate(msg.createdAt)}</span>
                                </div>
                                <p className="text-sm font-semibold text-[var(--color-ink)] truncate">{msg.subject}</p>
                                <p className="text-xs text-[var(--color-muted)] mt-0.5">
                                  {msg.userName || 'Аноним'} · {msg.userEmail}
                                </p>
                              </div>
                              <ChevronDown size={16} className={`text-[var(--color-muted)] transition-transform flex-shrink-0 mt-1 ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>

                            {/* Body */}
                            {isExpanded && (
                              <div className="px-5 pb-5 border-t border-[var(--color-sepia)] pt-4 space-y-3">
                                <div className="bg-[var(--color-paper-2)]/50 rounded-xl p-4">
                                  <p className="text-sm text-[var(--color-ink)] whitespace-pre-wrap">{msg.message}</p>
                                </div>

                                {/* Ответ админа (если есть) */}
                                {msg.adminResponse && (
                                  <div className="bg-emerald-500/10 rounded-xl p-4">
                                    <p className="text-[11px] font-semibold text-emerald-400 mb-1">Ответ администратора</p>
                                    <p className="text-sm text-[var(--color-ink)]">{msg.adminResponse}</p>
                                  </div>
                                )}

                                {/* Форма ответа */}
                                {isReplying ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={replyText}
                                      onChange={e => setReplyText(e.target.value)}
                                      placeholder="Напишите ответ пользователю..."
                                      rows={3}
                                      className="w-full px-3 py-2 text-sm bg-[var(--color-paper-2)]/50 border border-[var(--color-sepia)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-rust)]/20 resize-none text-[var(--color-ink)]"
                                    />
                                    <div className="flex gap-2">
                                      <button onClick={() => handleReplySupport(msg.id)}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-ok)] hover:brightness-95 text-[#FFFDF7] text-xs font-bold rounded-xl transition-all">
                                        <Send size={13} /> Отправить
                                      </button>
                                      <button onClick={() => { setReplyingId(null); setReplyText('') }}
                                        className="px-4 py-2 bg-[var(--color-paper-2)] text-[var(--color-ink)] text-xs font-medium rounded-xl transition-all">
                                        Отмена
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex gap-2">
                                    {msg.status !== 'resolved' && (
                                      <button onClick={() => { setReplyingId(msg.id); setReplyText('') }}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-rust)] hover:brightness-95 text-[#FFFDF7] text-xs font-bold rounded-xl transition-all">
                                        <MessageCircle size={13} /> Ответить
                                      </button>
                                    )}
                                    <button onClick={() => handleDeleteSupport(msg.id, msg.subject)}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-danger)]/8 hover:bg-[var(--color-danger)]/15 text-[var(--color-danger)] text-xs font-semibold rounded-xl transition-all">
                                      <Trash2 size={13} /> Удалить
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}

          </main>
        </div>
      </div>

      {/* ════ МОДАЛКА: БЛОКИРОВКА ════ */}
      {banTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-[var(--color-paper)] rounded-3xl shadow-2xl w-full max-w-md animate-fade-up">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-[var(--color-sepia)]">
              <div className="w-10 h-10 bg-[var(--color-danger)]/12 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Ban size={18} className="text-[var(--color-danger)]" />
              </div>
              <div>
                <p className="font-bold text-[var(--color-ink)]">Заблокировать пользователя</p>
                <p className="text-xs text-[var(--color-muted)] mt-0.5 truncate max-w-[240px]">{banTarget.name}</p>
              </div>
              <button onClick={() => setBanTarget(null)} className="ml-auto p-2 hover:bg-[var(--color-paper-2)] rounded-xl text-[var(--color-muted)] transition-colors">
                <XCircle size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Причина */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-ink)] mb-1.5">Причина блокировки</label>
                <input
                  type="text"
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  placeholder="Нарушение правил платформы..."
                  className="w-full px-4 py-2.5 bg-[var(--color-paper-2)]/50 border border-[var(--color-sepia)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)]/20 focus:border-[var(--color-danger)]"
                />
              </div>

              {/* Срок */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">Срок блокировки</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { d: 1,  l: '1 день'    },
                    { d: 3,  l: '3 дня'     },
                    { d: 7,  l: '7 дней'    },
                    { d: 14, l: '2 недели'  },
                    { d: 30, l: '30 дней'   },
                    { d: 0,  l: 'Навсегда'  },
                  ].map(({ d, l }) => (
                    <button
                      key={d}
                      onClick={() => setBanDays(d)}
                      className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                        banDays === d
                          ? d === 0
                            ? 'bg-[var(--color-danger)] text-[#FFFDF7] border-[var(--color-danger)]'
                            : 'bg-[var(--color-rust)] text-[#FFFDF7] border-[var(--color-rust)]'
                          : 'bg-[var(--color-paper)] text-[var(--color-ink)] border-[var(--color-sepia)] hover:border-[var(--color-rust)]/40 hover:bg-[var(--color-rust-wash)]/40'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className={`rounded-xl px-4 py-3 text-sm ${banDays === 0 ? 'bg-[var(--color-danger)]/8 text-[var(--color-danger)]' : 'bg-[var(--color-paper-2)]/50 text-[var(--color-muted)]'}`}>
                {banDays === 0
                  ? '⚠️ Пользователь будет заблокирован навсегда'
                  : `Разблокировка произойдёт автоматически через ${banDays} дн.`
                }
              </div>
            </div>

            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={handleBanConfirm}
                disabled={banLoading || !banReason.trim()}
                className="flex-1 py-3 bg-[var(--color-danger)] hover:brightness-90 text-[#FFFDF7] font-bold rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Ban size={15} />
                {banLoading ? 'Блокируем...' : 'Заблокировать'}
              </button>
              <button
                onClick={() => setBanTarget(null)}
                className="px-5 py-3 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] text-[var(--color-ink)] font-medium rounded-xl text-sm transition-all"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ МОДАЛКА: УДАЛЕНИЕ ════ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-[var(--color-paper)] rounded-3xl shadow-2xl w-full max-w-sm animate-fade-up">
            <div className="px-6 pt-6 pb-5 text-center">
              <div className="w-14 h-14 bg-[var(--color-danger)]/12 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-[var(--color-danger)]" />
              </div>
              <p className="font-bold text-[var(--color-ink)] text-lg">
                {deleteTarget.type === 'support' ? 'Удалить обращение?' :
                 deleteTarget.type === 'material' ? 'Удалить материал?' : 'Удалить аккаунт?'}
              </p>
              <p className="text-[var(--color-muted)] text-sm mt-2 leading-relaxed">
                <span className="font-semibold text-[var(--color-ink)]">«{deleteTarget.name}»</span>
                {deleteTarget.type === 'support' ? ' будет удалено без возможности восстановления.' :
                 deleteTarget.type === 'material' ? ' будет удалён без возможности восстановления.' :
                 ' будет помечен как удалённый. Пользователь потеряет доступ к платформе.'}
              </p>
              <p className="text-xs text-[var(--color-danger)] mt-3">Это действие нельзя отменить</p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="flex-1 py-3 bg-[var(--color-danger)] hover:brightness-90 text-[#FFFDF7] font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <UserX size={15} />
                {deleteLoading ? 'Удаляем...' : 'Удалить'}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-5 py-3 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] text-[var(--color-ink)] font-medium rounded-xl text-sm transition-all"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

/* ═══ Sub-components ═══ */

function SectionHeader({ title, icon: Icon, count }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <div className="w-8 h-8 rounded-xl bg-[var(--color-rust-wash)] flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-[var(--color-rust)]" />
      </div>
      <h2 className="text-lg font-bold text-[var(--color-ink)] font-display italic">{title}</h2>
      {count !== undefined && (
        <span className="px-2 py-0.5 bg-[var(--color-paper-2)] text-[var(--color-muted)] text-xs font-semibold rounded-full">{count}</span>
      )}
    </div>
  )
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="bg-[var(--color-paper)] rounded-2xl border border-[var(--color-sepia)] p-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--color-paper-2)] flex items-center justify-center mx-auto mb-4">
        <Icon size={24} className="text-[var(--color-muted-2)]" />
      </div>
      <p className="text-[var(--color-muted)] text-sm">{text}</p>
    </div>
  )
}

function RoleBadge({ role }) {
  const map = {
    student: 'bg-[var(--color-paper-2)] text-[var(--color-ink-2)]',
    teacher: 'bg-[var(--color-rust-wash)] text-[var(--color-rust)]',
    admin:   'bg-[var(--color-rust)]/10 text-[var(--color-rust)]',
  }
  const labels = { student: 'Студент', teacher: 'Преподаватель', admin: 'Админ' }
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${map[role] || 'bg-[var(--color-paper-2)] text-[var(--color-muted)]'}`}>
      {labels[role] || role}
    </span>
  )
}

function ActionBtn({ icon: Icon, label, color, onClick }) {
  const colors = {
    emerald: 'bg-[var(--color-ok)]/10 text-[var(--color-ok)] hover:bg-[var(--color-ok)]/18',
    red:     'bg-[var(--color-danger)]/8 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/15',
    amber:   'bg-[var(--color-warn)]/10 text-[var(--color-warn)] hover:bg-[var(--color-warn)]/18',
    blue:    'bg-[var(--color-rust-wash)] text-[var(--color-rust)] hover:bg-[var(--color-rust)]/18',
  }
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${colors[color] || colors.blue}`}
    >
      <Icon size={13} />{label}
    </button>
  )
}

/* ═══ Словарь ключей критериев → русский ═══ */
const CRITERIA_LABELS = {
  clarity: 'Ясность изложения', depth: 'Глубина темы', engagement: 'Удержание внимания',
  accessibility: 'Доступность для вопросов', relevance: 'Актуальность материала',
  materials_quality: 'Качество материалов', task_clarity: 'Чёткость задач',
  help: 'Помощь при затруднениях', feedback: 'Обратная связь', fairness: 'Справедливость',
  practical: 'Практическая применимость', pacing: 'Темп занятия',
  discussion: 'Организация дискуссии', inclusion: 'Вовлечение группы',
  theory_practice: 'Связь теории с практикой', preparation: 'Подготовленность',
  atmosphere: 'Атмосфера', cases: 'Полезность кейсов',
  availability: 'Доступность', feedback_quality: 'Качество обратной связи',
  topic_help: 'Помощь с темой', expertise: 'Научная экспертиза',
  motivation: 'Мотивация', reliability: 'Соблюдение договорённостей',
  professionalism: 'Профессионализм', explaining: 'Умение объяснять',
  attitude: 'Отношение к студентам', organization: 'Организованность',
  passion: 'Интерес к предмету', usefulness: 'Польза от занятий',
}
const TEACHER_ROLE_LABELS = {
  lecturer: 'Лектор', seminar: 'Семинарист', practice: 'Практик',
  supervisor: 'Научрук', both: 'Лектор + Семинарист', universal: 'Преподаватель',
}

/* ════════ RatingCard — полная карточка отзыва для модерации ════════ */
function RatingCard({ rating: r, expanded, onToggleExpand, rejectingId, rejectReason,
  setRejectReason, onApprove, onStartReject, onConfirmReject, onCancelReject, teacherName }) {

  const isRejecting = rejectingId === r.id

  /* Цвет оценки */
  const score = Number(r.averageScore || 0)
  const scoreClr =
    score >= 8 ? 'text-emerald-400' :
    score >= 5 ? 'text-amber-400'   : 'text-red-400'

  return (
    <div className="bg-[var(--color-paper)] rounded-2xl border border-[var(--color-sepia)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center">
              <span className={`text-2xl font-bold ${scoreClr}`}>{score.toFixed(1)}</span>
              <span className="text-[10px] text-[var(--color-muted)]">/10</span>
            </div>
            <div>
              {teacherName && (
                <p className="text-sm font-semibold text-[var(--color-ink)] mb-0.5">{teacherName}</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                {r.discipline && (
                  <span className="text-[11px] px-2 py-0.5 bg-[var(--color-rust-wash)] text-[var(--color-rust)] rounded-full">{r.discipline}</span>
                )}
                {r.semester && (
                  <span className="text-[11px] px-2 py-0.5 bg-[var(--color-paper-2)] text-[var(--color-muted)] rounded-full">{r.semester}</span>
                )}
                {r.teacherRole && (
                  <span className="text-[11px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">
                    {TEACHER_ROLE_LABELS[r.teacherRole] || r.teacherRole}
                  </span>
                )}
                {r.nps && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${NPS_COLORS[r.nps]}`}>{NPS_LABELS[r.nps]}</span>
                )}
              </div>
              <p className="text-xs text-[var(--color-muted)]">
                Студент {r.studentCourse ? `${r.studentCourse} курса` : ''} · {formatDate(r.createdAt)}
                {r.isAnonymous ? ' · Анонимно' : ''}
                {r.attendanceLevel ? ` · Посещаемость: ${ATTENDANCE_LABELS[r.attendanceLevel] || r.attendanceLevel}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onToggleExpand}
            className="p-2 hover:bg-[var(--color-paper-2)]/50 rounded-xl transition-colors text-[var(--color-muted)]">
            <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Комментарии — всегда видны */}
        <div className="space-y-2">
          {r.positiveComment && (
            <div className="bg-emerald-500/10 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-emerald-400 mb-1">+ Что понравилось</p>
              <p className={`text-sm text-[var(--color-ink)] ${!expanded ? 'line-clamp-3' : ''}`}>{r.positiveComment}</p>
            </div>
          )}
          {r.negativeComment && (
            <div className="bg-amber-500/10 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-amber-400 mb-1">− Что не понравилось</p>
              <p className={`text-sm text-[var(--color-ink)] ${!expanded ? 'line-clamp-3' : ''}`}>{r.negativeComment}</p>
            </div>
          )}
          {!r.positiveComment && !r.negativeComment && r.comment && (
            <div className="bg-[var(--color-paper-2)]/50 rounded-xl p-3">
              <p className={`text-sm text-[var(--color-ink)] ${!expanded ? 'line-clamp-3' : ''}`}>{r.comment}</p>
            </div>
          )}
        </div>
      </div>

      {/* Expanded detail — критерии */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-[var(--color-sepia)] pt-4 space-y-4">
          {/* Criteria scores */}
          {r.criteriaScores && Object.keys(r.criteriaScores).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--color-muted)] mb-2">Оценки по критериям</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(r.criteriaScores).map(([k, v]) => {
                  const label = CRITERIA_LABELS[k] || k
                  const val = v ?? 0
                  const barClr = val >= 8 ? 'bg-emerald-400' : val >= 5 ? 'bg-amber-400' : 'bg-red-400'
                  return (
                    <div key={k} className="bg-[var(--color-paper-2)] rounded-lg px-3 py-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] text-[var(--color-muted)]">{label}</span>
                        <span className="text-[11px] font-bold text-[var(--color-ink)]">{v ?? '—'}</span>
                      </div>
                      <div className="h-1 bg-[var(--color-sepia)] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barClr}`} style={{ width: `${val * 10}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Доп. информация */}
          <div className="flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
            {r.courseScore && (
              <span>Оценка курса: <strong className="text-[var(--color-ink)]">{r.courseScore}/10</strong></span>
            )}
            {r.attendanceLecture && (
              <span>Посещ. лекций: <strong className="text-[var(--color-ink)]">{ATTENDANCE_LABELS[r.attendanceLecture] || r.attendanceLecture}</strong></span>
            )}
            {r.attendanceSeminar && (
              <span>Посещ. семинаров: <strong className="text-[var(--color-ink)]">{ATTENDANCE_LABELS[r.attendanceSeminar] || r.attendanceSeminar}</strong></span>
            )}
          </div>
        </div>
      )}

      {/* Actions / reject form */}
      <div className="px-5 pb-4 border-t border-[var(--color-sepia)] pt-3">
        {isRejecting ? (
          <div className="space-y-2">
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Причина отклонения..."
              rows={2}
              className="w-full px-3 py-2 text-sm bg-[var(--color-paper-2)]/50 border border-[var(--color-sepia)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)]/20 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={onConfirmReject}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-danger)] hover:brightness-90 text-[#FFFDF7] text-xs font-bold rounded-xl transition-all">
                <XCircle size={13} /> Отклонить
              </button>
              <button onClick={onCancelReject}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-2)] text-[var(--color-ink)] text-xs font-medium rounded-xl transition-all">
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={onApprove}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-ok)] hover:brightness-95 text-[#FFFDF7] text-xs font-bold rounded-xl transition-all">
              <CheckCircle size={13} /> Одобрить
            </button>
            <button onClick={onStartReject}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-danger)]/8 hover:bg-[var(--color-danger)]/15 text-[var(--color-danger)] text-xs font-semibold rounded-xl transition-all">
              <XCircle size={13} /> Отклонить
            </button>
            <button onClick={onToggleExpand}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-paper-2)]/50 hover:bg-[var(--color-paper-2)] text-[var(--color-muted)] text-xs font-medium rounded-xl transition-all ml-auto">
              <Eye size={13} /> {expanded ? 'Свернуть' : 'Детали'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
