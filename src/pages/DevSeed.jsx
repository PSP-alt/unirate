/* ═══════════════════════════════════════════════════
   DevSeed — страница заполнения тестовыми данными
   Доступна по /dev/seed, только для разработки.
   Создаёт студентов, преподавателей, материалы и оценки.
   ═══════════════════════════════════════════════════ */

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  getAuth,
} from 'firebase/auth'
import {
  doc, setDoc, collection, addDoc, serverTimestamp, getDocs, deleteDoc, query,
} from 'firebase/firestore'
import { auth, db } from '../services/firebase'
import { CheckCircle, XCircle, Loader, Database, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

/* ══════════════════════════════════
   ТЕСТОВЫЕ ДАННЫЕ
══════════════════════════════════ */

const PASSWORD = import.meta.env.VITE_SEED_PASSWORD || 'seed_' + Math.random().toString(36).slice(2)

/* ── Тестовый администратор ── */
const ADMIN = {
  email:     import.meta.env.VITE_SEED_ADMIN_EMAIL || 'admin@unirate.edu',
  password:  import.meta.env.VITE_SEED_ADMIN_PASSWORD || PASSWORD,
  firstName: 'Главный',
  lastName:  'Администратор',
}

const STUDENTS = [
  {
    email: 'anna.smirnova@student.edu',
    firstName: 'Анна',
    lastName: 'Смирнова',
    course: 2,
  },
  {
    email: 'ivan.petrov@student.edu',
    firstName: 'Иван',
    lastName: 'Петров',
    course: 3,
  },
  {
    email: 'olga.kozlova@student.edu',
    firstName: 'Ольга',
    lastName: 'Козлова',
    course: 1,
  },
  {
    email: 'maxim.volkov@student.edu',
    firstName: 'Максим',
    lastName: 'Волков',
    course: 4,
  },
]

const TEACHERS = [
  {
    email: 'a.sokolov@university.edu',
    firstName: 'Александр',
    lastName: 'Соколов',
    middleName: 'Николаевич',
    position: 'Профессор кафедры высшей математики',
    teacherType: 'lecturer',
    disciplines: ['Высшая математика', 'Линейная алгебра', 'Математический анализ'],
    bio: 'Доктор физико-математических наук, профессор. Преподаёт математику в университете более 20 лет. Автор 3 учебных пособий по высшей математике.',
    contactEmail: 'a.sokolov@university.edu',
    avatarUrl: null,
  },
  {
    email: 'n.sorokina@university.edu',
    firstName: 'Наталья',
    lastName: 'Сорокина',
    middleName: 'Владимировна',
    position: 'Доцент кафедры информатики',
    teacherType: 'practice',
    disciplines: ['Алгоритмы и структуры данных', 'Программирование на Python', 'Базы данных'],
    bio: 'Кандидат технических наук. Специализируется на алгоритмах, машинном обучении и разработке ПО. Проводит практические занятия с акцентом на реальные проекты.',
    contactEmail: 'n.sorokina@university.edu',
    avatarUrl: null,
  },
  {
    email: 'd.morozov@university.edu',
    firstName: 'Дмитрий',
    lastName: 'Морозов',
    middleName: 'Сергеевич',
    position: 'Старший преподаватель кафедры экономики',
    teacherType: 'seminar',
    disciplines: ['Микроэкономика', 'Финансовая математика', 'Эконометрика'],
    bio: 'Практикующий экономист-аналитик, ведёт семинары по экономическим дисциплинам. Консультирует бизнес по вопросам финансового моделирования.',
    contactEmail: 'd.morozov@university.edu',
    avatarUrl: null,
  },
]

/* Создадим материалы после получения uid преподавателей */
function buildMaterials(teacherUids) {
  const [sokolovId, sorokinaId, morozovId] = teacherUids
  return [
    {
      title: 'Высшая математика: интегралы и ряды — конспект лекций',
      discipline: 'Высшая математика',
      course: 2,
      type: 'PDF',
      description: 'Полный конспект лекций по разделам: несобственные интегралы, числовые ряды, степенные ряды, ряды Фурье. Включает 85 разобранных примеров.',
      teacherId: sokolovId,
      teacherName: 'Соколов А. Н.',
      fileUrl: null,
      fileSize: 2457600,
      downloadCount: 143,
    },
    {
      title: 'Линейная алгебра: матрицы, определители, системы уравнений',
      discipline: 'Линейная алгебра',
      course: 1,
      type: 'PDF',
      description: 'Методическое пособие по линейной алгебре с теорией и задачами. Подробно разобраны операции над матрицами, метод Гаусса и теорема Крамера.',
      teacherId: sokolovId,
      teacherName: 'Соколов А. Н.',
      fileUrl: null,
      fileSize: 1843200,
      downloadCount: 98,
    },
    {
      title: 'Аналитическая геометрия: прямые и кривые на плоскости',
      discipline: 'Математический анализ',
      course: 1,
      type: 'DOCX',
      description: 'Практикум по аналитической геометрии. 60 задач с подробными решениями — от уравнений прямой до коник: эллипс, гипербола, парабола.',
      teacherId: sokolovId,
      teacherName: 'Соколов А. Н.',
      fileUrl: null,
      fileSize: 921600,
      downloadCount: 75,
    },
    {
      title: 'Алгоритмы и структуры данных: учебное пособие',
      discipline: 'Алгоритмы и структуры данных',
      course: 2,
      type: 'PDF',
      description: 'Учебное пособие охватывает основные структуры данных (стек, очередь, дерево, граф) и алгоритмы сортировки с анализом сложности O-нотацией.',
      teacherId: sorokinaId,
      teacherName: 'Сорокина Н. В.',
      fileUrl: null,
      fileSize: 3145728,
      downloadCount: 212,
    },
    {
      title: 'Python для начинающих: от нуля до первой программы',
      discipline: 'Программирование на Python',
      course: 1,
      type: 'PDF',
      description: 'Вводный курс по Python. Переменные, циклы, функции, списки, словари, ООП. Каждая тема — с практическими заданиями и разбором типичных ошибок.',
      teacherId: sorokinaId,
      teacherName: 'Сорокина Н. В.',
      fileUrl: null,
      fileSize: 2097152,
      downloadCount: 387,
    },
    {
      title: 'Базы данных: проектирование и SQL-запросы',
      discipline: 'Базы данных',
      course: 3,
      type: 'DOCX',
      description: 'Конспект лекций и практических занятий по базам данных: реляционная модель, нормализация, DDL/DML, сложные JOIN-запросы, оконные функции.',
      teacherId: sorokinaId,
      teacherName: 'Сорокина Н. В.',
      fileUrl: null,
      fileSize: 1572864,
      downloadCount: 156,
    },
    {
      title: 'Микроэкономика: базовый курс. Теория и задачи',
      discipline: 'Микроэкономика',
      course: 2,
      type: 'PDF',
      description: 'Полный курс микроэкономики: теория потребителя, производства, рыночные структуры. 40 практических задач с решениями к семинарским занятиям.',
      teacherId: morozovId,
      teacherName: 'Морозов Д. С.',
      fileUrl: null,
      fileSize: 2621440,
      downloadCount: 89,
    },
    {
      title: 'Финансовая математика: дисконтирование и аннуитеты',
      discipline: 'Финансовая математика',
      course: 3,
      type: 'PDF',
      description: 'Методичка по финансовой математике: простые и сложные проценты, приведённая стоимость, NPV, IRR, аннуитеты. Расчёты с примерами в Excel.',
      teacherId: morozovId,
      teacherName: 'Морозов Д. С.',
      fileUrl: null,
      fileSize: 1310720,
      downloadCount: 64,
    },
  ]
}

/* Оценки — создадим после получения uid студентов и преподавателей */
function buildRatings(studentUids, teacherUids) {
  const [annaId, ivanId, olgaId, maximId] = studentUids
  const [sokolovId, sorokinaId, morozovId] = teacherUids

  return [
    /* Соколов — математика */
    {
      teacherId: sokolovId,
      studentId: annaId,
      studentCourse: 2,
      criteriaScores: { knowledge: 9, explanation: 8, availability: 7, fairness: 9, materials: 9 },
      averageScore: 8.4,
      comment: 'Александр Николаевич объясняет очень чётко и структурированно. Лекции насыщены примерами. Единственный минус — иногда говорит быстро.',
      status: 'approved',
    },
    {
      teacherId: sokolovId,
      studentId: ivanId,
      studentCourse: 3,
      criteriaScores: { knowledge: 10, explanation: 9, availability: 6, fairness: 8, materials: 9 },
      averageScore: 8.4,
      comment: 'Лучший преподаватель по математике. Глубочайшие знания, объясняет любой уровень сложности. На консультации попасть сложновато.',
      status: 'approved',
    },
    {
      teacherId: sokolovId,
      studentId: olgaId,
      studentCourse: 1,
      criteriaScores: { knowledge: 9, explanation: 7, availability: 8, fairness: 9, materials: 10 },
      averageScore: 8.6,
      comment: 'Первая сессия по высшей математике прошла благодаря его методичкам. Материалы очень подробные. Объяснение иногда сложновато для новичка.',
      status: 'approved',
    },
    {
      teacherId: sokolovId,
      studentId: maximId,
      studentCourse: 4,
      criteriaScores: { knowledge: 10, explanation: 9, availability: 7, fairness: 10, materials: 9 },
      averageScore: 9.0,
      comment: 'Четыре года учусь у Александра Николаевича — один из лучших преподавателей кафедры. Строгий, но справедливый.',
      status: 'approved',
    },

    /* Сорокина — информатика */
    {
      teacherId: sorokinaId,
      studentId: annaId,
      studentCourse: 2,
      criteriaScores: { knowledge: 9, explanation: 9, availability: 9, fairness: 8, materials: 8 },
      averageScore: 8.6,
      comment: 'Наталья Владимировна проводит практику очень интересно. Задания реальные, не из учебника. Всегда готова помочь разобраться.',
      status: 'approved',
    },
    {
      teacherId: sorokinaId,
      studentId: ivanId,
      studentCourse: 3,
      criteriaScores: { knowledge: 10, explanation: 9, availability: 8, fairness: 9, materials: 9 },
      averageScore: 9.0,
      comment: 'Практические занятия по алгоритмам — просто огонь. После её курса я смог пройти стажировку в IT-компании. Огромное спасибо!',
      status: 'approved',
    },
    {
      teacherId: sorokinaId,
      studentId: maximId,
      studentCourse: 4,
      criteriaScores: { knowledge: 8, explanation: 8, availability: 9, fairness: 9, materials: 7 },
      averageScore: 8.2,
      comment: 'Хороший преподаватель, практика полезная. Иногда не хватает теоретической базы — сразу бросают в практику.',
      status: 'approved',
    },

    /* Морозов — экономика */
    {
      teacherId: morozovId,
      studentId: ivanId,
      studentCourse: 3,
      criteriaScores: { knowledge: 8, explanation: 7, availability: 7, fairness: 7, materials: 8 },
      averageScore: 7.4,
      comment: 'Семинары по микроэкономике нормальные, но бывает скучновато. Задачи интересные, практическая часть ценная.',
      status: 'approved',
    },
    {
      teacherId: morozovId,
      studentId: olgaId,
      studentCourse: 1,
      criteriaScores: { knowledge: 7, explanation: 7, availability: 6, fairness: 8, materials: 7 },
      averageScore: 7.0,
      comment: 'Дмитрий Сергеевич знает предмет, но объясняет быстро. Для первого курса сложновато. Хотелось бы больше примеров.',
      status: 'approved',
    },
    {
      teacherId: morozovId,
      studentId: maximId,
      studentCourse: 4,
      criteriaScores: { knowledge: 9, explanation: 8, availability: 7, fairness: 8, materials: 8 },
      averageScore: 8.0,
      comment: 'Финансовая математика у Морозова — очень полезный курс. Реальные кейсы из практики, хорошие методички.',
      status: 'approved',
    },
  ]
}

/* ══════════════════════════════════
   КОМПОНЕНТ
══════════════════════════════════ */

function LogLine({ item }) {
  const icons = {
    pending: <Loader size={14} className="animate-spin text-text-secondary" />,
    ok:      <CheckCircle size={14} className="text-success" />,
    error:   <XCircle size={14} className="text-error" />,
    info:    <span className="w-3.5 h-3.5 rounded-full bg-accent-blue-light inline-block" />,
  }
  return (
    <div className="flex items-start gap-2 text-sm font-body py-0.5">
      <span className="mt-0.5 flex-shrink-0">{icons[item.status]}</span>
      <span className={item.status === 'error' ? 'text-error' : 'text-text-primary'}>
        {item.text}
      </span>
    </div>
  )
}

export default function DevSeed() {
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [log, setLog] = useState([])
  const [showAccounts, setShowAccounts] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [clearMsg, setClearMsg] = useState('')

  const append = (text, status = 'ok') =>
    setLog((prev) => [...prev, { text, status }])

  async function clearRatings() {
    setClearing(true)
    setClearMsg('')
    try {
      const snap = await getDocs(query(collection(db, 'ratings')))
      let count = 0
      for (const d of snap.docs) {
        await deleteDoc(d.ref)
        count++
      }
      setClearMsg(`Удалено ${count} оценок. Обновите страницу профиля преподавателя.`)
    } catch (e) {
      setClearMsg('Ошибка: ' + e.message)
    }
    setClearing(false)
  }

  /* Создаём или логинимся в аккаунт, возвращаем uid */
  async function ensureUser(email, password, displayName) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      append(`✓ Создан: ${displayName} (${email})`)
      return cred.user.uid
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        try {
          const cred = await signInWithEmailAndPassword(auth, email, password)
          append(`↩ Уже существует, вошли: ${displayName}`)
          return cred.user.uid
        } catch {
          append(`✗ Ошибка входа в ${email}`, 'error')
          return null
        }
      }
      append(`✗ ${displayName}: ${err.message}`, 'error')
      return null
    }
  }

  async function runSeed() {
    setRunning(true)
    setLog([])
    setDone(false)

    /* ── 0. Администратор ── */
    append('── Создаём администратора ──', 'info')
    const adminUid = await ensureUser(ADMIN.email, ADMIN.password, `${ADMIN.firstName} ${ADMIN.lastName}`)
    if (adminUid) {
      await setDoc(doc(db, 'users', adminUid), {
        uid:       adminUid,
        email:     ADMIN.email,
        firstName: ADMIN.firstName,
        lastName:  ADMIN.lastName,
        role:      'admin',
        isActive:  true,
        createdAt: serverTimestamp(),
      }, { merge: true })
      append(`  ✓ Администратор создан: ${ADMIN.email} / ${ADMIN.password}`)
      await signOut(auth)
    }

    /* ── 1. Студенты ── */
    append('── Создаём студентов ──', 'info')
    const studentUids = []
    for (const s of STUDENTS) {
      const uid = await ensureUser(s.email, PASSWORD, `${s.firstName} ${s.lastName}`)
      if (!uid) continue
      studentUids.push(uid)
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: s.email,
        firstName: s.firstName,
        lastName: s.lastName,
        role: 'student',
        course: s.course,
        avatarUrl: null,
        isActive: true,
        createdAt: serverTimestamp(),
      }, { merge: true })
      await signOut(auth)
    }

    /* ── 2. Преподаватели ── */
    append('── Создаём преподавателей ──', 'info')
    const teacherUids = []
    for (const t of TEACHERS) {
      const uid = await ensureUser(t.email, PASSWORD, `${t.firstName} ${t.lastName}`)
      if (!uid) continue
      teacherUids.push(uid)

      /* users документ */
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: t.email,
        firstName: t.firstName,
        lastName: t.lastName,
        role: 'teacher',
        course: null,
        avatarUrl: t.avatarUrl,
        isActive: true,
        createdAt: serverTimestamp(),
      }, { merge: true })

      /* teachers документ */
      await setDoc(doc(db, 'teachers', uid), {
        userId: uid,
        firstName: t.firstName,
        lastName: t.lastName,
        middleName: t.middleName,
        position: t.position,
        teacherType: t.teacherType,
        disciplines: t.disciplines,
        bio: t.bio,
        avatarUrl: t.avatarUrl,
        contactEmail: t.contactEmail,
        ratingsEnabled: true,
        averageRating: 0,
        ratingsCount: 0,
        isActive: true,
        createdAt: serverTimestamp(),
      }, { merge: true })
      append(`  → профиль преподавателя создан`)

      await signOut(auth)
    }

    /* ── 3. Материалы ── */
    append('── Создаём учебные материалы ──', 'info')
    const mats = buildMaterials(teacherUids)
    for (const m of mats) {
      await addDoc(collection(db, 'materials'), {
        ...m,
        createdAt: serverTimestamp(),
      })
      append(`  + "${m.title.slice(0, 50)}..."`)
    }

    append('══ Готово! Студенты, преподаватели и материалы созданы ══', 'info')
    append('   Оценки студенты ставят сами через профили преподавателей.', 'info')
    setRunning(false)
    setDone(true)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-2">
        <Database size={28} className="text-accent-blue" />
        <h1 className="font-heading text-3xl font-bold text-accent-blue">
          Тестовые данные
        </h1>
      </div>
      <p className="text-text-secondary mb-8">
        Создаёт студентов, преподавателей, учебные материалы и оценки в Firebase.
        Все аккаунты с паролем <code className="bg-accent-blue-light text-accent-blue px-2 py-0.5 rounded font-mono text-sm">123456</code>
      </p>

      {/* Аккаунты */}
      <div className="bg-bg-card border border-border rounded-card p-5 mb-6">
        <button
          className="flex items-center justify-between w-full text-left"
          onClick={() => setShowAccounts(!showAccounts)}
        >
          <span className="font-medium text-text-primary">
            Что будет создано
          </span>
          {showAccounts ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showAccounts && (
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="font-semibold mb-2" style={{color:'var(--color-rust)'}}>🛡 Администратор:</p>
              <p className="text-text-secondary ml-3 font-mono bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-xl">
                {ADMIN.email} / <strong>{ADMIN.password}</strong>
              </p>
            </div>
            <div>
              <p className="font-semibold text-success mb-2">Студенты:</p>
              {STUDENTS.map(s => (
                <p key={s.email} className="text-text-secondary ml-3">
                  {s.lastName} {s.firstName} — {s.course} курс ({s.email})
                </p>
              ))}
            </div>
            <div>
              <p className="font-semibold text-accent-blue mb-2">Преподаватели:</p>
              {TEACHERS.map(t => (
                <p key={t.email} className="text-text-secondary ml-3">
                  {t.lastName} {t.firstName} — {t.position.split(' ')[0]} ({t.email})
                </p>
              ))}
            </div>
            <div>
              <p className="font-semibold text-accent-gold mb-2">
                Учебные материалы: 8 штук
              </p>
              <p className="font-semibold text-text-secondary mb-2">
                Оценки: 10 штук (одобренные)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Очистить оценки */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
        <h3 className="font-semibold text-red-700 mb-1 flex items-center gap-2">
          <Trash2 size={16} /> Очистить все оценки
        </h3>
        <p className="text-sm text-red-600 mb-3">Удаляет все документы из коллекции <code>ratings</code>. Нужно если студенты уже «оценили» из seed-данных.</p>
        <button
          onClick={clearRatings}
          disabled={clearing}
          className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {clearing ? 'Удаляем...' : 'Удалить все оценки'}
        </button>
        {clearMsg && <p className="text-sm text-red-700 mt-2 font-medium">{clearMsg}</p>}
      </div>

      {/* Кнопка запуска */}
      {!done && (
        <button
          onClick={runSeed}
          disabled={running}
          className="w-full py-3 bg-accent-blue text-white font-medium rounded-[8px] flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-accent-blue-hover transition-colors"
        >
          {running ? (
            <><Loader size={18} className="animate-spin" /> Создаём данные...</>
          ) : (
            <><Database size={18} /> Заполнить базу данных</>
          )}
        </button>
      )}

      {done && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-success-tint border border-success/30 rounded-card text-success font-medium"
        >
          <CheckCircle size={20} />
          База заполнена! Теперь можно войти под любым тестовым аккаунтом.
        </motion.div>
      )}

      {/* Лог */}
      {log.length > 0 && (
        <div className="mt-6 bg-bg-card border border-border rounded-card p-5 max-h-96 overflow-y-auto">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
            Лог
          </p>
          {log.map((item, i) => <LogLine key={i} item={item} />)}
        </div>
      )}
    </div>
  )
}
