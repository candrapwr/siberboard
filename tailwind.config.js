/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan HTML *and* JS — many classes are generated in template strings
  // (e.g. createNodeElement builds `bg-[#2b2b2b]`, `line-clamp-2`, …).
  content: ['./index.html', './src/**/*.js'],
  theme: {
    extend: {},
  },
  plugins: [],
};
