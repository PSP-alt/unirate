/* ═══════════════════════════════════════════════════
   Инициализация Firebase

   Если переменные окружения (.env) не заданы,
   приложение работает в демо-режиме без Firebase.
   Все Firebase-вызовы будут возвращать ошибки,
   но интерфейс будет отображаться корректно.
   ═══════════════════════════════════════════════════ */

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

/* Конфигурация Firebase из переменных окружения */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '0',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '0:0:web:0',
}

/* Флаг: настроен ли Firebase (есть реальные ключи) */
export const isFirebaseConfigured = !!import.meta.env.VITE_FIREBASE_API_KEY

/* Создаём приложение Firebase */
const app = initializeApp(firebaseConfig)

/* Экспортируем сервисы */
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app
