/* ═══════════════════════════════════════════════════
   Сервис Firestore — функции для работы с базой данных

   Создание, чтение и обновление документов
   в коллекциях users и teachers.
   ═══════════════════════════════════════════════════ */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore'
import { db } from './firebase'

/* ═══ ПОЛЬЗОВАТЕЛИ ═══ */

/* Проверить уникальность номера студенческого билета */
export async function checkStudentIdUnique(studentId) {
  try {
    const q = query(
      collection(db, 'users'),
      where('studentId', '==', studentId.trim()),
      limit(1),
    )
    const snap = await getDocs(q)
    return { taken: !snap.empty, error: null }
  } catch (error) {
    return { taken: false, error: 'Ошибка проверки студенческого билета' }
  }
}

/* Текущая версия документов (Privacy/Terms) — синхронизируйте с
   датой LAST_UPDATED в pages/Privacy.jsx и pages/Terms.jsx. */
export const CURRENT_DOC_VERSION = '2026-04-24'

/* Создать документ пользователя после регистрации.
   Retry-логика: Firestore SDK может не сразу получить auth-токен
   после createUserWithEmailAndPassword — повторяем до 3 раз. */
export async function createUserDocument(uid, data) {
  const payload = {
    uid,
    email: data.email,
    firstName: data.firstName || '',
    lastName:  data.lastName  || '',
    middleName: data.middleName || '',
    role: data.role, // "student" | "teacher" | "admin"
    course: data.course || null, // 1-4 для студентов
    studentId: data.studentId || null, // номер студенческого билета
    avatarUrl: null,
    isActive: data.isActive !== undefined ? data.isActive : data.role === 'student',
    createdAt: serverTimestamp(),

    /* Юридический след принятия документов (152-ФЗ — фиксация согласия) */
    consents: data.consents || null,
  }

  const MAX_RETRIES = 3
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await setDoc(doc(db, 'users', uid), payload)
      return { error: null }
    } catch (error) {
      console.error(`[createUserDocument] attempt ${attempt}/${MAX_RETRIES}`, error)
      /* permission-denied = скорее всего гонка Auth ↔ Firestore SDK,
         повторяем с нарастающей задержкой */
      if (attempt < MAX_RETRIES && error.code === 'permission-denied') {
        await new Promise(r => setTimeout(r, 1500 * attempt))
        continue
      }
      return { error: 'Не удалось сохранить данные пользователя' }
    }
  }
}

/* Поля, которые пользователь может менять в своём профиле через client.
   Изменение role / isActive / warnings / блокировок возможно только
   через админ-методы (admin.js) и только админом — это ещё раз
   подтверждено в firestore.rules. */
const USER_SELF_EDITABLE_FIELDS = new Set([
  'firstName', 'lastName', 'middleName',
  'nickname', 'bio', 'avatarUrl',
  'gender', 'faculty', 'profileTheme',
  'studentId', 'course',
  'consents',
])

/* Получить данные пользователя по uid */
export async function getUserDocument(uid) {
  try {
    const docSnap = await getDoc(doc(db, 'users', uid))
    if (docSnap.exists()) {
      return { data: docSnap.data(), error: null }
    }
    return { data: null, error: 'Пользователь не найден' }
  } catch (error) {
    return { data: null, error: 'Ошибка загрузки данных пользователя' }
  }
}

/* Обновить данные пользователя.
   ВНИМАНИЕ: фильтруем undefined-значения (Firestore их не принимает)
   и НЕ применяем клиентский whitelist здесь — так как этот метод
   используется и AuthContext-ом для системных операций (banHistory,
   blockedUntil, isActive после авто-разблокировки). Реальный security-
   gate — firestore.rules, где self-edit ограничен USER_SELF_EDITABLE_FIELDS. */
export async function updateUserDocument(uid, data) {
  try {
    const clean = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    )
    await updateDoc(doc(db, 'users', uid), clean)
    return { error: null }
  } catch (error) {
    console.error('[updateUserDocument]', error)
    return { error: 'Не удалось обновить данные' }
  }
}

/* Self-edit профиля — клиентская проверка whitelisted полей.
   Используется со страниц настроек профиля. */
export async function updateOwnUserProfile(uid, data) {
  const filtered = Object.fromEntries(
    Object.entries(data).filter(([k, v]) => USER_SELF_EDITABLE_FIELDS.has(k) && v !== undefined)
  )
  if (Object.keys(filtered).length === 0) return { error: null }
  return updateUserDocument(uid, filtered)
}

/* ═══ ПРЕПОДАВАТЕЛИ ═══ */

/* Создать документ преподавателя (дополнительная коллекция) */
export async function createTeacherDocument(uid, data) {
  try {
    await setDoc(doc(db, 'teachers', uid), {
      userId: uid,
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName || '',
      position: data.position || '',
      teacherTypes: data.teacherTypes || [],                                          // массив типов
      teacherType:  data.teacherTypes?.length === 1 ? data.teacherTypes[0] : 'universal', // primary (обратная совместимость)
      disciplines: data.disciplines || [],
      bio: '',
      avatarUrl: null,
      contactEmail: data.email || '',
      ratingsEnabled: false, // по умолчанию оценивание выключено
      averageRating: 0,
      ratingsCount: 0,
      createdAt: serverTimestamp(),
    })
    return { error: null }
  } catch (error) {
    return { error: 'Не удалось сохранить данные преподавателя' }
  }
}

/* Получить данные преподавателя по uid */
export async function getTeacherDocument(uid) {
  try {
    const docSnap = await getDoc(doc(db, 'teachers', uid))
    if (docSnap.exists()) {
      return { data: { id: docSnap.id, ...docSnap.data() }, error: null }
    }
    return { data: null, error: 'Преподаватель не найден' }
  } catch (error) {
    return { data: null, error: 'Ошибка загрузки данных преподавателя' }
  }
}

/* Обновить данные преподавателя */
export async function updateTeacherDocument(uid, data) {
  try {
    await updateDoc(doc(db, 'teachers', uid), data)
    return { error: null }
  } catch (error) {
    return { error: 'Не удалось обновить данные преподавателя' }
  }
}
