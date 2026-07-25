/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Silk ignora @layer completo → hay que aplanarlo
    "@csstools/postcss-cascade-layers": {},
    // color-mix / media range → sintaxis Chrome 80+
    "./postcss-lightningcss-legacy.cjs": {},
  },
};

module.exports = config;
