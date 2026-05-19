/* ═══════════════════════════════════════════════════
   Сервис авторизации — все функции работы с Firebase Auth

   Регистрация, вход, выход, сброс пароля.
   Все ошибки переводятся на русский язык.
   ═══════════════════════════════════════════════════ */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth'
import { auth } from './firebase'

/* ── Словарь ошибок Firebase → русский ── */
const ERROR_MESSAGES = {
  'auth/email-already-in-use': 'Этот email уже зарегистрирован',
  'auth/invalid-email': 'Неверный формат email',
  'auth/weak-password': 'Пароль слишком простой (минимум 6 символов)',
  'auth/user-not-found': 'Пользователь не найден',
  'auth/wrong-password': 'Неверный пароль',
  'auth/invalid-credential': 'Неверный email или пароль',
  'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже',
  'auth/network-request-failed': 'Нет соединения с сервером',
}

/* Получить понятное сообщение об ошибке */
function getErrorMessage(error) {
  return ERROR_MESSAGES[error.code] || 'Произошла ошибка. Попробуйте ещё раз'
}

/* ── Регистрация нового пользователя ── */
export async function registerUser(email, password, displayName) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    /* Устанавливаем отображаемое имя */
    await updateProfile(result.user, { displayName })

    /* Принудительно получаем ID-токен — без этого Firestore SDK
       может ещё не знать о новом пользователе и security rules
       отклонят запись в createUserDocument (гонка состояний). */
    await result.user.getIdToken(true)

    return { user: result.user, error: null }
  } catch (error) {
    /* Если Auth-аккаунт создался, но updateProfile/getIdToken упали,
       удаляем «полу-аккаунт» чтобы пользователь мог попробовать снова */
    if (auth.currentUser) {
      try { await auth.currentUser.delete() } catch { /* best effort */ }
    }
    return { user: null, error: getErrorMessage(error) }
  }
}

/* ── Вход в аккаунт ── */
export async function loginUser(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password)
    return { user: result.user, error: null }
  } catch (error) {
    return { user: null, error: getErrorMessage(error) }
  }
}

/* ── Выход из аккаунта ── */
export async function logoutUser() {
  try {
    await signOut(auth)
    return { error: null }
  } catch (error) {
    return { error: getErrorMessage(error) }
  }
}

/* ── Сброс пароля (письмо на email) ── */
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email)
    return { error: null }
  } catch (error) {
    return { error: getErrorMessage(error) }
  }
}
