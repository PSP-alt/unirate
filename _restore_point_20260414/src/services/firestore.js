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
} from 'firebase/firestore'
import { db } from './firebase'

/* ═══ ПОЛЬЗОВАТЕЛИ ═══ */

/* Создать документ пользователя после регистрации */
export async function createUserDocument(uid, data) {
  try {
    await setDoc(doc(db, 'users', uid), {
      uid,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role, // "student" | "teacher" | "admin"
      course: data.course || null, // 1-4 для студентов
      avatarUrl: null,
      isActive: data.isActive !== undefined ? data.isActive : data.role === 'student',
      createdAt: serverTimestamp(),
    })
    return { error: null }
  } catch (error) {
    return { error: 'Не удалось сохранить данные пользователя' }
  }
}

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

/* Обновить данные пользователя */
export async function updateUserDocument(uid, data) {
  try {
    await updateDoc(doc(db, 'users', uid), data)
    return { error: null }
  } catch (error) {
    return { error: 'Не удалось обновить данные' }
  }
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
      teacherType: data.teacherType, // lecturer/practice/seminar/supervisor/universal
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
