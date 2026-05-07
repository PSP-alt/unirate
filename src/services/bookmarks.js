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
  } catch (error) {
    console.error('[addBookmark]', error)
    return { error: 'Не удалось добавить в закладки' }
  }
}

/* ── Убрать материал из закладок ── */
export async function removeBookmark(userId, materialId) {
  try {
    await deleteDoc(doc(db, 'users', userId, 'bookmarks', materialId))
    return { error: null }
  } catch (error) {
    console.error('[removeBookmark]', error)
    return { error: 'Не удалось убрать из закладок' }
  }
}

/* ── Проверить, есть ли материал в закладках ── */
export async function isBookmarked(userId, materialId) {
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'bookmarks', materialId))
    return { bookmarked: snap.exists(), error: null }
  } catch (error) {
    console.error('[isBookmarked]', error)
    return { bookmarked: false, error: null }
  }
}

/* ── Получить все закладки пользователя.
   Без orderBy на сервере: документы без поля createdAt (legacy)
   серверный orderBy молча исключает из результата. Сортируем на клиенте. */
export async function getBookmarks(userId) {
  try {
    const snapshot = await getDocs(collection(db, 'users', userId, 'bookmarks'))
    const docs = snapshot.docs
      .map((d) => ({ materialId: d.data().materialId, createdAt: d.data().createdAt }))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
    return { bookmarkIds: docs.map(d => d.materialId), error: null }
  } catch (error) {
    console.error('[getBookmarks]', error)
    return { bookmarkIds: [], error: 'Ошибка загрузки закладок' }
  }
}
