import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GRAN BINGO ECUADOR — Plataforma Interactiva 6 Tablas",
  description:
    "Cartón digital interactivo de 6 tablas (B-I-N-G-O + Tabla Llena), verificación en tiempo real, PDF con QR y sorteo de desempate Al Número Mayor.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen antialiased selection:bg-amber-300 selection:text-slate-900"
      >
        {children}
      </body>
    </html>
  );
}
