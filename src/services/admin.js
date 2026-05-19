/* ═══════════════════════════════════════════════════
   Сервис администратора — функции для админ-панели

   Модерация оценок, управление пользователями,
   одобрение преподавателей, статистика,
   обработка жалоб, предупреждения студентам.
   ═══════════════════════════════════════════════════ */

import {
  collection,
  getDocs,
  getDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore'
import { ref, deleteObject } from 'firebase/storage'
import { db, storage } from './firebase'

/* ═══ МОДЕРАЦИЯ ОЦЕНОК ═══ */

/* Получить все оценки на модерации */
export async function getPendingRatings() {
  try {
    /* Только where — без orderBy, чтобы не требовался составной индекс Firestore.
       Сортировка делается на клиенте. */
    const q = query(
      collection(db, 'ratings'),
      where('status', '==', 'pending'),
    )
    const snapshot = await getDocs(q)
    const ratings = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
    return { ratings, error: null }
  } catch (error) {
    return { ratings: [], error: 'Ошибка загрузки оценок' }
  }
}

/* Получить все оценки с жалобами */
export async function getFlaggedRatings() {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('flags', '>=', 1),
    )
    const snapshot = await getDocs(q)
    const ratings = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.flags || 0) - (a.flags || 0))
    return { ratings, error: null }
  } catch (error) {
    return { ratings: [], error: 'Ошибка загрузки жалоб' }
  }
}

/* ── Внутренний хелпер: пересчитать и сохранить средний рейтинг преподавателя ── */
async function syncTeacherStats(teacherId) {
  try {
    const q = query(
      collection(db, 'ratings'),
      where('teacherId', '==', teacherId),
      where('status', '==', 'approved'),
    )
    const snap = await getDocs(q)
    const ratings = snap.docs.map(d => d.data())
    const count = ratings.length
    const avg = count > 0
      ? Math.round((ratings.reduce((s, r) => s + (r.averageScore || 0), 0) / count) * 10) / 10
      : 0
    await updateDoc(doc(db, 'teachers', teacherId), {
      averageRating: avg,
      ratingsCount: count,
    })
  } catch (e) {
    console.error('[syncTeacherStats]', e)
  }
}

/* Одобрить оценку + синхронизировать счётчики преподавателя */
export async function approveRating(ratingId) {
  try {
    const ratingRef = doc(db, 'ratings', ratingId)
    const snap = await getDoc(ratingRef)
    if (!snap.exists()) return { error: 'Оценка не найдена' }
    const { teacherId } = snap.data()

    await updateDoc(ratingRef, {
      status: 'approved',
      updatedAt: serverTimestamp(),
    })

    // Обновляем агрегированные поля в документе преподавателя
    await syncTeacherStats(teacherId)

    return { error: null }
  } catch {
    return { error: 'Не удалось одобрить оценку' }
  }
}

/* Отклонить оценку + синхронизировать счётчики */
export async function rejectRating(ratingId, reason) {
  try {
    const ratingRef = doc(db, 'ratings', ratingId)
    const snap = await getDoc(ratingRef)
    if (!snap.exists()) return { error: 'Оценка не найдена' }
    const { teacherId } = snap.data()

    await updateDoc(ratingRef, {
      status: 'rejected',
      rejectionReason: reason,
      updatedAt: serverTimestamp(),
    })

    // Пересчитываем (на случай если оценка была ранее одобрена)
    await syncTeacherStats(teacherId)

    return { error: null }
  } catch {
    return { error: 'Не удалось отклонить оценку' }
  }
}

/* Снять жалобы с оценки (восстановить) */
export async function dismissFlags(ratingId) {
  try {
    await updateDoc(doc(db, 'ratings', ratingId), {
      flags: 0,
      flaggedBy: [],
      flagReasons: [],
      status: 'approved',
      updatedAt: serverTimestamp(),
    })
    return { error: null }
  } catch {
    return { error: 'Не удалось снять жалобы' }
  }
}

/* Выдать предупреждение студенту */
export async function warnStudent(userId, reason) {
  try {
    const userRef = doc(db, 'users', userId)
    const snap = await getDoc(userRef)
    if (!snap.exists()) return { error: 'Пользователь не найден' }

    const data = snap.data()
    const warnings = (data.warnings || 0) + 1
    const warningLog = [...(data.warningLog || []), { reason, at: new Date().toISOString() }]

    const update = { warnings, warningLog, updatedAt: serverTimestamp() }
    // Авто-бан при 3+ предупреждениях
    if (warnings >= 3) {
      update.isActive    = false
      update.blockReason = 'Автоматическая блокировка: 3 предупреждения'
      update.blockedUntil = null
      update.blockedAt   = serverTimestamp()
    }

    await updateDoc(userRef, update)
    return { error: null, autoBanned: warnings >= 3 }
  } catch {
    return { error: 'Не удалось выдать предупреждение' }
  }
}

/* ═══ УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ═══ */

/* Получить всех пользователей */
export async function getAllUsers() {
  try {
    const q = query(
      collection(db, 'users'),
      orderBy('createdAt', 'desc'),
    )
    const snapshot = await getDocs(q)
    const users = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    return { users, error: null }
  } catch (error) {
    return { users: [], error: 'Ошибка загрузки пользователей' }
  }
}

/* Переключить активность пользователя */
export async function toggleUserActive(userId, isActive) {
  try {
    await updateDoc(doc(db, 'users', userId), { isActive })
    return { error: null }
  } catch {
    return { error: 'Не удалось обновить статус' }
  }
}

/* ═══ ОДОБРЕНИЕ ПРЕПОДАВАТЕЛЕЙ ═══ */

/* Получить неодобренных преподавателей */
export async function getPendingTeachers() {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'teacher'),
      where('isActive', '==', false),
    )
    const snapshot = await getDocs(q)
    const teachers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    return { teachers, error: null }
  } catch (error) {
    return { teachers: [], error: 'Ошибка загрузки преподавателей' }
  }
}

/* Одобрить преподавателя */
export async function approveTeacher(userId) {
  try {
    await updateDoc(doc(db, 'users', userId), { isActive: true })
    return { error: null }
  } catch {
    return { error: 'Не удалось одобрить преподавателя' }
  }
}

/* ═══ СТАТИСТИКА ═══ */

/* Получить общую статистику платформы */
export async function getPlatformStats() {
  try {
    /* Пользователи */
    const usersSnap = await getDocs(collection(db, 'users'))
    const users = usersSnap.docs.map((d) => d.data())

    const students = users.filter((u) => u.role === 'student').length
    const teachers = users.filter((u) => u.role === 'teacher').length
    const pendingTeachers = users.filter(
      (u) => u.role === 'teacher' && !u.isActive,
    ).length

    /* Материалы */
    const materialsSnap = await getDocs(collection(db, 'materials'))
    const totalMaterials = materialsSnap.size
    let totalDownloads = 0
    materialsSnap.docs.forEach((d) => {
      totalDownloads += d.data().downloadCount || 0
    })

    /* Оценки */
    const ratingsSnap = await getDocs(collection(db, 'ratings'))
    const ratingsData = ratingsSnap.docs.map((d) => d.data())
    const totalRatings = ratingsData.length
    const pendingRatings = ratingsData.filter((r) => r.status === 'pending').length
    const approvedRatings = ratingsData.filter((r) => r.status === 'approved').length
    const flaggedRatings = ratingsData.filter((r) => (r.flags || 0) > 0).length

    return {
      stats: {
        students,
        teachers,
        pendingTeachers,
        totalMaterials,
        totalDownloads,
        totalRatings,
        pendingRatings,
        approvedRatings,
        flaggedRatings,
      },
      error: null,
    }
  } catch (error) {
    return { stats: null, error: 'Ошибка загрузки статистики' }
  }
}

/* ═══ РАСШИРЕННЫЕ ФУНКЦИИ ═══ */

/* ── Изменить роль пользователя ── */
export async function changeUserRole(userId, newRole) {
  try {
    await updateDoc(doc(db, 'users', userId), {
      role: newRole,
      updatedAt: serverTimestamp(),
    })
    return { error: null }
  } catch {
    return { error: 'Не удалось изменить роль' }
  }
}

/* ── Жёстко удалить оценку (без возможности восстановления) ── */
export async function deleteRatingPermanently(ratingId) {
  try {
    const ratingRef = doc(db, 'ratings', ratingId)
    const snap = await getDoc(ratingRef)
    if (!snap.exists()) return { error: 'Оценка не найдена' }
    const { teacherId } = snap.data()
    await deleteDoc(ratingRef)
    await syncTeacherStats(teacherId)
    return { error: null }
  } catch {
    return { error: 'Не удалось удалить оценку' }
  }
}

/* ── Получить всех преподавателей (для управления) ── */
export async function getAllTeachersFull() {
  try {
    const snap = await getDocs(collection(db, 'teachers'))
    const teachers = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '', 'ru'))
    return { teachers, error: null }
  } catch {
    return { teachers: [], error: 'Ошибка загрузки преподавателей' }
  }
}

/* ── Получить все материалы ── */
export async function getAllMaterialsAdmin() {
  try {
    const q = query(collection(db, 'materials'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    const materials = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    return { materials, error: null }
  } catch {
    return { materials: [], error: 'Ошибка загрузки материалов' }
  }
}

/* ── Удалить материал ── */
export async function deleteMaterialAdmin(materialId, storagePath) {
  try {
    await deleteDoc(doc(db, 'materials', materialId))
    if (storagePath) {
      try { await deleteObject(ref(storage, storagePath)) } catch {}
    }
    return { error: null }
  } catch {
    return { error: 'Не удалось удалить материал' }
  }
}

/* ── Заблокировать пользователя на заданное число дней (0 = навсегда) ── */
export async function blockUserTemporarily(userId, durationDays, reason) {
  try {
    const blockedUntil = durationDays > 0
      ? Timestamp.fromDate(new Date(Date.now() + durationDays * 86400000))
      : null  // null = навсегда
    await updateDoc(doc(db, 'users', userId), {
      isActive:    false,
      blockReason: reason || 'Нарушение правил платформы',
      blockedUntil,
      blockedAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
    })
    return { error: null }
  } catch {
    return { error: 'Не удалось заблокировать пользователя' }
  }
}

/* ── Снять блокировку, очистить поля и сохранить в историю ── */
export async function unblockUser(userId) {
  try {
    const snap = await getDoc(doc(db, 'users', userId))
    if (!snap.exists()) return { error: 'Пользователь не найден' }
    const data = snap.data()

    /* Запись в историю банов */
    const entry = {
      reason:       data.blockReason || 'Нарушение правил платформы',
      blockedAt:    data.blockedAt?.toDate
        ? data.blockedAt.toDate().toISOString()
        : new Date().toISOString(),
      unblockedAt:  new Date().toISOString(),
      wasTemporary: !!data.blockedUntil,
    }

    await updateDoc(doc(db, 'users', userId), {
      isActive:     true,
      blockReason:  null,
      blockedUntil: null,
      blockedAt:    null,
      banHistory:   arrayUnion(entry),
      updatedAt:    serverTimestamp(),
    })
    return { error: null }
  } catch {
    return { error: 'Не удалось разблокировать пользователя' }
  }
}

/* ── Мягкое удаление аккаунта (Firebase Auth удалить с клиента нельзя) ── */
export async function deleteUserAccount(userId) {
  try {
    /* 1. Помечаем пользователя удалённым в коллекции users */
    await updateDoc(doc(db, 'users', userId), {
      isActive:    false,
      isDeleted:   true,
      deletedAt:   serverTimestamp(),
      blockReason: 'Аккаунт удалён администратором',
      blockedUntil: null,
      updatedAt:   serverTimestamp(),
    })

    /* 2. Если пользователь — преподаватель, помечаем его документ
          в коллекции teachers тоже как удалённый.
          Если документа нет — ошибку молча игнорируем. */
    try {
      const teacherRef = doc(db, 'teachers', userId)
      const teacherSnap = await getDoc(teacherRef)
      if (teacherSnap.exists()) {
        await updateDoc(teacherRef, {
          isDeleted: true,
          updatedAt: serverTimestamp(),
        })
      }
    } catch {
      /* Не критично — профиль преподавателя мог не существовать */
    }

    return { error: null }
  } catch {
    return { error: 'Не удалось удалить аккаунт' }
  }
}

/* ── Удалить «призрачных» преподавателей без записи в users ── */
export async function cleanupOrphanedTeachers() {
  try {
    const teachersSnap = await getDocs(collection(db, 'teachers'))
    const orphaned = []

    for (const teacherDoc of teachersSnap.docs) {
      const userDoc = await getDoc(doc(db, 'users', teacherDoc.id))
      if (!userDoc.exists()) {
        const d = teacherDoc.data()
        orphaned.push({
          id: teacherDoc.id,
          name: [d.lastName, d.firstName].filter(Boolean).join(' ') || teacherDoc.id,
        })
        await deleteDoc(doc(db, 'teachers', teacherDoc.id))
      }
    }

    return { deleted: orphaned, error: null }
  } catch (err) {
    console.error('[cleanupOrphanedTeachers]', err)
    return { deleted: [], error: 'Ошибка при очистке' }
  }
}

/* ── Массовое одобрение всех pending оценок ── */
export async function bulkApproveAllPending() {
  try {
    const q = query(collection(db, 'ratings'), where('status', '==', 'pending'))
    const snap = await getDocs(q)
    await Promise.all(
      snap.docs.map(d => updateDoc(d.ref, { status: 'approved', updatedAt: serverTimestamp() })),
    )
    const teacherIds = [...new Set(snap.docs.map(d => d.data().teacherId).filter(Boolean))]
    await Promise.all(teacherIds.map(id => syncTeacherStats(id)))
    return { count: snap.docs.length, error: null }
  } catch {
    return { count: 0, error: 'Ошибка массового одобрения' }
  }
}

/* ═══ ОБРАЩЕНИЯ В ПОДДЕРЖКУ ═══ */

/* Получить все обращения */
export async function getAllSupportMessages() {
  try {
    const snap = await getDocs(collection(db, 'supportMessages'))
    const messages = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
    return { messages, error: null }
  } catch {
    return { messages: [], error: 'Ошибка загрузки обращений' }
  }
}

/* Отметить обращение как прочитанное */
export async function markSupportRead(messageId) {
  try {
    await updateDoc(doc(db, 'supportMessages', messageId), {
      status: 'read',
      updatedAt: serverTimestamp(),
    })
    return { error: null }
  } catch {
    return { error: 'Не удалось обновить статус' }
  }
}

/* Ответить на обращение и закрыть */
export async function resolveSupportMessage(messageId, response) {
  try {
    await updateDoc(doc(db, 'supportMessages', messageId), {
      status: 'resolved',
      adminResponse: response,
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return { error: null }
  } catch {
    return { error: 'Не удалось ответить на обращение' }
  }
}

/* Удалить обращение */
export async function deleteSupportMessage(messageId) {
  try {
    await deleteDoc(doc(db, 'supportMessages', messageId))
    return { error: null }
  } catch {
    return { error: 'Не удалось удалить обращение' }
  }
}

/* ── Получить последние N оценок (для графика активности) ── */
export async function getRecentRatings(days = 14) {
  try {
    const since = new Date(Date.now() - days * 86400000)
    const q = query(collection(db, 'ratings'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    const ratings = snap.docs
      .map(d => d.data())
      .filter(r => {
        const ts = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0)
        return ts >= since
      })
    return { ratings, error: null }
  } catch {
    return { ratings: [], error: null }
  }
}
