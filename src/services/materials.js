/* ═══════════════════════════════════════════════════
   Сервис материалов — CRUD для коллекции materials

   Загрузка файлов в Firebase Storage,
   создание/чтение/удаление документов в Firestore.
   ═══════════════════════════════════════════════════ */

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  updateDoc,
  increment,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore'
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import { db, storage } from './firebase'

/* ── Загрузить файл в Storage с таймаутом ── */
export function uploadFile(file, path, onProgress) {
  return new Promise((resolve, reject) => {
    /* Таймаут на 2 минуты */
    const timeout = setTimeout(() => {
      reject(new Error('Время загрузки истекло'))
    }, 120000)

    try {
      const storageRef = ref(storage, path)
      const uploadTask = uploadBytesResumable(storageRef, file)

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          /* Прогресс загрузки в процентах */
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          if (onProgress) onProgress(progress)
        },
        (error) => {
          clearTimeout(timeout)
          console.error('[UPLOAD] Ошибка загрузки:', error.code, error.message)
          reject(error)
        },
        async () => {
          clearTimeout(timeout)
          try {
            /* Получаем URL загруженного файла */
            const url = await getDownloadURL(uploadTask.snapshot.ref)
            resolve(url)
          } catch (err) {
            reject(err)
          }
        },
      )
    } catch (err) {
      clearTimeout(timeout)
      reject(err)
    }
  })
}

/* ── Создать документ материала ── */
export async function createMaterial(data) {
  try {
    const docRef = await addDoc(collection(db, 'materials'), {
      title: data.title,
      description: data.description || '',
      category: data.category,
      courses: data.courses, // массив [1,2,3,4] или ["all"]
      discipline: data.discipline,
      teacherId: data.teacherId,
      teacherName: data.teacherName,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileSize: data.fileSize,
      fileType: data.fileType,
      downloadCount: 0,
      createdAt: serverTimestamp(),
    })
    return { id: docRef.id, error: null }
  } catch (error) {
    return { id: null, error: 'Не удалось сохранить материал' }
  }
}

/* ── Получить материалы с фильтрами и пагинацией ── */
export async function getMaterials({
  courseFilter = 'all',
  categoryFilter = 'all',
  disciplineFilter = '',
  searchQuery = '',
  sortBy = 'newest',
  pageSize = 12,
  lastDoc = null,
} = {}) {
  try {
    let q = collection(db, 'materials')
    const constraints = []

    /* Наличие серверных where-фильтров:
       Firestore не позволяет комбинировать where() + orderBy() по разным полям
       без составного индекса. При активных фильтрах — сортируем на клиенте. */
    const hasWhereFilter = categoryFilter !== 'all' || !!disciplineFilter

    /* Фильтр по категории */
    if (categoryFilter !== 'all') {
      constraints.push(where('category', '==', categoryFilter))
    }

    /* Фильтр по дисциплине */
    if (disciplineFilter) {
      constraints.push(where('discipline', '==', disciplineFilter))
    }

    if (hasWhereFilter) {
      /* При наличии where — не добавляем orderBy, иначе нужен составной индекс.
         Берём до 200 записей, фильтруем и сортируем на клиенте. */
      constraints.push(limit(200))
    } else {
      /* Без where-фильтров — стандартная сортировка + пагинация */
      switch (sortBy) {
        case 'newest':
          constraints.push(orderBy('createdAt', 'desc'))
          break
        case 'popular':
          constraints.push(orderBy('downloadCount', 'desc'))
          break
        case 'alphabet':
          constraints.push(orderBy('title', 'asc'))
          break
        default:
          constraints.push(orderBy('createdAt', 'desc'))
      }
      constraints.push(limit(pageSize))
      if (lastDoc) constraints.push(startAfter(lastDoc))
    }

    q = query(q, ...constraints)
    const snapshot = await getDocs(q)

    let materials = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      _doc: d,
    }))

    /* Фильтр по курсу на клиенте */
    if (courseFilter !== 'all') {
      materials = materials.filter((m) => {
        if (courseFilter === 'common') return m.courses?.includes('all')
        return m.courses?.includes(courseFilter) || m.courses?.includes('all')
      })
    }

    /* Поиск по названию на клиенте */
    if (searchQuery) {
      const lower = searchQuery.toLowerCase()
      materials = materials.filter(
        (m) =>
          m.title?.toLowerCase().includes(lower) ||
          m.discipline?.toLowerCase().includes(lower),
      )
    }

    /* Клиентская сортировка при активных where-фильтрах */
    if (hasWhereFilter) {
      switch (sortBy) {
        case 'newest':
          materials.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
          break
        case 'popular':
          materials.sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0))
          break
        case 'alphabet':
          materials.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ru'))
          break
        default:
          materials.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      }
      /* Пагинация отключена при фильтрах */
      return { materials, lastVisible: null, hasMore: false, error: null }
    }

    const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null
    const hasMore = snapshot.docs.length === pageSize

    return { materials, lastVisible, hasMore, error: null }
  } catch (error) {
    return { materials: [], lastVisible: null, hasMore: false, error: 'Ошибка загрузки материалов' }
  }
}

/* ── Получить материалы конкретного преподавателя ── */
export async function getTeacherMaterials(teacherId) {
  try {
    /* Без orderBy на сервере — избегаем composite index (teacherId + createdAt).
       Сортируем на клиенте. */
    const q = query(
      collection(db, 'materials'),
      where('teacherId', '==', teacherId),
    )
    const snapshot = await getDocs(q)
    const materials = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
    return { materials, error: null }
  } catch (error) {
    console.error('[getTeacherMaterials]', error)
    return { materials: [], error: 'Ошибка загрузки материалов' }
  }
}

/* ── Увеличить счётчик скачиваний ── */
export async function incrementDownload(materialId) {
  try {
    await updateDoc(doc(db, 'materials', materialId), {
      downloadCount: increment(1),
    })
  } catch {
    /* Некритичная ошибка */
  }
}

/* ── Удалить материал ── */
export async function deleteMaterial(materialId, fileUrl) {
  try {
    /* Удаляем файл из Storage */
    if (fileUrl) {
      const fileRef = ref(storage, fileUrl)
      await deleteObject(fileRef).catch(() => {})
    }
    /* Удаляем документ из Firestore */
    await deleteDoc(doc(db, 'materials', materialId))
    return { error: null }
  } catch (error) {
    return { error: 'Не удалось удалить материал' }
  }
}

/* ── Real-time подписка на материалы (onSnapshot).
   Лимит 200 — без него по мере роста коллекция целиком летела в
   память каждого подписчика, а это и платный трафик, и тормоза.
   Если нужна полная пагинация — добавьте offset через startAfter. */
export function subscribeToMaterials(onUpdate, { pageSize = 200 } = {}) {
  const q = query(
    collection(db, 'materials'),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  )
  return onSnapshot(
    q,
    (snapshot) => {
      const materials = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      onUpdate(materials)
    },
    (err) => {
      console.error('[subscribeToMaterials]', err)
      onUpdate([])
    },
  )
}

/* ── Получить список уникальных дисциплин ── */
export async function getDisciplines() {
  try {
    const snapshot = await getDocs(collection(db, 'materials'))
    const disciplines = new Set()
    snapshot.docs.forEach((d) => {
      if (d.data().discipline) {
        disciplines.add(d.data().discipline)
      }
    })
    return { disciplines: Array.from(disciplines).sort(), error: null }
  } catch (error) {
    console.error('[getDisciplines]', error)
    return { disciplines: [], error: null }
  }
}
