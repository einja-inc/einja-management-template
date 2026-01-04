import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  // TailwindCSSとの共存のためpreflightを無効化
  preflight: false,

  // Where to look for your css declarations
  include: ["./src/**/*.{js,jsx,ts,tsx}", "./pages/**/*.{js,jsx,ts,tsx}"],

  // Files to exclude
  exclude: [],

  // Panda CSSクラスにプレフィックスを付けてTailwindと区別
  prefix: "panda",

  // Useful for theme customization
  theme: {
    extend: {
      breakpoints: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1440px",
      },
      tokens: {
        colors: {
          // shadcnのカラーシステムと互換性を保つ
          border: { value: "hsl(214.3 31.8% 91.4%)" },
          input: { value: "hsl(214.3 31.8% 91.4%)" },
          ring: { value: "hsl(222.2 84% 4.9%)" },
          background: { value: "hsl(0 0% 100%)" },
          foreground: { value: "hsl(222.2 84% 4.9%)" },
          primary: {
            DEFAULT: { value: "hsl(222.2 47.4% 11.2%)" },
            foreground: { value: "hsl(210 40% 98%)" },
          },
          secondary: {
            DEFAULT: { value: "hsl(210 40% 96%)" },
            foreground: { value: "hsl(222.2 84% 4.9%)" },
          },
          destructive: {
            DEFAULT: { value: "hsl(0 62.8% 30.6%)" },
            foreground: { value: "hsl(210 40% 98%)" },
          },
          muted: {
            DEFAULT: { value: "hsl(210 40% 96%)" },
            foreground: { value: "hsl(215.4 16.3% 46.9%)" },
          },
          accent: {
            DEFAULT: { value: "hsl(210 40% 96%)" },
            foreground: { value: "hsl(222.2 84% 4.9%)" },
          },
          popover: {
            DEFAULT: { value: "hsl(0 0% 100%)" },
            foreground: { value: "hsl(222.2 84% 4.9%)" },
          },
          card: {
            DEFAULT: { value: "hsl(0 0% 100%)" },
            foreground: { value: "hsl(222.2 84% 4.9%)" },
          },
        },
      },
      recipes: {
        // 独自のPanda CSSレシピを定義
        pandaButton: {
          className: "panda-button",
          base: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "md",
            fontSize: "sm",
            fontWeight: "medium",
            transition: "all 0.2s",
            cursor: "pointer",
            _disabled: {
              pointerEvents: "none",
              opacity: 0.5,
            },
          },
          variants: {
            variant: {
              primary: {
                bg: "primary",
                color: "primary.foreground",
                _hover: { opacity: 0.9 },
              },
              secondary: {
                bg: "secondary",
                color: "secondary.foreground",
                _hover: { opacity: 0.8 },
              },
            },
            size: {
              sm: { h: "8", px: "3" },
              md: { h: "10", px: "4" },
              lg: { h: "12", px: "6" },
            },
          },
          defaultVariants: {
            variant: "primary",
            size: "md",
          },
        },
      },
    },
  },

  // The output directory for your css system
  outdir: "styled-system",

  jsxFramework: "react",
});
