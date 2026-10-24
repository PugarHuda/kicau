import type { Metadata } from "next";
import { Pixelify_Sans, Press_Start_2P } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// Variable names kept so globals.css and the game canvas keep working.
const display = Press_Start_2P({ variable: "--font-display", weight: "400", subsets: ["latin"] });
const sans = Pixelify_Sans({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kicau — Koleksi burung, main, selamatkan",
  description: "Bird NFTs that power a flappy game and fund bird conservation, fully on-chain on Monad.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${display.variable} ${sans.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
