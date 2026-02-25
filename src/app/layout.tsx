import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conversor de Imagens",
  description: "Converta imagens em massa para WebP, AVIF, JPEG, PNG, TIFF e mais",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
