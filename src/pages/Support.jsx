/* ═══════════════════════════════════════════════════
   Страница обращений в поддержку — /support

   Авторизованный пользователь может отправить:
   — Жалобу (complaint)
   — Предложение (suggestion)

   Ниже формы отображается история своих обращений.
   ═══════════════════════════════════════════════════ */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  MessageSquarePlus, AlertCircle, Lightbulb, Send, Clock,
  CheckCircle, Eye, ChevronDown, ArrowRight, Shield,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { submitSupportMessage, getMySupportMessages } from '../services/support'

const TYPE_META = {
  complaint:  { label: 'Жалоба',       icon: AlertCircle, desc: 'Проблема, нарушение, некорректные данные' },
  suggestion: { label: 'Предложение',  icon: Lightbulb,   desc: 'Идея, улучшение, пожелание' },
}

const STATUS_MAP = {
  new:      { label: 'Новое',       cls: 'bg-[var(--color-warn)]/12 text-[var(--color-warn)]',   icon: Clock       },
  read:     { label: 'Прочитано',   cls: 'bg-[var(--color-rust-wash)] text-[var(--color-rust)]', icon: Eye         },
  resolved: { label: 'Решено',      cls: 'bg-[var(--color-ok)]/12 text-[var(--color-ok)]',      icon: CheckCircle },
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Support() {
  const { user, userData } = useAuth()

  /* Form state */
  const [type, setType]           = useState('complaint')
  const [subject, setSubject]     = useState('')
  const [message, setMessage]     = useState('')
  const [sending, setSending]     = useState(false)

  /* History */
  const [history, setHistory]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getMySupportMessages(user.uid).then(res => {
      setHistory(res.messages)
      setLoading(false)
    })
  }, [user])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) { toast.error('Войдите в аккаунт'); return }
    if (!subject.trim()) { toast.error('Укажите тему'); return }
    if (!message.trim()) { toast.error('Напишите сообщение'); return }
    if (message.trim().length > 5000) { toast.error('Сообщение слишком длинное (макс. 5000 символов)'); return }

    setSending(true)
    const { id, error } = await submitSupportMessage(
      type,
      subject,
      message,
      { uid: user.uid, email: user.email, firstName: userData?.firstName, lastName: userData?.lastName },
    )
    setSending(false)

    if (error) { toast.error(error); return }

    toast.success('Обращение отправлено!')
    setSubject('')
    setMessage('')

    /* Добавляем в историю без перезагрузки */
    setHistory(prev => [{
      id,
      type,
      subject: subject.trim(),
      message: message.trim(),
      status: 'new',
      adminResponse: '',
      createdAt: { seconds: Math.floor(Date.now() / 1000) },
    }, ...prev])
  }

  /* ── Неавторизованный пользователь ── */
  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] pt-20 pb-16">
        <div className="max-w-lg mx-auto px-6 pt-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-rust-wash)] flex items-center justify-center mx-auto mb-6">
            <Shield size={28} className="text-[var(--color-rust)]" />
          </div>
          <h1 className="font-display italic text-[32px] text-[var(--color-ink)] mb-3">Нужна авторизация</h1>
          <p className="text-[var(--color-muted)] mb-8">Войдите в аккаунт, чтобы отправить обращение в поддержку.</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-rust)] text-[#FFFDF7] font-semibold rounded-full hover:brightness-95 transition-all"
          >
            Войти <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)] pt-20 pb-16">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden border-b border-[var(--color-sepia)]">
        <div className="absolute -top-20 -right-20 w-[28rem] h-[28rem] rounded-full bg-[var(--color-rust)]/8 blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-6 md:px-12 py-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--color-sepia)] bg-[var(--color-paper)] mb-4">
            <MessageSquarePlus size={12} className="text-[var(--color-rust)]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--color-muted)]">
              Обратная связь
            </span>
          </div>
          <h1 className="font-display italic text-[44px] md:text-[52px] leading-[1.0] tracking-[-0.02em] text-[var(--color-ink)]">
            Поддержка
          </h1>
          <p className="mt-3 text-[14px] text-[var(--color-muted)] max-w-md leading-relaxed">
            Расскажите о проблеме или предложите улучшение.
            Каждое обращение рассматривается модератором.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 md:px-12 mt-8 space-y-10">

        {/* ═══ ФОРМА ═══ */}
        <form onSubmit={handleSubmit} className="bg-[var(--color-paper)] rounded-2xl border border-[var(--color-sepia)] overflow-hidden">

          {/* Тип обращения */}
          <div className="px-6 pt-6 pb-4">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[var(--color-muted)] mb-3">Тип обращения</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(TYPE_META).map(([key, meta]) => {
                const active = type === key
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setType(key)}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      active
                        ? 'border-[var(--color-rust)] bg-[var(--color-rust-wash)]'
                        : 'border-[var(--color-sepia)] hover:border-[var(--color-rust)]/30 hover:bg-[var(--color-paper-2)]/30'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      active ? 'bg-[var(--color-rust)] text-[#FFFDF7]' : 'bg-[var(--color-paper-2)] text-[var(--color-muted)]'
                    }`}>
                      <meta.icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${active ? 'text-[var(--color-ink)]' : 'text-[var(--color-muted)]'}`}>
                        {meta.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-muted)] mt-0.5 leading-snug">{meta.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Тема */}
          <div className="px-6 pb-4">
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-1.5">
              Тема <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              maxLength={200}
              placeholder={type === 'complaint' ? 'Кратко опишите проблему...' : 'О чём ваше предложение...'}
              className="w-full px-4 py-3 bg-[var(--color-paper-2)]/50 border border-[var(--color-sepia)] rounded-xl text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-rust)] focus:shadow-[0_0_0_3px_rgba(184,74,30,0.12)] transition-all"
            />
            <p className="text-[10px] text-[var(--color-muted-2)] mt-1 text-right">{subject.length}/200</p>
          </div>

          {/* Сообщение */}
          <div className="px-6 pb-4">
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-1.5">
              Сообщение <span className="text-[var(--color-danger)]">*</span>
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={5000}
              rows={5}
              placeholder="Подробно опишите ситуацию или идею..."
              className="w-full px-4 py-3 bg-[var(--color-paper-2)]/50 border border-[var(--color-sepia)] rounded-xl text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-rust)] focus:shadow-[0_0_0_3px_rgba(184,74,30,0.12)] resize-none transition-all"
            />
            <p className="text-[10px] text-[var(--color-muted-2)] mt-1 text-right">{message.length}/5000</p>
          </div>

          {/* Отправляющий */}
          <div className="px-6 pb-4">
            <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
              Обращение будет отправлено от имени <strong className="text-[var(--color-ink)]">{userData?.firstName} {userData?.lastName}</strong> ({user.email})
            </p>
          </div>

          {/* Кнопка */}
          <div className="px-6 pb-6">
            <button
              type="submit"
              disabled={sending || !subject.trim() || !message.trim()}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-[var(--color-rust)] text-[#FFFDF7] font-bold text-sm rounded-xl hover:brightness-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
              {sending ? 'Отправляем...' : 'Отправить обращение'}
            </button>
          </div>
        </form>

        {/* ═══ ИСТОРИЯ ОБРАЩЕНИЙ ═══ */}
        <div>
          <h2 className="font-display italic text-[22px] text-[var(--color-ink)] mb-4 flex items-center gap-3">
            <Clock size={18} className="text-[var(--color-rust)]" />
            Мои обращения
          </h2>

          {loading ? (
            <div className="bg-[var(--color-paper)] rounded-2xl border border-[var(--color-sepia)] p-10 text-center">
              <p className="text-sm text-[var(--color-muted)] animate-pulse">Загрузка...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="bg-[var(--color-paper)] rounded-2xl border border-[var(--color-sepia)] p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-paper-2)] flex items-center justify-center mx-auto mb-3">
                <MessageSquarePlus size={20} className="text-[var(--color-muted-2)]" />
              </div>
              <p className="text-sm text-[var(--color-muted)]">Пока нет обращений</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(msg => {
                const meta = TYPE_META[msg.type] || TYPE_META.complaint
                const st = STATUS_MAP[msg.status] || STATUS_MAP.new
                const expanded = expandedId === msg.id
                const StIcon = st.icon

                return (
                  <div key={msg.id} className="bg-[var(--color-paper)] rounded-2xl border border-[var(--color-sepia)] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : msg.id)}
                      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[var(--color-paper-2)]/30 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-rust-wash)] flex items-center justify-center flex-shrink-0">
                        <meta.icon size={15} className="text-[var(--color-rust)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-ink)] truncate">{msg.subject}</p>
                        <p className="text-[11px] text-[var(--color-muted)] mt-0.5">{formatDate(msg.createdAt)}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${st.cls}`}>
                        <StIcon size={10} />
                        {st.label}
                      </span>
                      <ChevronDown size={14} className={`text-[var(--color-muted)] transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
                    </button>

                    {expanded && (
                      <div className="px-5 pb-5 border-t border-[var(--color-sepia)] pt-4 space-y-3">
                        <div>
                          <p className="text-[11px] font-semibold text-[var(--color-muted)] mb-1">Ваше сообщение</p>
                          <p className="text-sm text-[var(--color-ink)] bg-[var(--color-paper-2)]/50 rounded-xl px-4 py-3 whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                        </div>
                        {msg.adminResponse && (
                          <div>
                            <p className="text-[11px] font-semibold text-[var(--color-ok)] mb-1">Ответ модератора</p>
                            <p className="text-sm text-[var(--color-ink)] bg-[var(--color-ok)]/8 rounded-xl px-4 py-3 whitespace-pre-wrap leading-relaxed">{msg.adminResponse}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
