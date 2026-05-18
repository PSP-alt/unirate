/* ═══════════════════════════════════════════════════
   Сервис преподавателей — чтение коллекции teachers

   Получение списка, профиля, фильтрация по типу,
   поиск по имени и дисциплине.
   ═══════════════════════════════════════════════════ */

import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'

/* ── Получить всех активных преподавателей ── */
export async function getTeachers({
  typeFilter = 'all',
  searchQuery = '',
} = {}) {
  try {
    let q = collection(db, 'teachers')
    const constraints = []

    /* Фильтр по типу преподавателя.
       Используем array-contains по полю teacherTypes (массив).
       Преподаватели с legacy teacherType (строка, до multi-select)
       не попадут в эту выборку — поэтому делаем второй запрос
       и объединяем результаты ниже. */
    if (typeFilter !== 'all') {
      constraints.push(where('teacherTypes', 'array-contains', typeFilter))
    }

    q = query(q, ...constraints)

    const snapshot = await getDocs(q)
    let teachers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))

    /* Подмешиваем legacy-документы со старым строковым teacherType */
    if (typeFilter !== 'all') {
      try {
        const legacySnap = await getDocs(query(
          collection(db, 'teachers'),
          where('teacherType', '==', typeFilter),
        ))
        const seen = new Set(teachers.map(t => t.id))
        for (const d of legacySnap.docs) {
          if (!seen.has(d.id)) teachers.push({ id: d.id, ...d.data() })
        }
      } catch (e) {
        /* legacy-запрос может упасть, если индекса нет — это ок,
           основная выборка уже сделана. */
        console.warn('[getTeachers legacy fallback]', e)
      }
    }

    /* Сортировка по фамилии на клиенте */
    teachers.sort((a, b) =>
      (a.lastName || '').localeCompare(b.lastName || '', 'ru'),
    )

    /* Фильтруем удалённые аккаунты — поле isDeleted: true
       выставляется в teachers/{uid} при удалении через админ-панель */
    teachers = teachers.filter((t) => !t.isDeleted)

    /* Поиск по имени / дисциплине */
    if (searchQuery) {
      const lower = searchQuery.toLowerCase()
      teachers = teachers.filter((t) => {
        const fullName = `${t.lastName} ${t.firstName} ${t.middleName || ''}`.toLowerCase()
        const disc = (t.disciplines || []).join(' ').toLowerCase()
        return fullName.includes(lower) || disc.includes(lower)
      })
    }

    return { teachers, error: null }
  } catch (error) {
    console.error('[getTeachers]', error)
    return { teachers: [], error: 'Ошибка загрузки преподавателей' }
  }
}

/* ── Получить одного преподавателя по ID ── */
export async function getTeacherById(teacherId) {
  try {
    const docSnap = await getDoc(doc(db, 'teachers', teacherId))
    if (docSnap.exists()) {
      return { teacher: { id: docSnap.id, ...docSnap.data() }, error: null }
    }
    return { teacher: null, error: 'Преподаватель не найден' }
  } catch (error) {
    console.error('[getTeacherById]', error)
    return { teacher: null, error: 'Ошибка загрузки данных' }
  }
}

/* ── Обновить поле ratingsEnabled ── */
export async function toggleRatingsEnabled(teacherId, enabled) {
  try {
    await updateDoc(doc(db, 'teachers', teacherId), {
      ratingsEnabled: enabled,
    })
    return { error: null }
  } catch (error) {
    console.error('[toggleRatingsEnabled]', error)
    return { error: 'Не удалось сохранить настройку' }
  }
}

/* ── Обновить средний рейтинг и количество оценок.
   Внимание: с введёнными firestore.rules этот метод смогут вызвать
   только админ или Cloud Function (см. правило для teachers update,
   которое разрешает писать ratings* только админам). Метод оставлен
   для admin.syncTeacherStats. */
export async function updateTeacherRating(teacherId, averageRating, ratingsCount) {
  try {
    await updateDoc(doc(db, 'teachers', teacherId), {
      averageRating,
      ratingsCount,
    })
    return { error: null }
  } catch (error) {
    console.error('[updateTeacherRating]', error)
    return { error: 'Не удалось обновить рейтинг' }
  }
}
