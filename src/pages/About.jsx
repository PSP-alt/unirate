import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Mail,
  Send,
  UserPlus,
  Star,
  Download,
  CheckCircle2,
  MessageCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Loader2,
} from 'lucide-react'
import { collection, getCountFromServer, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'

/* ════════════════════════════════════════════════════════════
   ДАННЫЕ
════════════════════════════════════════════════════════════ */

const TEAM = [
  {
    initials: 'ИХ',
    name:     'Илья Хануков',
    role:     'Основатель · Full-stack · Дизайн',
    faculty:  'СПбГУПТД, 1 курс',
    desc:     'Придумал, спроектировал и собрал платформу с нуля — от базы данных до интерфейса. Один за всех и все задачи сам.',
    from: '#D16A3D',
    to:   '#8B3A1A',
    tg:   'unirate_spb',
  },
  {
    initials: 'ИИ',
    name:     'Нейросеть',
    role:     'Код · Дизайн · Тексты · Архитектура',
    faculty:  'Anthropic · Claude',
    desc:     'Помогает с кодом, интерфейсом, копирайтингом и архитектурными решениями. Не устаёт, не просит зарплату, работает без кофе.',
    from: '#3A5AA0',
    to:   '#1A2A5A',
    tg:   null,
  },
]

const STEPS = [
  {
    num:   '01',
    Icon:  UserPlus,
    title: 'Зарегистрируйтесь',
    desc:  'Только университетская почта — никаких соцсетей и утечек. Занимает меньше минуты, полностью бесплатно.',
  },
  {
    num:   '02',
    Icon:  Star,
    title: 'Оставьте честный отзыв',
    desc:  'Пять критериев вместо одной звезды. Плюсы и минусы — отдельно. Каждый отзыв проходит ручную модерацию.',
  },
  {
    num:   '03',
    Icon:  Download,
    title: 'Делитесь материалами',
    desc:  'Загружайте конспекты, методички и записи лекций. Скачивайте то, чем поделились другие студенты и преподаватели.',
  },
]

const VALUES = [
  'Честность и прозрачность оценок',
  'Анонимность и защита данных студентов',
  'Открытый доступ к учебным материалам',
  'Уважение к преподавателям и академической среде',
]

const STAT_DEFS = [
  { key: 'teachers',  label: 'Преподавателей', sub: 'в базе платформы'    },
  { key: 'ratings',   label: 'Отзывов',        sub: 'от студентов'        },
  { key: 'materials', label: 'Материалов',     sub: 'доступно бесплатно'  },
]

const HELP_OPTIONS = [
  { v: 'dev',     l: 'Разработка (Frontend / Backend)' },
  { v: 'design',  l: 'Дизайн / UI' },
  { v: 'content', l: 'Контент и тексты' },
  { v: 'testing', l: 'Тестирование и баги' },
  { v: 'idea',    l: 'Есть идея для платформы' },
  { v: 'other',   l: 'Другое' },
]

/* ── Форма «Хочешь помочь?» ── */
function JoinForm() {
  const [open,       setOpen]       = useState(false)
  const [name,       setName]       = useState('')
  const [contact,    setContact]    = useState('')
  const [helpType,   setHelpType]   = useState('')
  const [message,    setMessage]    = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !contact.trim() || !helpType) {
      setError('Заполните имя, контакт и выберите, чем хотите помочь')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'joinRequests'), {
        name:      name.trim(),
        contact:   contact.trim(),
        helpType,
        message:   message.trim(),
        createdAt: serverTimestamp(),
      })
      setDone(true)
    } catch (err) {
      console.error('[JoinForm]', err)
      setError('Не удалось отправить заявку. Попробуйте позже или напишите нам напрямую.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = "w-full px-4 py-3 rounded-xl border border-[var(--color-sepia)] bg-[var(--color-cream)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)] text-sm focus:outline-none focus:border-[var(--color-rust)] focus:shadow-[0_0_0_3px_rgba(184,74,30,0.15)] transition-all"

  return (
    <div className="mt-6 bg-[var(--color-paper)] rounded-3xl border border-[var(--color-sepia)] overflow-hidden">

      {/* Шапка — всегда видна */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-5 p-6 text-left hover:bg-[var(--color-paper-2)] transition-colors"
      >
        <div className="w-12 h-12 bg-[var(--color-rust)]/10 rounded-2xl flex items-center justify-center flex-shrink-0">
          <Sparkles size={22} className="text-[var(--color-rust)]" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-[var(--color-ink)] text-sm">Хочешь помочь проекту?</p>
          <p className="text-[var(--color-muted)] text-sm mt-0.5">
            Оставь заявку — расскажи, чем можешь помочь, и мы свяжемся с тобой.
          </p>
        </div>
        <div className="flex-shrink-0 text-[var(--color-muted)]">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Форма — раскрывается */}
      {open && (
        <div className="border-t border-[var(--color-sepia)] p-6 animate-slide-up">
          {done ? (
            /* ── Успех ── */
            <div className="flex flex-col items-center gap-3 py-6 text-center animate-scale-in">
              <div className="w-14 h-14 rounded-full bg-[var(--color-ok)]/10 flex items-center justify-center">
                <CheckCircle size={28} className="text-[var(--color-ok)]" />
              </div>
              <p className="font-bold text-[var(--color-ink)] text-base">Заявка отправлена!</p>
              <p className="text-[var(--color-muted)] text-sm max-w-xs">
                Мы получили твоё сообщение и свяжемся по указанному контакту. Спасибо!
              </p>
            </div>
          ) : (
            /* ── Форма ── */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-1.5">
                    Имя
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Как тебя зовут?"
                    maxLength={60}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-1.5">
                    Контакт
                  </label>
                  <input
                    type="text"
                    value={contact}
                    onChange={e => setContact(e.target.value)}
                    placeholder="Telegram или email"
                    maxLength={80}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-2">
                  Чем хочешь помочь?
                </label>
                <div className="flex flex-wrap gap-2">
                  {HELP_OPTIONS.map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setHelpType(opt.v)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        helpType === opt.v
                          ? 'bg-[var(--color-rust)] text-[#FFFDF7] border-[var(--color-rust)]'
                          : 'bg-[var(--color-cream)] text-[var(--color-muted)] border-[var(--color-sepia)] hover:border-[var(--color-rust)]/40 hover:text-[var(--color-ink)]'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink-2)] uppercase tracking-wide mb-1.5">
                  Расскажи подробнее <span className="text-[var(--color-muted)] normal-case font-normal">(необязательно)</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={3}
                  placeholder="Идеи, опыт, что хочешь видеть на платформе..."
                  maxLength={500}
                  className={`${inputCls} resize-none`}
                />
                <p className="text-[11px] text-[var(--color-muted)] mt-1 text-right">{message.length}/500</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 rounded-xl text-sm text-[var(--color-danger)]">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-rust)] text-[#FFFDF7] text-sm font-bold hover:brightness-95 transition-all disabled:opacity-50 shadow-[0_4px_20px_rgba(184,74,30,0.2)]"
                >
                  {submitting
                    ? <><Loader2 size={16} className="animate-spin" /> Отправка...</>
                    : <><Send size={15} /> Отправить заявку</>
                  }
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors"
                >
                  Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   КОМПОНЕНТ
════════════════════════════════════════════════════════════ */
export default function About() {
  const [counts, setCounts] = useState({ teachers: null, ratings: null, materials: null })

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [tSnap, rSnap, mSnap] = await Promise.all([
          getCountFromServer(collection(db, 'teachers')),
          getCountFromServer(collection(db, 'ratings')),
          getCountFromServer(collection(db, 'materials')),
        ])
        setCounts({
          teachers:  tSnap.data().count,
          ratings:   rSnap.data().count,
          materials: mSnap.data().count,
        })
      } catch (e) {
        console.error('[About stats]', e)
      }
    }
    fetchCounts()
  }, [])

  return (
    <div className="min-h-screen bg-[var(--color-cream)] text-[var(--color-ink)]">

      {/* ══════════════════════════════════════════════════
          HERO — тёмный фон, как на главной
      ══════════════════════════════════════════════════ */}
      <section className="relative bg-[#1A1613] overflow-hidden">
        {/* Rust glow */}
        <div className="absolute -top-40 -right-40 w-[36rem] h-[36rem] rounded-full bg-[var(--color-rust)]/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[22rem] h-[22rem] rounded-full bg-[var(--color-rust)]/5 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 md:px-12 pt-32 pb-24">
          {/* Eyebrow */}
          <div className="label-eyebrow mb-8">СПбГУПТД · UniRate · О проекте</div>

          <h1 className="font-display text-[36px] sm:text-[52px] md:text-[84px] leading-[0.97] tracking-[-0.02em] text-[#F4EBDB] max-w-3xl">
            Платформа, которую хотели{' '}
            <span className="italic text-[var(--color-rust)]">студенты.</span>
          </h1>

          <p className="mt-8 max-w-xl text-[15px] leading-relaxed text-[#B8A999]">
            Независимая площадка честных отзывов о преподавателях и учебных материалах
            Санкт-Петербургского государственного университета промышленных технологий и дизайна.
            Без рекламы, без регистрации через соцсети — только по делу.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              to="/teachers"
              className="group inline-flex items-center gap-3 px-6 py-3.5 rounded-full bg-[var(--color-rust)] text-[#FFFDF7] text-sm font-semibold hover:bg-[#C55830] transition-colors"
            >
              Смотреть преподавателей
              <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-[#3A322A] text-[#E6D9C9] text-sm font-medium hover:border-[var(--color-rust-soft)] hover:text-[#F4EBDB] transition-colors"
            >
              Присоединиться
            </Link>
          </div>

          {/* Stats row */}
          <div className="mt-20">
            <div className="flex items-center gap-4 opacity-30 mb-10">
              <div className="h-px flex-1 bg-[#3A322A]" />
              <span className="font-display italic text-[#B8A999] text-sm">∼</span>
              <div className="h-px flex-1 bg-[#3A322A]" />
            </div>

            <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-md">
              {STAT_DEFS.map(({ key, label, sub }) => (
                <div key={key}>
                  {counts[key] === null ? (
                    <div className="w-12 h-9 bg-[#3A322A] rounded-lg animate-pulse mb-1" />
                  ) : (
                    <p className="font-display text-[32px] sm:text-[44px] leading-none text-[var(--color-rust)]">
                      {counts[key]}
                    </p>
                  )}
                  <p className="text-[#F4EBDB] text-sm font-medium mt-1.5">{label}</p>
                  <p className="text-[#5A5248] text-xs mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          МИССИЯ
      ══════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

          {/* Текст */}
          <div>
            <div className="label-eyebrow mb-5">Наша миссия</div>
            <h2 className="font-display text-[28px] sm:text-[36px] md:text-[52px] leading-[1.04] tracking-[-0.02em] text-[var(--color-ink)]">
              Помочь студентам принимать <span className="italic text-[var(--color-rust)]">осознанные</span> решения.
            </h2>
            <p className="text-[var(--color-muted)] mt-6 leading-relaxed">
              UniRate создан студентами СПбГУПТД для студентов СПбГУПТД. Мы верим,
              что доступ к честным оценкам преподавателей и качественным материалам
              делает университетскую жизнь лучше — и для студентов, и для преподавателей.
            </p>
            <p className="text-[var(--color-muted)] mt-4 leading-relaxed">
              Платформа объединяет коллективный опыт: здесь узнают, кто объясняет
              сложные темы понятно, кто открыт к диалогу, и где найти лучшие
              конспекты перед сессией.
            </p>
            <ul className="mt-8 space-y-3">
              {VALUES.map(text => (
                <li key={text} className="flex items-start gap-3 text-[var(--color-ink-2)] text-sm">
                  <CheckCircle2 size={15} className="text-[var(--color-rust)] flex-shrink-0 mt-0.5" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Карточки-факты */}
          <div className="space-y-4">
            <div className="bg-[var(--color-paper)] rounded-3xl p-8 border border-[var(--color-sepia)]">
              <p className="label-muted mb-4">Главная цель</p>
              <p className="font-display text-[26px] leading-tight text-[var(--color-ink)] tracking-[-0.01em]">
                Создать пространство, где студенты делятся честным опытом
                и помогают друг другу учиться.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--color-paper)] rounded-3xl p-6 border border-[var(--color-sepia)]">
                <p className="font-display text-[40px] leading-none text-[var(--color-rust)]">0 ₽</p>
                <p className="text-[var(--color-ink)] font-semibold text-sm mt-2">Полностью бесплатно</p>
                <p className="text-[var(--color-muted)] text-xs mt-1">Без подписок и рекламы</p>
              </div>
              <div className="bg-[var(--color-paper)] rounded-3xl p-6 border border-[var(--color-sepia)]">
                <p className="font-display text-[40px] leading-none text-[var(--color-rust)]">24 ч</p>
                <p className="text-[var(--color-ink)] font-semibold text-sm mt-2">Модерация отзывов</p>
                <p className="text-[var(--color-muted)] text-xs mt-1">Каждый — вручную</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          КАК ЭТО РАБОТАЕТ — тёмный фон
      ══════════════════════════════════════════════════ */}
      <section className="bg-[#1A1613] py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12">

          <div className="flex flex-wrap items-end justify-between gap-6 mb-14">
            <div>
              <div className="label-eyebrow mb-4">Как это работает</div>
              <h2 className="font-display text-[28px] sm:text-[36px] md:text-[52px] leading-[1.04] tracking-[-0.02em] text-[#F4EBDB]">
                Три шага до <span className="italic text-[var(--color-rust)]">честного отзыва.</span>
              </h2>
            </div>
            <span className="font-mono text-xs text-[#4A4038] tracking-widest select-none">01 — 03</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {STEPS.map(({ num, Icon, title, desc }) => (
              <div key={num} className="relative bg-[#24201C] rounded-3xl p-8 border border-[#3A322A]">
                <span className="absolute top-6 right-6 font-display text-[56px] leading-none text-[#2A2420] select-none pointer-events-none">
                  {num}
                </span>
                <div className="w-11 h-11 bg-[var(--color-rust)] rounded-2xl flex items-center justify-center mb-6">
                  <Icon size={20} className="text-[#FFFDF7]" />
                </div>
                <h3 className="text-base font-bold text-[#F4EBDB] mb-3">{title}</h3>
                <p className="text-[#B8A999] text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          КОМАНДА
      ══════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-24">

        <div className="flex flex-wrap items-end justify-between gap-6 mb-14">
          <div>
            <div className="label-eyebrow mb-4">Команда</div>
            <h2 className="font-display text-[28px] sm:text-[36px] md:text-[52px] leading-[1.04] tracking-[-0.02em] text-[var(--color-ink)]">
              Сделано студентами <span className="italic text-[var(--color-rust)]">для студентов.</span>
            </h2>
          </div>
          <p className="max-w-xs text-[var(--color-muted)] text-sm leading-relaxed">
            UniRate — некоммерческий проект. Мы не аффилированы с администрацией университета
            и не представляем официальную позицию вуза.
          </p>
        </div>

        {/* Карточки участников */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
          {TEAM.map(member => (
            <div
              key={member.name}
              className="bg-[var(--color-paper)] rounded-3xl p-8 border border-[var(--color-sepia)] flex flex-col gap-6 hover:border-[var(--color-rust)]/30 transition-colors"
            >
              {/* Аватар */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${member.from}, ${member.to})` }}
              >
                {member.initials}
              </div>

              {/* Информация */}
              <div className="flex-1 space-y-1.5">
                <p className="font-bold text-[var(--color-ink)] text-lg leading-tight">{member.name}</p>
                <p className="text-[var(--color-rust)] text-xs font-semibold">{member.role}</p>
                <p className="label-muted !text-[10px]">{member.faculty}</p>
                <p className="text-[var(--color-muted)] text-sm leading-relaxed pt-2">{member.desc}</p>
              </div>

              {/* Telegram — только для живого человека */}
              {member.tg && (
                <a
                  href={`https://t.me/${member.tg}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-rust)] transition-colors w-fit"
                >
                  <Send size={11} />
                  @{member.tg}
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Join form */}
        <JoinForm />
      </section>

      {/* ══════════════════════════════════════════════════
          КОНТАКТЫ — тёмный фон
      ══════════════════════════════════════════════════ */}
      <section className="bg-[#1A1613] py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-12">

          <div className="mb-14">
            <div className="label-eyebrow mb-4">Контакты</div>
            <h2 className="font-display text-[28px] sm:text-[36px] md:text-[52px] leading-[1.04] tracking-[-0.02em] text-[#F4EBDB]">
              Свяжитесь с нами.
            </h2>
            <p className="text-[#B8A999] mt-4 text-base max-w-md">
              Есть предложение, нашли баг или просто хочется поговорить о платформе?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
            <a
              href="mailto:support@unirate.ru"
              className="group bg-[#24201C] rounded-3xl p-8 border border-[#3A322A] hover:border-[var(--color-rust)]/40 transition-colors flex flex-col gap-6"
            >
              <div className="w-12 h-12 bg-[var(--color-rust)]/10 rounded-2xl flex items-center justify-center group-hover:bg-[var(--color-rust)] transition-colors">
                <Mail size={22} className="text-[var(--color-rust)] group-hover:text-white transition-colors" />
              </div>
              <div>
                <p className="font-bold text-[#F4EBDB] text-base">Электронная почта</p>
                <p className="text-[var(--color-rust)] font-medium mt-1 text-sm">support@unirate.ru</p>
                <p className="text-[#6B625A] text-xs mt-2">Для вопросов, жалоб и предложений</p>
              </div>
            </a>

            <a
              href="https://t.me/unirate_spb"
              target="_blank"
              rel="noreferrer"
              className="group bg-[#24201C] rounded-3xl p-8 border border-[#3A322A] hover:border-[var(--color-rust)]/40 transition-colors flex flex-col gap-6"
            >
              <div className="w-12 h-12 bg-[var(--color-rust)]/10 rounded-2xl flex items-center justify-center group-hover:bg-[var(--color-rust)] transition-colors">
                <MessageCircle size={22} className="text-[var(--color-rust)] group-hover:text-white transition-colors" />
              </div>
              <div>
                <p className="font-bold text-[#F4EBDB] text-base">Telegram</p>
                <p className="text-[var(--color-rust)] font-medium mt-1 text-sm">@unirate_spb</p>
                <p className="text-[#6B625A] text-xs mt-2">Новости и обновления платформы</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Footer note */}
      <div className="border-t border-[#3A322A] bg-[#1A1613]">
        <p className="max-w-7xl mx-auto px-6 md:px-12 py-6 text-[11px] tracking-[0.15em] uppercase text-[#4A4038]">
          UniRate — некоммерческий студенческий проект СПбГУПТД · 2025
        </p>
      </div>

    </div>
  )
}
