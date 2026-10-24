import type { Metadata } from "next";
import { Pixelify_Sans, Press_Start_2P, VT323 } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// Variable names kept so globals.css and the game canvas keep working.
const display = Press_Start_2P({ variable: "--font-display", weight: "400", subsets: ["latin"] });
const sans = Pixelify_Sans({ variable: "--font-geist-sans", subsets: ["latin"] });
// Numbers: VT323 keeps the pixel look but its digits stay legible at small sizes (Press Start 2P digits blur together).
const num = VT323({ variable: "--font-num", weight: "400", subsets: ["latin"] });

const title = "Kicau — The on-chain record for real-life songbird contests";
const description =
  "Live gantangan judging on Monad: every score on-chain, instant prizes, verified champion pedigrees, dynamic Kicau Value — plus a pixel game and open world. Keep the song, not the cage.";

export const metadata: Metadata = {
  metadataBase: new URL("https://kicau.xyz"),
  title,
  description,
  openGraph: { title, description, siteName: "Kicau", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} ${num.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
