/** @type {import('tailwindcss').Config} */

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// Colour scale backed by space-separated RGB channels in CSS variables
// (e.g. --neutral-500: 115 115 115) so opacity modifiers like /20 keep working.
// Values per colour scheme / accent live in src/index.css.
const varScale = (name) =>
  Object.fromEntries(STEPS.map((step) => [step, `rgb(var(--${name}-${step}) / <alpha-value>)`]));

export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		borderColor: {
  			DEFAULT: 'rgb(var(--neutral-200) / <alpha-value>)',
  		},
  		colors: {
  			// Colour schemes: the whole app is built on neutral-*, white and black,
  			// so remapping them re-themes every component without edits.
  			neutral: varScale('neutral'),
  			white: 'rgb(var(--neutral-white) / <alpha-value>)',
  			black: 'rgb(var(--neutral-black) / <alpha-value>)',
  			// Accent colour chosen in Settings → Appearance.
  			// Semantic names already adapt to light/dark (no dark: variant needed):
  			//   bg-accent / hover:bg-accent-hover / text-accent-fg  solid fills (buttons, today marker, progress)
  			//   text-accent-ink    accent-coloured text & icons on normal surfaces
  			//   bg-accent-soft     tinted background for selected / active items
  			//   ring-accent-ring   focus rings and outlines
  			accent: {
  				...varScale('accent'),
  				DEFAULT: 'rgb(var(--accent-solid) / <alpha-value>)',
  				hover: 'rgb(var(--accent-solid-hover) / <alpha-value>)',
  				fg: 'rgb(var(--accent-on-solid) / <alpha-value>)',
  				foreground: 'rgb(var(--accent-on-solid) / <alpha-value>)',
  				ink: 'rgb(var(--accent-ink) / <alpha-value>)',
  				soft: 'rgb(var(--accent-soft) / var(--accent-soft-alpha))',
  				ring: 'rgb(var(--accent-ring) / <alpha-value>)',
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'rgb(var(--neutral-200) / <alpha-value>)',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate"), require("tailwind-scrollbar-hide")],
}
