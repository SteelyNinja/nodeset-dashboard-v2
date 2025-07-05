/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'media', // Auto-detect system theme preference
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe', 
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6', // Main primary blue
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff', 
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7', // Purple accent
          600: '#9333ea',
          700: '#7c3aed',
          800: '#6b21a8',
          900: '#581c87',
        },
        // Status color system
        success: {
          light: '#d1fae5',
          DEFAULT: '#10b981',
          dark: '#047857',
        },
        warning: {
          light: '#fef3c7',
          DEFAULT: '#f59e0b',
          dark: '#d97706',
        },
        danger: {
          light: '#fee2e2',
          DEFAULT: '#ef4444',
          dark: '#dc2626',
        },
        info: {
          light: '#dbeafe',
          DEFAULT: '#3b82f6',
          dark: '#1d4ed8',
        },
        glassmorphism: {
          light: 'rgba(255, 255, 255, 0.25)',
          dark: 'rgba(17, 24, 46, 0.25)',
          border: 'rgba(255, 255, 255, 0.15)',
        },
        'glass-light': 'rgba(255, 255, 255, 0.1)',
        'glass-dark': 'rgba(17, 24, 46, 0.4)',
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
      spacing: {
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
        '5': '1.25rem',
        '6': '1.5rem',
        '8': '2rem',
        '10': '2.5rem',
        '12': '3rem',
        '16': '4rem',
        '20': '5rem',
        '24': '6rem',
      },
      backgroundImage: {
        'original-light': 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0f9ff 100%)',
        'original-dark': 'linear-gradient(135deg, #11182e 0%, #1f2a3f 50%, #11182e 100%)',
        'gradient-light': 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0f9ff 100%)',
        'gradient-dark': 'linear-gradient(135deg, #11182e 0%, #1f2a3f 50%, #11182e 100%)',
        'glass-light': 'linear-gradient(135deg, rgba(59, 130, 246, 0.08), rgba(147, 51, 234, 0.08))',
        'glass-dark': 'linear-gradient(135deg, rgba(96, 165, 250, 0.12), rgba(167, 139, 250, 0.12))',
        'glass-light-hover': 'linear-gradient(135deg, rgba(59, 130, 246, 0.10), rgba(147, 51, 234, 0.10))',
        'glass-dark-hover': 'linear-gradient(135deg, rgba(96, 165, 250, 0.15), rgba(167, 139, 250, 0.15))',
        'glass-highlight': 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
      },
      backdropBlur: {
        'glass': '15px',
        'glass-dark': '20px',
      },
      backdropSaturate: {
        '140': '1.4',
      },
      boxShadow: {
        'glass-light': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'glass-light-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'glass-dark': '0 8px 32px rgba(0, 0, 0, 0.3), 0 1px 0 rgba(255, 255, 255, 0.1) inset, 0 -1px 0 rgba(0, 0, 0, 0.2) inset',
        'glass-dark-hover': '0 12px 40px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(255, 255, 255, 0.15) inset, 0 -1px 0 rgba(0, 0, 0, 0.25) inset',
        'button-glow': '0 0 20px -5px currentColor',
        'button-glow-lg': '0 0 30px -5px currentColor',
        'glass-button': '0 8px 32px rgba(0, 0, 0, 0.2), 0 1px 0 rgba(255, 255, 255, 0.2) inset, 0 -1px 0 rgba(0, 0, 0, 0.1) inset',
        'glass-button-hover': '0 20px 40px rgba(0, 0, 0, 0.3), 0 1px 0 rgba(255, 255, 255, 0.3) inset, 0 -1px 0 rgba(0, 0, 0, 0.15) inset',
      },
      transitionTimingFunction: {
        'glass': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%) skewX(-12deg)' },
          '100%': { transform: 'translateX(100%) skewX(-12deg)' },
        },
      },
    },
  },
  plugins: [],
}