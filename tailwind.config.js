/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* ── Surfaces (Unirate) ── */
        'cream':                    '#FBF6EC',
        'paper':                    '#FFFDF7',
        'paper-2':                  '#F5EEDF',

        /* ── Text (Unirate) ── */
        'ink':                      '#1C1917',
        'ink-2':                    '#3A342E',
        'muted':                    '#8B827A',
        'muted-2':                  '#A89E91',

        /* ── Accent: Rust (Unirate) ── */
        'rust':                     '#B84A1E',
        'rust-soft':                '#C2724C',
        'rust-wash':                '#F2DDCF',

        /* ── Borders (Unirate) ── */
        'sepia':                    '#E8DCC6',
        'sepia-2':                  '#D9C9AD',

        /* ── Semantic (Unirate) ── */
        'ok':                       '#4A7A3C',
        'warn':                     '#C29A2A',
        'danger':                   '#9A2B1A',
        'sage':                     '#6B7A5A',
        'gold':                     '#A88030',

        /* ── Mapped to standard Tailwind names ── */
        'surface':                  '#FBF6EC',
        'surface-bright':           '#FFFDF7',
        'surface-dim':              '#F5EEDF',
        'surface-container-lowest': '#FFFDF7',
        'surface-container-low':    '#F5EEDF',
        'surface-container':        '#F5EEDF',
        'surface-container-high':   '#E8DCC6',
        'on-surface':               '#1C1917',
        'on-surface-variant':       '#3A342E',
        'inverse-surface':          '#1A1613',
        'inverse-on-surface':       '#F4EBDB',

        /* ── Primary (Rust) ── */
        'primary':                  '#B84A1E',
        'primary-container':        '#F2DDCF',
        'primary-fixed':            '#F2DDCF',
        'primary-fixed-dim':        '#C2724C',
        'inverse-primary':          '#D16A3D',
        'on-primary':               '#FFFDF7',
        'on-primary-container':     '#1C1917',
        'on-primary-fixed':         '#1C1917',
        'on-primary-fixed-variant': '#8B4A2A',

        /* ── Secondary (Rust-soft) ── */
        'secondary':                '#C2724C',
        'secondary-container':      '#F2DDCF',
        'secondary-fixed':          '#F2DDCF',
        'secondary-fixed-dim':      '#C2724C',
        'on-secondary':             '#1C1917',
        'on-secondary-container':   '#3A342E',
        'on-secondary-fixed':       '#FFFDF7',
        'on-secondary-fixed-variant': '#8B4A2A',

        /* ── Tertiary (Sage) ── */
        'tertiary':                 '#6B7A5A',
        'tertiary-container':       '#D9C9AD',
        'tertiary-fixed':           '#D9C9AD',
        'tertiary-fixed-dim':       '#6B7A5A',
        'on-tertiary':              '#FFFDF7',
        'on-tertiary-container':    '#1C1917',
        'on-tertiary-fixed':        '#FFFDF7',
        'on-tertiary-fixed-variant': '#6B7A5A',

        /* ── Semantic ── */
        'outline':                  '#8B827A',
        'outline-variant':          '#A89E91',
        'surface-tint':             '#B84A1E',
        'error':                    '#9A2B1A',
        'error-container':          '#F2DDCF',
        'on-error':                 '#FFFDF7',
        'on-error-container':       '#1C1917',
        'background':               '#FBF6EC',
        'on-background':            '#1C1917',
        'surface-variant':          '#E8DCC6',

        /* ── Shortcut names ── */
        'rust':                     '#B84A1E',
        'sepia':                    '#E8DCC6',
        'cream':                    '#FBF6EC',
      },
      fontFamily: {
        /* Serif italic display — для заголовков и акцентов Unirate */
        display:  ['Fraunces', 'Georgia', 'serif'],
        serif:    ['Fraunces', 'Georgia', 'serif'],
        /* Inter — body */
        headline: ['Inter', 'sans-serif'],
        body:     ['Inter', 'sans-serif'],
        label:    ['Inter', 'sans-serif'],
        sans:     ['Inter', 'sans-serif'],
        mono:     ['"JetBrains Mono"', 'monospace'],
      },
      letterSpacing: {
        'label': '0.18em',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg:      '0.5rem',
        xl:      '0.75rem',
        '2xl':   '1rem',
        '3xl':   '1.5rem',
        full:    '9999px',
      },
      boxShadow: {
        'sm':   '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card': '0 4px 24px rgba(0,0,0,0.06)',
        'md':   '0 4px 16px rgba(0,0,0,0.08)',
        'lg':   '0 8px 32px rgba(0,0,0,0.10)',
        'rust': '0 4px 20px rgba(184,74,30,0.25)',
      },
    },
  },
  plugins: [],
}
