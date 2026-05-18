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
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-rust-wash)] flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">⏳</span>
          </div>
          <h2 className="font-display text-2xl font-bold text-[var(--color-ink)] mb-3">
            Аккаунт на модерации
          </h2>
          <p className="text-sm text-[var(--color-muted)] leading-relaxed">
            Ваш аккаунт ещё не активирован администратором.
            Пожалуйста, подождите — обычно это занимает до 24 часов.
          </p>
        </div>
      </div>
    )
  }

  return children
}
