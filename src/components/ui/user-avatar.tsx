'use client'

/**
 * Shared user avatar: renders the uploaded profile photo when present,
 * otherwise falls back to the colored initial-letter avatar.
 */
export function UserAvatar({
  image,
  color,
  name,
  size = 32,
  radius = 'full',
  className = '',
}: {
  image?: string | null
  color: string
  name: string
  /** Pixel size (width = height) */
  size?: number
  /** 'full' circle or 'xl' for the rounded-2xl profile look */
  radius?: 'full' | 'xl'
  className?: string
}) {
  const radiusCls = radius === 'xl' ? 'rounded-2xl' : 'rounded-full'
  const style = { width: size, height: size, backgroundColor: color }

  if (image) {
    return (
       
      <img
        src={image}
        alt={`${name}'s avatar`}
        className={`shrink-0 object-cover ${radiusCls} ${className}`}
        style={style}
      />
    )
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center font-bold text-white ${radiusCls} ${className}`}
      style={{ ...style, fontSize: Math.max(10, Math.round(size * 0.42)) }}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}
