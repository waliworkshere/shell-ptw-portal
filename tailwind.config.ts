import type { Config } from 'tailwindcss';

// Palette: Artelia navy for the working UI, Shell red & yellow for brand
// accents, Artelia green for "good / passed / approved" states.
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14202B',
        // Primary UI (Artelia navy)
        petrol: {
          50: '#EEF3F8',
          100: '#D9E3EE',
          200: '#AFC3D8',
          300: '#7898B8',
          400: '#3F6A93',
          500: '#1D3D60',
          600: '#16304C',
          700: '#0F2338',
        },
        // Shell yellow
        sand: {
          50: '#FFFBE6',
          100: '#FFF3B0',
          200: '#FFE97A',
          300: '#FFDF44',
          400: '#FFD91F',
          500: '#FBCE07',
          600: '#A68500',
          700: '#6E5800',
        },
        // Shell red
        rust: {
          50: '#FDECEC',
          100: '#F9D0D1',
          400: '#E5484C',
          500: '#DD1D21',
          600: '#B4161A',
          700: '#8A1114',
        },
        // Artelia green — success
        leaf: {
          50: '#F1F8E6',
          100: '#DCEFC2',
          200: '#BBDF8E',
          400: '#86BC3E',
          500: '#6A9F2A',
          600: '#4F7A1D',
          700: '#3A5A15',
        },
        paper: '#F5F6F8',
        slate: {
          300: '#C3CBD3',
          400: '#8592A0',
          500: '#5A6775',
          600: '#434F5C',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        sans: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'pop': { '0%': { transform: 'scale(.9)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(221,29,33,.55)' }, '100%': { boxShadow: '0 0 0 18px rgba(221,29,33,0)' } },
        'confetti': { '0%': { transform: 'translateY(-10vh) rotate(0)', opacity: '1' }, '100%': { transform: 'translateY(105vh) rotate(720deg)', opacity: '0.9' } },
        'scan': { '0%': { top: '8%' }, '50%': { top: '88%' }, '100%': { top: '8%' } },
      },
      animation: {
        'fade-up': 'fade-up .35s ease-out both',
        'pop': 'pop .25s ease-out both',
        'pulse-ring': 'pulse-ring 1.4s ease-out infinite',
        'confetti': 'confetti 2.6s ease-in forwards',
        'scan': 'scan 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
