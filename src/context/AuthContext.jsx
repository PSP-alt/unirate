/* ═══════════════════════════════════════════════════
   AuthContext — глобальное состояние авторизации

   Использует onSnapshot для подписки на документ
   пользователя в реальном времени — блокировка/
   разблокировка отражается мгновенно без перезагрузки.
   ═══════════════════════════════════════════════════ */

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { onSnapshot, doc, arrayUnion } from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from '../services/firebase'
import { getUserDocument, updateUserDocument } from '../services/firestore'

const AuthContext = createContext(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth должен использоваться внутри AuthProvider')
  return context
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [userData,     setUserData]     = useState(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return }

    let docUnsub = null

    const authUnsub = onAuthStateChanged(auth, async (user) => {
      /* Отписываемся от предыдущего документа */
      if (docUnsub) { docUnsub(); docUnsub = null }

      setFirebaseUser(user)

      if (user) {
        /* НЕ создаём документ автоматически!
           Документ пользователя создаётся ТОЛЬКО в Register.jsx
           с полными данными (роль, согласия 152-ФЗ, студенческий билет и т.д.).
           Авто-создание здесь вызывало гонку: AuthContext опережал
           Register.jsx и писал неполный документ, из-за чего повторный
           setDoc воспринимался как update и блокировался security rules. */

        /* Подписка на реальное время — любое изменение документа
           (в том числе блокировка/разблокировка администратором)
           немедленно обновит состояние */
        docUnsub = onSnapshot(
          doc(db, 'users', user.uid),
          async (snap) => {
            if (!snap.exists()) { setLoading(false); return }
            let data = snap.data()

            /* ── Удалённый аккаунт — немедленно выкидываем из сессии ──
               Firebase Auth не даёт удалить чужой аккаунт с клиента,
               поэтому при обнаружении isDeleted:true принудительно
               завершаем сессию. Следующий вход тоже приведёт к этому же. */
            if (data.isDeleted) {
              await signOut(auth)
              setUserData(null)
              setLoading(false)
              return
            }

            /* ── Обработка неактивных аккаунтов ── */
            if (!data.isActive) {

              if (data.blockedUntil && !data.isDeleted) {
                /* Временная блокировка — проверяем срок */
                const until = data.blockedUntil.toDate
                  ? data.blockedUntil.toDate()
                  : new Date(data.blockedUntil)

                if (until <= new Date()) {
                  /* Срок истёк → авто-разблокировка + запись в историю */
                  const entry = {
                    reason:      data.blockReason || 'Нарушение правил платформы',
                    blockedAt:   data.blockedAt?.toDate
                      ? data.blockedAt.toDate().toISOString()
                      : new Date().toISOString(),
                    unblockedAt: new Date().toISOString(),
                    wasTemporary: true,
                    autoExpired:  true,
                  }
                  await updateUserDocument(user.uid, {
                    isActive:     true,
                    blockReason:  null,
                    blockedUntil: null,
                    blockedAt:    null,
                    banHistory:   arrayUnion(entry),
                  })
                  return /* следующий snapshot придёт с isActive:true */
                }
                /* Срок ещё не истёк — показываем заблокированный UI */

              }
              /* Любая блокировка (постоянная, по сроку, без причины) —
                 уважается. Auto-unblock только по истёкшему blockedUntil
                 (см. ветку выше). НИКОГДА не флипаем isActive:true для
                 teacher/admin без явного действия админа — это была дыра,
                 позволявшая выходить из бана простым релогином. */
            }

            setUserData(data)
            setLoading(false)
          },
          (err) => {
            console.error('[AuthContext onSnapshot]', err)
            setLoading(false)
          },
        )
      } else {
        setUserData(null)
        setLoading(false)
      }
    })

    return () => {
      authUnsub()
      if (docUnsub) docUnsub()
    }
  }, [])

  async function refreshUserData() {
    if (firebaseUser) {
      const { data } = await getUserDocument(firebaseUser.uid)
      if (data) setUserData(data)
    }
  }

  return (
    <AuthContext.Provider value={{ user: firebaseUser, userData, loading, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  )
}
