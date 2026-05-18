import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginUser } from '../services/auth'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'

/* ⚠ Тестовые аккаунты доступны ТОЛЬКО в dev-сборке.
   В production показывать их недопустимо: enumerate валидных
   admin-эмейлов + автозаполнение известного пароля = takeover. */
const IS_DEV = import.meta.env.DEV
const TEST_ACCOUNTS = IS_DEV
  ? [
      { label: 'Администратор',                    email: 'admin@test.com',             role: 'admin'   },
      { label: 'Студент — Анна Смирнова',         email: 'anna.smirnova@student.edu',  role: 'student' },
      { label: 'Студент — Иван Петров',            email: 'ivan.petrov@student.edu',    role: 'student' },
      { label: 'Студент — Ольга Козлова',          email: 'olga.kozlova@student.edu',   role: 'student' },
      { label: 'Преподаватель — Соколов А.Н.',     email: 'a.sokolov@university.edu',   role: 'teacher' },
      { label: 'Преподаватель — Сорокина Н.В.',    email: 'n.sorokina@university.edu',  role: 'teacher' },
      { label: 'Преподаватель — Морозов Д.С.',     email: 'd.morozov@university.edu',   role: 'teacher' },
    ]
  : []

export default function Login() {
  const navigate = useNavigate()
  const { user, userData } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showTests, setShowTests] = useState(false)

  /* Редирект если уже авторизован */
  useEffect(() => {
    if (user) {
      const dest = userData?.role === 'teacher' ? `/teachers/${user.uid}` : '/'
      navigate(dest, { replace: true })
    }
  }, [user, userData, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await loginUser(email, password)
    setLoading(false)
    if (err) { setError(err); return }
    navigate('/')
  }

  function fillAccount(acc) {
    setEmail(acc.email)
    setPassword('123456')
    setError('')
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center px-4 pt-16 pb-12">
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-[var(--color-paper)] rounded-2xl sm:rounded-3xl shadow-sm border border-[var(--color-sepia)] p-5 sm:p-8">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--color-ink)] font-headline">Вход в аккаунт</h1>
            <p className="text-[var(--color-muted)] text-sm mt-1">
              Нет аккаунта?{' '}
              <Link to="/register" className="text-[var(--color-rust)] font-semibold hover:underline">
                Зарегистрироваться
              </Link>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@university.edu"
                className="w-full px-4 py-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-sepia)] text-[var(--color-ink)] placeholder:text-[var(--color-muted-2)] text-sm focus:outline-none focus:border-[var(--color-rust)] focus:shadow-[0_0_0_3px_rgba(184,74,30,0.15)] transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-1.5">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-[var(--color-paper)] border border-[var(--color-sepia)] text-[var(--color-ink)] placeholder:text-[var(--color-muted-2)] text-sm focus:outline-none focus:border-[var(--color-rust)] focus:shadow-[0_0_0_3px_rgba(184,74,30,0.15)] transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/20 rounded-xl text-sm">
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[var(--color-rust)] text-[#FFFDF7] font-bold rounded-xl hover:brightness-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-2 shadow-[0_4px_20px_rgba(184,74,30,0.25)]"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          {/* Test accounts — только в dev-сборке */}
          {IS_DEV && TEST_ACCOUNTS.length > 0 && <div className="mt-6">
            <button
              onClick={() => setShowTests(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-rust)] transition-colors w-full"
            >
              {showTests ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Тестовые аккаунты (пароль: 123456)
            </button>

            {showTests && (
              <div className="mt-3 space-y-1.5">
                {TEST_ACCOUNTS.map(acc => (
                  <button
                    key={acc.email}
                    onClick={() => fillAccount(acc)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[var(--color-paper-2)] hover:bg-[var(--color-rust-wash)] text-left transition-colors group border border-[var(--color-sepia)]"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-rust)] transition-colors">{acc.label}</p>
                      <p className="text-[11px] text-[var(--color-muted)] mt-0.5">{acc.email}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      acc.role === 'admin'
                        ? 'bg-[var(--color-rust)] text-[#FFFDF7] border-[var(--color-rust)]'
                        : acc.role === 'teacher'
                          ? 'bg-[var(--color-sage)]/15 text-[var(--color-sage)] border-[var(--color-sage)]/30'
                          : 'bg-[var(--color-ok)]/10 text-[var(--color-ok)] border-[var(--color-ok)]/30'
                    }`}>
                      {acc.role === 'admin' ? 'Админ' : acc.role === 'teacher' ? 'Преп.' : 'Студент'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>}

        </div>

        {/* Back home */}
        <div className="text-center mt-6">
          <Link to="/" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-rust)] transition-colors flex items-center justify-center gap-1.5">
            <ArrowLeft size={13} />
            На главную
          </Link>
        </div>

      </div>
    </div>
  )
}
