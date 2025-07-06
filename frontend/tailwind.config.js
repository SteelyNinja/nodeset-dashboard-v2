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
          500: '#2563eb', // Enhanced NodeSet brand blue
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#172554',
        },
        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff', 
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#8b5cf6', // Enhanced complementary purple
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        // Enhanced status color system
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#047857', // Professional green
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          light: '#d1fae5',
          DEFAULT: '#047857',
          dark: '#064e3b',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b', // Enterprise amber
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          light: '#fef3c7',
          DEFAULT: '#f59e0b',
          dark: '#92400e',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444', // Clear red
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          light: '#fee2e2',
          DEFAULT: '#ef4444',
          dark: '#991b1b',
        },
        info: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#2563eb', // Aligned with primary
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#172554',
          light: '#dbeafe',
          DEFAULT: '#2563eb',
          dark: '#1e40af',
        },
        // Enhanced neutral grays with better contrast
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
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
        'xs': ['0.625rem', { lineHeight: '0.875rem' }],      // 10px
        'sm': ['0.75rem', { lineHeight: '1rem' }],           // 12px
        'base': ['0.875rem', { lineHeight: '1.25rem' }],     // 14px
        'md': ['1rem', { lineHeight: '1.5rem' }],            // 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],       // 18px
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],        // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],           // 24px
        '3xl': ['2rem', { lineHeight: '2.5rem' }],           // 32px
        '4xl': ['2.5rem', { lineHeight: '3rem' }],           // 40px
        '5xl': ['3rem', { lineHeight: '3.5rem' }],           // 48px
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        'heading': ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        'body': ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
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
        'original-light': 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #f8fafc 100%)',
        'original-dark': 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #172554 100%)',
        'gradient-light': 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #f8fafc 100%)',
        'gradient-dark': 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #172554 100%)',
        'glass-light': 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(139, 92, 246, 0.08))',
        'glass-dark': 'linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(139, 92, 246, 0.12))',
        'glass-light-hover': 'linear-gradient(135deg, rgba(37, 99, 235, 0.12), rgba(139, 92, 246, 0.12))',
        'glass-dark-hover': 'linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(139, 92, 246, 0.18))',
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