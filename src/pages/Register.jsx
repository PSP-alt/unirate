import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser, logoutUser } from '../services/auth'
import { createUserDocument, createTeacherDocument, checkStudentIdUnique, CURRENT_DOC_VERSION } from '../services/firestore'
import { useAuth } from '../context/AuthContext'
import { GraduationCap, BookOpen, ArrowLeft, ChevronRight, CheckCircle, AlertCircle, LogIn, CreditCard, UserCheck, LogOut, ShieldCheck, Check } from 'lucide-react'

const inputClass = "w-full px-4 py-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-sepia)] text-[var(--color-ink)] placeholder:text-[var(--color-muted-2)] text-sm focus:outline-none focus:border-[var(--color-rust)] focus:shadow-[0_0_0_3px_rgba(184,74,30,0.15)] transition-all"

const TEACHER_TYPES = [
  { value: 'lecturer',   label: 'Лектор',     desc: 'Провожу лекции' },
  { value: 'practice',   label: 'Практик',    desc: 'Практические занятия' },
  { value: 'seminar',    label: 'Семинарист', desc: 'Семинарские занятия' },
  { value: 'supervisor', label: 'Научрук',    desc: 'Научное руководство' },
]

/* Тип ошибки — чтобы разделять «уже зарег.» от прочих */
const ERR_ALREADY_REGISTERED = 'ALREADY_REGISTERED'
const ERR_STUDENT_ID_TAKEN   = 'STUDENT_ID_TAKEN'

export default function Register() {
  const navigate = useNavigate()
  const { user, userData, loading } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  const [step, setStep]   = useState('role') // 'role' | 'form'
  const [role, setRole]   = useState(null)   // 'student' | 'teacher'
  const [errorType, setErrorType] = useState(null)   // ERR_* | null
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  /* Согласия на обработку ПДн (152-ФЗ) и условия пользования */
  const [consentPrivacy, setConsentPrivacy] = useState(false)
  const [consentTerms,   setConsentTerms]   = useState(false)
  const [consentError,   setConsentError]   = useState(false)

  const [form, setForm] = useState({
    firstName:   '',
    lastName:    '',
    middleName:  '',
    email:       '',
    password:    '',
    course:      '1',
    studentId:   '',
    position:    '',
    department:  '',
    teacherTypes: [],
    about:       '',
  })

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function clearError() {
    setError('')
    setErrorType(null)
    setConsentError(false)
  }

  function pickRole(r) {
    setRole(r)
    setStep('form')
    clearError()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    clearError()

    if (form.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов')
      return
    }

    if (role === 'teacher' && form.teacherTypes.length === 0) {
      setError('Выберите хотя бы один тип занятий')
      return
    }

    /* Согласия — обязательны для регистрации */
    if (!consentPrivacy || !consentTerms) {
      setConsentError(true)
      setError('Для регистрации необходимо принять Политику конфиденциальности и Условия использования')
      return
    }

    /* ── Проверка уникальности студенческого билета ── */
    if (role === 'student') {
      if (!form.studentId.trim()) {
        setError('Введите номер студенческого билета')
        return
      }
      const { taken, error: checkErr } = await checkStudentIdUnique(form.studentId)
      if (checkErr) { setError(checkErr); return }
      if (taken) {
        setErrorType(ERR_STUDENT_ID_TAKEN)
        setError('Аккаунт с таким номером студенческого билета уже существует')
        return
      }
    }

    setSubmitting(true)
    const displayName = `${form.firstName} ${form.lastName}`.trim()
    const { user, error: authErr } = await registerUser(form.email, form.password, displayName)

    if (authErr) {
      setSubmitting(false)
      /* Определяем тип ошибки по тексту (уже переведено в auth.js) */
      if (authErr === 'Этот email уже зарегистрирован') {
        setErrorType(ERR_ALREADY_REGISTERED)
      }
      setError(authErr)
      return
    }

    /* На этом этапе Auth-аккаунт уже создан. Если Firestore-запись
       упадёт, у нас будет «полу-аккаунт»: Auth есть, документа нет.
       Решение — попытаться удалить только что созданный Auth-аккаунт,
       чтобы пользователь мог попробовать ещё раз с тем же email. */
    const acceptedAt = new Date().toISOString()
    const { error: userDocErr } = await createUserDocument(user.uid, {
      email:      form.email,
      firstName:  form.firstName,
      lastName:   form.lastName,
      middleName: form.middleName,
      role,
      course:     role === 'student' ? Number(form.course) : null,
      studentId:  role === 'student' ? form.studentId.trim() : null,
      consents: {
        privacy: { accepted: true, version: CURRENT_DOC_VERSION, acceptedAt },
        terms:   { accepted: true, version: CURRENT_DOC_VERSION, acceptedAt },
      },
    })

    if (userDocErr) {
      /* Rollback: удаляем Auth-аккаунт (только что созданный, поэтому
         freshly-authenticated и нам разрешено его удалять). */
      try { await user.delete() } catch (e) { console.error('[register-rollback]', e) }
      setSubmitting(false)
      setError('Не удалось завершить регистрацию. Попробуйте ещё раз.')
      return
    }

    if (role === 'teacher') {
      const { error: teacherDocErr } = await createTeacherDocument(user.uid, {
        firstName:   form.firstName,
        lastName:    form.lastName,
        middleName:  form.middleName,
        email:       form.email,
        position:    form.position,
        department:  form.department,
        teacherTypes: form.teacherTypes,
        about:       form.about,
      })
      if (teacherDocErr) {
        /* Профиль преподавателя не создался, но user-doc уже есть.
           Не делаем destructive rollback — пользователь сможет
           заполнить профиль вручную из настроек. Покажем уведомление. */
        console.error('[register] teacher-doc create failed:', teacherDocErr)
      }
    }

    setSubmitting(false)
    navigate(role === 'teacher' ? `/teachers/${user.uid}` : '/')
  }

  /* ── Уже авторизован — показываем заглушку ── */
  if (!loading && user) {
    const displayName = userData
      ? [userData.firstName, userData.lastName].filter(Boolean).join(' ') || user.email
      : user.email
    const profileLink = userData?.role === 'teacher' ? `/teachers/${user.uid}` : '/profile'

    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--color-rust-wash)] border-2 border-[var(--color-rust)]/20 flex items-center justify-center mx-auto mb-5">
            <UserCheck size={28} className="text-[var(--color-rust)]" />
          </div>

          <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--color-ink)] font-headline mb-1">
            Вы уже зарегистрированы
          </h1>
          <p className="text-sm text-[var(--color-muted)] mb-6 leading-relaxed">
            Вы вошли как <span className="font-semibold text-[var(--color-ink)]">{displayName}</span>.
            Создать второй аккаунт нельзя — сначала выйдите из текущего.
          </p>

          <div className="flex flex-col gap-3">
            <Link
              to={profileLink}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--color-rust)] text-[#FFFDF7] font-semibold text-sm hover:brightness-95 transition-all shadow-[0_4px_20px_rgba(184,74,30,0.25)]"
            >
              <UserCheck size={16} />
              Перейти в профиль
            </Link>
            <button
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true)
                await logoutUser()
                setLoggingOut(false)
              }}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--color-sepia)] bg-[var(--color-paper)] text-[var(--color-ink-2)] font-semibold text-sm hover:border-[var(--color-rust)]/40 hover:bg-[var(--color-rust-wash)] transition-all disabled:opacity-50"
            >
              <LogOut size={16} />
              {loggingOut ? 'Выход...' : 'Выйти и зарегистрировать другой аккаунт'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center px-4 pt-16 pb-12">
      <div className="w-full max-w-lg">

        {/* ── STEP 1: Role selection ── */}
        {step === 'role' && (
          <div className="animate-fade-in">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold tracking-[-0.03em] text-[var(--color-ink)] font-headline">
                Добро пожаловать
              </h1>
              <p className="text-[var(--color-muted)] mt-2">Кто вы в университете?</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  r: 'student',
                  Icon: GraduationCap,
                  title: 'Студент',
                  desc: 'Оценивайте преподавателей и скачивайте учебные материалы',
                },
                {
                  r: 'teacher',
                  Icon: BookOpen,
                  title: 'Преподаватель',
                  desc: 'Создайте профиль и делитесь учебными материалами со студентами',
                },
              ].map(({ r, Icon, title, desc }) => (
                <button
                  key={r}
                  onClick={() => pickRole(r)}
                  className="group relative bg-[var(--color-paper)] rounded-3xl p-8 border-2 border-[var(--color-sepia)] text-left flex flex-col items-start gap-5 overflow-hidden
                    transition-all duration-300 ease-out
                    hover:border-[var(--color-rust)] hover:bg-[var(--color-rust)] hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(184,74,30,0.25)]"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.12] transition-opacity duration-300 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle, #FFFDF7 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

                  <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center
                    bg-[var(--color-rust-wash)] group-hover:bg-[#FFFDF7]/15
                    transition-colors duration-300">
                    <Icon size={26} className="text-[var(--color-rust)] group-hover:text-[#FFFDF7] transition-colors duration-300" />
                  </div>

                  <div className="relative flex-1">
                    <h2 className="text-lg font-bold font-headline text-[var(--color-ink)] group-hover:text-[#FFFDF7] transition-colors duration-300">
                      {title}
                    </h2>
                    <p className="text-sm text-[var(--color-muted)] group-hover:text-[#FFFDF7]/75 mt-1 leading-relaxed transition-colors duration-300">
                      {desc}
                    </p>
                  </div>

                  <div className="relative flex items-center gap-1.5 text-sm font-semibold
                    text-[var(--color-rust)] group-hover:text-[#FFFDF7]
                    group-hover:gap-3 transition-all duration-300">
                    Выбрать <ChevronRight size={16} />
                  </div>
                </button>
              ))}
            </div>

            <p className="text-center text-sm text-[var(--color-muted)] mt-8">
              Уже есть аккаунт?{' '}
              <Link to="/login" className="text-[var(--color-rust)] font-semibold hover:underline">Войти</Link>
            </p>
          </div>
        )}

        {/* ── STEP 2: Form ── */}
        {step === 'form' && (
          <div>
            {/* Back + header */}
            <div className="flex items-center gap-3 mb-8">
              <button
                onClick={() => { setStep('role'); clearError() }}
                className="w-9 h-9 rounded-xl bg-[var(--color-paper)] border border-[var(--color-sepia)] flex items-center justify-center hover:border-[var(--color-rust)] hover:bg-[var(--color-rust-wash)] transition-colors"
              >
                <ArrowLeft size={16} className="text-[var(--color-rust)]" />
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--color-ink)] font-headline">
                  {role === 'student' ? 'Регистрация студента' : 'Регистрация преподавателя'}
                </h1>
                <p className="text-[var(--color-muted)] text-sm mt-0.5">
                  Уже есть аккаунт?{' '}
                  <Link to="/login" className="text-[var(--color-rust)] font-semibold hover:underline">Войти</Link>
                </p>
              </div>
            </div>

            <div className="bg-[var(--color-paper)] rounded-3xl shadow-sm border border-[var(--color-sepia)] p-8">
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-1.5">Имя</label>
                    <input type="text" value={form.firstName} onChange={set('firstName')} required placeholder="Иван" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-1.5">Фамилия</label>
                    <input type="text" value={form.lastName} onChange={set('lastName')} required placeholder="Петров" className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-1.5">Отчество</label>
                  <input type="text" value={form.middleName} onChange={set('middleName')} placeholder="Сергеевич (необязательно)" className={inputClass} />
                </div>

                <div className="border-t border-[var(--color-sepia)] pt-4">
                  <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-1.5">Email</label>
                  <input
                    type="email" value={form.email}
                    onChange={e => { clearError(); set('email')(e) }}
                    required placeholder="you@university.edu" className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-1.5">Пароль</label>
                  <input type="password" value={form.password} onChange={set('password')} required placeholder="Минимум 6 символов" className={inputClass} />
                </div>

                {/* ── Student fields ── */}
                {role === 'student' && (
                  <div className="border-t border-[var(--color-sepia)] pt-4 space-y-4">

                    {/* Номер студенческого билета */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-1.5">
                        Номер студенческого билета
                      </label>
                      <div className="relative">
                        <CreditCard size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
                        <input
                          type="text"
                          value={form.studentId}
                          onChange={e => { clearError(); set('studentId')(e) }}
                          required
                          placeholder="Например: 221-12345"
                          className={inputClass + ' pl-10'}
                        />
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)] mt-1.5 leading-relaxed">
                        Используется для верификации и защиты от дублирующих аккаунтов. Администрация университета может проверить ваш билет.
                      </p>
                    </div>

                    {/* Курс */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-2">Курс</label>
                      <div className="flex gap-2">
                        {['1','2','3','4'].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, course: c }))}
                            className={`flex-1 py-3 text-sm font-bold rounded-xl border-2 transition-all duration-200 ${
                              form.course === c
                                ? 'bg-[var(--color-rust)] text-[#FFFDF7] border-[var(--color-rust)]'
                                : 'bg-[var(--color-paper)] border-[var(--color-sepia)] text-[var(--color-muted)] hover:border-[var(--color-rust)]/40 hover:text-[var(--color-rust)]'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Teacher fields ── */}
                {role === 'teacher' && (
                  <div className="border-t border-[var(--color-sepia)] pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-1.5">Должность</label>
                        <input type="text" value={form.position} onChange={set('position')} placeholder="Доцент, профессор..." className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-1.5">Кафедра</label>
                        <input type="text" value={form.department} onChange={set('department')} placeholder="Кафедра математики..." className={inputClass} />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide">
                          Тип занятий
                        </label>
                        <span className="text-[11px] text-[var(--color-muted)]">
                          {form.teacherTypes.length === 0
                            ? 'выберите один или несколько'
                            : `выбрано: ${form.teacherTypes.length}`}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {TEACHER_TYPES.map(t => {
                          const active = form.teacherTypes.includes(t.value)
                          return (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() =>
                                setForm(f => ({
                                  ...f,
                                  teacherTypes: active
                                    ? f.teacherTypes.filter(v => v !== t.value)
                                    : [...f.teacherTypes, t.value],
                                }))
                              }
                              className={`relative flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl border-2 text-left transition-all duration-200 ${
                                active
                                  ? 'bg-[var(--color-rust)] text-[#FFFDF7] border-[var(--color-rust)] shadow-[0_4px_16px_rgba(184,74,30,0.25)]'
                                  : 'bg-[var(--color-paper)] border-[var(--color-sepia)] text-[var(--color-muted)] hover:border-[var(--color-rust)]/40 hover:text-[var(--color-rust)]'
                              }`}
                            >
                              {active && (
                                <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#FFFDF7]/25 flex items-center justify-center">
                                  <CheckCircle size={10} className="text-[#FFFDF7]" />
                                </span>
                              )}
                              <span className="text-sm font-semibold leading-none">{t.label}</span>
                              <span className={`text-[11px] leading-relaxed mt-0.5 ${active ? 'text-[#FFFDF7]/70' : ''}`}>
                                {t.desc}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-1.5">
                        О себе <span className="text-[var(--color-muted-2)] normal-case font-normal">(необязательно)</span>
                      </label>
                      <textarea
                        value={form.about}
                        onChange={set('about')}
                        rows={3}
                        placeholder="Расскажите студентам о себе, своём опыте и курсах..."
                        className={inputClass + ' resize-none'}
                      />
                    </div>

                    <div className="flex items-start gap-3 p-3.5 bg-[var(--color-rust-wash)] border border-[var(--color-rust)]/20 rounded-xl">
                      <CheckCircle size={16} className="text-[var(--color-rust)] mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-[var(--color-ink-2)] leading-relaxed">
                        После регистрации вы сразу попадёте на свой профиль. Там можно добавить фото и материалы.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Согласия с документами ── */}
                <div className={`border-t pt-4 ${consentError ? 'border-[var(--color-danger)]/40' : 'border-[var(--color-sepia)]'}`}>
                  <div
                    className={`rounded-2xl border p-4 space-y-2.5 transition-colors ${
                      consentError
                        ? 'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5'
                        : (consentPrivacy && consentTerms)
                          ? 'border-[var(--color-rust)]/25 bg-[var(--color-rust-wash)]/40'
                          : 'border-[var(--color-sepia)] bg-[var(--color-paper)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck size={15} className="text-[var(--color-rust)]" />
                      <p className="text-[11px] tracking-[0.16em] uppercase font-semibold text-[var(--color-ink-2)]">
                        Согласия (152-ФЗ)
                      </p>
                    </div>

                    <ConsentCheckbox
                      checked={consentPrivacy}
                      onChange={v => { setConsentPrivacy(v); if (v && consentTerms) setConsentError(false) }}
                      error={consentError && !consentPrivacy}
                    >
                      Я ознакомился(-ась) и принимаю{' '}
                      <Link
                        to="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-rust)] font-semibold hover:underline"
                      >
                        Политику конфиденциальности
                      </Link>{' '}
                      и даю согласие на обработку моих персональных данных в указанных в ней целях.
                    </ConsentCheckbox>

                    <ConsentCheckbox
                      checked={consentTerms}
                      onChange={v => { setConsentTerms(v); if (v && consentPrivacy) setConsentError(false) }}
                      error={consentError && !consentTerms}
                    >
                      Я принимаю{' '}
                      <Link
                        to="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-rust)] font-semibold hover:underline"
                      >
                        Условия использования
                      </Link>{' '}
                      платформы Unirate (публичную оферту).
                    </ConsentCheckbox>

                    {consentError && (
                      <p className="text-[11px] text-[var(--color-danger)] font-medium pt-1 flex items-start gap-1.5">
                        <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                        Без принятия обоих документов регистрация невозможна (ст. 9 152-ФЗ).
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Блок ошибок ── */}
                {error && (
                  errorType === ERR_ALREADY_REGISTERED ? (
                    /* Особый блок: уже зарегистрирован */
                    <div className="rounded-2xl border border-[var(--color-rust)]/30 bg-[var(--color-rust-wash)] p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle size={18} className="text-[var(--color-rust)] mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--color-rust)]">
                            Этот email уже зарегистрирован
                          </p>
                          <p className="text-xs text-[var(--color-ink-2)] mt-0.5 leading-relaxed">
                            Аккаунт с таким адресом уже существует. Войдите или восстановите пароль, если забыли его.
                          </p>
                        </div>
                      </div>
                      <Link
                        to="/login"
                        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[var(--color-rust)] text-[#FFFDF7] text-sm font-semibold hover:brightness-95 transition-all"
                      >
                        <LogIn size={15} />
                        Войти в аккаунт
                      </Link>
                    </div>
                  ) : errorType === ERR_STUDENT_ID_TAKEN ? (
                    /* Особый блок: дубль студенческого билета */
                    <div className="rounded-2xl border border-[var(--color-danger)]/25 bg-[var(--color-danger)]/8 p-4">
                      <div className="flex items-start gap-3">
                        <CreditCard size={18} className="text-[var(--color-danger)] mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--color-danger)]">
                            Этот студенческий билет уже используется
                          </p>
                          <p className="text-xs text-[var(--color-ink-2)] mt-0.5 leading-relaxed">
                            Аккаунт с таким номером уже зарегистрирован. Если вы считаете это ошибкой — обратитесь к администратору.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Обычная ошибка */
                    <div className="flex items-center gap-2.5 px-4 py-3 bg-[var(--color-danger)]/8 text-[var(--color-danger)] rounded-xl text-sm border border-[var(--color-danger)]/20">
                      <AlertCircle size={16} className="flex-shrink-0" />
                      {error}
                    </div>
                  )
                )}

                <button
                  type="submit"
                  disabled={submitting || !consentPrivacy || !consentTerms}
                  className="w-full py-3.5 bg-[var(--color-rust)] text-[#FFFDF7] font-bold rounded-xl hover:brightness-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-2 shadow-[0_4px_20px_rgba(184,74,30,0.25)]"
                  title={(!consentPrivacy || !consentTerms) ? 'Необходимо принять Политику конфиденциальности и Условия использования' : undefined}
                >
                  {submitting
                    ? 'Создание аккаунта...'
                    : (!consentPrivacy || !consentTerms)
                      ? 'Примите согласия для регистрации'
                      : 'Зарегистрироваться'}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

/* ══════════════ ChECKBOX «СОГЛАСЕН» ══════════════ */
function ConsentCheckbox({ checked, onChange, error, children }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none group">
      <span
        className={`mt-0.5 w-[18px] h-[18px] rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
          checked
            ? 'bg-[var(--color-rust)] border-[var(--color-rust)]'
            : error
              ? 'bg-[var(--color-paper)] border-[var(--color-danger)]/60 group-hover:border-[var(--color-danger)]'
              : 'bg-[var(--color-paper)] border-[var(--color-sepia)] group-hover:border-[var(--color-rust)]/50'
        }`}
      >
        {checked && <Check size={12} strokeWidth={3} className="text-[#FFFDF7]" />}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className={`text-[12.5px] leading-relaxed ${error ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink-2)]'}`}>
        {children}
      </span>
    </label>
  )
}
