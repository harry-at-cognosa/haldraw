/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        panel: 'var(--panel)',
        'panel-hover': 'var(--panel-hover)',
        canvas: 'var(--canvas)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        border: 'var(--border)',
        fg: 'var(--fg)',
        'fg-muted': 'var(--fg-muted)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};
