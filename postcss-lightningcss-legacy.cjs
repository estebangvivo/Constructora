/**
 * Re-procesa el CSS de Tailwind v4 para navegadores viejos (Amazon Silk / Fire).
 * Tailwind asume Chrome 111+ (@layer, color-mix, media range). Silk suele ir atrás
 * e ignora esas reglas → UI sin estilos / rota. LightningCSS las transpila.
 */
const { transform, browserslistToTargets, Features } = require("lightningcss");
const browserslist = require("browserslist");

const LEGACY_BROWSERS = [
  "chrome >= 80",
  "android >= 80",
  "safari >= 14",
  "ios >= 14",
  "firefox >= 90",
  "edge >= 80",
];

const lightningcssLegacy = () => {
  return {
    postcssPlugin: "lightningcss-legacy",
    OnceExit(root, { result, postcss }) {
      const input = root.toString();
      const from = result.opts.from ?? "input.css";

      let out;
      try {
        out = transform({
          filename: from,
          code: Buffer.from(input),
          minify: false,
          sourceMap: false,
          errorRecovery: true,
          targets: browserslistToTargets(browserslist(LEGACY_BROWSERS)),
          include:
            Features.Nesting |
            Features.Colors |
            Features.MediaQueries |
            Features.LightDark |
            Features.HexAlphaColors |
            Features.LogicalProperties,
        });
      } catch (err) {
        console.warn("[lightningcss-legacy] transform failed:", err);
        return;
      }

      const css = out.code.toString();
      const parsed = postcss.parse(css, { from });
      root.removeAll();
      root.append(parsed.nodes);
    },
  };
};

lightningcssLegacy.postcss = true;

module.exports = lightningcssLegacy;
