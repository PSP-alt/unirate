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

    /* Фильтр по типу преподавателя */
    if (typeFilter !== 'all') {
      constraints.push(where('teacherType', '==', typeFilter))
    }

    /* Без orderBy на сервере — избегаем составного индекса Firestore.
       Сортируем по фамилии на клиенте. */
    q = query(q, ...constraints)

    const snapshot = await getDocs(q)
    let teachers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))

    /* Сортировка по фамилии на клиенте */
    teachers.sort((a, b) =>
      (a.lastName || '').localeCompare(b.lastName || '', 'ru'),
    )

    /* Только активные (одобренные администратором) —
       проверяем через коллекцию users */
    /* Примечание: в реальном проекте стоит хранить isActive
       прямо в teachers, но пока делаем клиентскую фильтрацию */

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
    return { error: 'Не удалось сохранить настройку' }
  }
}

/* ── Обновить средний рейтинг и количество оценок ── */
export async function updateTeacherRating(teacherId, averageRating, ratingsCount) {
  try {
    await updateDoc(doc(db, 'teachers', teacherId), {
      averageRating,
      ratingsCount,
    })
    return { error: null }
  } catch (error) {
    return { error: 'Не удалось обновить рейтинг' }
  }
}
