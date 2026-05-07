import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../services/auth'
import { createUserDocument, createTeacherDocument } from '../services/firestore'
import { GraduationCap, BookOpen, ArrowLeft, ChevronRight, CheckCircle } from 'lucide-react'

const inputClass = "w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-on-surface placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#002366]/20 focus:border-[#002366] transition-all"

const TEACHER_TYPES = [
  { value: 'lecturer',   label: 'Лектор' },
  { value: 'practice',   label: 'Практик' },
  { value: 'seminar',    label: 'Семинарист' },
  { value: 'supervisor', label: 'Научрук' },
  { value: 'universal',  label: 'Универсал' },
]

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep]   = useState('role') // 'role' | 'form'
  const [role, setRole]   = useState(null)   // 'student' | 'teacher'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    firstName:   '',
    lastName:    '',
    middleName:  '',
    email:       '',
    password:    '',
    course:      '1',
    position:    '',
    department:  '',
    teacherType: 'universal',
    about:       '',
  })

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function pickRole(r) {
    setRole(r)
    setStep('form')
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('Пароль должен содержать минимум 6 символов'); return }

    setLoading(true)
    const displayName = `${form.firstName} ${form.lastName}`.trim()
    const { user, error: authErr } = await registerUser(form.email, form.password, displayName)
    if (authErr) { setError(authErr); setLoading(false); return }

    await createUserDocument(user.uid, {
      email:      form.email,
      firstName:  form.firstName,
      lastName:   form.lastName,
      middleName: form.middleName,
      role,
      course: role === 'student' ? Number(form.course) : null,
    })

    if (role === 'teacher') {
      await createTeacherDocument(user.uid, {
        firstName:   form.firstName,
        lastName:    form.lastName,
        middleName:  form.middleName,
        email:       form.email,
        position:    form.position,
        department:  form.department,
        teacherType: form.teacherType,
        about:       form.about,
      })
    }

    setLoading(false)
    navigate(role === 'teacher' ? `/teachers/${user.uid}` : '/')
  }

  return (
    <div className="min-h-screen bg-[#f8f8fa] flex items-center justify-center px-4 pt-16 pb-12">
      <div className="w-full max-w-lg">

        {/* ── STEP 1: Role selection ── */}
        {step === 'role' && (
          <div className="animate-fade-in">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold tracking-[-0.03em] text-[#002366] font-headline">Добро пожаловать</h1>
              <p className="text-slate-500 mt-2">Кто вы в университете?</p>
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
                  className="group relative bg-white rounded-3xl p-8 border-2 border-slate-200 text-left flex flex-col items-start gap-5 overflow-hidden
                    transition-all duration-300 ease-out
                    hover:border-[#002366] hover:bg-[#002366] hover:-translate-y-1.5 hover:shadow-[0_20px_40px_rgba(0,35,102,0.25)]"
                >
                  {/* Dot grid — appears on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.08] transition-opacity duration-300 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle, #ccff00 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

                  {/* Icon */}
                  <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center
                    bg-[#002366] group-hover:bg-[#ccff00]
                    transition-colors duration-300">
                    <Icon size={26} className="text-[#ccff00] group-hover:text-[#002366] transition-colors duration-300" />
                  </div>

                  {/* Text */}
                  <div className="relative flex-1">
                    <h2 className="text-lg font-bold font-headline text-[#002366] group-hover:text-white transition-colors duration-300">
                      {title}
                    </h2>
                    <p className="text-sm text-slate-500 group-hover:text-white/60 mt-1 leading-relaxed transition-colors duration-300">
                      {desc}
                    </p>
                  </div>

                  {/* CTA */}
                  <div className="relative flex items-center gap-1.5 text-sm font-semibold
                    text-[#002366] group-hover:text-[#ccff00]
                    group-hover:gap-3 transition-all duration-300">
                    Выбрать <ChevronRight size={16} />
                  </div>
                </button>
              ))}
            </div>

            <p className="text-center text-sm text-slate-500 mt-8">
              Уже есть аккаунт?{' '}
              <Link to="/login" className="text-[#002366] font-semibold hover:underline">Войти</Link>
            </p>
          </div>
        )}

        {/* ── STEP 2: Form ── */}
        {step === 'form' && (
          <div>
            {/* Back + header */}
            <div className="flex items-center gap-3 mb-8">
              <button
                onClick={() => { setStep('role'); setError('') }}
                className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:border-[#002366] transition-colors"
              >
                <ArrowLeft size={16} className="text-[#002366]" />
              </button>
              <div>
                <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#002366] font-headline">
                  {role === 'student' ? 'Регистрация студента' : 'Регистрация преподавателя'}
                </h1>
                <p className="text-slate-500 text-sm mt-0.5">
                  Уже есть аккаунт?{' '}
                  <Link to="/login" className="text-[#002366] font-semibold hover:underline">Войти</Link>
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8">
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Имя</label>
                    <input type="text" value={form.firstName} onChange={set('firstName')} required placeholder="Иван" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Фамилия</label>
                    <input type="text" value={form.lastName} onChange={set('lastName')} required placeholder="Петров" className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Отчество</label>
                  <input type="text" value={form.middleName} onChange={set('middleName')} placeholder="Сергеевич (необязательно)" className={inputClass} />
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={set('email')} required placeholder="you@university.edu" className={inputClass} />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Пароль</label>
                  <input type="password" value={form.password} onChange={set('password')} required placeholder="Минимум 6 символов" className={inputClass} />
                </div>

                {/* ── Student fields ── */}
                {role === 'student' && (
                  <div className="border-t border-slate-100 pt-4">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Курс</label>
                    <div className="flex gap-2">
                      {['1','2','3','4'].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, course: c }))}
                          className={`flex-1 py-3 text-sm font-bold rounded-xl border-2 transition-all duration-200 ${
                            form.course === c
                              ? 'bg-[#002366] text-white border-[#002366]'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-[#002366]/40'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Teacher fields ── */}
                {role === 'teacher' && (
                  <div className="border-t border-slate-100 pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Должность</label>
                        <input type="text" value={form.position} onChange={set('position')} placeholder="Доцент, профессор..." className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Кафедра</label>
                        <input type="text" value={form.department} onChange={set('department')} placeholder="Кафедра математики..." className={inputClass} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Тип занятий</label>
                      <div className="flex flex-wrap gap-2">
                        {TEACHER_TYPES.map(t => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, teacherType: t.value }))}
                            className={`px-3.5 py-1.5 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${
                              form.teacherType === t.value
                                ? 'bg-[#002366] text-white border-[#002366]'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-[#002366]/40'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">О себе <span className="text-slate-400 normal-case font-normal">(необязательно)</span></label>
                      <textarea
                        value={form.about}
                        onChange={set('about')}
                        rows={3}
                        placeholder="Расскажите студентам о себе, своём опыте и курсах..."
                        className={inputClass + ' resize-none'}
                      />
                    </div>

                    <div className="flex items-start gap-3 p-3.5 bg-[#002366]/5 rounded-xl">
                      <CheckCircle size={16} className="text-[#002366] mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-[#002366]/80 leading-relaxed">
                        После регистрации вы сразу попадёте на свой профиль. Там можно добавить фото и материалы.
                      </p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="px-4 py-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#ccff00] text-[#002366] font-bold rounded-xl hover:brightness-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-2 shadow-[0_4px_20px_rgba(204,255,0,0.35)]"
                >
                  {loading ? 'Создание аккаунта...' : 'Зарегистрироваться'}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
