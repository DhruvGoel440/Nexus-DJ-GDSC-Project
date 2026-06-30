/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Outfit", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        dj: {
          // Added the missing quotes around these hex codes here:
          bg: "#050508",
          surface: "#0a0a12",
          panel: "#11111a",
          elevated: "#161624",
          border: "#222232",
          "border-light": "#2d2d44",
          
          // These already have quotes
          accent: "#ff3366",
          "accent-dim": "#cc2952",
          blue: "#00d4ff",
          "blue-dim": "#0099cc",
          green: "#00e676",
          yellow: "#ffca28",
          muted: "#6b6b80",
        },
      },
      boxShadow: {
        panel: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
        glow: "0 0 25px rgba(255,51,102,0.22)",
        "glow-blue": "0 0 25px rgba(0,212,255,0.22)",
      },
      animation: {
        "pulse-slow": "pulse 2.5s cubic-bezier(0.4,0,0.6,1) infinite",
        "slide-up": "slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fadeIn 0.2s ease-out",
        "spin-slow": "spin 12s linear infinite",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};