/* ═══════════════════════════════════════════════════
   Сервис оценок — CRUD для коллекции ratings

   Создание оценок, проверка «уже оценивал»,
   получение оценок преподавателя.
   ═══════════════════════════════════════════════════ */

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

/* ── Создать оценку (отправить на модерацию) ── */
export async function createRating(data) {
  try {
    const docRef = await addDoc(collection(db, 'ratings'), {
      teacherId: data.teacherId,
      studentId: data.studentId,
      criteriaScores: data.criteriaScores,
      averageScore: data.averageScore,
      comment: data.comment,
      status: 'pending',       // на модерации
      rejectionReason: '',
      isAnonymous: true,
      studentCourse: data.studentCourse,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { id: docRef.id, error: null }
  } catch (error) {
    return { id: null, error: 'Не удалось отправить оценку' }
  }
}

/* ── Проверить, оценивал ли студент этого преподавателя ── */
export async function hasStudentRated(teacherId, studentId) {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('teacherId', '==', teacherId),
      where('studentId', '==', studentId),
    )
    const snapshot = await getDocs(q)
    return { hasRated: !snapshot.empty, error: null }
  } catch (error) {
    return { hasRated: false, error: null }
  }
}

/* ── Получить одобренные оценки преподавателя ── */
export async function getApprovedRatings(teacherId) {
  try {
    /* Без orderBy — сортируем на клиенте, чтобы не нужен составной индекс */
    const q = query(
      collection(db, 'ratings'),
      where('teacherId', '==', teacherId),
      where('status', '==', 'approved'),
    )
    const snapshot = await getDocs(q)
    const ratings = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aTime = a.createdAt?.seconds ?? 0
        const bTime = b.createdAt?.seconds ?? 0
        return bTime - aTime
      })
    return { ratings, error: null }
  } catch (error) {
    console.error('[getApprovedRatings]', error)
    return { ratings: [], error: 'Ошибка загрузки оценок' }
  }
}

/* ── Получить оценки конкретного студента ── */
export async function getStudentRatings(studentId) {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('studentId', '==', studentId),
      orderBy('createdAt', 'desc'),
    )
    const snapshot = await getDocs(q)
    const ratings = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    return { ratings, error: null }
  } catch (error) {
    return { ratings: [], error: 'Ошибка загрузки оценок' }
  }
}

/* ── Получить все оценки преподавателя (для статистики) ── */
export async function getAllTeacherRatings(teacherId) {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('teacherId', '==', teacherId),
    )
    const snapshot = await getDocs(q)
    const ratings = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    return { ratings, error: null }
  } catch (error) {
    return { ratings: [], error: 'Ошибка загрузки оценок' }
  }
}
