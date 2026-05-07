import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginUser } from '../services/auth'

const TEST_ACCOUNTS = [
  { label: 'Студент — Анна Смирнова',         email: 'anna.smirnova@student.edu',  role: 'student' },
  { label: 'Студент — Иван Петров',            email: 'ivan.petrov@student.edu',    role: 'student' },
  { label: 'Студент — Ольга Козлова',          email: 'olga.kozlova@student.edu',   role: 'student' },
  { label: 'Студент — Максим Волков',          email: 'maxim.volkov@student.edu',   role: 'student' },
  { label: 'Преподаватель — Соколов А.Н.',     email: 'a.sokolov@university.edu',   role: 'teacher' },
  { label: 'Преподаватель — Сорокина Н.В.',    email: 'n.sorokina@university.edu',  role: 'teacher' },
  { label: 'Преподаватель — Морозов Д.С.',     email: 'd.morozov@university.edu',   role: 'teacher' },
]

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showTests, setShowTests] = useState(false)

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
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 pt-16">
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-3xl shadow-sm border border-slate-200/60 p-8">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-on-surface">Вход в аккаунт</h1>
            <p className="text-on-surface-variant text-sm mt-1">
              Нет аккаунта?{' '}
              <Link to="/register" className="text-primary font-medium hover:underline">
                Зарегистрироваться
              </Link>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@university.edu"
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-slate-200/80 text-on-surface placeholder:text-on-surface-variant/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface mb-1.5">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-slate-200/80 text-on-surface placeholder:text-on-surface-variant/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl text-sm">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-secondary text-on-secondary font-semibold rounded-xl hover:brightness-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm mt-2 shadow-lime"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          {/* Test accounts */}
          <div className="mt-6">
            <button
              onClick={() => setShowTests(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-on-surface-variant hover:text-primary transition-colors w-full"
            >
              <span className="material-symbols-outlined text-[16px]">
                {showTests ? 'expand_less' : 'expand_more'}
              </span>
              Тестовые аккаунты (пароль: 123456)
            </button>

            {showTests && (
              <div className="mt-3 space-y-1.5">
                {TEST_ACCOUNTS.map(acc => (
                  <button
                    key={acc.email}
                    onClick={() => fillAccount(acc)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-left transition-colors group"
                  >
                    <div>
                      <p className="text-xs font-medium text-on-surface group-hover:text-primary transition-colors">{acc.label}</p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">{acc.email}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      acc.role === 'teacher'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {acc.role === 'teacher' ? 'Преп.' : 'Студент'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Back home */}
        <div className="text-center mt-6">
          <Link to="/" className="text-xs text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-[15px]">arrow_back</span>
            На главную
          </Link>
        </div>

      </div>
    </div>
  )
}
