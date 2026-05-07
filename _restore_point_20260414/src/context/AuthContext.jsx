/* ═══════════════════════════════════════════════════
   AuthContext — глобальное состояние авторизации

   Зачем: чтобы любой компонент в приложении мог узнать,
   авторизован ли пользователь, какая у него роль,
   и вызвать login/logout.

   Как работает:
   1. При загрузке приложения Firebase проверяет,
      есть ли сохранённая сессия (onAuthStateChanged)
   2. Если пользователь найден — загружаем его данные
      из Firestore (роль, курс, имя и т.д.)
   3. Все компоненты получают доступ через useAuth()
   ═══════════════════════════════════════════════════ */

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../services/firebase'
import { getUserDocument, createUserDocument, updateUserDocument } from '../services/firestore'

/* Создаём контекст */
const AuthContext = createContext(null)

/* Хук для удобного доступа к контексту */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider')
  }
  return context
}

/* Провайдер — оборачивает всё приложение */
export function AuthProvider({ children }) {
  /* Данные пользователя из Firebase Auth */
  const [firebaseUser, setFirebaseUser] = useState(null)
  /* Данные пользователя из Firestore (роль, курс и т.д.) */
  const [userData, setUserData] = useState(null)
  /* Идёт ли загрузка (при первом открытии сайта) */
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    /* Если Firebase не настроен — просто убираем загрузку */
    if (!isFirebaseConfigured) {
      setLoading(false)
      return
    }

    /* Подписываемся на изменения авторизации */
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user)

      if (user) {
        /* Пользователь авторизован — загружаем его данные из Firestore */
        let { data } = await getUserDocument(user.uid)

        /* Если документа нет — создаём с ролью, определённой по email */
        if (!data) {
          const defaultRole = user.email?.includes('admin') ? 'admin'
            : user.email?.includes('teacher') ? 'teacher'
            : 'student'
          /* Для существующих аккаунтов Firebase Auth ставим isActive: true */
          const isActive = true
          await createUserDocument(user.uid, {
            email: user.email,
            firstName: user.displayName?.split(' ')[0] || '',
            lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
            role: defaultRole,
            course: defaultRole === 'student' ? 1 : null,
            isActive,
          })
          const result = await getUserDocument(user.uid)
          data = result.data
        }

        /* Авто-активация: если teacher/admin с isActive=false, активируем */
        if (data && !data.isActive && (data.role === 'teacher' || data.role === 'admin')) {
          await updateUserDocument(user.uid, { isActive: true })
          data = { ...data, isActive: true }
        }

        setUserData(data)
      } else {
        /* Пользователь вышел */
        setUserData(null)
      }

      setLoading(false)
    })

    /* Отписываемся при размонтировании */
    return unsubscribe
  }, [])

  /* Функция для обновления userData после изменений */
  const refreshUserData = async () => {
    if (firebaseUser) {
      const { data } = await getUserDocument(firebaseUser.uid)
      setUserData(data)
    }
  }

  /* Значения, доступные во всём приложении */
  const value = {
    /* Firebase Auth пользователь (uid, email, displayName) */
    user: firebaseUser,
    /* Данные из Firestore (role, course, firstName, lastName, ...) */
    userData,
    /* Идёт ли загрузка */
    loading,
    /* Обновить данные пользователя */
    refreshUserData,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
