/* ═══════════════════════════════════════════════════
   SettingsPanel — расширенная панель настроек

   Секции: Профиль, Оформление, Уведомления,
   Приватность, Оценки (препод.), Безопасность, Аккаунт.
   ═══════════════════════════════════════════════════ */

import { useState, useRef, useEffect } from 'react'
import {
  User,
  Palette,
  Bell,
  Lock,
  LogOut,
  Camera,
  Trash2,
  Sun,
  Moon,
  Monitor,
  Globe,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Check,
  Shield,
  Star,
  Mail,
  Key,
  Type,
  Layout,
  Layers,
  Link2,
  Phone,
  Building2,
  GraduationCap,
  BookOpen,
  Clock,
  MapPin,
  ExternalLink,
  MessageSquare,
  Megaphone,
  Newspaper,
  Eye,
  EyeOff,
  Award,
  TrendingUp,
  UserCheck,
  Send,
} from 'lucide-react'
import toast from 'react-hot-toast'

import Card from '../ui/Card'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { Textarea, Select } from '../ui/Input'
import Avatar from '../ui/Avatar'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { updateUserDocument, getTeacherDocument, updateTeacherDocument } from '../../services/firestore'
import { uploadFile } from '../../services/materials'
import { logoutUser, resetPassword } from '../../services/auth'
import { cn } from '../../utils/cn'

/* Подсекции */
const BASE_SUBSECTIONS = [
  { key: 'profile', icon: User },
  { key: 'appearance', icon: Palette },
  { key: 'notifications', icon: Bell },
  { key: 'privacy', icon: Lock },
  { key: 'security', icon: Shield },
  { key: 'account', icon: LogOut },
]

const TEACHER_SUBSECTIONS = [
  { key: 'profile', icon: User },
  { key: 'appearance', icon: Palette },
  { key: 'notifications', icon: Bell },
  { key: 'privacy', icon: Lock },
  { key: 'ratings', icon: Star },
  { key: 'security', icon: Shield },
  { key: 'account', icon: LogOut },
]

/* Темы */
const THEMES = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
]

/* Размеры шрифта */
const FONT_SIZES = [
  { value: 'normal', icon: Type, size: 14 },
  { value: 'large', icon: Type, size: 17 },
  { value: 'xlarge', icon: Type, size: 20 },
]

/* Стили карточек */
const CARD_STYLES = [
  { value: 'elevated', icon: Layers },
  { value: 'flat', icon: Layout },
  { value: 'outlined', icon: Layout },
]

/* ── Переключатель ── */
function Toggle({ enabled, onChange, label, desc, accent = false }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 min-w-0 pr-4">
        <p className={cn('text-sm font-medium', accent ? 'text-accent-blue' : 'text-text-primary')}>
          {label}
        </p>
        {desc && <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{desc}</p>}
      </div>
      <button onClick={() => onChange(!enabled)} className="flex-shrink-0" type="button">
        {enabled
          ? <ToggleRight size={34} className={accent ? 'text-accent-blue' : 'text-success'} />
          : <ToggleLeft size={34} className="text-text-secondary" />
        }
      </button>
    </div>
  )
}

/* ── Секция с заголовком ── */
function Section({ title, icon: Icon, children }) {
  return (
    <div className="mb-6 last:mb-0">
      {title && (
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
          {Icon && <Icon size={15} className="text-text-secondary" />}
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {title}
          </h4>
        </div>
      )}
      {children}
    </div>
  )
}

export default function SettingsPanel({ role = 'student' }) {
  const { user, userData, refreshUserData } = useAuth()
  const {
    themeMode, setThemeMode,
    language, setLanguage, languages,
    fontSize, setFontSize,
    compactMode, setCompactMode,
    cardStyle, setCardStyle,
    notifications, setNotifications,
    privacy, setPrivacy,
    t,
  } = useSettings()
  const avatarInputRef = useRef(null)

  const subsections = role === 'teacher' ? TEACHER_SUBSECTIONS : BASE_SUBSECTIONS
  const [section, setSection] = useState('profile')

  /* ── Данные преподавателя ── */
  const [teacherData, setTeacherData] = useState(null)
  const [ratingsEnabled, setRatingsEnabled] = useState(false)
  const [participateOverall, setParticipateOverall] = useState(true)

  useEffect(() => {
    if (role !== 'teacher' || !user?.uid) return
    getTeacherDocument(user.uid).then(({ data }) => {
      if (data) {
        setTeacherData(data)
        setRatingsEnabled(data.ratingsEnabled ?? false)
        setParticipateOverall(data.participateOverall ?? true)
        /* Заполняем поля преподавателя */
        setMiddleName(data.middleName || '')
        setDegree(data.degree || 'none')
        setAcademicTitle(data.academicTitle || 'none')
        setDepartment(data.department || '')
        setExperience(data.experience || '')
        setResearchInterests(data.researchInterests || '')
        setOffice(data.office || '')
        setOfficeHours(data.officeHours || '')
        setWebsite(data.website || '')
        setContactEmail(data.contactEmail || '')
        setVk(data.vk || '')
        setTelegram(data.telegram || '')
        setPhone(data.phone || '')
      }
    })
  }, [role, user?.uid])

  /* ── Поля профиля (общие) ── */
  const [firstName, setFirstName] = useState(userData?.firstName || '')
  const [lastName, setLastName] = useState(userData?.lastName || '')
  const [middleName, setMiddleName] = useState(userData?.middleName || '')
  const [bio, setBio] = useState(userData?.bio || '')
  const [phone, setPhone] = useState(userData?.phone || '')
  const [vk, setVk] = useState(userData?.vk || '')
  const [telegram, setTelegram] = useState(userData?.telegram || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  /* ── Поля профиля студента ── */
  const [course, setCourse] = useState(userData?.course || 1)
  const [specialty, setSpecialty] = useState(userData?.specialty || '')
  const [group, setGroup] = useState(userData?.group || '')
  const [interests, setInterests] = useState(userData?.interests || '')
  const [goals, setGoals] = useState(userData?.goals || '')

  /* ── Поля профиля преподавателя ── */
  const [contactEmail, setContactEmail] = useState(userData?.contactEmail || '')
  const [degree, setDegree] = useState('none')
  const [academicTitle, setAcademicTitle] = useState('none')
  const [department, setDepartment] = useState('')
  const [experience, setExperience] = useState('')
  const [researchInterests, setResearchInterests] = useState('')
  const [office, setOffice] = useState('')
  const [officeHours, setOfficeHours] = useState('')
  const [website, setWebsite] = useState('')

  /* ── Безопасность ── */
  const [resetSent, setResetSent] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)

  /* Имя для аватара */
  const fullName = `${userData?.lastName || ''} ${userData?.firstName || ''}`.trim()

  /* ── Загрузка аватара ── */
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение (JPG, PNG, GIF)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Максимальный размер аватара — 5 МБ')
      return
    }
    setIsUploadingAvatar(true)
    try {
      const path = `avatars/${user.uid}/${Date.now()}_${file.name}`
      const avatarUrl = await uploadFile(file, path, () => {})
      await updateUserDocument(user.uid, { avatarUrl })
      if (role === 'teacher') await updateTeacherDocument(user.uid, { avatarUrl })
      await refreshUserData()
      toast.success('Аватар обновлён')
    } catch (err) {
      toast.error('Не удалось загрузить аватар')
    }
    setIsUploadingAvatar(false)
  }

  /* ── Удалить аватар ── */
  const handleRemoveAvatar = async () => {
    await updateUserDocument(user.uid, { avatarUrl: null })
    if (role === 'teacher') await updateTeacherDocument(user.uid, { avatarUrl: null })
    await refreshUserData()
    toast.success('Аватар удалён')
  }

  /* ── Сохранение профиля студента ── */
  const handleSaveStudentProfile = async (e) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Заполните имя и фамилию')
      return
    }
    setIsSaving(true)
    const { error } = await updateUserDocument(user.uid, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleName: middleName.trim(),
      course: Number(course),
      specialty: specialty.trim(),
      group: group.trim(),
      bio: bio.trim(),
      interests: interests.trim(),
      goals: goals.trim(),
      phone: phone.trim(),
      vk: vk.trim(),
      telegram: telegram.trim(),
    })
    if (error) toast.error(error)
    else { toast.success('Данные обновлены'); await refreshUserData() }
    setIsSaving(false)
  }

  /* ── Сохранение профиля преподавателя ── */
  const handleSaveTeacherProfile = async (e) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Заполните имя и фамилию')
      return
    }
    setIsSaving(true)
    const userUpdates = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleName: middleName.trim(),
    }
    const teacherUpdates = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleName: middleName.trim(),
      bio: bio.trim(),
      contactEmail: contactEmail.trim(),
      degree,
      academicTitle,
      department: department.trim(),
      experience: experience ? Number(experience) : null,
      researchInterests: researchInterests.trim(),
      office: office.trim(),
      officeHours: officeHours.trim(),
      website: website.trim(),
      phone: phone.trim(),
      vk: vk.trim(),
      telegram: telegram.trim(),
    }
    const [r1, r2] = await Promise.all([
      updateUserDocument(user.uid, userUpdates),
      updateTeacherDocument(user.uid, teacherUpdates),
    ])
    if (r1.error || r2.error) toast.error('Не удалось сохранить данные')
    else { toast.success('Данные обновлены'); await refreshUserData() }
    setIsSaving(false)
  }

  /* ── Переключение ratingsEnabled ── */
  const handleRatingsToggle = async (value) => {
    setRatingsEnabled(value)
    const { error } = await updateTeacherDocument(user.uid, { ratingsEnabled: value })
    if (error) {
      setRatingsEnabled(!value)
      toast.error('Не удалось изменить настройку')
    } else {
      toast.success(value ? 'Оценивание включено' : 'Оценивание отключено')
    }
  }

  /* ── Переключение participateOverall ── */
  const handleParticipateToggle = async (value) => {
    setParticipateOverall(value)
    const { error } = await updateTeacherDocument(user.uid, { participateOverall: value })
    if (error) {
      setParticipateOverall(!value)
      toast.error('Не удалось изменить настройку')
    }
  }

  /* ── Сброс пароля ── */
  const handlePasswordReset = async () => {
    setSendingReset(true)
    const { error } = await resetPassword(user.email)
    setSendingReset(false)
    if (error) toast.error(error)
    else { setResetSent(true); toast.success('Письмо отправлено!') }
  }

  return (
    <div className="space-y-6">
      {/* Горизонтальные под-вкладки */}
      <div className="flex gap-0.5 overflow-x-auto no-scrollbar border-b border-border">
        {subsections.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              section === s.key
                ? 'text-accent-blue border-accent-blue'
                : 'text-text-secondary border-transparent hover:text-accent-blue',
            )}
          >
            <s.icon size={15} />
            {t(`settings.${s.key}`)}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════
          ПРОФИЛЬ
          ═══════════════════════════════════════ */}
      {section === 'profile' && (
        <Card className="p-6">
          <h3 className="font-heading text-lg text-accent-blue mb-6">
            {t('settings.profile')}
          </h3>

          {/* Аватар */}
          <Section>
            <div className="flex items-center gap-5 mb-2">
              <div className="relative">
                <Avatar src={userData?.avatarUrl} name={fullName} size="xl" />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute bottom-0 right-0 bg-accent-blue text-white p-1.5 rounded-full shadow-md hover:bg-accent-blue-hover transition-colors"
                  type="button"
                >
                  <Camera size={14} />
                </button>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary mb-1">{t('settings.avatar')}</p>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar ? 'Загрузка...' : t('settings.avatarChange')}
                  </Button>
                  {userData?.avatarUrl && (
                    <Button variant="ghost" size="sm" onClick={handleRemoveAvatar}>
                      {t('settings.avatarRemove')}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-text-secondary mt-1">JPG, PNG, GIF. Максимум 5 МБ</p>
              </div>
            </div>
          </Section>

          {/* ── Форма студента ── */}
          {role === 'student' && (
            <form onSubmit={handleSaveStudentProfile} className="space-y-5 max-w-lg">
              <Section title="Основная информация" icon={User}>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label={t('settings.lastName')}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                    <Input
                      label={t('settings.firstName')}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <Input
                    label={t('settings.middleName')}
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Иванович"
                  />
                  <Input
                    label={t('settings.email')}
                    value={user?.email || ''}
                    disabled
                    className="opacity-60"
                  />
                  <Input
                    label={t('settings.phone')}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>
              </Section>

              <Section title="Учёба" icon={GraduationCap}>
                <div className="space-y-3">
                  <Select
                    label={t('settings.course')}
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                  >
                    {[1,2,3,4,5,6].map(n => (
                      <option key={n} value={n}>{n} курс</option>
                    ))}
                  </Select>
                  <Input
                    label={t('settings.specialty')}
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="Прикладная математика и информатика"
                  />
                  <Input
                    label={t('settings.group')}
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    placeholder="ПМИ-22-01"
                  />
                </div>
              </Section>

              <Section title="О себе" icon={BookOpen}>
                <div className="space-y-3">
                  <Textarea
                    label={t('settings.bio')}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Расскажите о себе..."
                    rows={3}
                  />
                  <Textarea
                    label={t('settings.interests')}
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    placeholder="Программирование, математика, музыка..."
                    rows={2}
                  />
                  <Textarea
                    label={t('settings.goals')}
                    value={goals}
                    onChange={(e) => setGoals(e.target.value)}
                    placeholder="Чего хочу достичь в учёбе..."
                    rows={2}
                  />
                </div>
              </Section>

              <Section title={t('settings.socialLinks')} icon={Link2}>
                <div className="space-y-3">
                  <Input
                    label={t('settings.vk')}
                    value={vk}
                    onChange={(e) => setVk(e.target.value)}
                    placeholder="https://vk.com/username"
                  />
                  <Input
                    label={t('settings.telegram')}
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value)}
                    placeholder="@username"
                  />
                </div>
              </Section>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? t('settings.saving') : t('settings.save')}
              </Button>
            </form>
          )}

          {/* ── Форма преподавателя ── */}
          {role === 'teacher' && (
            <form onSubmit={handleSaveTeacherProfile} className="space-y-5 max-w-lg">
              <Section title="Основная информация" icon={User}>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label={t('settings.lastName')}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                    <Input
                      label={t('settings.firstName')}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <Input
                    label={t('settings.middleName')}
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Александрович"
                  />
                  <Input
                    label={t('settings.email')}
                    value={user?.email || ''}
                    disabled
                    className="opacity-60"
                  />
                  <Input
                    label={t('settings.contactEmail')}
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="Публичный email для студентов"
                  />
                  <Input
                    label={t('settings.phone')}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (999) 123-45-67"
                  />
                </div>
              </Section>

              <Section title="Академический статус" icon={Award}>
                <div className="space-y-3">
                  <Select
                    label={t('settings.degree')}
                    value={degree}
                    onChange={(e) => setDegree(e.target.value)}
                  >
                    <option value="none">{t('settings.degreeNone')}</option>
                    <option value="candidate">{t('settings.degreeCandidate')}</option>
                    <option value="doctor">{t('settings.degreeDoctor')}</option>
                  </Select>
                  <Select
                    label={t('settings.academicTitle')}
                    value={academicTitle}
                    onChange={(e) => setAcademicTitle(e.target.value)}
                  >
                    <option value="none">{t('settings.titleNone')}</option>
                    <option value="assistant">{t('settings.titleAssistant')}</option>
                    <option value="docent">{t('settings.titleDocent')}</option>
                    <option value="professor">{t('settings.titleProfessor')}</option>
                  </Select>
                  <Input
                    label={t('settings.department')}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Кафедра математического анализа"
                  />
                  <Input
                    label={t('settings.experience')}
                    type="number"
                    min={0}
                    max={60}
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    placeholder="10"
                  />
                </div>
              </Section>

              <Section title="Научная деятельность" icon={TrendingUp}>
                <div className="space-y-3">
                  <Textarea
                    label={t('settings.bio')}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Кратко о вашем опыте и подходе к преподаванию..."
                    rows={3}
                  />
                  <Textarea
                    label={t('settings.researchInterests')}
                    value={researchInterests}
                    onChange={(e) => setResearchInterests(e.target.value)}
                    placeholder="Теория вероятностей, математическая статистика..."
                    rows={2}
                  />
                </div>
              </Section>

              <Section title="Кабинет и расписание" icon={MapPin}>
                <div className="space-y-3">
                  <Input
                    label={t('settings.office')}
                    value={office}
                    onChange={(e) => setOffice(e.target.value)}
                    placeholder="Корпус 2, кабинет 314"
                  />
                  <Input
                    label={t('settings.officeHours')}
                    value={officeHours}
                    onChange={(e) => setOfficeHours(e.target.value)}
                    placeholder="Пн 14:00–16:00, Ср 10:00–12:00"
                  />
                  <Input
                    label={t('settings.website')}
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://mysite.ru"
                  />
                </div>
              </Section>

              <Section title={t('settings.socialLinks')} icon={Link2}>
                <div className="space-y-3">
                  <Input
                    label={t('settings.vk')}
                    value={vk}
                    onChange={(e) => setVk(e.target.value)}
                    placeholder="https://vk.com/username"
                  />
                  <Input
                    label={t('settings.telegram')}
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value)}
                    placeholder="@username"
                  />
                </div>
              </Section>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? t('settings.saving') : t('settings.save')}
              </Button>
            </form>
          )}

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </Card>
      )}

      {/* ═══════════════════════════════════════
          ОФОРМЛЕНИЕ
          ═══════════════════════════════════════ */}
      {section === 'appearance' && (
        <Card className="p-6">
          <h3 className="font-heading text-lg text-accent-blue mb-6">
            {t('settings.appearance')}
          </h3>

          {/* Тема */}
          <Section title={t('settings.theme')} icon={Palette}>
            <div className="grid grid-cols-3 gap-3">
              {THEMES.map((theme) => {
                const isActive = themeMode === theme.value
                const ThemeIcon = theme.icon
                return (
                  <button
                    key={theme.value}
                    onClick={() => setThemeMode(theme.value)}
                    type="button"
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                      isActive
                        ? 'border-accent-blue bg-accent-blue-light'
                        : 'border-border hover:border-accent-blue/40',
                    )}
                  >
                    <ThemeIcon size={24} className={isActive ? 'text-accent-blue' : 'text-text-secondary'} />
                    <span className={cn('text-sm font-medium', isActive ? 'text-accent-blue' : 'text-text-secondary')}>
                      {t(`settings.theme${theme.value.charAt(0).toUpperCase() + theme.value.slice(1)}`)}
                    </span>
                    {isActive && <Check size={14} className="text-accent-blue" />}
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Язык */}
          <Section title={t('settings.language')} icon={Globe}>
            <div className="grid grid-cols-3 gap-3">
              {languages.map((lang) => {
                const isActive = language === lang.code
                return (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    type="button"
                    className={cn(
                      'flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all',
                      isActive
                        ? 'border-accent-blue bg-accent-blue-light'
                        : 'border-border hover:border-accent-blue/40',
                    )}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span className={cn('text-sm font-medium', isActive ? 'text-accent-blue' : 'text-text-secondary')}>
                      {lang.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Размер шрифта */}
          <Section title={t('settings.fontSize')} icon={Type}>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'normal', label: t('settings.fontSizeNormal'), size: 'text-sm' },
                { value: 'large', label: t('settings.fontSizeLarge'), size: 'text-base' },
                { value: 'xlarge', label: t('settings.fontSizeXLarge'), size: 'text-lg' },
              ].map((opt) => {
                const isActive = fontSize === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setFontSize(opt.value)}
                    type="button"
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all',
                      isActive
                        ? 'border-accent-blue bg-accent-blue-light'
                        : 'border-border hover:border-accent-blue/40',
                    )}
                  >
                    <span className={cn('font-bold', opt.size, isActive ? 'text-accent-blue' : 'text-text-secondary')}>
                      Аа
                    </span>
                    <span className={cn('text-xs font-medium', isActive ? 'text-accent-blue' : 'text-text-secondary')}>
                      {opt.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Стиль карточек */}
          <Section title={t('settings.cardStyle')} icon={Layers}>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'elevated', label: t('settings.cardStyleElevated') },
                { value: 'flat', label: t('settings.cardStyleFlat') },
                { value: 'outlined', label: t('settings.cardStyleOutlined') },
              ].map((opt) => {
                const isActive = cardStyle === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setCardStyle(opt.value)}
                    type="button"
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all',
                      isActive
                        ? 'border-accent-blue bg-accent-blue-light'
                        : 'border-border hover:border-accent-blue/40',
                    )}
                  >
                    <div className={cn(
                      'w-12 h-8 rounded-md',
                      opt.value === 'elevated' ? 'shadow-card bg-bg-card border border-border/50' :
                      opt.value === 'flat' ? 'bg-bg-card border border-border' :
                      'bg-bg-card border-2 border-border',
                    )} />
                    <span className={cn('text-xs font-medium', isActive ? 'text-accent-blue' : 'text-text-secondary')}>
                      {opt.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Компактный режим */}
          <Section>
            <div className="divide-y divide-border">
              <Toggle
                enabled={compactMode}
                onChange={setCompactMode}
                label={t('settings.compactMode')}
                desc={t('settings.compactModeDesc')}
              />
            </div>
          </Section>
        </Card>
      )}

      {/* ═══════════════════════════════════════
          УВЕДОМЛЕНИЯ
          ═══════════════════════════════════════ */}
      {section === 'notifications' && (
        <Card className="p-6">
          <h3 className="font-heading text-lg text-accent-blue mb-4">
            {t('settings.notifications')}
          </h3>
          <div className="divide-y divide-border">
            <Toggle
              enabled={notifications.email}
              onChange={(v) => setNotifications((p) => ({ ...p, email: v }))}
              label={t('settings.notifEmail')}
              desc={t('settings.notifEmailDesc')}
            />
            {role === 'teacher' && (
              <Toggle
                enabled={notifications.ratings}
                onChange={(v) => setNotifications((p) => ({ ...p, ratings: v }))}
                label={t('settings.notifRatings')}
                desc={t('settings.notifRatingsDesc')}
              />
            )}
            <Toggle
              enabled={notifications.materials}
              onChange={(v) => setNotifications((p) => ({ ...p, materials: v }))}
              label={t('settings.notifMaterials')}
              desc={t('settings.notifMaterialsDesc')}
            />
            <Toggle
              enabled={notifications.messages ?? true}
              onChange={(v) => setNotifications((p) => ({ ...p, messages: v }))}
              label={t('settings.notifMessages')}
              desc={t('settings.notifMessagesDesc')}
            />
            <Toggle
              enabled={notifications.announcements ?? true}
              onChange={(v) => setNotifications((p) => ({ ...p, announcements: v }))}
              label={t('settings.notifAnnouncements')}
              desc={t('settings.notifAnnouncementsDesc')}
            />
            <Toggle
              enabled={notifications.digest ?? false}
              onChange={(v) => setNotifications((p) => ({ ...p, digest: v }))}
              label={t('settings.notifDigest')}
              desc={t('settings.notifDigestDesc')}
            />
          </div>
        </Card>
      )}

      {/* ═══════════════════════════════════════
          ПРИВАТНОСТЬ
          ═══════════════════════════════════════ */}
      {section === 'privacy' && (
        <Card className="p-6">
          <h3 className="font-heading text-lg text-accent-blue mb-4">
            {t('settings.privacy')}
          </h3>
          <div className="divide-y divide-border">
            <Toggle
              enabled={privacy.profilePublic}
              onChange={(v) => setPrivacy((p) => ({ ...p, profilePublic: v }))}
              label={t('settings.profilePublic')}
              desc={t('settings.profilePublicDesc')}
            />
            <Toggle
              enabled={privacy.showEmail}
              onChange={(v) => setPrivacy((p) => ({ ...p, showEmail: v }))}
              label={t('settings.showEmail')}
              desc={t('settings.showEmailDesc')}
            />
            <Toggle
              enabled={privacy.showPhone ?? false}
              onChange={(v) => setPrivacy((p) => ({ ...p, showPhone: v }))}
              label={t('settings.showPhone')}
              desc={t('settings.showPhoneDesc')}
            />
            <Toggle
              enabled={privacy.showSocialLinks ?? true}
              onChange={(v) => setPrivacy((p) => ({ ...p, showSocialLinks: v }))}
              label={t('settings.showSocialLinks')}
              desc={t('settings.showSocialLinksDesc')}
            />
            <Toggle
              enabled={privacy.showStats ?? true}
              onChange={(v) => setPrivacy((p) => ({ ...p, showStats: v }))}
              label={t('settings.showStats')}
              desc={t('settings.showStatsDesc')}
            />
            {role === 'student' && (
              <Toggle
                enabled={privacy.participateRanking ?? true}
                onChange={(v) => setPrivacy((p) => ({ ...p, participateRanking: v }))}
                label={t('settings.participateRanking')}
                desc={t('settings.participateRankingDesc')}
              />
            )}
          </div>
        </Card>
      )}

      {/* ═══════════════════════════════════════
          ОЦЕНКИ (только для преподавателей)
          ═══════════════════════════════════════ */}
      {section === 'ratings' && role === 'teacher' && (
        <div className="space-y-4">
          {/* Главный переключатель — крупный */}
          <Card className={cn(
            'p-6 border-2 transition-colors',
            ratingsEnabled ? 'border-success bg-success-tint' : 'border-border',
          )}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Star size={20} className={ratingsEnabled ? 'text-success' : 'text-text-secondary'} />
                  <h3 className="font-heading text-lg text-accent-blue">
                    {t('settings.ratingsEnabled')}
                  </h3>
                </div>
                <p className="text-sm text-text-secondary mb-3 leading-relaxed">
                  {t('settings.ratingsEnabledDesc')}
                </p>
                {/* Статус */}
                <span className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full',
                  ratingsEnabled
                    ? 'bg-success text-white'
                    : 'bg-border text-text-secondary',
                )}>
                  {ratingsEnabled ? (
                    <><UserCheck size={12} /> {t('settings.ratingsEnabledOn')}</>
                  ) : (
                    <><EyeOff size={12} /> {t('settings.ratingsEnabledOff')}</>
                  )}
                </span>
              </div>
              <button
                onClick={() => handleRatingsToggle(!ratingsEnabled)}
                type="button"
                className="flex-shrink-0 mt-1"
              >
                {ratingsEnabled
                  ? <ToggleRight size={44} className="text-success" />
                  : <ToggleLeft size={44} className="text-text-secondary" />
                }
              </button>
            </div>

            {!ratingsEnabled && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-warning-tint border border-warning/20">
                <AlertTriangle size={15} className="text-warning mt-0.5 flex-shrink-0" />
                <p className="text-xs text-text-secondary leading-relaxed">
                  {t('settings.ratingsWarning')}
                </p>
              </div>
            )}
          </Card>

          {/* Участие в общем рейтинге */}
          <Card className="p-6">
            <h3 className="font-heading text-base text-accent-blue mb-4 flex items-center gap-2">
              <TrendingUp size={18} />
              Видимость в рейтинге
            </h3>
            <div className="divide-y divide-border">
              <Toggle
                enabled={participateOverall}
                onChange={handleParticipateToggle}
                label={t('settings.participateOverall')}
                desc={t('settings.participateOverallDesc')}
              />
            </div>
          </Card>

          {/* Статистика */}
          {teacherData && (
            <Card className="p-6">
              <h3 className="font-heading text-base text-accent-blue mb-4 flex items-center gap-2">
                <TrendingUp size={18} />
                Ваша статистика
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-xl bg-blue-tint">
                  <p className="text-2xl font-bold text-accent-blue">
                    {teacherData.averageRating?.toFixed(1) || '—'}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">Средний балл</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-gold-tint">
                  <p className="text-2xl font-bold text-accent-blue">
                    {teacherData.ratingsCount || 0}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">Всего оценок</p>
                </div>
                <div className="text-center p-4 rounded-xl bg-success-tint">
                  <p className="text-2xl font-bold text-accent-blue">
                    {teacherData.disciplines?.length || 0}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">Дисциплин</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════
          БЕЗОПАСНОСТЬ
          ═══════════════════════════════════════ */}
      {section === 'security' && (
        <div className="space-y-4">
          {/* Текущий аккаунт */}
          <Card className="p-6">
            <h3 className="font-heading text-lg text-accent-blue mb-4 flex items-center gap-2">
              <Shield size={18} />
              {t('settings.security')}
            </h3>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-tint mb-0">
              <Avatar src={userData?.avatarUrl} name={fullName} size="md" />
              <div>
                <p className="text-xs text-text-secondary">{t('settings.loginAs')}</p>
                <p className="font-medium text-text-primary">{fullName || 'Пользователь'}</p>
                <p className="text-sm text-text-secondary">{user?.email}</p>
              </div>
            </div>
          </Card>

          {/* Смена пароля */}
          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-medium text-text-primary flex items-center gap-2 mb-1">
                  <Key size={16} className="text-text-secondary" />
                  {t('settings.changePassword')}
                </h4>
                <p className="text-sm text-text-secondary mb-4">
                  {t('settings.changePasswordDesc')}
                </p>
                {resetSent ? (
                  <div className="flex items-center gap-2 text-success text-sm font-medium">
                    <Check size={16} />
                    {t('settings.resetEmailSent')}
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePasswordReset}
                    disabled={sendingReset}
                  >
                    <Send size={14} />
                    {sendingReset ? 'Отправка...' : t('settings.sendResetEmail')}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* 2FA (заглушка) */}
          <Card className="p-6 opacity-60">
            <div className="flex items-start gap-3">
              <Shield size={20} className="text-text-secondary mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-text-primary mb-1">
                  {t('settings.twoFactor')}
                </h4>
                <p className="text-sm text-text-secondary">{t('settings.twoFactorDesc')}</p>
                <Button variant="secondary" size="sm" disabled className="mt-3">
                  Скоро
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════
          АККАУНТ
          ═══════════════════════════════════════ */}
      {section === 'account' && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="font-heading text-lg text-accent-blue mb-3">
              {t('settings.account')}
            </h3>
            <Button variant="danger" onClick={() => logoutUser()}>
              <LogOut size={16} />
              {t('settings.logoutBtn')}
            </Button>
          </Card>

          <Card className="p-6 border-l-4 border-l-error">
            <h3 className="font-heading text-lg text-error mb-2 flex items-center gap-2">
              <AlertTriangle size={18} />
              {t('settings.dangerZone')}
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              {t('settings.deleteAccountDesc')}
            </p>
            <Button
              variant="danger"
              size="sm"
              onClick={() => toast.error('Функция удаления аккаунта пока недоступна')}
            >
              <Trash2 size={16} />
              {t('settings.deleteAccount')}
            </Button>
          </Card>
        </div>
      )}
    </div>
  )
}
