import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Tema industrial escuro
        background: {
          primary: '#0A0E1A',    // Fundo principal
          secondary: '#0D1421',  // Painéis laterais
          tertiary: '#111827',   // Cards e modais
          surface: '#1A2235',    // Superfícies elevadas
          border: '#1E2D45',     // Bordas
        },
        accent: {
          blue: '#1565C0',
          'blue-light': '#42A5F5',
          'blue-bright': '#2979FF',
          cyan: '#00BCD4',
          'cyan-light': '#26C6DA',
        },
        status: {
          safe: '#2E7D32',
          'safe-light': '#4CAF50',
          warning: '#E65100',
          'warning-light': '#FF9800',
          danger: '#B71C1C',
          'danger-light': '#F44336',
        },
        text: {
          primary: '#E8EDF5',
          secondary: '#8FA3BE',
          muted: '#4A6080',
          accent: '#42A5F5',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'grid-pattern': `
          linear-gradient(rgba(30,45,69,0.8) 1px, transparent 1px),
          linear-gradient(90deg, rgba(30,45,69,0.8) 1px, transparent 1px)
        `,
      },
      backgroundSize: {
        'grid-sm': '20px 20px',
        'grid-md': '40px 40px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        glow: {
          from: { boxShadow: '0 0 5px #1565C0, 0 0 10px #1565C0' },
          to: { boxShadow: '0 0 10px #42A5F5, 0 0 20px #42A5F5, 0 0 30px #42A5F5' },
        },
      },
      boxShadow: {
        'panel': '0 0 0 1px rgba(30,45,69,0.8), 0 4px 24px rgba(0,0,0,0.4)',
        'glow-blue': '0 0 20px rgba(21,101,192,0.4)',
        'glow-green': '0 0 20px rgba(46,125,50,0.4)',
        'glow-red': '0 0 20px rgba(183,28,28,0.4)',
      },
    },
  },
  plugins: [],
}
export default config
