'use client'

import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface MoveListProps {
  moves: string[]
}

export function MoveList({ moves }: MoveListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [moves.length])

  const rows: { no: number; white?: string; black?: string }[] = []
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ no: i / 2 + 1, white: moves[i], black: moves[i + 1] })
  }

  return (
    <ScrollArea className="h-64 max-h-64 rounded-lg border">
      <div className="p-1">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No moves yet — white to play
          </p>
        ) : (
          <table className="w-full text-sm" aria-label="Move list">
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.no}
                  className={idx === rows.length - 1 ? 'bg-emerald-500/10 font-semibold' : ''}
                >
                  <td className="w-10 px-2 py-1 text-right text-xs text-muted-foreground">
                    {row.no}.
                  </td>
                  <td className="px-3 py-1 font-mono">{row.white}</td>
                  <td className="px-3 py-1 font-mono">{row.black ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  )
}
