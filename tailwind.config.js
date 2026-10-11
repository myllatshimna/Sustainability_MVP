/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f2f8f4',
          100: '#e1efe4',
          200: '#c4dfcd',
          300: '#9bc8aa',
          400: '#6ca980',
          500: '#488c5f',
          600: '#35714a',
          700: '#2b5a3c',
          800: '#254832',
          900: '#1e3c2b',
          950: '#0e2016',
        },
        warm: {
          50: '#fbfaf8',
          100: '#f6f4ee',
          200: '#ece7db',
          300: '#dfd6c2',
          400: '#cdbfa4',
          500: '#bca889',
        }
      },
    },
  },
  plugins: [],
};
