"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Route-level error boundary for the root segment. Client-side render,
 * data-fetch and streaming errors land here instead of crashing the SPA.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real stack in the browser console; users only see the
    // friendly card below.
    console.error("[KnightForge] unhandled route error:", error);
  }, [error]);

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center"
      role="main"
    >
      <p
        aria-hidden="true"
        className="text-6xl md:text-7xl select-none"
      >
        &#9822;&#9823;
      </p>
      <h1 className="mt-4 text-2xl md:text-3xl font-bold text-foreground">
        Game interrupted
      </h1>
      <p className="mt-3 max-w-md text-sm md:text-base text-muted-foreground">
        Something went wrong on our side of the board. Your account and games
        are safe — try resuming.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-muted-foreground/70 font-mono">
          error ref: {error.digest}
        </p>
      ) : null}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <Button onClick={reset} className="min-h-[44px] px-6">
          Try again
        </Button>
        <Button
          variant="outline"
          className="min-h-[44px] px-6"
          onClick={() => {
            window.location.href = "/";
          }}
        >
          Back to home
        </Button>
      </div>
    </main>
  );
}
