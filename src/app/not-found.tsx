import Link from "next/link";

export const metadata = {
  title: "Page not found — KnightForge",
};

export default function NotFound() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center"
      role="main"
    >
      {/* Falling-knight 404 mark, themed to the emerald design system */}
      <p
        aria-hidden="true"
        className="text-8xl md:text-9xl font-black tracking-tight text-emerald-600 select-none"
      >
        4&#9822;4
      </p>
      <h1 className="mt-4 text-2xl md:text-3xl font-bold text-foreground">
        Checkmate — this page doesn&apos;t exist
      </h1>
      <p className="mt-3 max-w-md text-sm md:text-base text-muted-foreground">
        The move you tried is illegal: the page you are looking for was
        captured, moved, or never existed on this board.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow hover:opacity-90 transition-opacity min-h-[44px]"
        >
          Back to the board
        </Link>
        <a
          href="/#puzzles"
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-semibold text-foreground shadow-sm hover:bg-accent transition-colors min-h-[44px]"
        >
          Solve a puzzle instead
        </a>
      </div>
    </main>
  );
}
