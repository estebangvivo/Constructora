import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Fire / tablets en la LAN: sin esto Next puede bloquear /_next/* (CSS/JS)
  allowedDevOrigins: [
    "192.168.0.207",
    "192.168.0.207:3000",
    "localhost",
    "127.0.0.1",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
      // Permite login desde tablet/celular en la LAN (IP local) y dominios de prod.
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        "192.168.0.207:3000",
        "www.bunas.com.ar",
        "bunas.com.ar",
      ],
    },
  },
  serverExternalPackages: ["pdf-parse", "tesseract.js"],
};

export default nextConfig;
