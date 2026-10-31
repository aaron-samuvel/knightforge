import { NextResponse } from "next/server";

/**
 * GET /api — machine-readable index of the KnightForge REST surface.
 * The full OpenAPI description lives at /api/openapi.json.
 */
export async function GET() {
  return NextResponse.json({
    name: "KnightForge API",
    version: 1,
    docs: "/api/openapi.json",
    health: "/api/health",
    endpoints: {
      auth: {
        register: "POST /api/auth/register",
        login: "POST /api/auth/login (rate-limited)",
        logout: "POST /api/auth/logout",
        me: "GET /api/auth/me",
        forgotPassword: "POST /api/auth/forgot-password (rate-limited)",
        resetPassword: "POST /api/auth/reset-password (rate-limited)",
      },
      gameplay: {
        recentGames: "GET /api/games?limit=",
        gamePgn: "GET /api/games/[id]/pgn",
        gameAnalysis: "GET|POST /api/games/[id]/analysis",
        finishGame: "POST /api/games/finish",
      },
      players: {
        leaderboard: "GET /api/leaderboard?take=",
        leaderboardStream: "GET /api/leaderboard/stream (SSE)",
        profile: "GET /api/players/[name]",
        myProfile: "PATCH /api/profile",
        userLookup: "GET|POST /api/users?name=",
      },
      puzzles: {
        list: "GET /api/puzzles",
        daily: "GET /api/puzzles/daily",
        attempt: "POST /api/puzzles/attempt",
      },
      import: {
        featured: "GET /api/import/featured",
        games: "POST /api/import/games",
      },
      realtime: "socket.io (embedded :3003 / proxied via /socket.io)",
    },
  });
}
