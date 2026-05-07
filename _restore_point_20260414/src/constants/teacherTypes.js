/* ═══════════════════════════════════════════════════
   Типы преподавателей

   Каждый тип имеет уникальный ключ, название,
   описание (показывается при регистрации) и
   цвет бейджа. Используется на формах и карточках.
   ═══════════════════════════════════════════════════ */

export const TEACHER_TYPES = {
  lecturer: {
    key: 'lecturer',
    label: 'Лектор',
    description: 'Провожу лекции',
    badge: 'blue',
  },
  practice: {
    key: 'practice',
    label: 'Практик',
    description: 'Провожу практические занятия',
    badge: 'green',
  },
  seminar: {
    key: 'seminar',
    label: 'Семинарист',
    description: 'Провожу семинарские занятия',
    badge: 'gold',
  },
  supervisor: {
    key: 'supervisor',
    label: 'Науч. руководитель',
    description: 'Являюсь научным руководителем',
    badge: 'red',
  },
  universal: {
    key: 'universal',
    label: 'Универсальный',
    description: 'Веду несколько типов занятий',
    badge: 'gray',
  },
}

/* Массив для итерации (удобно в формах) */
export const TEACHER_TYPES_LIST = Object.values(TEACHER_TYPES)
