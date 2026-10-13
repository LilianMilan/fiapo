import { useEffect, useState } from 'react'
import { usePersisted, type Source } from './store'

type Stats = { sources: number; streak: number }
export type Accessory = { id: string; name: string; icon: string; hint: string; goal: number; progress: (s: Stats) => number }

export const ACCESSORIES: Accessory[] = [
  { id: 'lacinho', name: 'Lacinho', icon: '🎀', hint: 'Dê a primeira fonte pro Fiapo', goal: 1, progress: s => s.sources },
  { id: 'oculos', name: 'Óculos de leitura', icon: '👓', hint: 'Junte 10 fontes na teia', goal: 10, progress: s => s.sources },
  { id: 'cachecol', name: 'Cachecol', icon: '🧣', hint: 'Estude 5 dias seguidos', goal: 5, progress: s => s.streak },
]

// Days in a row with at least one new source, counting back from today (or yesterday)
export function streak(sources: Source[], now: number) {
  const days = new Set(sources.map(s => new Date(s.addedAt).toDateString()))
  const d = new Date(now)
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1)
  let count = 0
  while (days.has(d.toDateString())) { count++; d.setDate(d.getDate() - 1) }
  return count
}

// Makes the walking spider spin around in celebration
const party = () => window.dispatchEvent(new Event('fiapo:party'))

export function useWardrobe(sources: Source[], now: number) {
  const [equipped, setEquipped] = usePersisted<string[]>('fiapo:equipped', [])
  const [celebrated, setCelebrated] = usePersisted<string[]>('fiapo:celebrated', [])
  const [testMode, setTestMode] = useState(false)
  const [testToast, setTestToast] = useState(false)

  const stats = { sources: sources.length, streak: streak(sources, now) }
  const earned = ACCESSORIES.filter(a => a.progress(stats) >= a.goal).map(a => a.id)
  const unlocked = testMode ? ACCESSORIES.map(a => a.id) : earned
  const freshIds = earned.filter(id => !celebrated.includes(id))
  const fresh = freshIds.join()
  const worn = [...new Set([...equipped, ...freshIds])].filter(id => unlocked.includes(id))
  const toast = testToast ? ACCESSORIES : ACCESSORIES.filter(a => freshIds.includes(a.id))

  // Real unlocks: party now, show the toast, then keep the accessory on for good
  useEffect(() => {
    if (!fresh) return
    party()
    const ids = fresh.split(',')
    const id = setTimeout(() => {
      setCelebrated(c => [...c, ...ids])
      setEquipped(e => [...new Set([...e, ...ids])])
    }, 3500)
    return () => clearTimeout(id)
  }, [fresh, setCelebrated, setEquipped])

  useEffect(() => {
    if (!testToast) return
    const id = setTimeout(() => setTestToast(false), 3500)
    return () => clearTimeout(id)
  }, [testToast])

  const wornKey = worn.join(' ')
  useEffect(() => { document.documentElement.dataset.fiapoWear = wornKey }, [wornKey])

  const toggle = (id: string) => setEquipped(e => e.includes(id) ? e.filter(x => x !== id) : [...e, id])

  // Test mode unlocks everything for this tab only, without spending the real celebrations
  const toggleTestMode = () => {
    if (!testMode) {
      setEquipped(ACCESSORIES.map(a => a.id))
      setTestToast(true)
      party()
    }
    setTestMode(t => !t)
  }

  return { stats, unlocked, worn, toast, testMode, toggle, toggleTestMode }
}
