import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="w-full py-8 mt-auto bg-slate-50 border-t border-slate-200/50">
      <div className="flex flex-col md:flex-row justify-between items-center px-12 max-w-7xl mx-auto gap-4 md:gap-0">
        <p className="text-[11px] tracking-[0.05em] uppercase font-medium text-slate-400">
          © 2025 UniRate. All rights reserved.
        </p>
        <div className="flex gap-8">
          {['Конфиденциальность', 'Условия', 'О нас'].map(label => (
            <a
              key={label}
              href="#"
              className="text-[11px] tracking-[0.05em] uppercase font-medium text-slate-400 hover:text-slate-800 transition-colors duration-200"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
