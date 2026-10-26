import { db } from '@/lib/db'
import { PUZZLES } from '@/lib/puzzles-data'

/**
 * Lazily seed the Puzzle table from the static, validated set in
 * src/lib/puzzles-data.ts. Idempotent: upserts by puzzle id, and skips
 * entirely once every seed puzzle is present in the table.
 */
export async function ensurePuzzlesSeeded(): Promise<void> {
  try {
    const existing = await db.puzzle.count()
    if (existing >= PUZZLES.length) return

    for (const p of PUZZLES) {
      await db.puzzle.upsert({
        where: { id: p.id },
        update: {
          fen: p.fen,
          solution: p.solution,
          theme: p.theme,
          difficulty: p.difficulty,
          sideToMove: p.sideToMove,
          description: p.description,
        },
        create: {
          id: p.id,
          fen: p.fen,
          solution: p.solution,
          theme: p.theme,
          difficulty: p.difficulty,
          sideToMove: p.sideToMove,
          description: p.description,
        },
      })
    }
  } catch (err) {
    console.error('[puzzles seed] failed:', err)
  }
}
