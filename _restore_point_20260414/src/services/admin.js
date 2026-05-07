/* ═══════════════════════════════════════════════════
   Сервис администратора — функции для админ-панели

   Модерация оценок, управление пользователями,
   одобрение преподавателей, статистика.
   ═══════════════════════════════════════════════════ */

import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

/* ═══ МОДЕРАЦИЯ ОЦЕНОК ═══ */

/* Получить все оценки на модерации */
export async function getPendingRatings() {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc'),
    )
    const snapshot = await getDocs(q)
    const ratings = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    return { ratings, error: null }
  } catch (error) {
    return { ratings: [], error: 'Ошибка загрузки оценок' }
  }
}

/* Одобрить оценку */
export async function approveRating(ratingId) {
  try {
    await updateDoc(doc(db, 'ratings', ratingId), {
      status: 'approved',
      updatedAt: serverTimestamp(),
    })
    return { error: null }
  } catch {
    return { error: 'Не удалось одобрить оценку' }
  }
}

/* Отклонить оценку с причиной */
export async function rejectRating(ratingId, reason) {
  try {
    await updateDoc(doc(db, 'ratings', ratingId), {
      status: 'rejected',
      rejectionReason: reason,
      updatedAt: serverTimestamp(),
    })
    return { error: null }
  } catch {
    return { error: 'Не удалось отклонить оценку' }
  }
}

/* ═══ УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ═══ */

/* Получить всех пользователей */
export async function getAllUsers() {
  try {
    const q = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc'),
    )
    const snapshot = await getDocs(q)
    const users = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    return { users, error: null }
  } catch (error) {
    return { users: [], error: 'Ошибка загрузки пользователей' }
  }
}

/* Переключить активность пользователя */
export async function toggleUserActive(userId, isActive) {
  try {
    await updateDoc(doc(db, 'users', userId), { isActive })
    return { error: null }
  } catch {
    return { error: 'Не удалось обновить статус' }
  }
}

/* ═══ ОДОБРЕНИЕ ПРЕПОДАВАТЕЛЕЙ ═══ */

/* Получить неодобренных преподавателей */
export async function getPendingTeachers() {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'teacher'),
      where('isActive', '==', false),
    )
    const snapshot = await getDocs(q)
    const teachers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    return { teachers, error: null }
  } catch (error) {
    return { teachers: [], error: 'Ошибка загрузки преподавателей' }
  }
}

/* Одобрить преподавателя */
export async function approveTeacher(userId) {
  try {
    await updateDoc(doc(db, 'users', userId), { isActive: true })
    return { error: null }
  } catch {
    return { error: 'Не удалось одобрить преподавателя' }
  }
}

/* ═══ СТАТИСТИКА ═══ */

/* Получить общую статистику платформы */
export async function getPlatformStats() {
  try {
    /* Пользователи */
    const usersSnap = await getDocs(collection(db, 'users'))
    const users = usersSnap.docs.map((d) => d.data())

    const students = users.filter((u) => u.role === 'student').length
    const teachers = users.filter((u) => u.role === 'teacher').length
    const pendingTeachers = users.filter(
      (u) => u.role === 'teacher' && !u.isActive,
    ).length

    /* Материалы */
    const materialsSnap = await getDocs(collection(db, 'materials'))
    const totalMaterials = materialsSnap.size
    let totalDownloads = 0
    materialsSnap.docs.forEach((d) => {
      totalDownloads += d.data().downloadCount || 0
    })

    /* Оценки */
    const ratingsSnap = await getDocs(collection(db, 'ratings'))
    const ratingsData = ratingsSnap.docs.map((d) => d.data())
    const totalRatings = ratingsData.length
    const pendingRatings = ratingsData.filter((r) => r.status === 'pending').length
    const approvedRatings = ratingsData.filter((r) => r.status === 'approved').length

    return {
      stats: {
        students,
        teachers,
        pendingTeachers,
        totalMaterials,
        totalDownloads,
        totalRatings,
        pendingRatings,
        approvedRatings,
      },
      error: null,
    }
  } catch (error) {
    return { stats: null, error: 'Ошибка загрузки статистики' }
  }
}
