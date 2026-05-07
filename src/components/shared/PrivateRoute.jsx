/* ═══════════════════════════════════════════════════
   Компонент PrivateRoute — защита маршрутов

   Проверяет, авторизован ли пользователь и имеет ли
   нужную роль. Если нет — перенаправляет на /login.

   Использование:
     <PrivateRoute>              — любой авторизованный
     <PrivateRoute roles={["admin"]}>  — только admin
     <PrivateRoute roles={["teacher"]}> — только teacher
   ═══════════════════════════════════════════════════ */

import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Skeleton from '../ui/Skeleton'

export default function PrivateRoute({ children, roles }) {
  const { user, userData, loading } = useAuth()

  /* Пока загружаем данные — показываем скелетон */
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  /* Не авторизован — на страницу входа */
  if (!user) {
    return <Navigate to="/login" replace />
  }

  /* Авторизован, но роль не подходит */
  if (roles && userData && !roles.includes(userData.role)) {
    return <Navigate to="/" replace />
  }

  /* Преподаватель ещё не активирован (pending, нет причины блокировки).
     Legacy-аккаунты, у которых isActive вообще не установлено
     (undefined), считаем активными — иначе их блокировал бы этот
     гард, хотя их никто реально не банил. */
  if (
    userData?.role === 'teacher' &&
    userData?.isActive === false &&
    !userData?.blockReason
  ) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="font-heading text-2xl text-accent-blue mb-4">
          Аккаунт на модерации
        </h2>
        <p className="text-text-secondary">
          Ваш аккаунт ещё не активирован администратором.
          Пожалуйста, подождите — обычно это занимает до 24 часов.
        </p>
      </div>
    )
  }

  return children
}
