import type { Metadata, Viewport } from "next";
import { DM_Sans, IBM_Plex_Sans } from "next/font/google";
import { AuthProvider } from "@/features/auth/auth-provider";
import { HardNavForLegacy } from "@/components/compat/hard-nav-for-legacy";
import { APP_NAME, APP_SLOGAN } from "@/config/brand";
import "@/styles/globals.css";

const display = DM_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Roboto", "sans-serif"],
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "Roboto", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_SLOGAN,
  icons: {
    icon: [{ url: "/brand/simpleobra-mark.png", type: "image/png" }],
    apple: [{ url: "/brand/simpleobra-mark.png", type: "image/png" }],
  },
};

/** Crítico para Fire/Silk y móviles: sin esto la UI se ve minúscula. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1c1917",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh min-h-screen overflow-x-hidden font-sans antialiased">
        <HardNavForLegacy />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
