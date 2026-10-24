import type { Metadata } from "next";
import { Pixelify_Sans, Press_Start_2P } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// Variable names kept so globals.css and the game canvas keep working.
const display = Press_Start_2P({ variable: "--font-display", weight: "400", subsets: ["latin"] });
const sans = Pixelify_Sans({ variable: "--font-geist-sans", subsets: ["latin"] });

const title = "Kicau — Collect birds, play, save them";
const description = "Bird NFTs that power a flappy game and fund bird conservation, fully on-chain on Monad.";

export const metadata: Metadata = {
  metadataBase: new URL("https://kicau-theta.vercel.app"),
  title,
  description,
  openGraph: { title, description, siteName: "Kicau", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
