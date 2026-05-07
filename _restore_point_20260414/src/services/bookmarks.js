/* ═══════════════════════════════════════════════════
   Сервис закладок — добавление/удаление/получение
   закладок студента в подколлекции
   users/{uid}/bookmarks
   ═══════════════════════════════════════════════════ */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

/* ── Добавить материал в закладки ── */
export async function addBookmark(userId, materialId) {
  try {
    await setDoc(doc(db, 'users', userId, 'bookmarks', materialId), {
      materialId,
      createdAt: serverTimestamp(),
    })
    return { error: null }
  } catch {
    return { error: 'Не удалось добавить в закладки' }
  }
}

/* ── Убрать материал из закладок ── */
export async function removeBookmark(userId, materialId) {
  try {
    await deleteDoc(doc(db, 'users', userId, 'bookmarks', materialId))
    return { error: null }
  } catch {
    return { error: 'Не удалось убрать из закладок' }
  }
}

/* ── Проверить, есть ли материал в закладках ── */
export async function isBookmarked(userId, materialId) {
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'bookmarks', materialId))
    return { bookmarked: snap.exists(), error: null }
  } catch {
    return { bookmarked: false, error: null }
  }
}

/* ── Получить все закладки пользователя ── */
export async function getBookmarks(userId) {
  try {
    const q = query(
      collection(db, 'users', userId, 'bookmarks'),
      orderBy('createdAt', 'desc'),
    )
    const snapshot = await getDocs(q)
    const ids = snapshot.docs.map((d) => d.data().materialId)
    return { bookmarkIds: ids, error: null }
  } catch {
    return { bookmarkIds: [], error: 'Ошибка загрузки закладок' }
  }
}
