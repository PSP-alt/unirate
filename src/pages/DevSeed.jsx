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
  doc, setDoc, collection, addDoc, serverTimestamp, getDocs, deleteDoc, query, increment, where, getCountFromServer,
} from 'firebase/firestore'
import { auth, db, storage } from '../services/firebase'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { jsPDF } from 'jspdf'
import { CheckCircle, XCircle, Loader, Database, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

/* ══════════════════════════════════
   ТЕСТОВЫЕ ДАННЫЕ
══════════════════════════════════ */

const PASSWORD = import.meta.env.VITE_SEED_PASSWORD || 'Test123456'

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
    teacherTypes: ['lecturer'],
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
    teacherTypes: ['practice'],
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
    teacherTypes: ['seminar'],
    disciplines: ['Микроэкономика', 'Финансовая математика', 'Эконометрика'],
    bio: 'Практикующий экономист-аналитик, ведёт семинары по экономическим дисциплинам. Консультирует бизнес по вопросам финансового моделирования.',
    contactEmail: 'd.morozov@university.edu',
    avatarUrl: null,
  },
]

/* ══════════════════════════════════
   ГЕНЕРАЦИЯ PDF-ФАЙЛОВ
══════════════════════════════════ */

/* Содержимое каждого материала — реальный учебный текст */
const MATERIAL_CONTENT = {
  'integrals': {
    title: 'Высшая математика: интегралы и ряды',
    subtitle: 'Конспект лекций',
    sections: [
      { heading: '1. Несобственные интегралы', text: 'Несобственный интеграл первого рода — это предел определённого интеграла, когда один из пределов интегрирования стремится к бесконечности.\n\nОпределение: Пусть f(x) непрерывна на [a, +∞). Тогда:\n∫[a,+∞) f(x)dx = lim(b→+∞) ∫[a,b] f(x)dx\n\nЕсли предел существует и конечен, то интеграл сходится.\n\nПримеры:\n• ∫[1,+∞) 1/x² dx = 1 (сходится)\n• ∫[1,+∞) 1/x dx = +∞ (расходится)\n\nПризнак сравнения: Если 0 ≤ f(x) ≤ g(x) и ∫g сходится, то ∫f тоже сходится.' },
      { heading: '2. Числовые ряды', text: 'Числовой ряд — это выражение вида: Σ(n=1,∞) aₙ = a₁ + a₂ + a₃ + ...\n\nЧастичная сумма: Sₙ = a₁ + a₂ + ... + aₙ\nРяд сходится, если последовательность {Sₙ} имеет конечный предел.\n\nНеобходимый признак сходимости:\nЕсли ряд Σaₙ сходится, то lim(n→∞) aₙ = 0.\nВнимание: обратное неверно! (гармонический ряд)\n\nПризнак Даламбера: lim |aₙ₊₁/aₙ| = L\n• L < 1 → ряд сходится\n• L > 1 → ряд расходится\n• L = 1 → признак не работает' },
      { heading: '3. Степенные ряды', text: 'Степенной ряд: Σ(n=0,∞) cₙ(x-a)ⁿ\n\nРадиус сходимости R определяет интервал (a-R, a+R), в котором ряд сходится абсолютно.\n\nФормула Коши-Адамара: 1/R = lim sup ⁿ√|cₙ|\n\nРазложения элементарных функций:\n• eˣ = Σ xⁿ/n!, R = ∞\n• sin x = Σ (-1)ⁿ x²ⁿ⁺¹/(2n+1)!, R = ∞\n• 1/(1-x) = Σ xⁿ, R = 1' },
    ],
  },
  'linear-algebra': {
    title: 'Линейная алгебра',
    subtitle: 'Матрицы, определители, системы уравнений',
    sections: [
      { heading: '1. Матрицы и операции', text: 'Матрица — прямоугольная таблица чисел A = (aᵢⱼ), i=1..m, j=1..n.\n\nОперации:\n• Сложение: (A+B)ᵢⱼ = aᵢⱼ + bᵢⱼ (матрицы одного размера)\n• Умножение на скаляр: (λA)ᵢⱼ = λ·aᵢⱼ\n• Умножение матриц: (AB)ᵢⱼ = Σₖ aᵢₖ·bₖⱼ\n  Внимание: AB ≠ BA в общем случае!\n\nТранспонирование: (Aᵀ)ᵢⱼ = aⱼᵢ\nСвойства: (AB)ᵀ = BᵀAᵀ, (A+B)ᵀ = Aᵀ+Bᵀ' },
      { heading: '2. Определители', text: 'Определитель квадратной матрицы — число, характеризующее матрицу.\n\nДля 2×2: det A = a₁₁a₂₂ - a₁₂a₂₁\n\nДля 3×3: правило Саррюса или разложение по строке/столбцу.\n\nСвойства:\n• det(AB) = det A · det B\n• det(Aᵀ) = det A\n• При перестановке строк знак меняется\n• Если строка = 0, то det = 0\n• det(λA) = λⁿ det A (для n×n)' },
      { heading: '3. Метод Гаусса', text: 'Метод Гаусса — последовательное исключение неизвестных.\n\nЭлементарные преобразования:\n1) Перестановка строк\n2) Умножение строки на число ≠ 0\n3) Прибавление к строке другой строки, умноженной на число\n\nПрямой ход: приведение к ступенчатому виду\nОбратный ход: нахождение неизвестных снизу вверх\n\nТеорема Кронекера-Капелли:\nСистема совместна ⟺ rang A = rang(A|b)' },
    ],
  },
  'analytic-geometry': {
    title: 'Аналитическая геометрия',
    subtitle: 'Прямые и кривые на плоскости',
    sections: [
      { heading: '1. Уравнения прямой', text: 'Общее уравнение: Ax + By + C = 0\n\nС угловым коэффициентом: y = kx + b, где k = tg α\n\nЧерез две точки: (x-x₁)/(x₂-x₁) = (y-y₁)/(y₂-y₁)\n\nВ отрезках: x/a + y/b = 1\n\nРасстояние от точки до прямой:\nd = |Ax₀ + By₀ + C| / √(A² + B²)\n\nУгол между прямыми: tg φ = |k₁-k₂| / (1+k₁k₂)' },
      { heading: '2. Кривые второго порядка', text: 'Эллипс: x²/a² + y²/b² = 1\nЭксцентриситет: e = c/a, где c² = a² - b²\nПри e = 0 — окружность\n\nГипербола: x²/a² - y²/b² = 1\nАсимптоты: y = ±(b/a)x\ne = c/a > 1\n\nПарабола: y² = 2px\nФокус: F(p/2, 0)\nДиректриса: x = -p/2' },
    ],
  },
  'algorithms': {
    title: 'Алгоритмы и структуры данных',
    subtitle: 'Учебное пособие',
    sections: [
      { heading: '1. Сложность алгоритмов', text: 'O-нотация описывает верхнюю границу роста функции.\n\nОсновные классы сложности:\n• O(1) — константная (доступ к элементу массива)\n• O(log n) — логарифмическая (бинарный поиск)\n• O(n) — линейная (линейный поиск)\n• O(n log n) — линеарифмическая (merge sort)\n• O(n²) — квадратичная (bubble sort)\n• O(2ⁿ) — экспоненциальная (полный перебор)\n\nПравила:\n• Константы отбрасываются: O(3n) = O(n)\n• Берётся старший член: O(n² + n) = O(n²)' },
      { heading: '2. Структуры данных', text: 'Массив — последовательность элементов в памяти.\nДоступ: O(1), поиск: O(n), вставка: O(n)\n\nСвязный список — узлы со ссылками на следующий.\nДоступ: O(n), вставка в начало: O(1)\n\nСтек (LIFO): push O(1), pop O(1)\nПримеры: проверка скобок, обход в глубину\n\nОчередь (FIFO): enqueue O(1), dequeue O(1)\nПримеры: BFS, планировщик задач\n\nХеш-таблица: поиск O(1) в среднем\nКоллизии: цепочки или открытая адресация' },
      { heading: '3. Сортировки', text: 'Сортировка пузырьком: O(n²)\nСравниваем соседние элементы, меняем если нужно.\n\nСортировка вставками: O(n²)\nКаждый элемент вставляем в нужное место.\n\nСортировка слиянием: O(n log n)\nРазделяй и властвуй. Стабильная.\n\nБыстрая сортировка: O(n log n) в среднем\nВыбираем опорный элемент, разделяем на две части.\nВ худшем случае O(n²), но на практике — самая быстрая.' },
    ],
  },
  'python': {
    title: 'Python для начинающих',
    subtitle: 'От нуля до первой программы',
    sections: [
      { heading: '1. Переменные и типы данных', text: 'Python — интерпретируемый язык с динамической типизацией.\n\nОсновные типы:\n• int — целые числа: x = 42\n• float — дробные: pi = 3.14\n• str — строки: name = "Python"\n• bool — логические: flag = True\n• list — списки: nums = [1, 2, 3]\n• dict — словари: d = {"key": "value"}\n\nПреобразование типов:\nint("42") → 42\nstr(3.14) → "3.14"\nfloat("2.5") → 2.5' },
      { heading: '2. Условия и циклы', text: 'Условный оператор:\nif x > 0:\n    print("Положительное")\nelif x == 0:\n    print("Ноль")\nelse:\n    print("Отрицательное")\n\nЦикл for:\nfor i in range(10):\n    print(i)  # 0, 1, ..., 9\n\nfor item in ["a", "b", "c"]:\n    print(item)\n\nЦикл while:\nwhile x > 0:\n    x -= 1\n\nbreak — выход из цикла\ncontinue — переход к следующей итерации' },
      { heading: '3. Функции', text: 'Определение функции:\ndef greet(name):\n    return f"Привет, {name}!"\n\nАргументы по умолчанию:\ndef power(x, n=2):\n    return x ** n\n\npower(3)     → 9\npower(3, 3)  → 27\n\n*args — произвольное число аргументов:\ndef summ(*args):\n    return sum(args)\n\n**kwargs — именованные аргументы:\ndef info(**kwargs):\n    for k, v in kwargs.items():\n        print(f"{k}: {v}")' },
    ],
  },
  'databases': {
    title: 'Базы данных',
    subtitle: 'Проектирование и SQL-запросы',
    sections: [
      { heading: '1. Реляционная модель', text: 'Реляционная БД хранит данные в таблицах (отношениях).\n\nОсновные понятия:\n• Таблица (отношение) — набор строк и столбцов\n• Строка (кортеж) — одна запись\n• Столбец (атрибут) — поле данных\n• Первичный ключ (PK) — уникальный идентификатор\n• Внешний ключ (FK) — ссылка на другую таблицу\n\nТипы связей:\n• 1:1 — один к одному (паспорт ↔ человек)\n• 1:N — один ко многим (автор → книги)\n• M:N — многие ко многим (студенты ↔ курсы)' },
      { heading: '2. SQL: основные запросы', text: 'SELECT — выборка данных:\nSELECT name, age FROM users WHERE age > 18;\n\nINSERT — вставка:\nINSERT INTO users (name, age) VALUES (\'Иван\', 20);\n\nUPDATE — обновление:\nUPDATE users SET age = 21 WHERE name = \'Иван\';\n\nDELETE — удаление:\nDELETE FROM users WHERE age < 18;\n\nJOIN — объединение таблиц:\nSELECT u.name, o.total\nFROM users u\nJOIN orders o ON u.id = o.user_id;' },
      { heading: '3. Нормализация', text: '1НФ: Атомарность значений. Нет повторяющихся групп.\n  ✗ телефоны = "123, 456"\n  ✓ отдельные записи для каждого телефона\n\n2НФ: 1НФ + каждый неключевой атрибут зависит от всего ключа.\n  Если PK составной — нет частичных зависимостей.\n\n3НФ: 2НФ + нет транзитивных зависимостей.\n  A → B → C: C зависит от A транзитивно через B.\n  Решение: вынести B и C в отдельную таблицу.\n\nНФБК (Бойса-Кодда): каждый детерминант — потенциальный ключ.' },
    ],
  },
  'microeconomics': {
    title: 'Микроэкономика: базовый курс',
    subtitle: 'Теория и задачи',
    sections: [
      { heading: '1. Спрос и предложение', text: 'Закон спроса: при росте цены объём спроса падает (при прочих равных).\nQd = a - bP\n\nЗакон предложения: при росте цены объём предложения растёт.\nQs = c + dP\n\nРыночное равновесие: Qd = Qs\nP* = (a - c) / (b + d)\n\nЭластичность спроса по цене:\nEd = (ΔQ/Q) / (ΔP/P)\n• |Ed| > 1 — эластичный спрос\n• |Ed| < 1 — неэластичный спрос\n• |Ed| = 1 — единичная эластичность' },
      { heading: '2. Теория потребителя', text: 'Полезность — степень удовлетворения от потребления.\n\nПредельная полезность MU — добавочная полезность от ещё одной единицы.\nЗакон убывающей предельной полезности.\n\nБюджетное ограничение: P₁X₁ + P₂X₂ ≤ I\nНаклон: -P₁/P₂\n\nОптимум потребителя:\nMU₁/P₁ = MU₂/P₂ (правило равных предельных полезностей)\n\nКривые безразличия — множества наборов с одинаковой полезностью.\nMRS = MU₁/MU₂ = P₁/P₂ в точке оптимума.' },
    ],
  },
  'financial-math': {
    title: 'Финансовая математика',
    subtitle: 'Дисконтирование и аннуитеты',
    sections: [
      { heading: '1. Простые и сложные проценты', text: 'Простые проценты: S = P(1 + nr)\nгде P — начальная сумма, n — число периодов, r — ставка.\n\nСложные проценты: S = P(1 + r)ⁿ\nКапитализация — проценты начисляются на проценты.\n\nНоминальная vs эффективная ставка:\nrₑ = (1 + rₙ/m)ᵐ - 1\nгде m — число начислений в году.\n\nПример: 12% годовых с ежемесячной капитализацией:\nrₑ = (1 + 0.12/12)¹² - 1 = 12.68%' },
      { heading: '2. Дисконтирование и NPV', text: 'Приведённая стоимость (PV) — сегодняшняя цена будущего платежа.\nPV = FV / (1 + r)ⁿ\n\nЧистая приведённая стоимость (NPV):\nNPV = -I₀ + Σ CFₜ / (1 + r)ᵗ\n• NPV > 0 → проект выгоден\n• NPV < 0 → проект убыточен\n\nIRR — внутренняя норма доходности:\nСтавка r, при которой NPV = 0.\nЕсли IRR > требуемая доходность → проект принимается.\n\nАннуитет — серия равных платежей:\nPV = PMT × [1 - (1+r)⁻ⁿ] / r' },
    ],
  },
}

/* Генерация PDF из контента */
function generatePDF(contentKey) {
  const content = MATERIAL_CONTENT[contentKey]
  if (!content) return null

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  /* Заголовок */
  pdf.setFontSize(22)
  pdf.setFont('helvetica', 'bold')
  pdf.text(content.title, 105, 30, { align: 'center' })

  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'normal')
  pdf.text(content.subtitle, 105, 40, { align: 'center' })

  pdf.setFontSize(10)
  pdf.setTextColor(120)
  pdf.text('UniRate — учебные материалы', 105, 50, { align: 'center' })
  pdf.setTextColor(0)

  let y = 65

  for (const section of content.sections) {
    if (y > 250) { pdf.addPage(); y = 25 }

    /* Заголовок раздела */
    pdf.setFontSize(14)
    pdf.setFont('helvetica', 'bold')
    pdf.text(section.heading, 15, y)
    y += 8

    /* Текст раздела */
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    const lines = pdf.splitTextToSize(section.text, 175)
    for (const line of lines) {
      if (y > 280) { pdf.addPage(); y = 25 }
      pdf.text(line, 15, y)
      y += 5
    }
    y += 8
  }

  /* Подвал */
  const pageCount = pdf.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(8)
    pdf.setTextColor(150)
    pdf.text(`Стр. ${i} из ${pageCount}`, 105, 290, { align: 'center' })
    pdf.text('UniRate Platform', 190, 290, { align: 'right' })
  }

  return pdf.output('blob')
}

/* Создадим материалы после получения uid преподавателей */
function buildMaterials(teacherUids) {
  const [sokolovId, sorokinaId, morozovId] = teacherUids
  return [
    {
      title: 'Высшая математика: интегралы и ряды — конспект лекций',
      discipline: 'Высшая математика',
      course: 2,
      type: 'PDF',
      contentKey: 'integrals',
      fileName: 'vysshaya_matematika_integraly.pdf',
      description: 'Полный конспект лекций по разделам: несобственные интегралы, числовые ряды, степенные ряды, ряды Фурье. Включает 85 разобранных примеров.',
      teacherId: sokolovId,
      teacherName: 'Соколов А. Н.',
      fileUrl: null,
      fileSize: 0,
      downloadCount: 143,
    },
    {
      title: 'Линейная алгебра: матрицы, определители, системы уравнений',
      discipline: 'Линейная алгебра',
      course: 1,
      type: 'PDF',
      contentKey: 'linear-algebra',
      fileName: 'lineynaya_algebra.pdf',
      description: 'Методическое пособие по линейной алгебре с теорией и задачами. Подробно разобраны операции над матрицами, метод Гаусса и теорема Крамера.',
      teacherId: sokolovId,
      teacherName: 'Соколов А. Н.',
      fileUrl: null,
      fileSize: 0,
      downloadCount: 98,
    },
    {
      title: 'Аналитическая геометрия: прямые и кривые на плоскости',
      discipline: 'Математический анализ',
      course: 1,
      type: 'PDF',
      contentKey: 'analytic-geometry',
      fileName: 'analiticheskaya_geometriya.pdf',
      description: 'Практикум по аналитической геометрии. 60 задач с подробными решениями — от уравнений прямой до коник: эллипс, гипербола, парабола.',
      teacherId: sokolovId,
      teacherName: 'Соколов А. Н.',
      fileUrl: null,
      fileSize: 0,
      downloadCount: 75,
    },
    {
      title: 'Алгоритмы и структуры данных: учебное пособие',
      discipline: 'Алгоритмы и структуры данных',
      course: 2,
      type: 'PDF',
      contentKey: 'algorithms',
      fileName: 'algoritmy_i_struktury_dannyh.pdf',
      description: 'Учебное пособие охватывает основные структуры данных (стек, очередь, дерево, граф) и алгоритмы сортировки с анализом сложности O-нотацией.',
      teacherId: sorokinaId,
      teacherName: 'Сорокина Н. В.',
      fileUrl: null,
      fileSize: 0,
      downloadCount: 212,
    },
    {
      title: 'Python для начинающих: от нуля до первой программы',
      discipline: 'Программирование на Python',
      course: 1,
      type: 'PDF',
      contentKey: 'python',
      fileName: 'python_dlya_nachinayushchih.pdf',
      description: 'Вводный курс по Python. Переменные, циклы, функции, списки, словари, ООП. Каждая тема — с практическими заданиями и разбором типичных ошибок.',
      teacherId: sorokinaId,
      teacherName: 'Сорокина Н. В.',
      fileUrl: null,
      fileSize: 0,
      downloadCount: 387,
    },
    {
      title: 'Базы данных: проектирование и SQL-запросы',
      discipline: 'Базы данных',
      course: 3,
      type: 'PDF',
      contentKey: 'databases',
      fileName: 'bazy_dannyh_sql.pdf',
      description: 'Конспект лекций и практических занятий по базам данных: реляционная модель, нормализация, DDL/DML, сложные JOIN-запросы, оконные функции.',
      teacherId: sorokinaId,
      teacherName: 'Сорокина Н. В.',
      fileUrl: null,
      fileSize: 0,
      downloadCount: 156,
    },
    {
      title: 'Микроэкономика: базовый курс. Теория и задачи',
      discipline: 'Микроэкономика',
      course: 2,
      type: 'PDF',
      contentKey: 'microeconomics',
      fileName: 'mikroekonomika.pdf',
      description: 'Полный курс микроэкономики: теория потребителя, производства, рыночные структуры. 40 практических задач с решениями к семинарским занятиям.',
      teacherId: morozovId,
      teacherName: 'Морозов Д. С.',
      fileUrl: null,
      fileSize: 0,
      downloadCount: 89,
    },
    {
      title: 'Финансовая математика: дисконтирование и аннуитеты',
      discipline: 'Финансовая математика',
      course: 3,
      type: 'PDF',
      contentKey: 'financial-math',
      fileName: 'finansovaya_matematika.pdf',
      description: 'Методичка по финансовой математике: простые и сложные проценты, приведённая стоимость, NPV, IRR, аннуитеты. Расчёты с примерами в Excel.',
      teacherId: morozovId,
      teacherName: 'Морозов Д. С.',
      fileUrl: null,
      fileSize: 0,
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
        teacherTypes: t.teacherTypes || [t.teacherType],
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

    /* ── 3. Материалы (с PDF и загрузкой в Storage) ── */
    append('── Создаём учебные материалы с PDF ──', 'info')
    const mats = buildMaterials(teacherUids)

    /* Для загрузки материалов логинимся под преподавателем-владельцем */
    const teacherEmails = {}
    for (let i = 0; i < teacherUids.length; i++) {
      teacherEmails[teacherUids[i]] = TEACHERS[i].email
    }

    let currentTeacherId = null
    for (const m of mats) {
      try {
        /* Логинимся под преподавателем если сменился */
        if (m.teacherId !== currentTeacherId) {
          if (currentTeacherId) await signOut(auth)
          const email = teacherEmails[m.teacherId]
          if (email) {
            await signInWithEmailAndPassword(auth, email, PASSWORD)
            currentTeacherId = m.teacherId
          } else {
            append(`  ✗ Нет email для преподавателя ${m.teacherId}`, 'error')
            continue
          }
        }

        /* Генерируем PDF */
        const pdfBlob = generatePDF(m.contentKey)
        let fileUrl = null
        let fileSize = 0

        if (pdfBlob) {
          /* Загружаем в Firebase Storage */
          const filePath = `materials/${m.teacherId}/${m.fileName}`
          const fileRef = storageRef(storage, filePath)
          await uploadBytes(fileRef, pdfBlob, { contentType: 'application/pdf' })
          fileUrl = await getDownloadURL(fileRef)
          fileSize = pdfBlob.size
          append(`  📄 PDF загружен: ${m.fileName} (${Math.round(fileSize / 1024)} КБ)`)
        }

        /* Сохраняем в Firestore */
        const { contentKey, fileName, ...matData } = m
        await addDoc(collection(db, 'materials'), {
          ...matData,
          fileUrl,
          fileName: m.fileName,
          fileSize,
          fileType: 'application/pdf',
          createdAt: serverTimestamp(),
        })
        append(`  + "${m.title.slice(0, 50)}..."`)
      } catch (e) {
        append(`  ✗ Материал "${m.title.slice(0, 30)}...": ${e.message}`, 'error')
      }
    }
    if (currentTeacherId) await signOut(auth)

    /* ── 4. Оценки ── */
    if (studentUids.length >= 2 && teacherUids.length >= 2) {
      append('── Создаём оценки преподавателей ──', 'info')
      const ratings = buildRatings(studentUids, teacherUids)

      /* Собираем агрегаты по преподавателям */
      const teacherAgg = {} // { teacherId: { sum, count } }

      /* Группируем оценки по студенту, чтобы залогиниться один раз за студента */
      const byStudent = {}
      for (const r of ratings) {
        if (!byStudent[r.studentId]) byStudent[r.studentId] = []
        byStudent[r.studentId].push(r)
      }

      /* Находим email по uid */
      const uidToEmail = {}
      for (let i = 0; i < studentUids.length; i++) {
        uidToEmail[studentUids[i]] = STUDENTS[i].email
      }

      const allCreatedRatingIds = []

      for (const [sUid, sRatings] of Object.entries(byStudent)) {
        /* Логинимся под студентом, чтобы Firestore rules пропустили запись */
        try {
          await signInWithEmailAndPassword(auth, uidToEmail[sUid], PASSWORD)
        } catch (e) {
          append(`  ✗ Не удалось войти как ${uidToEmail[sUid]}: ${e.message}`, 'error')
          continue
        }

        const createdIds = []
        for (const r of sRatings) {
          try {
            const ref = await addDoc(collection(db, 'ratings'), {
              teacherId: r.teacherId,
              studentId: r.studentId,
              studentCourse: r.studentCourse,
              criteriaScores: r.criteriaScores,
              averageScore: r.averageScore,
              positiveComment: r.comment,
              negativeComment: '',
              comment: r.comment,
              isAnonymous: true,
              discipline: '',
              teacherRole: '',
              attendanceLevel: '',
              semester: '',
              nps: null,
              courseScore: null,
              status: 'pending',
              helpfulVotes: 0,
              unhelpfulVotes: 0,
              flags: 0,
              votedBy: [],
              flaggedBy: [],
              flagReasons: [],
              teacherResponse: '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
            createdIds.push(ref.id)
          } catch (e) {
            append(`  ✗ Оценка не создана: ${e.message}`, 'error')
          }

          /* Собираем агрегаты */
          if (!teacherAgg[r.teacherId]) teacherAgg[r.teacherId] = { sum: 0, count: 0 }
          teacherAgg[r.teacherId].sum += r.averageScore
          teacherAgg[r.teacherId].count += 1
        }
        allCreatedRatingIds.push(...createdIds)
        await signOut(auth)
      }
      append(`  + Создано ${allCreatedRatingIds.length} оценок`)

      /* Логинимся под админом для обновления агрегатов и счётчиков */
      try {
        await signInWithEmailAndPassword(auth, ADMIN.email, ADMIN.password)
      } catch (e) {
        append(`  ✗ Не удалось войти как админ: ${e.message}`, 'error')
      }

      /* Одобряем все оценки от имени админа */
      append('── Одобряем оценки (admin → approved) ──', 'info')
      for (const rId of allCreatedRatingIds) {
        try {
          await setDoc(doc(db, 'ratings', rId), { status: 'approved', updatedAt: serverTimestamp() }, { merge: true })
        } catch (e) {
          append(`  ✗ Не удалось одобрить оценку ${rId}: ${e.message}`, 'error')
        }
      }
      append(`  ✓ Одобрено ${allCreatedRatingIds.length} оценок`)

      /* Обновляем средний рейтинг и число оценок на профиле каждого преподавателя */
      for (const [tid, agg] of Object.entries(teacherAgg)) {
        const avg = Math.round((agg.sum / agg.count) * 10) / 10
        try {
          await setDoc(doc(db, 'teachers', tid), {
            averageRating: avg,
            ratingsCount: agg.count,
          }, { merge: true })
          append(`  → Преподаватель ${tid.slice(0, 8)}… — рейтинг ${avg}, отзывов: ${agg.count}`)
        } catch (e) {
          append(`  ✗ Ошибка обновления рейтинга: ${e.message}`, 'error')
        }
      }

      /* ── 5. Публичные счётчики (meta/counters) — считаем реальное количество из БД ── */
      append('── Обновляем публичные счётчики ──', 'info')
      try {
        const studSnap = await getCountFromServer(query(collection(db, 'users'), where('role', '==', 'student')))
        const teachSnap = await getCountFromServer(collection(db, 'teachers'))
        const ratSnap = await getCountFromServer(query(collection(db, 'ratings'), where('status', '==', 'approved')))

        const realStudents = studSnap.data().count
        const realTeachers = teachSnap.data().count
        const realRatings = ratSnap.data().count

        await setDoc(doc(db, 'meta', 'counters'), {
          students: realStudents,
          teachers: realTeachers,
          ratings: realRatings,
        }, { merge: true })
        append(`  ✓ meta/counters: ${realStudents} студентов, ${realTeachers} преподавателей, ${realRatings} отзывов`)
      } catch (e) {
        append(`  ✗ Не удалось обновить meta/counters: ${e.message}`, 'error')
      }

      await signOut(auth)
    } else {
      append('⚠ Не хватает аккаунтов для создания оценок', 'error')
    }

    append('══ Готово! Студенты, преподаватели, материалы и оценки созданы ══', 'info')
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
      <p className="text-text-secondary mb-4">
        Создаёт студентов, преподавателей, учебные материалы и оценки в Firebase.
        Все аккаунты с паролем <code className="bg-accent-blue-light text-accent-blue px-2 py-0.5 rounded font-mono text-sm">{PASSWORD}</code>
      </p>
      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mb-8">
        ⚠ Перед первым запуском создайте документ <b>users/{'{adminUid}'}</b> с полем <b>role: "admin"</b>
        в Firebase Console, иначе одобрение оценок и обновление счётчиков не сработает.
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
