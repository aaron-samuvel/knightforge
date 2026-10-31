'use client'

import { useState } from 'react'
import { Check, Flag, Loader2, LogOut, Palette, Save, User, Volume2 } from 'lucide-react'
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

export function ProfileView() {
  const user = useApp((s) => s.user)
  const prefs = useApp((s) => s.prefs)
  const setPrefs = useApp((s) => s.setPrefs)
  const { updateProfile, logout } = useAuth()
  const { toast } = useToast()

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor ?? '#10b981')
  const [country, setCountry] = useState(user?.country ?? '')
  const [birthYear, setBirthYear] = useState(user?.birthYear ? String(user.birthYear) : '')
  const [saving, setSaving] = useState(false)

  if (!user) return null

  const save = async () => {
    setSaving(true)
    const res = await updateProfile({
      displayName,
      bio,
      avatarColor,
      country: country || null,
      birthYear: birthYear ? Number(birthYear) : null,
      preferences: JSON.stringify(prefs),
    })
    setSaving(false)
    if (res.ok) toast({ title: 'Profile saved' })
    else toast({ title: res.error ?? 'Save failed', variant: 'destructive' })
  }

  const totalGames = user.wins + user.losses + user.draws

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-4">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white"
          style={{ backgroundColor: avatarColor }}
          aria-hidden
        >
          {(displayName || user.name).slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <User className="h-6 w-6 text-emerald-600" /> {user.displayName || user.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            @{user.name} · rating {user.rating} · {totalGames} games · {user.puzzleSolved} puzzles
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Profile details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <span className="font-mono text-sm text-muted-foreground">{avatarColor}</span>
            </div>
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

export function ProfileSaveIndicator() {
  return <Check className="h-4 w-4 text-emerald-600" />
}
