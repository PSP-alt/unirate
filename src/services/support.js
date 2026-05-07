/* ═══════════════════════════════════════════════════
   Сервис обращений в поддержку

   Позволяет пользователю отправить жалобу
   или предложение из формы /support.
   ═══════════════════════════════════════════════════ */

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

/**
 * Отправить обращение в поддержку
 * @param {'complaint'|'suggestion'} type
 * @param {string} subject   — тема (до 200 символов)
 * @param {string} message   — текст (до 5000 символов)
 * @param {{ uid: string, email: string, firstName?: string, lastName?: string }} user
 */
export async function submitSupportMessage(type, subject, message, user) {
  try {
    const docRef = await addDoc(collection(db, 'supportMessages'), {
      type,
      subject: subject.trim(),
      message: message.trim(),
      userId:    user.uid,
      userEmail: user.email || '',
      userName:  `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      status:    'new',          // new → read → resolved
      adminResponse: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { id: docRef.id, error: null }
  } catch (e) {
    console.error('[submitSupportMessage]', e)
    return { id: null, error: 'Не удалось отправить обращение' }
  }
}

/**
 * Получить свои обращения (для отображения истории)
 * @param {string} userId
 */
export async function getMySupportMessages(userId) {
  try {
    const q = query(
      collection(db, 'supportMessages'),
      where('userId', '==', userId),
    )
    const snap = await getDocs(q)
    const messages = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
    return { messages, error: null }
  } catch {
    return { messages: [], error: 'Ошибка загрузки обращений' }
  }
}
