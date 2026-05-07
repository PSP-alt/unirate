import { Link } from 'react-router-dom'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  Shield,
  Database,
  Target,
  Scale,
  Clock,
  Globe2,
  UserCheck,
  Lock,
  Cookie,
  MessageSquare,
  Mail,
  FileText,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Search,
  X,
  ListTree,
  CornerDownLeft,
} from 'lucide-react'

/* ════════════════════════════════════════════════════════════
   UNIRATE · ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ
   Составлена с учётом ФЗ «О персональных данных» № 152-ФЗ,
   ФЗ № 149-ФЗ, ФЗ № 242-ФЗ (локализация), а также фактического
   функционала платформы.
════════════════════════════════════════════════════════════ */

const LAST_UPDATED = '24 апреля 2026 г.'
const EFFECTIVE_FROM = '24 апреля 2026 г.'

/* ── Категории субъектов ПДн ── */
const SUBJECT_CATEGORIES = [
  {
    title: 'Студенты (зарегистрированные)',
    desc:  'Пользователи, создавшие учётную запись в роли «студент». Могут публиковать отзывы, голосовать, жаловаться, скачивать материалы.',
  },
  {
    title: 'Преподаватели (зарегистрированные)',
    desc:  'Пользователи в роли «преподаватель», прошедшие верификацию. Могут заполнять профиль, загружать материалы, отвечать на отзывы.',
  },
  {
    title: 'Администраторы и модераторы',
    desc:  'Лица, уполномоченные оператором на модерацию контента, рассмотрение жалоб и управление учётными записями.',
  },
  {
    title: 'Посетители (незарегистрированные)',
    desc:  'Лица, просматривающие публичные разделы сайта без создания учётной записи. Обрабатываются только технические данные.',
  },
  {
    title: 'Лица, отправившие заявку',
    desc:  'Субъекты, заполнившие форму «Хочешь помочь проекту?» или обратившиеся через контактные каналы оператора.',
  },
]

/* ── Полный перечень ПДн (по аудиту) ── */
const DATA_INVENTORY = [
  {
    group: 'Регистрация и аутентификация',
    items: [
      'Адрес электронной почты',
      'Пароль (хранится в зашифрованном виде средствами Firebase Authentication)',
      'Имя, фамилия',
      'Роль (студент / преподаватель)',
      'Для студентов — номер студенческого билета, курс обучения',
      'Дата и время регистрации, последнего входа',
    ],
  },
  {
    group: 'Профиль студента',
    items: [
      'Никнейм (отображаемое имя), биография (до 200 символов)',
      'Фотография (аватар), загружаемая в Firebase Storage',
      'Пол, факультет, оформление профиля',
      'История оставленных отзывов, голосов и жалоб',
    ],
  },
  {
    group: 'Профиль преподавателя',
    items: [
      'Должность, кафедра, тип преподавателя',
      'Биография, контактный e-mail для связи со студентами',
      'Список дисциплин, фотография (аватар)',
      'Статус открытости к оценкам, средний балл и число отзывов (публично)',
    ],
  },
  {
    group: 'Отзывы и оценки',
    items: [
      'Идентификатор студента-автора (скрыт при анонимной публикации)',
      'Идентификатор преподавателя, которому выставлена оценка',
      'Оценки по 8 критериям, NPS-индекс, итоговая оценка по курсу',
      'Текстовые комментарии (плюсы / минусы), дисциплина, роль преподавателя',
      'Уровень посещаемости (лекции / семинары), семестр',
      'Статус модерации, отметка об анонимности, курс автора',
      'Списки проголосовавших «полезно», авторов жалоб и причин жалоб',
      'Ответ преподавателя на отзыв (при наличии), временные метки',
    ],
  },
  {
    group: 'Учебные материалы',
    items: [
      'Идентификатор и имя преподавателя-автора',
      'Название, описание, категория, дисциплина, курсы',
      'Файл (PDF, DOCX и т. п.) в Firebase Storage, имя, размер, тип',
      'Счётчик скачиваний',
    ],
  },
  {
    group: 'Модерация и санкции',
    items: [
      'Причина блокировки, срок блокировки, дата применения',
      'История блокировок (массив событий)',
      'Список жалоб пользователя (как автора, так и адресата)',
    ],
  },
  {
    group: 'Локальное хранилище браузера',
    items: [
      'Настройки темы, языка, размера шрифта, компактности интерфейса',
      'Настройки уведомлений и конфиденциальности (ключи eduhub_*)',
      'Хранятся только на устройстве пользователя, на сервер не передаются',
    ],
  },
  {
    group: 'Заявки и обращения',
    items: [
      'Имя, контакт (e-mail / Telegram), тип предлагаемой помощи',
      'Текст сообщения, дата отправки (коллекция joinRequests)',
    ],
  },
  {
    group: 'Технические данные',
    items: [
      'IP-адрес, тип и версия браузера, операционная система',
      'Журналы запросов Firebase (временные, для обеспечения работы и безопасности)',
    ],
  },
]

/* ── Цели обработки ── */
const PURPOSES = [
  'Идентификация и аутентификация пользователя, разграничение прав доступа.',
  'Предоставление базовой функциональности: публикация профилей, отзывов, материалов.',
  'Расчёт агрегированных показателей (средний балл, количество отзывов) и их отображение.',
  'Модерация контента, рассмотрение жалоб, блокировка нарушителей правил.',
  'Связь с пользователем по вопросам использования платформы и обращений.',
  'Обеспечение информационной безопасности, предотвращение мошенничества и злоупотреблений.',
  'Улучшение качества сервиса на основе обезличенной статистики.',
  'Исполнение требований законодательства Российской Федерации.',
]

/* ── Правовые основания ── */
const LEGAL_BASIS = [
  {
    ref: 'п. 1 ч. 1 ст. 6 152-ФЗ',
    text: 'Согласие субъекта персональных данных, выраженное путём регистрации на платформе и проставления соответствующих отметок.',
  },
  {
    ref: 'п. 5 ч. 1 ст. 6 152-ФЗ',
    text: 'Необходимость исполнения договора (пользовательского соглашения), стороной которого является субъект ПДн.',
  },
  {
    ref: 'п. 7 ч. 1 ст. 6 152-ФЗ',
    text: 'Достижение целей, предусмотренных законом или обеспечение законных интересов оператора (безопасность, модерация).',
  },
  {
    ref: 'ч. 1 ст. 10.1 152-ФЗ',
    text: 'Отдельное согласие на распространение персональных данных — для публичных отзывов и профилей.',
  },
]

/* ── Права субъекта ПДн ── */
const USER_RIGHTS = [
  {
    title: 'Право на доступ и информацию',
    ref:   'ст. 14 152-ФЗ',
    desc:  'Получить сведения о факте обработки ваших ПДн, их перечне, целях, сроках и способах обработки.',
  },
  {
    title: 'Право на изменение и уточнение',
    ref:   'ст. 14 152-ФЗ',
    desc:  'Отредактировать профиль в настройках самостоятельно или запросить исправление неточных данных у оператора.',
  },
  {
    title: 'Право на удаление и блокирование',
    ref:   'ст. 14, 21 152-ФЗ',
    desc:  'Потребовать удаления или блокирования ПДн, если они обрабатываются незаконно или больше не нужны для заявленных целей.',
  },
  {
    title: 'Право на отзыв согласия',
    ref:   'ч. 2 ст. 9 152-ФЗ',
    desc:  'Отозвать согласие на обработку ПДн в любой момент путём удаления учётной записи или письменного обращения.',
  },
  {
    title: 'Право на обжалование',
    ref:   'ст. 17 152-ФЗ',
    desc:  'Обратиться в Роскомнадзор (uполномоченный орган по защите прав субъектов ПДн) или в суд для защиты своих прав.',
  },
  {
    title: 'Право на возражение',
    ref:   'ст. 15 152-ФЗ',
    desc:  'Возразить против обработки ПДн, в том числе в целях продвижения (платформа не ведёт маркетинговых рассылок).',
  },
]

/* ── Меры защиты ── */
const SECURITY_MEASURES = [
  {
    type: 'Организационные',
    items: [
      'Назначение лиц, ответственных за обработку ПДн',
      'Ограничение круга лиц, имеющих доступ к данным (только администраторы)',
      'Разграничение прав доступа по ролям (студент / преподаватель / админ)',
      'Ведение журналов модерации и санкций',
    ],
  },
  {
    type: 'Технические',
    items: [
      'Шифрование передачи данных по протоколу HTTPS (TLS)',
      'Хранение паролей в виде хэшей средствами Firebase Authentication',
      'Правила безопасности Firestore и Storage, ограничивающие чтение/запись',
      'Резервное копирование и журналирование на стороне Google Cloud',
      'Защита от подбора паролей и базовая защита от DDoS средствами Firebase',
    ],
  },
]

/* ── Разделы для оглавления ── */
const TOC = [
  { id: '1',  title: 'Общие положения' },
  { id: '2',  title: 'Оператор' },
  { id: '3',  title: 'Категории субъектов' },
  { id: '4',  title: 'Состав обрабатываемых данных' },
  { id: '5',  title: 'Цели обработки' },
  { id: '6',  title: 'Правовые основания' },
  { id: '7',  title: 'Способы и сроки' },
  { id: '8',  title: 'Трансграничная передача' },
  { id: '9',  title: 'Права субъектов' },
  { id: '10', title: 'Меры защиты' },
  { id: '11', title: 'Cookies и localStorage' },
  { id: '12', title: 'Публичный контент' },
  { id: '13', title: 'Порядок обращений' },
  { id: '14', title: 'Заключительные положения' },
]

export default function Privacy() {
  const sections = useMemo(() => TOC, [])

  /* ════════════ ПОИСК ПО ДОКУМЕНТУ ════════════ */
  const inputRef    = useRef(null)
  const contentRef  = useRef(null)
  const [query, setQuery]       = useState('')
  const [activeIdx, setActiveIdx] = useState(0) // индекс активного результата
  const [tocOpen, setTocOpen]   = useState(false)

  /* — индексация: один раз после маунта (DOM уже отрисован) — */
  const [searchIndex, setSearchIndex] = useState([])
  useEffect(() => {
    if (!contentRef.current) return
    const els = contentRef.current.querySelectorAll('section[id^="section-"]')
    const idx = Array.from(els).map(el => {
      const id = el.id.replace('section-', '')
      const titleEl = el.querySelector('h2')
      const tocItem = TOC.find(t => t.id === id)
      return {
        id,
        title: tocItem?.title || titleEl?.textContent?.trim() || `Раздел ${id}`,
        text:  el.textContent || '',
      }
    })
    setSearchIndex(idx)
  }, [])

  /* — горячие клавиши: Ctrl/⌘+K и «/» — фокус инпута; Esc — очистить.
     ВАЖНО: «/» перехватываем только если пользователь не печатает в
     поле (раньше это ломало встроенный Quick Find браузера). */
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      } else if (e.key === '/' && !isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        inputRef.current?.focus()
      } else if (e.key === 'Escape' && isTyping && document.activeElement === inputRef.current) {
        if (query) setQuery('')
        else inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [query])

  /* — результаты: для каждого раздела считаем количество совпадений и сниппет — */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || q.length < 2) return []
    return searchIndex
      .map(item => {
        const lower = item.text.toLowerCase()
        const first = lower.indexOf(q)
        if (first === -1) return null
        let count = 0, from = 0
        while ((from = lower.indexOf(q, from)) !== -1) { count++; from += q.length }
        const start = Math.max(0, first - 70)
        const end   = Math.min(item.text.length, first + q.length + 90)
        const snippet = (start > 0 ? '…' : '') + item.text.slice(start, end).trim() + (end < item.text.length ? '…' : '')
        return { ...item, count, snippet }
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count)
  }, [query, searchIndex])

  const matchedIds = useMemo(() => new Set(results.map(r => r.id)), [results])
  const totalMatches = useMemo(() => results.reduce((s, r) => s + r.count, 0), [results])

  /* — клампим активный индекс при изменении результатов — */
  useEffect(() => { setActiveIdx(0) }, [query])

  /* — CSS Custom Highlight API: подсвечиваем все совпадения внутри документа — */
  useEffect(() => {
    if (typeof CSS === 'undefined' || !CSS.highlights) return
    const q = query.trim()
    CSS.highlights.delete('uni-search')
    if (!q || q.length < 2 || !contentRef.current) return

    const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
        // пропускаем скрипты/стили
        const p = node.parentElement
        if (!p) return NodeFilter.FILTER_REJECT
        const tag = p.tagName
        if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
    })
    const ranges = []
    const lowerQ = q.toLowerCase()
    let node
    while ((node = walker.nextNode())) {
      const text = node.nodeValue.toLowerCase()
      let from = 0, idx
      while ((idx = text.indexOf(lowerQ, from)) !== -1) {
        const r = document.createRange()
        r.setStart(node, idx)
        r.setEnd(node, idx + q.length)
        ranges.push(r)
        from = idx + q.length
      }
    }
    if (ranges.length) CSS.highlights.set('uni-search', new Highlight(...ranges))
    return () => { CSS.highlights.delete('uni-search') }
  }, [query, searchIndex])

  /* — переход к разделу с flash-эффектом —
     Считаем динамический offset: высота navbar (80) + sticky-панели
     поиска (которая может быть раскрыта), чтобы заголовок раздела не
     уехал под неё. */
  const jumpTo = useCallback((id) => {
    const el = document.getElementById(`section-${id}`)
    if (!el) return
    const sticky = document.querySelector('[data-privacy-sticky]')
    const offset = (sticky?.getBoundingClientRect().bottom || 80) + 8
    const top = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: 'smooth' })
    el.classList.add('uni-flash')
    window.setTimeout(() => el.classList.remove('uni-flash'), 1600)
  }, [])

  /* — навигация по результатам стрелками вверх/вниз внутри инпута — */
  function onInputKey(e) {
    if (!results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % results.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i - 1 + results.length) % results.length) }
    else if (e.key === 'Enter')   { e.preventDefault(); jumpTo(results[activeIdx]?.id) }
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">

      {/* Стили подсветки и flash-анимации */}
      <style>{`
        ::highlight(uni-search) {
          background-color: rgba(184, 74, 30, 0.28);
          color: var(--color-ink);
          border-radius: 2px;
        }
        @keyframes uniFlash {
          0%   { box-shadow: 0 0 0 0 rgba(184,74,30,0); }
          15%  { box-shadow: 0 0 0 4px rgba(184,74,30,0.45), 0 14px 40px rgba(184,74,30,0.18); }
          100% { box-shadow: 0 0 0 0 rgba(184,74,30,0); }
        }
        .uni-flash { animation: uniFlash 1.4s ease-out; }
      `}</style>

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden border-b border-[var(--color-sepia)]">
        {/* Фоновые паттерны */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, var(--color-ink) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute -top-40 -right-20 w-[480px] h-[480px] rounded-full bg-[var(--color-rust)] opacity-[0.07] blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 w-[360px] h-[360px] rounded-full bg-[var(--color-rust-soft)] opacity-[0.05] blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-6 md:px-12 pt-20 pb-16">
          {/* Хлебные крошки / ярлык */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--color-sepia)] bg-[var(--color-paper)] mb-8">
            <FileText size={12} className="text-[var(--color-rust)]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--color-muted)]">
              Документ · ст. 3 152-ФЗ
            </span>
          </div>

          <h1 className="font-display italic text-5xl md:text-7xl leading-[0.95] tracking-[-0.02em] text-[var(--color-ink)] max-w-4xl">
            Политика <br />
            <span className="text-[var(--color-rust)]">конфиденциальности</span>
          </h1>

          <p className="mt-8 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
            Документ, описывающий, какие персональные данные обрабатывает платформа{' '}
            <span className="text-[var(--color-ink)] font-semibold">Unirate</span>, на каких правовых
            основаниях, как долго, кому они доступны и какие права есть у пользователя.
            Составлен в соответствии с Федеральным законом «О персональных данных» № 152-ФЗ.
          </p>

          {/* Мета-строка */}
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-[12px] tracking-[0.15em] uppercase">
            <div className="flex items-center gap-2 text-[var(--color-muted)]">
              <Clock size={13} className="text-[var(--color-rust)]" />
              Действует с {EFFECTIVE_FROM}
            </div>
            <div className="flex items-center gap-2 text-[var(--color-muted)]">
              <Shield size={13} className="text-[var(--color-rust)]" />
              14 разделов
            </div>
            <div className="flex items-center gap-2 text-[var(--color-muted)]">
              <Scale size={13} className="text-[var(--color-rust)]" />
              152-ФЗ · 149-ФЗ · 242-ФЗ
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ПОИСК + ОГЛАВЛЕНИЕ ═══ */}
      <div data-privacy-sticky className="sticky top-20 z-20 bg-[var(--color-cream)]/95 backdrop-blur-xl border-b border-[var(--color-sepia)]">
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-3">
          {/* Search input + toolbar */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Toggle TOC (моб./компактно) */}
            <button
              type="button"
              onClick={() => setTocOpen(v => !v)}
              title="Оглавление"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-[11px] font-semibold transition-colors ${
                tocOpen
                  ? 'bg-[var(--color-rust)] text-[#FFFDF7] border-[var(--color-rust)]'
                  : 'bg-[var(--color-paper)] text-[var(--color-muted)] border-[var(--color-sepia)] hover:text-[var(--color-rust)] hover:border-[var(--color-rust)]/40'
              }`}
            >
              <ListTree size={13} />
              <span className="hidden sm:inline">Оглавление</span>
              <span className="sm:hidden">{sections.length}</span>
            </button>

            {/* Search */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                type="search"
                placeholder="Поиск по документу — например «Firebase», «Роскомнадзор», «согласие»…"
                className="w-full pl-9 pr-24 py-2 rounded-full bg-[var(--color-paper)] border border-[var(--color-sepia)] text-[13px] text-[var(--color-ink)] placeholder:text-[var(--color-muted-2)] focus:outline-none focus:border-[var(--color-rust)] focus:shadow-[0_0_0_3px_rgba(184,74,30,0.12)] transition-all"
              />
              {/* Right-side controls: hotkey hint OR clear */}
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {query ? (
                  <>
                    {results.length > 1 && (
                      <div className="hidden sm:flex items-center gap-0.5 mr-1">
                        <button
                          type="button"
                          onClick={() => setActiveIdx(i => (i - 1 + results.length) % results.length)}
                          className="p-1 rounded-md text-[var(--color-muted)] hover:text-[var(--color-rust)] hover:bg-[var(--color-rust-wash)] transition-colors"
                          title="Предыдущий результат (↑)"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveIdx(i => (i + 1) % results.length)}
                          className="p-1 rounded-md text-[var(--color-muted)] hover:text-[var(--color-rust)] hover:bg-[var(--color-rust-wash)] transition-colors"
                          title="Следующий результат (↓)"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { setQuery(''); inputRef.current?.focus() }}
                      className="p-1.5 rounded-full text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] transition-colors"
                      title="Очистить (Esc)"
                    >
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[var(--color-sepia)] bg-[var(--color-paper-2)]/60 text-[10px] tracking-[0.05em] text-[var(--color-muted)] font-mono">
                    Ctrl K
                  </kbd>
                )}
              </div>
            </div>

            {/* Match counter */}
            {query && query.trim().length >= 2 && (
              <div className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[var(--color-rust-wash)] text-[var(--color-rust)] text-[11px] font-semibold whitespace-nowrap">
                {totalMatches > 0
                  ? <>{totalMatches} {pluralRu(totalMatches, 'совпадение', 'совпадения', 'совпадений')} · {results.length} {pluralRu(results.length, 'раздел', 'раздела', 'разделов')}</>
                  : 'Не найдено'}
              </div>
            )}
          </div>

          {/* TOC chips — раскрывается по кнопке или фильтруется поиском */}
          {(tocOpen || query.trim().length >= 2) && (
            <div className="mt-3 -mx-1 px-1 overflow-x-auto">
              <nav className="flex gap-1 min-w-max">
                {sections.map(s => {
                  const dimmed = query.trim().length >= 2 && !matchedIds.has(s.id)
                  return (
                    <a
                      key={s.id}
                      href={`#section-${s.id}`}
                      onClick={(e) => { e.preventDefault(); jumpTo(s.id); setTocOpen(false) }}
                      className={[
                        'px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all',
                        dimmed
                          ? 'text-[var(--color-muted-2)] opacity-40 hover:opacity-100'
                          : 'text-[var(--color-muted)] hover:text-[var(--color-rust)] hover:bg-[var(--color-rust-wash)]',
                      ].join(' ')}
                    >
                      <span className="text-[var(--color-rust)] font-semibold">{s.id}.</span>{' '}
                      {s.title}
                    </a>
                  )
                })}
              </nav>
            </div>
          )}
        </div>

        {/* Выпадающая панель результатов */}
        {query.trim().length >= 2 && (
          <div className="border-t border-[var(--color-sepia)] bg-[var(--color-paper)] max-h-[55vh] overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 md:px-12 py-3">
              {results.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-[13px] text-[var(--color-muted)]">
                    По запросу{' '}
                    <span className="font-semibold text-[var(--color-ink)]">«{query.trim()}»</span>{' '}
                    в документе ничего не найдено
                  </p>
                  <p className="text-[11px] text-[var(--color-muted-2)] mt-1.5">
                    Попробуйте другие формулировки — например, «персональные данные», «удаление», «cookies».
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {results.map((r, i) => {
                    const active = i === activeIdx
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => { setActiveIdx(i); jumpTo(r.id) }}
                          onMouseEnter={() => setActiveIdx(i)}
                          className={[
                            'w-full text-left p-3 rounded-xl border transition-colors',
                            active
                              ? 'border-[var(--color-rust)]/40 bg-[var(--color-rust-wash)]/40'
                              : 'border-[var(--color-sepia)] bg-[var(--color-cream)] hover:border-[var(--color-rust)]/30 hover:bg-[var(--color-rust-wash)]/25',
                          ].join(' ')}
                        >
                          <div className="flex items-baseline justify-between gap-3 mb-1.5">
                            <span className="font-display italic text-[15px] text-[var(--color-ink)] leading-tight">
                              <span className="text-[var(--color-rust)] not-italic font-semibold">{r.id}.</span>{' '}
                              {r.title}
                            </span>
                            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-rust)]/15 text-[var(--color-rust)] text-[10px] font-semibold tracking-[0.06em]">
                              {r.count}
                            </span>
                          </div>
                          <p className="text-[12px] text-[var(--color-muted)] leading-relaxed line-clamp-2">
                            <Highlighted text={r.snippet} query={query.trim()} />
                          </p>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}

              {results.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--color-sepia)] flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] tracking-[0.08em] text-[var(--color-muted-2)]">
                  <span className="inline-flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-[var(--color-sepia)] bg-[var(--color-cream)] font-mono">↑↓</kbd>
                    выбрать
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-[var(--color-sepia)] bg-[var(--color-cream)] font-mono inline-flex items-center gap-0.5"><CornerDownLeft size={9} />Enter</kbd>
                    перейти к разделу
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-[var(--color-sepia)] bg-[var(--color-cream)] font-mono">Esc</kbd>
                    очистить
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ ВАЖНОЕ УВЕДОМЛЕНИЕ ═══ */}
      <div className="max-w-3xl mx-auto px-6 md:px-12 pt-12">
        <div className="rounded-2xl border border-[var(--color-rust)]/30 bg-[var(--color-rust-wash)] px-6 py-5 flex gap-4">
          <AlertTriangle size={20} className="text-[var(--color-rust)] flex-shrink-0 mt-0.5" />
          <div className="text-[13px] leading-relaxed text-[var(--color-ink-2)]">
            <p className="font-semibold text-[var(--color-ink)] mb-1">
              Unirate — студенческий некоммерческий проект.
            </p>
            <p>
              Настоящая Политика является публичной офертой и обязательна для всех лиц,
              использующих платформу. Использование сайта без согласия с настоящей
              Политикой не допускается. Оператор прилагает разумные усилия для защиты
              данных, однако уровень гарантий соответствует возможностям некоммерческого
              студенческого проекта.
            </p>
          </div>
        </div>
      </div>

      {/* ═══ СОДЕРЖИМОЕ ═══ */}
      <div ref={contentRef} className="max-w-3xl mx-auto px-6 md:px-12 py-12 space-y-6">

        {/* ── 1. Общие положения ── */}
        <Section id="1" icon={Shield} title="Общие положения">
          <P>
            <B>1.1.</B> Настоящая Политика конфиденциальности (далее — «Политика»)
            разработана в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ
            «О персональных данных» (далее — «152-ФЗ»), Федеральным законом от
            27.07.2006 № 149-ФЗ «Об информации, информационных технологиях и о защите
            информации», а также иными нормативно-правовыми актами Российской
            Федерации в области персональных данных.
          </P>
          <P>
            <B>1.2.</B> В Политике используются следующие основные понятия (в значениях,
            установленных ст. 3 152-ФЗ): «персональные данные» (далее — «ПДн»),
            «оператор», «субъект персональных данных», «обработка персональных данных»,
            «автоматизированная обработка», «обезличивание», «распространение»,
            «предоставление», «уничтожение».
          </P>
          <P>
            <B>1.3.</B> Политика распространяется на все ПДн, получаемые и обрабатываемые
            оператором в связи с функционированием веб-сайта Unirate, расположенного
            в сети «Интернет».
          </P>
          <P>
            <B>1.4.</B> Регистрация на платформе, публикация контента или заполнение форм
            означает безусловное согласие субъекта ПДн с настоящей Политикой
            и условиями обработки ПДн.
          </P>
          <P>
            <B>1.5.</B> Оператор вправе в одностороннем порядке вносить изменения в
            Политику. Актуальная редакция публикуется по постоянной ссылке
            в разделе «Политика конфиденциальности». Дата последнего обновления
            указывается внизу страницы.
          </P>
        </Section>

        {/* ── 2. Оператор ── */}
        <Section id="2" icon={UserCheck} title="Оператор персональных данных">
          <P>
            <B>2.1.</B> Оператором ПДн является команда студенческого проекта «Unirate»
            (далее — «Оператор»), действующая на базе Санкт-Петербургского
            государственного университета промышленных технологий и дизайна (СПбГУПТД).
          </P>
          <P>
            <B>2.2.</B> Оператор не является юридическим лицом и осуществляет деятельность
            на некоммерческой основе. Проект не зарегистрирован в Реестре операторов
            персональных данных Роскомнадзора в силу оснований, предусмотренных ч. 2
            ст. 22 152-ФЗ (обработка без средств автоматизации в целях исполнения
            договора, стороной которого является субъект ПДн).
          </P>
          <P>
            <B>2.3.</B> Контактные данные Оператора для обращений по вопросам обработки ПДн:
          </P>
          <Bullets items={[
            'Электронная почта: support@unirate.ru',
            'Telegram-канал для обращений: @unirate_spb',
            'Адрес фактического нахождения: г. Санкт-Петербург',
          ]} />
        </Section>

        {/* ── 3. Категории субъектов ── */}
        <Section id="3" icon={UserCheck} title="Категории субъектов персональных данных">
          <P>
            <B>3.1.</B> Оператор обрабатывает ПДн следующих категорий субъектов:
          </P>
          <div className="space-y-3 mt-4">
            {SUBJECT_CATEGORIES.map((c, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--color-sepia)] bg-[var(--color-paper)] px-5 py-4"
              >
                <p className="font-semibold text-[14px] text-[var(--color-ink)] mb-1">
                  {i + 1}. {c.title}
                </p>
                <p className="text-[13px] text-[var(--color-muted)] leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 4. Перечень данных ── */}
        <Section id="4" icon={Database} title="Состав обрабатываемых персональных данных">
          <P>
            <B>4.1.</B> Оператор обрабатывает исключительно ПДн, необходимые для
            достижения целей, указанных в разделе 5 настоящей Политики. Полный
            перечень приведён ниже и сгруппирован по назначению.
          </P>
          <P>
            <B>4.2.</B> Оператор <B>не обрабатывает</B> специальные категории ПДн
            (сведения о расовой или национальной принадлежности, политических
            взглядах, религиозных или философских убеждениях, состоянии здоровья,
            интимной жизни), а также биометрические ПДн.
          </P>

          <div className="space-y-4 mt-5">
            {DATA_INVENTORY.map((block, i) => (
              <details
                key={i}
                className="group rounded-xl border border-[var(--color-sepia)] bg-[var(--color-paper)] overflow-hidden"
              >
                <summary className="list-none cursor-pointer px-5 py-4 flex items-center justify-between gap-3 hover:bg-[var(--color-paper-2)] transition-colors">
                  <span className="font-semibold text-[14px] text-[var(--color-ink)]">
                    {block.group}
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-[var(--color-muted)] transition-transform group-open:rotate-90"
                  />
                </summary>
                <ul className="px-5 pb-4 pt-0 space-y-2">
                  {block.items.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex gap-3 text-[13px] text-[var(--color-ink-2)] leading-relaxed"
                    >
                      <span className="text-[var(--color-rust)] mt-1">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </Section>

        {/* ── 5. Цели ── */}
        <Section id="5" icon={Target} title="Цели обработки персональных данных">
          <P>
            <B>5.1.</B> ПДн обрабатываются Оператором исключительно в следующих целях:
          </P>
          <ol className="space-y-3 mt-3 list-none counter-reset-list">
            {PURPOSES.map((p, i) => (
              <li
                key={i}
                className="flex gap-3 text-[13px] text-[var(--color-ink-2)] leading-relaxed"
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-rust-wash)] text-[var(--color-rust)] text-[11px] font-semibold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
          <P>
            <B>5.2.</B> Оператор не использует ПДн для принятия юридически значимых
            решений исключительно автоматизированным способом без участия человека.
            Все санкции модерации (блокировки, снятие отзывов) применяются по решению
            человека-администратора.
          </P>
        </Section>

        {/* ── 6. Правовые основания ── */}
        <Section id="6" icon={Scale} title="Правовые основания обработки">
          <P>
            <B>6.1.</B> Обработка ПДн осуществляется Оператором на следующих правовых
            основаниях, предусмотренных ст. 6 и ст. 10.1 152-ФЗ:
          </P>
          <div className="space-y-3 mt-4">
            {LEGAL_BASIS.map((l, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--color-sepia)] bg-[var(--color-paper)] px-5 py-4"
              >
                <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-md bg-[var(--color-rust-wash)] mb-2">
                  <Scale size={10} className="text-[var(--color-rust)]" />
                  <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[var(--color-rust)]">
                    {l.ref}
                  </span>
                </div>
                <p className="text-[13px] text-[var(--color-ink-2)] leading-relaxed">{l.text}</p>
              </div>
            ))}
          </div>
          <P>
            <B>6.2.</B> Согласие на обработку ПДн даётся субъектом добровольно путём
            совершения конклюдентных действий — регистрации на платформе, публикации
            контента либо проставления отметок согласия в формах.
          </P>
        </Section>

        {/* ── 7. Способы и сроки ── */}
        <Section id="7" icon={Clock} title="Способы и сроки обработки">
          <P>
            <B>7.1.</B> Обработка ПДн осуществляется смешанным способом — как с
            использованием средств автоматизации (облачные сервисы Firebase), так и без
            использования таковых (обращения по электронной почте).
          </P>
          <P>
            <B>7.2.</B> Сроки обработки определяются исходя из целей обработки:
          </P>
          <Bullets items={[
            'Учётные и профильные данные — с момента регистрации до удаления учётной записи пользователем или Оператором.',
            'Опубликованные отзывы и оценки — бессрочно (являются частью публичной базы знаний платформы), после удаления аккаунта автора — обезличиваются (автор заменяется на «Удалённый пользователь»).',
            'Данные жалоб и модерации — в течение 3 лет для целей разрешения споров и обеспечения безопасности.',
            'Технические журналы — не более 30 дней с момента их формирования, если иное не требуется для расследования инцидентов.',
            'Заявки из формы обратной связи — не более 1 года с момента получения.',
          ]} />
          <P>
            <B>7.3.</B> По достижении целей обработки или в случае отзыва субъектом
            согласия ПДн подлежат уничтожению или обезличиванию в срок, не превышающий
            30 дней, если иное не установлено законодательством.
          </P>
        </Section>

        {/* ── 8. Трансграничная передача ── */}
        <Section id="8" icon={Globe2} title="Трансграничная передача данных">
          <P>
            <B>8.1.</B> Платформа размещена на инфраструктуре сервисов Google Firebase
            (Firebase Authentication, Cloud Firestore, Cloud Storage), предоставляемой
            компанией Google LLC. Серверы хранения данных расположены за пределами
            территории Российской Федерации.
          </P>
          <P>
            <B>8.2.</B> В соответствии с ч. 3 ст. 12 152-ФЗ трансграничная передача ПДн
            осуществляется на территорию <B>Соединённых Штатов Америки</B>. Данная
            страна не входит в перечень иностранных государств, обеспечивающих
            адекватную защиту прав субъектов ПДн.
          </P>
          <P>
            <B>8.3.</B> Правовым основанием трансграничной передачи является письменное
            согласие субъекта ПДн (выраженное путём регистрации и принятия настоящей
            Политики), а также необходимость исполнения договора, стороной которого
            является субъект (п. 2, 3 ч. 4 ст. 12 152-ФЗ).
          </P>
          <P>
            <B>8.4.</B> Оператор осознаёт возможные риски трансграничной передачи ПДн
            в страну, не обеспечивающую адекватную защиту, и рекомендует пользователям
            воздержаться от размещения на платформе сведений, раскрытие которых
            способно причинить им существенный вред.
          </P>
        </Section>

        {/* ── 9. Права субъектов ── */}
        <Section id="9" icon={UserCheck} title="Права субъектов персональных данных">
          <P>
            <B>9.1.</B> Субъект ПДн имеет права, предусмотренные главой 3 152-ФЗ:
          </P>
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            {USER_RIGHTS.map((r, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--color-sepia)] bg-[var(--color-paper)] px-5 py-4"
              >
                <p className="font-semibold text-[13px] text-[var(--color-ink)] mb-1">
                  {r.title}
                </p>
                <p className="text-[10px] tracking-[0.12em] uppercase text-[var(--color-rust)] mb-2">
                  {r.ref}
                </p>
                <p className="text-[12px] text-[var(--color-muted)] leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
          <P>
            <B>9.2.</B> Реализация прав осуществляется путём:
          </P>
          <Bullets items={[
            'Самостоятельного редактирования данных в разделе «Настройки профиля».',
            'Удаления учётной записи через кнопку «Удалить аккаунт» в настройках.',
            'Направления письменного обращения на support@unirate.ru с указанием ФИО, контактных данных и существа требования.',
          ]} />
          <P>
            <B>9.3.</B> Ответ на обращение предоставляется в срок, не превышающий 30
            календарных дней с момента получения запроса (ст. 20 152-ФЗ), если иной
            срок не предусмотрен законодательством.
          </P>
        </Section>

        {/* ── 10. Меры защиты ── */}
        <Section id="10" icon={Lock} title="Меры защиты персональных данных">
          <P>
            <B>10.1.</B> Оператор принимает необходимые правовые, организационные и
            технические меры для защиты ПДн от неправомерного или случайного доступа,
            уничтожения, изменения, блокирования, копирования, предоставления и
            распространения (ч. 1 ст. 19 152-ФЗ).
          </P>
          <div className="space-y-4 mt-4">
            {SECURITY_MEASURES.map((m, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--color-sepia)] bg-[var(--color-paper)] px-5 py-4"
              >
                <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--color-rust)] mb-3 font-semibold">
                  {m.type} меры
                </p>
                <ul className="space-y-2">
                  {m.items.map((x, j) => (
                    <li key={j} className="flex gap-2 text-[13px] text-[var(--color-ink-2)] leading-relaxed">
                      <span className="text-[var(--color-rust)]">·</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <P>
            <B>10.2.</B> Оператор не может гарантировать абсолютную защиту данных,
            однако обязуется уведомлять субъектов ПДн о фактах несанкционированного
            доступа к их данным, если такие факты станут известны, в разумные сроки
            с учётом характера инцидента.
          </P>
        </Section>

        {/* ── 11. Cookies ── */}
        <Section id="11" icon={Cookie} title="Cookies и локальное хранилище">
          <P>
            <B>11.1.</B> Платформа использует файлы cookie и механизм localStorage
            браузера для обеспечения базовой функциональности сайта: сохранения
            сессии пользователя, настроек интерфейса (темы, языка, размера шрифта),
            флагов согласий.
          </P>
          <P>
            <B>11.2.</B> Ключи, используемые в localStorage, имеют префикс{' '}
            <code className="px-1.5 py-0.5 rounded bg-[var(--color-paper-2)] text-[12px] text-[var(--color-rust)]">
              eduhub_
            </code>{' '}
            и хранят пользовательские настройки исключительно на устройстве субъекта;
            на серверы Оператора они не передаются.
          </P>
          <P>
            <B>11.3.</B> Платформа <B>не использует</B> cookie-файлы сторонних сервисов
            аналитики и рекламных сетей (Google Analytics, Яндекс.Метрика, рекламные пиксели).
          </P>
          <P>
            <B>11.4.</B> Пользователь вправе в любой момент отключить cookie или очистить
            локальное хранилище средствами браузера. Это может привести к ограничению
            функциональности платформы (например, необходимости повторной авторизации).
          </P>
        </Section>

        {/* ── 12. Публичный контент ── */}
        <Section id="12" icon={MessageSquare} title="Публичный контент и модерация">
          <P>
            <B>12.1.</B> Отзывы, комментарии, оценки, профили преподавателей и
            учебные материалы являются <B>публичным контентом</B> и доступны
            неограниченному кругу лиц (в том числе незарегистрированным посетителям).
          </P>
          <P>
            <B>12.2.</B> Публикуя отзыв, пользователь подтверждает согласие на
            распространение содержащихся в нём сведений в порядке ст. 10.1 152-ФЗ.
          </P>
          <P>
            <B>12.3.</B> При выборе опции <B>«анонимный отзыв»</B> имя и профиль
            автора скрываются от других пользователей, однако связь с учётной
            записью сохраняется во внутренней базе в целях модерации и
            предотвращения злоупотреблений. При необходимости, предусмотренной
            законодательством, информация об авторе может быть раскрыта.
          </P>
          <P>
            <B>12.4.</B> Отзыв может быть удалён или скрыт Оператором в случае
            нарушения Правил платформы (оскорбления, клевета, спам, раскрытие
            сведений о третьих лицах и пр.). Автору направляется уведомление с
            указанием причины.
          </P>
          <P>
            <B>12.5.</B> При удалении учётной записи публичные отзывы автора
            <B> обезличиваются</B> — имя автора заменяется на указание «Удалённый
            пользователь», связь с профилем разрывается, оценки сохраняются для
            корректности агрегированной статистики.
          </P>
        </Section>

        {/* ── 13. Порядок обращений ── */}
        <Section id="13" icon={Mail} title="Порядок обращений к оператору">
          <P>
            <B>13.1.</B> Обращение по вопросам обработки ПДн направляется на адрес
            электронной почты{' '}
            <a
              href="mailto:support@unirate.ru"
              className="text-[var(--color-rust)] font-medium hover:underline"
            >
              support@unirate.ru
            </a>{' '}
            с указанием:
          </P>
          <Bullets items={[
            'Фамилии, имени и отчества (при наличии) субъекта ПДн либо его представителя.',
            'Сведений об учётной записи (e-mail регистрации, идентификатор профиля).',
            'Существа требования (предоставление информации, изменение, удаление, отзыв согласия и т. д.).',
            'Контактных данных для направления ответа.',
          ]} />
          <P>
            <B>13.2.</B> При невозможности разрешить вопрос в рамках обращения к
            Оператору, субъект ПДн вправе обратиться в{' '}
            <B>Федеральную службу по надзору в сфере связи, информационных технологий
            и массовых коммуникаций (Роскомнадзор)</B> как уполномоченный орган по
            защите прав субъектов ПДн, либо в суд по месту жительства истца.
          </P>
        </Section>

        {/* ── 14. Заключительные положения ── */}
        <Section id="14" icon={FileText} title="Заключительные положения">
          <P>
            <B>14.1.</B> Настоящая Политика вступает в силу с момента её
            размещения на сайте и действует бессрочно до её замены новой
            редакцией.
          </P>
          <P>
            <B>14.2.</B> Ко всем отношениям, возникающим в связи с обработкой ПДн
            и не урегулированным настоящей Политикой, применяется законодательство
            Российской Федерации.
          </P>
          <P>
            <B>14.3.</B> В случае, если отдельные положения Политики будут признаны
            недействительными или не соответствующими законодательству, остальные
            положения сохраняют юридическую силу.
          </P>
          <P>
            <B>14.4.</B> Оператор рекомендует пользователям периодически проверять
            настоящую страницу на предмет обновлений.
          </P>
        </Section>

        {/* ═══ ПОДВАЛ ═══ */}
        <div className="mt-8 rounded-3xl border border-[var(--color-sepia)] bg-[var(--color-paper)] p-8 md:p-10">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-[var(--color-rust-wash)] flex items-center justify-center flex-shrink-0">
              <Shield size={18} className="text-[var(--color-rust)]" />
            </div>
            <div>
              <p className="font-display italic text-xl text-[var(--color-ink)] leading-tight">
                Есть вопросы по обработке данных?
              </p>
              <p className="text-[13px] text-[var(--color-muted)] mt-1">
                Напишите нам — ответим в течение 30 дней согласно ст. 20 152-ФЗ.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:support@unirate.ru"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--color-rust)] text-[#FFFDF7] text-[13px] font-semibold hover:bg-[#C55830] transition-colors"
            >
              <Mail size={14} />
              support@unirate.ru
            </a>
            <Link
              to="/terms"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--color-sepia)] bg-[var(--color-cream)] text-[var(--color-ink)] text-[13px] font-semibold hover:bg-[var(--color-paper-2)] transition-colors"
            >
              Условия использования
              <ChevronRight size={14} />
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[var(--color-sepia)] bg-[var(--color-cream)] text-[var(--color-ink)] text-[13px] font-semibold hover:bg-[var(--color-paper-2)] transition-colors"
            >
              О проекте
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-[var(--color-sepia)] flex flex-wrap justify-between items-center gap-3 text-[11px] tracking-[0.15em] uppercase text-[var(--color-muted)]">
            <span>© 2026 Unirate · СПбГУПТД</span>
            <span>Последнее обновление: {LAST_UPDATED}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════ ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ══════════════ */

function Section({ id, icon: Icon, title, children }) {
  return (
    <section
      id={`section-${id}`}
      className="scroll-mt-40 rounded-3xl border border-[var(--color-sepia)] bg-[var(--color-paper)] overflow-hidden"
    >
      <header className="flex items-center gap-4 px-7 md:px-9 py-6 border-b border-[var(--color-sepia)] bg-[var(--color-paper-2)]/40">
        <div className="w-10 h-10 rounded-2xl bg-[var(--color-rust-wash)] flex items-center justify-center flex-shrink-0">
          <Icon size={18} className="text-[var(--color-rust)]" />
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-display italic text-3xl text-[var(--color-rust)] leading-none">
            {id}.
          </span>
          <h2 className="font-display italic text-xl md:text-2xl text-[var(--color-ink)] leading-tight">
            {title}
          </h2>
        </div>
      </header>
      <div className="px-7 md:px-9 py-6 space-y-4">
        {children}
      </div>
    </section>
  )
}

function P({ children }) {
  return (
    <p className="text-[14px] leading-relaxed text-[var(--color-ink-2)]">
      {children}
    </p>
  )
}

function B({ children }) {
  return (
    <span className="font-semibold text-[var(--color-ink)]">{children}</span>
  )
}

function Bullets({ items }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((x, i) => (
        <li
          key={i}
          className="flex gap-3 text-[13px] text-[var(--color-ink-2)] leading-relaxed"
        >
          <span className="flex-shrink-0 mt-1.5 w-1 h-1 rounded-full bg-[var(--color-rust)]" />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  )
}

/* ── Подсветка совпадений в сниппете результата поиска ── */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function Highlighted({ text, query }) {
  if (!query) return text
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'))
  const lowerQ = query.toLowerCase()
  return parts.map((p, i) =>
    p.toLowerCase() === lowerQ
      ? <mark key={i} className="bg-[var(--color-rust)]/20 text-[var(--color-ink)] font-semibold rounded px-0.5">{p}</mark>
      : <span key={i}>{p}</span>
  )
}

/* ── Русское согласование числительных ── */
function pluralRu(n, one, few, many) {
  const mod10  = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
