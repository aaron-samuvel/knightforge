'use client'

import { useRef, useState } from 'react'
import {
  Camera,
  Check,
  ExternalLink,
  Flag,
  GraduationCap,
  ImagePlus,
  Loader2,
  LogOut,
  Palette,
  Save,
  Trash2,
  User,
  Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { BOARD_THEMES } from '@/lib/config'
import { COUNTRIES, countryToFlag } from '@/lib/countries'
import { useApp } from '@/lib/store'
import { useAuth } from '@/hooks/use-auth'
import { UserAvatar } from '@/components/ui/user-avatar'

/** Input file size cap before client-side resize (5MB). */
const MAX_INPUT_BYTES = 5 * 1024 * 1024
/** Uploaded avatar is stored as a ≤256px JPEG data URL. */
const AVATAR_SIZE = 256
/** Server hard cap on the base64 data URL length. */
const AVATAR_MAX_CHARS = 200_000

/**
 * Cover-crop an image file into a square AVATAR_SIZE JPEG data URL using
 * a canvas — keeps uploads tiny (~10–30KB) regardless of the source photo.
 */
async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file')
  if (file.size > MAX_INPUT_BYTES) throw new Error('Image too large (max 5MB)')

  const bitmap = await createImageBitmap(file)
  const scale = Math.max(AVATAR_SIZE / bitmap.width, AVATAR_SIZE / bitmap.height)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const sx = Math.floor((w - AVATAR_SIZE) / 2)
  const sy = Math.floor((h - AVATAR_SIZE) / 2)

  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process the image')
  ctx.drawImage(bitmap, sx, sy, AVATAR_SIZE, AVATAR_SIZE, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  if (dataUrl.length > AVATAR_MAX_CHARS) throw new Error('Image too complex — try a simpler photo')
  return dataUrl
}

export function ProfileView() {
  const user = useApp((s) => s.user)
  const prefs = useApp((s) => s.prefs)
  const setPrefs = useApp((s) => s.setPrefs)
  const { updateProfile, logout } = useAuth()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor ?? '#10b981')
  const [avatarImage, setAvatarImage] = useState(user?.avatarImage ?? null)
  const [favoriteOpening, setFavoriteOpening] = useState(user?.favoriteOpening ?? '')
  const [lichessHandle, setLichessHandle] = useState(user?.lichessHandle ?? '')
  const [chesscomHandle, setChesscomHandle] = useState(user?.chesscomHandle ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(user?.websiteUrl ?? '')
  const [country, setCountry] = useState(user?.country ?? '')
  const [birthYear, setBirthYear] = useState(user?.birthYear ? String(user.birthYear) : '')
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)

  if (!user) return null

  const save = async () => {
    // Trimmed empties become null (cleared) — handles are either valid or absent
    const website = websiteUrl.trim()
    setSaving(true)
    const res = await updateProfile({
      displayName,
      bio,
      avatarColor,
      avatarImage,
      favoriteOpening: favoriteOpening.trim() || null,
      lichessHandle: lichessHandle.trim() || null,
      chesscomHandle: chesscomHandle.trim() || null,
      websiteUrl: website ? (httpsify(website) ?? website) : null,
      country: country || null,
      birthYear: birthYear ? Number(birthYear) : null,
      preferences: JSON.stringify(prefs),
    })
    setSaving(false)
    if (res.ok) toast({ title: 'Profile saved' })
    else toast({ title: res.error ?? 'Save failed', variant: 'destructive' })
  }

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return
    setPhotoBusy(true)
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      setAvatarImage(dataUrl)
      toast({ title: 'Photo ready — press "Save changes" to apply' })
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : 'Could not process the image',
        variant: 'destructive',
      })
    } finally {
      setPhotoBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removePhoto = () => {
    setAvatarImage(null)
  }

  const totalGames = user.wins + user.losses + user.draws
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-4">
        <UserAvatar
          image={avatarImage}
          color={avatarColor}
          name={displayName || user.name}
          size={64}
          radius="xl"
        />
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <User className="h-6 w-6 text-emerald-600" /> {user.displayName || user.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            @{user.name} · rating {user.rating} · {totalGames} games · {user.puzzleSolved} puzzles
            {memberSince ? ` · member since ${memberSince}` : ''}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Profile photo &amp; identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Photo upload */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <UserAvatar
                image={avatarImage}
                color={avatarColor}
                name={displayName || user.name}
                size={80}
                radius="xl"
              />
              {photoBusy && (
                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </span>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                id="pr-photo"
                aria-label="Upload profile photo"
                onChange={(e) => void handlePhoto(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                disabled={photoBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="mr-2 h-4 w-4" /> Upload photo
              </Button>
              {avatarImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] text-destructive"
                  disabled={photoBusy}
                  onClick={() => void removePhoto()}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Remove photo
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                JPG/PNG/WebP, cropped to a square. Stored small so pages stay fast.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pr-display">Display name</Label>
            <Input id="pr-display" value={displayName} maxLength={30} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-bio">Bio</Label>
            <Textarea id="pr-bio" value={bio} maxLength={200} rows={2} onChange={(e) => setBio(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pr-country" className="inline-flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5" /> Nationality
              </Label>
              <Select value={country || undefined} onValueChange={setCountry}>
                <SelectTrigger id="pr-country" aria-label="Nationality">
                  <SelectValue placeholder="Select a country…" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {countryToFlag(c.code)} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Shown with your flag in the global ranking.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-birth">Birth year</Label>
              <Select value={birthYear || undefined} onValueChange={setBirthYear}>
                <SelectTrigger id="pr-birth" aria-label="Birth year">
                  <SelectValue placeholder="Select a year…" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - 5 - i).map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used to show your age in the global ranking.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-color">Avatar color</Label>
            <div className="flex items-center gap-2">
              <input
                id="pr-color"
                type="color"
                value={avatarColor}
                onChange={(e) => setAvatarColor(e.target.value)}
                className="h-9 w-14 cursor-pointer rounded border"
                aria-label="Avatar color picker"
              />
              <span className="text-xs text-muted-foreground">
                Used for the letter avatar while no photo is uploaded.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4" /> Chess profile &amp; links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pr-opening" className="inline-flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5" /> Favorite opening
            </Label>
            <Input
              id="pr-opening"
              value={favoriteOpening}
              maxLength={60}
              placeholder="e.g. Sicilian Najdorf"
              onChange={(e) => setFavoriteOpening(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pr-lichess">Lichess username</Label>
              <Input
                id="pr-lichess"
                value={lichessHandle}
                maxLength={30}
                placeholder="letters, numbers, _ and -"
                onChange={(e) => setLichessHandle(e.target.value)}
              />
              {lichessHandle.trim() && (
                <a
                  className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                  href={`https://lichess.org/@/${encodeURIComponent(lichessHandle.trim())}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on lichess.org <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-chesscom">Chess.com username</Label>
              <Input
                id="pr-chesscom"
                value={chesscomHandle}
                maxLength={30}
                placeholder="letters, numbers, _ and -"
                onChange={(e) => setChesscomHandle(e.target.value)}
              />
              {chesscomHandle.trim() && (
                <a
                  className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                  href={`https://www.chess.com/member/${encodeURIComponent(chesscomHandle.trim())}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on chess.com <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-website">Website</Label>
            <Input
              id="pr-website"
              type="url"
              value={websiteUrl}
              maxLength={200}
              placeholder="https://your-site.example"
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">A personal site, stream or club page — shown on your profile.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" /> Board &amp; experience
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Board theme</Label>
            <div className="grid grid-cols-4 gap-2">
              {BOARD_THEMES.map((t) => (
                <button
                  key={t.id}
                  aria-pressed={prefs.boardTheme === t.id}
                  aria-label={`Theme ${t.label}`}
                  onClick={() => setPrefs({ boardTheme: t.id })}
                  className={`overflow-hidden rounded-lg border-2 transition ${
                    prefs.boardTheme === t.id ? 'border-emerald-600' : 'border-transparent hover:border-muted-foreground/30'
                  }`}
                >
                  <span className="flex">
                    <span className="h-8 w-1/2" style={{ backgroundColor: t.light }} />
                    <span className="h-8 w-1/2" style={{ backgroundColor: t.dark }} />
                  </span>
                  <span className="block py-1 text-[11px] font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="pr-sound" className="inline-flex items-center gap-2 text-sm">
              <Volume2 className="h-4 w-4" /> Move sounds
            </Label>
            <Switch id="pr-sound" checked={prefs.sound} onCheckedChange={(v) => setPrefs({ sound: v })} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={saving} onClick={save}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save changes
        </Button>
        <Button variant="outline" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  )
}

/** Adds https:// when the user typed a bare domain ("example.com" → "https://example.com"). */
function httpsify(url: string): string | null {
  if (/^https?:\/\//i.test(url)) return url
  const withHttps = `https://${url}`
  return /^https:\/\/\S+\.\S+/.test(withHttps) ? withHttps : null
}

export function ProfileSaveIndicator() {
  return <Check className="h-4 w-4 text-emerald-600" />
}
