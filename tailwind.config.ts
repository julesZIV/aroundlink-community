import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#f0f3f8',
          100: '#d9e2ef',
          200: '#b3c5df',
          300: '#8da8cf',
          400: '#415f82',
          500: '#1a3055',
          600: '#162840',
          700: '#0f1f33',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
