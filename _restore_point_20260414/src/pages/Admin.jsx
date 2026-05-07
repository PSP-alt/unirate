/* ═══════════════════════════════════════════════════
   Панель администратора — /admin

   Боковая навигация + секции:
   1. Обзор (статистика платформы)
   2. Модерация оценок
   3. Управление пользователями
   4. Одобрение преподавателей
   ═══════════════════════════════════════════════════ */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Shield,
  Users,
  UserCheck,
  CheckCircle,
  XCircle,
  Clock,
  BookOpen,
  Download,
  Star,
  ToggleLeft,
  ToggleRight,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'

import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Textarea } from '../components/ui/Input'
import Avatar from '../components/ui/Avatar'
import Skeleton from '../components/ui/Skeleton'
import {
  getPendingRatings,
  approveRating,
  rejectRating,
  getAllUsers,
  toggleUserActive,
  getPendingTeachers,
  approveTeacher,
  getPlatformStats,
} from '../services/admin'
import { cn } from '../utils/cn'

/* Секции боковой панели */
const SECTIONS = [
  { key: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { key: 'moderation', label: 'Модерация', icon: Shield },
  { key: 'users', label: 'Пользователи', icon: Users },
  { key: 'teachers', label: 'Преподаватели', icon: UserCheck },
]

/* Роли */
const ROLE_LABELS = {
  student: { label: 'Студент', variant: 'blue' },
  teacher: { label: 'Преподаватель', variant: 'gold' },
  admin: { label: 'Админ', variant: 'red' },
}

/* Форматирование даты */
function formatDate(timestamp) {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default function Admin() {
  const [activeSection, setActiveSection] = useState('overview')
  const [loading, setLoading] = useState(true)

  /* Данные */
  const [stats, setStats] = useState(null)
  const [pendingRatings, setPendingRatings] = useState([])
  const [users, setUsers] = useState([])
  const [pendingTeachersList, setPendingTeachersList] = useState([])

  /* Модерация: причина отклонения */
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  /* Поиск пользователей */
  const [userSearch, setUserSearch] = useState('')

  /* ── Загрузка данных ── */
  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const [statsRes, ratingsRes, usersRes, teachersRes] = await Promise.all([
        getPlatformStats(),
        getPendingRatings(),
        getAllUsers(),
        getPendingTeachers(),
      ])

      setStats(statsRes.stats)
      setPendingRatings(ratingsRes.ratings)
      setUsers(usersRes.users)
      setPendingTeachersList(teachersRes.teachers)

      setLoading(false)
    }
    load()
  }, [])

  /* ── Одобрить оценку ── */
  const handleApproveRating = async (ratingId) => {
    const { error } = await approveRating(ratingId)
    if (error) {
      toast.error(error)
    } else {
      setPendingRatings((prev) => prev.filter((r) => r.id !== ratingId))
      toast.success('Оценка одобрена')
    }
  }

  /* ── Отклонить оценку ── */
  const handleRejectRating = async (ratingId) => {
    if (!rejectReason.trim()) {
      toast.error('Укажите причину отклонения')
      return
    }
    const { error } = await rejectRating(ratingId, rejectReason.trim())
    if (error) {
      toast.error(error)
    } else {
      setPendingRatings((prev) => prev.filter((r) => r.id !== ratingId))
      setRejectingId(null)
      setRejectReason('')
      toast.success('Оценка отклонена')
    }
  }

  /* ── Переключить активность пользователя ── */
  const handleToggleUser = async (userId, currentActive) => {
    const { error } = await toggleUserActive(userId, !currentActive)
    if (error) {
      toast.error(error)
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: !currentActive } : u)),
      )
      toast.success(!currentActive ? 'Пользователь активирован' : 'Пользователь деактивирован')
    }
  }

  /* ── Одобрить преподавателя ── */
  const handleApproveTeacher = async (userId) => {
    const { error } = await approveTeacher(userId)
    if (error) {
      toast.error(error)
    } else {
      setPendingTeachersList((prev) => prev.filter((t) => t.id !== userId))
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: true } : u)),
      )
      toast.success('Преподаватель одобрен')
    }
  }

  /* Фильтрация пользователей по поиску */
  const filteredUsers = userSearch
    ? users.filter((u) => {
        const name = `${u.lastName || ''} ${u.firstName || ''} ${u.email || ''}`.toLowerCase()
        return name.includes(userSearch.toLowerCase())
      })
    : users

  /* ── Скелетон ── */
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex gap-8">
          <Skeleton className="w-56 h-[400px] hidden lg:block" />
          <div className="flex-1 space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* ═══ БОКОВАЯ НАВИГАЦИЯ ═══ */}
        <aside className="lg:w-56 flex-shrink-0">
          <Card className="p-3 lg:sticky lg:top-24">
            <nav className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
              {SECTIONS.map((section) => {
                /* Счётчик для модерации и преподавателей */
                let count = null
                if (section.key === 'moderation') count = pendingRatings.length
                if (section.key === 'teachers') count = pendingTeachersList.length

                return (
                  <button
                    key={section.key}
                    onClick={() => setActiveSection(section.key)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors w-full text-left',
                      activeSection === section.key
                        ? 'bg-accent-blue text-white'
                        : 'text-text-secondary hover:bg-accent-blue-light hover:text-accent-blue',
                    )}
                  >
                    <section.icon size={18} />
                    {section.label}
                    {count > 0 && (
                      <span
                        className={cn(
                          'ml-auto text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center',
                          activeSection === section.key
                            ? 'bg-white text-accent-blue'
                            : 'bg-error text-white',
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </Card>
        </aside>

        {/* ═══ ОСНОВНОЕ СОДЕРЖИМОЕ ═══ */}
        <main className="flex-1 min-w-0">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* ── Обзор ── */}
            {activeSection === 'overview' && (
              <div className="space-y-6">
                <h2 className="font-heading text-2xl text-accent-blue">
                  Обзор платформы
                </h2>

                {/* Карточки статистики */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    icon={Users}
                    label="Студентов"
                    value={stats?.students || 0}
                    color="text-accent-blue"
                    bg="bg-accent-blue-light"
                  />
                  <StatCard
                    icon={UserCheck}
                    label="Преподавателей"
                    value={stats?.teachers || 0}
                    color="text-accent-gold"
                    bg="bg-accent-gold/10"
                  />
                  <StatCard
                    icon={BookOpen}
                    label="Материалов"
                    value={stats?.totalMaterials || 0}
                    color="text-success"
                    bg="bg-success/10"
                  />
                  <StatCard
                    icon={Download}
                    label="Скачиваний"
                    value={stats?.totalDownloads || 0}
                    color="text-info"
                    bg="bg-info/10"
                  />
                </div>

                {/* Второй ряд */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard
                    icon={Star}
                    label="Всего оценок"
                    value={stats?.totalRatings || 0}
                    color="text-accent-gold"
                    bg="bg-accent-gold/10"
                  />
                  <StatCard
                    icon={Clock}
                    label="На модерации"
                    value={stats?.pendingRatings || 0}
                    color="text-warning"
                    bg="bg-warning/10"
                  />
                  <StatCard
                    icon={CheckCircle}
                    label="Одобренных"
                    value={stats?.approvedRatings || 0}
                    color="text-success"
                    bg="bg-success/10"
                  />
                </div>

                {/* Уведомления */}
                {(pendingRatings.length > 0 || pendingTeachersList.length > 0) && (
                  <Card className="p-5 border-l-4 border-l-warning">
                    <h3 className="font-heading text-base text-accent-blue mb-3">
                      Требуют внимания
                    </h3>
                    <div className="space-y-2">
                      {pendingRatings.length > 0 && (
                        <button
                          onClick={() => setActiveSection('moderation')}
                          className="flex items-center gap-2 text-sm text-text-primary hover:text-accent-blue transition-colors w-full text-left"
                        >
                          <Shield size={16} className="text-warning" />
                          <span>
                            {pendingRatings.length}{' '}
                            {pendingRatings.length === 1 ? 'оценка' : 'оценок'} ожидает модерации
                          </span>
                        </button>
                      )}
                      {pendingTeachersList.length > 0 && (
                        <button
                          onClick={() => setActiveSection('teachers')}
                          className="flex items-center gap-2 text-sm text-text-primary hover:text-accent-blue transition-colors w-full text-left"
                        >
                          <UserCheck size={16} className="text-warning" />
                          <span>
                            {pendingTeachersList.length}{' '}
                            {pendingTeachersList.length === 1
                              ? 'преподаватель ожидает'
                              : 'преподавателей ожидают'}{' '}
                            одобрения
                          </span>
                        </button>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ── Модерация оценок ── */}
            {activeSection === 'moderation' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-2xl text-accent-blue">
                    Модерация оценок
                  </h2>
                  {pendingRatings.length > 0 && (
                    <Badge variant="gold">{pendingRatings.length} на модерации</Badge>
                  )}
                </div>

                {pendingRatings.length > 0 ? (
                  <div className="space-y-4">
                    {pendingRatings.map((rating) => (
                      <Card key={rating.id} className="p-5">
                        {/* Шапка */}
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-medium text-text-primary">
                              Студент {rating.studentCourse} курса
                            </p>
                            <p className="text-xs text-text-secondary">
                              {formatDate(rating.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-accent-blue font-body">
                              {Number(rating.averageScore).toFixed(1)}
                            </span>
                            <span className="text-xs text-text-secondary">/ 10</span>
                          </div>
                        </div>

                        {/* Оценки по критериям */}
                        {rating.criteriaScores && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {Object.entries(rating.criteriaScores).map(([key, val]) => (
                              <span
                                key={key}
                                className="text-xs bg-gray-100 rounded px-2 py-1 text-text-secondary"
                              >
                                {key}: <strong className="text-text-primary">{val}</strong>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Комментарий */}
                        {rating.comment && (
                          <div className="bg-gray-50 rounded-lg p-3 mb-4">
                            <p className="text-sm text-text-primary leading-relaxed">
                              {rating.comment}
                            </p>
                          </div>
                        )}

                        {/* Форма отклонения */}
                        {rejectingId === rating.id ? (
                          <div className="space-y-3">
                            <Textarea
                              placeholder="Укажите причину отклонения..."
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleRejectRating(rating.id)}
                              >
                                Отклонить
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setRejectingId(null)
                                  setRejectReason('')
                                }}
                              >
                                Отмена
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* Кнопки действий */
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApproveRating(rating.id)}
                            >
                              <CheckCircle size={16} />
                              Одобрить
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setRejectingId(rating.id)}
                            >
                              <XCircle size={16} />
                              Отклонить
                            </Button>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="p-6 text-center">
                    <CheckCircle size={48} className="mx-auto text-success/30 mb-4" />
                    <p className="text-text-secondary">
                      Нет оценок на модерации
                    </p>
                  </Card>
                )}
              </div>
            )}

            {/* ── Пользователи ── */}
            {activeSection === 'users' && (
              <div className="space-y-6">
                <h2 className="font-heading text-2xl text-accent-blue">
                  Управление пользователями
                </h2>

                {/* Поиск */}
                <Input
                  placeholder="Поиск по имени или email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />

                {/* Таблица */}
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-border">
                          <th className="text-left px-4 py-3 font-medium text-text-secondary">
                            Пользователь
                          </th>
                          <th className="text-left px-4 py-3 font-medium text-text-secondary">
                            Роль
                          </th>
                          <th className="text-left px-4 py-3 font-medium text-text-secondary">
                            Дата регистрации
                          </th>
                          <th className="text-left px-4 py-3 font-medium text-text-secondary">
                            Статус
                          </th>
                          <th className="text-right px-4 py-3 font-medium text-text-secondary">
                            Действия
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => {
                          const role = ROLE_LABELS[u.role] || ROLE_LABELS.student
                          const fullName = `${u.lastName || ''} ${u.firstName || ''}`.trim()

                          return (
                            <tr
                              key={u.id}
                              className="border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <Avatar name={fullName} size="sm" />
                                  <div>
                                    <p className="font-medium text-text-primary">
                                      {fullName || 'Без имени'}
                                    </p>
                                    <p className="text-xs text-text-secondary">
                                      {u.email}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={role.variant}>{role.label}</Badge>
                              </td>
                              <td className="px-4 py-3 text-text-secondary">
                                {formatDate(u.createdAt)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 text-xs font-medium',
                                    u.isActive ? 'text-success' : 'text-error',
                                  )}
                                >
                                  {u.isActive ? (
                                    <>
                                      <CheckCircle size={14} /> Активен
                                    </>
                                  ) : (
                                    <>
                                      <XCircle size={14} /> Неактивен
                                    </>
                                  )}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {u.role !== 'admin' && (
                                  <button
                                    onClick={() => handleToggleUser(u.id, u.isActive)}
                                    className="transition-colors"
                                    title={
                                      u.isActive ? 'Деактивировать' : 'Активировать'
                                    }
                                  >
                                    {u.isActive ? (
                                      <ToggleRight size={28} className="text-success" />
                                    ) : (
                                      <ToggleLeft size={28} className="text-text-secondary" />
                                    )}
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {filteredUsers.length === 0 && (
                    <div className="p-8 text-center">
                      <p className="text-text-secondary">Пользователи не найдены</p>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ── Одобрение преподавателей ── */}
            {activeSection === 'teachers' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-heading text-2xl text-accent-blue">
                    Одобрение преподавателей
                  </h2>
                  {pendingTeachersList.length > 0 && (
                    <Badge variant="gold">
                      {pendingTeachersList.length} ожидают
                    </Badge>
                  )}
                </div>

                {pendingTeachersList.length > 0 ? (
                  <div className="space-y-4">
                    {pendingTeachersList.map((teacher) => {
                      const fullName = `${teacher.lastName || ''} ${teacher.firstName || ''}`.trim()

                      return (
                        <Card key={teacher.id} className="p-5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Avatar name={fullName} size="md" />
                              <div>
                                <h4 className="font-medium text-text-primary">
                                  {fullName || 'Без имени'}
                                </h4>
                                <p className="text-sm text-text-secondary">
                                  {teacher.email}
                                </p>
                                <p className="text-xs text-text-secondary mt-1">
                                  Зарегистрирован: {formatDate(teacher.createdAt)}
                                </p>
                              </div>
                            </div>

                            <Button
                              size="sm"
                              onClick={() => handleApproveTeacher(teacher.id)}
                            >
                              <CheckCircle size={16} />
                              Одобрить
                            </Button>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <Card className="p-6 text-center">
                    <UserCheck size={48} className="mx-auto text-success/30 mb-4" />
                    <p className="text-text-secondary">
                      Нет преподавателей, ожидающих одобрения
                    </p>
                  </Card>
                )}
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  )
}

/* ═══ Компонент карточки статистики ═══ */
function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className={cn('p-2.5 rounded-lg', bg)}>
          <Icon size={20} className={color} />
        </div>
        <div>
          <p className="text-2xl font-bold text-accent-blue font-body">
            {value}
          </p>
          <p className="text-xs text-text-secondary">{label}</p>
        </div>
      </div>
    </Card>
  )
}
