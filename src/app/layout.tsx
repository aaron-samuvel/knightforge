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
  title: "ChessCodeCEO Chess — Free Realtime Multiplayer Chess",
  description:
    "Free realtime multiplayer chess platform: quick matchmaking, chess clocks, bot play and Stockfish game review. Built with Next.js, Socket.io, chess.js and Stockfish WASM.",
  keywords: ["chess", "multiplayer chess", "realtime chess", "stockfish", "game review", "open source"],
  authors: [{ name: "chesscodeceo" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "ChessCodeCEO Chess",
    description: "Free realtime multiplayer chess with Stockfish game review",
    siteName: "ChessCodeCEO Chess",
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
