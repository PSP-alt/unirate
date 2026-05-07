/* ═══════════════════════════════════════════════════
   QuickSettings — плавающая панель быстрого доступа
   Тема и язык — всегда под рукой, на любой странице.
   ═══════════════════════════════════════════════════ */

import { useState } from 'react'
import { Sun, Moon, Monitor, Globe, ChevronUp, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettings } from '../../context/SettingsContext'
import { cn } from '../../utils/cn'

const THEMES = [
  { value: 'light',  icon: Sun,     label: 'Светлая',   short: 'Свет' },
  { value: 'dark',   icon: Moon,    label: 'Тёмная',    short: 'Тёмн' },
  { value: 'system', icon: Monitor, label: 'Системная', short: 'Авто' },
]

const LANGS = [
  { code: 'ru', flag: '🇷🇺', label: 'RU' },
  { code: 'en', flag: '🇺🇸', label: 'EN' },
  { code: 'zh', flag: '🇨🇳', label: 'CN' },
]

export default function QuickSettings() {
  const { themeMode, setThemeMode, language, setLanguage } = useSettings()
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col items-end gap-2">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'bg-bg-card border border-border rounded-2xl shadow-card-hover p-4 w-52',
            )}
          >
            {/* Тема */}
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Тема
            </p>
            <div className="flex gap-1.5 mb-4">
              {THEMES.map(({ value, icon: Icon, label, short }) => (
                <button
                  key={value}
                  onClick={() => setThemeMode(value)}
                  title={label}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border transition-all text-xs font-medium',
                    themeMode === value
                      ? 'border-accent-blue bg-accent-blue-light text-accent-blue'
                      : 'border-border text-text-secondary hover:border-accent-blue/40 hover:text-accent-blue',
                  )}
                >
                  <Icon size={15} />
                  <span className="leading-none">{short}</span>
                </button>
              ))}
            </div>

            {/* Язык */}
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Язык
            </p>
            <div className="flex gap-1.5">
              {LANGS.map(({ code, flag, label }) => (
                <button
                  key={code}
                  onClick={() => setLanguage(code)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl border text-xs font-medium transition-all',
                    language === code
                      ? 'border-accent-blue bg-accent-blue-light text-accent-blue ring-1 ring-accent-blue/40'
                      : 'border-border text-text-secondary hover:border-accent-blue/40 hover:text-accent-blue',
                  )}
                >
                  <span className="text-base leading-none">{flag}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Кнопка открытия */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-12 h-12 rounded-full shadow-card-hover flex items-center justify-center transition-all',
          'bg-accent-blue text-white hover:bg-accent-blue-hover',
          open && 'rotate-180',
        )}
        title="Тема и язык"
      >
        {open ? <ChevronDown size={20} /> : <Globe size={20} />}
      </button>
    </div>
  )
}
