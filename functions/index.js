/* ════════════════════════════════════════════════════════════════════
   UNIRATE · Cloud Functions

   Серверные триггеры, поддерживающие целостность агрегатов и
   защищающие данные от клиентских манипуляций.

   1) onRatingWrite — пересчитывает averageRating / ratingsCount
      преподавателя при любом изменении отзыва (создание / approve /
      reject / удаление).
   2) onUserDelete — при удалении документа пользователя обезличивает
      все его отзывы (152-ФЗ — право на удаление ПДн).
   ════════════════════════════════════════════════════════════════════ */

const { onDocumentWritten } = require('firebase-functions/v2/firestore')
const { setGlobalOptions } = require('firebase-functions/v2')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const logger = require('firebase-functions/logger')

initializeApp()
const db = getFirestore()

/* Регион — выбираем европейский, чтобы было быстрее для пользователей в РФ.
   Если хочешь сменить — список здесь:
   https://firebase.google.com/docs/functions/locations */
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 })

// ────────────────────────────────────────────────────────────────────
//  Хелпер: пересчитать агрегаты преподавателя
// ────────────────────────────────────────────────────────────────────

async function recomputeTeacherAggregates(teacherId) {
  if (!teacherId) return

  const snap = await db
    .collection('ratings')
    .where('teacherId', '==', teacherId)
    .where('status', '==', 'approved')
    .get()

  let sum = 0
  let count = 0
  snap.forEach((doc) => {
    const score = Number(doc.data().averageScore)
    if (!isNaN(score) && score > 0) {
      sum += score
      count++
    }
  })

  const averageRating = count > 0 ? Math.round((sum / count) * 10) / 10 : 0

  await db.doc(`teachers/${teacherId}`).set(
    {
      averageRating,
      ratingsCount: count,
      updatedAt: new Date(),
    },
    { merge: true },
  )

  logger.info(
    `[recomputeTeacherAggregates] teacher=${teacherId} avg=${averageRating} count=${count}`,
  )
}

// ────────────────────────────────────────────────────────────────────
//  Триггер: любое изменение в коллекции ratings
// ────────────────────────────────────────────────────────────────────

exports.onRatingWrite = onDocumentWritten('ratings/{ratingId}', async (event) => {
  const before = event.data.before?.exists ? event.data.before.data() : null
  const after  = event.data.after?.exists  ? event.data.after.data()  : null

  // Пересчитываем оба teacherId — на случай переноса между преподавателями
  const teacherIds = new Set()
  if (before?.teacherId) teacherIds.add(before.teacherId)
  if (after?.teacherId)  teacherIds.add(after.teacherId)

  // Оптимизация: голосование «полезно» / жалоба не меняют статус и счёт —
  // незачем пересчитывать.
  if (before && after) {
    const sameStatus  = before.status === after.status
    const sameTeacher = before.teacherId === after.teacherId
    const sameScore   = before.averageScore === after.averageScore
    if (sameStatus && sameTeacher && sameScore) {
      return
    }
  }

  for (const teacherId of teacherIds) {
    try {
      await recomputeTeacherAggregates(teacherId)
    } catch (err) {
      logger.error(`[onRatingWrite] failed for teacher=${teacherId}`, err)
    }
  }
})

// ────────────────────────────────────────────────────────────────────
//  Триггер: удаление пользователя
// ────────────────────────────────────────────────────────────────────

exports.onUserDelete = onDocumentWritten('users/{uid}', async (event) => {
  const before = event.data.before?.exists ? event.data.before.data() : null
  const after  = event.data.after?.exists  ? event.data.after.data()  : null

  // Срабатываем при реальном удалении или установке isDeleted:true
  const wasDeleted    = !after && before
  const markedDeleted = before && after && !before.isDeleted && after.isDeleted
  if (!wasDeleted && !markedDeleted) return

  const uid = event.params.uid
  logger.info(`[onUserDelete] anonymizing ratings for uid=${uid}`)

  const ratingsSnap = await db
    .collection('ratings')
    .where('studentId', '==', uid)
    .get()

  const teacherIds = new Set()
  const batch = db.batch()
  ratingsSnap.forEach((doc) => {
    if (doc.data().teacherId) teacherIds.add(doc.data().teacherId)
    batch.update(doc.ref, {
      studentId: null,
      isAnonymous: true,
      authorDeleted: true,
    })
  })
  await batch.commit()

  for (const teacherId of teacherIds) {
    try {
      await recomputeTeacherAggregates(teacherId)
    } catch (err) {
      logger.error(`[onUserDelete] aggregates for teacher=${teacherId}`, err)
    }
  }
})
