/** @type {import('tailwindcss').Config} */
import { violet } from "tailwindcss/colors"
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			/* Dashboard card radius — 14px is the sweet spot between
  			 *  the 8px (md) form-input look and 20px (xl) which reads
  			 *  too playful for an editorial dashboard. */
  			card: '14px'
  		},
		
			listStyleType: {
				none: 'none',
		},
		screens:  {
			'high-dpi': {'raw'  : '(min-resolution: 144dpi)' },

		},

  		colors: {
			border: "hsl(var(--border))",
			input: "hsl(var(--input))",
			ring: "hsl(var(--ring))",
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
			  popover: {
				DEFAULT: "hsl(var(--popover))",
				foreground: "hsl(var(--popover-foreground))",
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
				DEFAULT: "hsl(var(--muted))",
				foreground: "hsl(var(--muted-foreground))",
			  },
			  accent: {
				DEFAULT: "hsl(var(--accent))",
				foreground: "hsl(var(--accent-foreground))",
			  },
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			/* ── Polish-pass additions: semantic state colors + soft border
  			 *    + tertiary text. The `border-soft` and `text-tertiary`
  			 *    vars carry their own alpha via the slash syntax. */
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))'
  			},
  			'border-soft': 'hsl(var(--border-soft))',
  			'text-tertiary': 'hsl(var(--text-tertiary))',

  			/* ── Dashboard token layer (see src/styles/theme.css) ──
  			 *    Clean semantic aliases used by the modern home
  			 *    dashboard. Layered surfaces + four text levels +
  			 *    refined coral-red accent + calm semantic states. */
  			surface:   'hsl(var(--cwa-surface))',
  			'surface-2': 'hsl(var(--cwa-surface-2))',
  			fg:        'hsl(var(--cwa-fg))',
  			'fg-muted':  'hsl(var(--cwa-fg-muted))',
  			'fg-subtle': 'hsl(var(--cwa-fg-subtle))',
  			'fg-faint':  'hsl(var(--cwa-fg-faint))',
  			line:        'hsl(var(--cwa-line))',
  			'line-strong': 'hsl(var(--cwa-line-strong))',
  			'accent-coral': 'hsl(var(--cwa-accent))',
  			'success-strong': 'hsl(var(--cwa-success))',
  			'success-bg':     'hsl(var(--cwa-success-bg))',
  			'warning-strong': 'hsl(var(--cwa-warning))',
  			'warning-bg':     'hsl(var(--cwa-warning-bg))',
  			'danger-strong':  'hsl(var(--cwa-danger))',
  			'danger-bg':      'hsl(var(--cwa-danger-bg))',
  		},
  		fontSize: {
  			/* Type scale for the dashboard.
  			 *   metric — hero numbers (38/600, tabular-nums via theme.css)
  			 *   title  — card titles (14/500)
  			 *   label  — tracked uppercase labels (11/600)
  			 *   hint   — secondary meta (12/400)
  			 *   body   — body copy (13.5/400) */
  			metric: ['38px', { lineHeight: '1.05', letterSpacing: '-0.015em', fontWeight: 600 }],
  			title:  ['14px', { lineHeight: '1.3', fontWeight: 500 }],
  			label:  ['11px', { lineHeight: '1', letterSpacing: '0.08em', fontWeight: 600 }],
  			hint:   ['12px', { lineHeight: '1.45', fontWeight: 400 }],
  			body:   ['13.5px', { lineHeight: '1.5', fontWeight: 400 }],
  		},
  		borderWidth: {
  			/* True hairline — 0.5 logical pixel. Renders as 1 device pixel
  			 *  with subpixel AA on standard DPI, halfpx on retina. The
  			 *  most subtle stroke that still anchors a card edge. */
  			xs: '0.5px',
			  borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			  },
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
			 
			  keyframes: {
				"accordion-down": {
				  from: { height: 0 },
				  to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
				  from: { height: "var(--radix-accordion-content-height)" },
				  to: { height: 0 },
				},
				shimmer: {
				  "100%": { transform: "translateX(100%)" },
				},
				"revenue-pulse": {
				  from: { transform: "scale(1)", opacity: "0.6" },
				  to: { transform: "scale(1.8)", opacity: "0" },
				},
			  },
			  animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
				shimmer: "shimmer 1.4s infinite",
				"revenue-pulse": "revenue-pulse 1.5s ease-out infinite",
			  },
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
