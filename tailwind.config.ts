import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        abyss: '#05070f',
        dusk: '#0f172a',
        moon: '#d6bcfa',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(168, 85, 247, 0.25), 0 14px 40px rgba(15, 23, 42, 0.45)',
      },
      backgroundImage: {
        'forge-gradient':
          'radial-gradient(circle at top right, rgba(147, 51, 234, 0.22), transparent 45%), radial-gradient(circle at bottom left, rgba(59, 130, 246, 0.18), transparent 40%)',
      },
    },
  },
  plugins: [],
} satisfies Config;
