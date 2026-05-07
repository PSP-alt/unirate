/* ═══════════════════════════════════════════════════
   Константы категорий материалов

   Используются в фильтрах и при загрузке материалов.
   ═══════════════════════════════════════════════════ */

export const MATERIAL_CATEGORIES = [
  { value: 'all', label: 'Все категории' },
  { value: 'methodical', label: 'Методичка' },
  { value: 'lecture', label: 'Лекция' },
  { value: 'reference', label: 'Справка' },
  { value: 'assignment', label: 'Задание' },
  { value: 'other', label: 'Прочее' },
]

/* Курсы для фильтра */
export const COURSES = [
  { value: 'all', label: 'Все курсы' },
  { value: 1, label: '1 курс' },
  { value: 2, label: '2 курс' },
  { value: 3, label: '3 курс' },
  { value: 4, label: '4 курс' },
  { value: 'common', label: 'Общие' },
]

/* Варианты сортировки */
export const SORT_OPTIONS = [
  { value: 'newest', label: 'Новые сначала' },
  { value: 'alphabet', label: 'По алфавиту' },
  { value: 'popular', label: 'По популярности' },
]

/* Допустимые форматы файлов */
export const ALLOWED_FILE_TYPES = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
}

/* Максимальный размер файла в байтах (50 МБ) */
export const MAX_FILE_SIZE = 50 * 1024 * 1024
