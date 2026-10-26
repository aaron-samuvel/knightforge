import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KnightForge — Free Online Chess: Play, Learn, Review",
  description:
    "KnightForge is a free online chess platform: realtime multiplayer, computer opponents, private rooms, puzzles, openings and Stockfish-powered game review.",
  keywords: ["chess", "online chess", "multiplayer chess", "stockfish", "puzzles", "openings", "knightforge"],
  authors: [{ name: "chesscodeceo" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "KnightForge — Free Online Chess",
    description: "Play, learn, and forge your game. Free forever.",
    siteName: "KnightForge",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
