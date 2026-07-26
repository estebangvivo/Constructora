/**
 * Expone el server local con HTTPS público (Cloudflare quick tunnel).
 * En el celular abrí la URL https://….trycloudflare.com que imprime,
 * iniciá sesión y ahí WhatsApp sí puede adjuntar el PDF.
 *
 * Uso (con `npm run dev` ya corriendo en otra terminal):
 *   npm run tunnel
 */
import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const target = `http://127.0.0.1:${port}`;

console.log("");
console.log("Túnel HTTPS →", target);
console.log("Dejá esta terminal abierta. En el celular usá la URL https://…trycloudflare.com");
console.log("(no uses http://192.168… para adjuntar PDF)");
console.log("");

const child = spawn(
  "npx",
  ["--yes", "cloudflared", "tunnel", "--url", target],
  { stdio: "inherit", shell: true },
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
