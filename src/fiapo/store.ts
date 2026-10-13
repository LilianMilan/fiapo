import { useEffect, useState } from 'react'

export type Source = { id: string; url: string; title: string; subject: string; addedAt: number; lastSeenAt: number }
export type Mood = 'curioso' | 'animado' | 'tranquilo' | 'sonolento'

const KEY = 'fiapo:sources'
export const DAY = 86_400_000
export const FORGOTTEN_AFTER = 7 * DAY
const PALETTE = ['#b9e978', '#ac98f3', '#e6ae67', '#7eaee9', '#ef8fb5', '#6fd6c4']

export function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* sem armazenamento: vive só nesta aba */ }
  }, [key, value])

  return [value, setValue] as const
}

export function useSources() {
  const [sources, setSources] = usePersisted<Source[]>(KEY, [])

  const add = (input: Pick<Source, 'url' | 'title' | 'subject'>) => {
    const now = Date.now()
    const source = { ...input, id: crypto.randomUUID(), addedAt: now, lastSeenAt: now }
    setSources(list => [...list, source])
    return source
  }
  const addMany = (items: Source[]) => setSources(list => [...list, ...items])
  const remove = (id: string) => setSources(list => list.filter(s => s.id !== id))
  const markSeen = (id: string) => setSources(list => list.map(s => s.id === id ? { ...s, lastSeenAt: Date.now() } : s))

  return { sources, add, addMany, remove, markSeen }
}

// Each subject keeps the color of the order it first appeared in
export function subjectColors(sources: Source[]) {
  const colors = new Map<string, string>()
  for (const s of sources) if (!colors.has(s.subject)) colors.set(s.subject, PALETTE[colors.size % PALETTE.length])
  return colors
}

// Adding a source or finishing a focus session both count as studying
export function moodOf(sources: Source[], now: number, lastFocus = 0): Mood {
  if (!sources.length && !lastFocus) return 'curioso'
  const last = Math.max(lastFocus, ...sources.map(s => s.addedAt))
  if (new Date(last).toDateString() === new Date(now).toDateString()) return 'animado'
  return now - last <= 2 * DAY ? 'tranquilo' : 'sonolento'
}

export const isForgotten = (s: Source, now: number) => now - s.lastSeenAt > FORGOTTEN_AFTER

// Asks the walking spider (PageCrawler) to run to a source card
export const sendFiapoTo = (id: string) => window.dispatchEvent(new CustomEvent('fiapo:visit', { detail: id }))

export function sampleSources(now: number): Source[] {
  const at = (days: number) => now - days * DAY
  return [
    { id: crypto.randomUUID(), url: 'https://www.nature.com/', title: 'Comportamentos emergentes em enxames de robôs', subject: 'Robótica', addedAt: at(12), lastSeenAt: at(10) },
    { id: crypto.randomUUID(), url: 'https://www.science.org/', title: 'Inteligência coletiva em sistemas auto-organizados', subject: 'Biologia', addedAt: at(9), lastSeenAt: at(8) },
    { id: crypto.randomUUID(), url: 'https://arxiv.org/', title: 'Guia de campo de algoritmos bioinspirados', subject: 'Robótica', addedAt: at(5), lastSeenAt: at(2) },
    { id: crypto.randomUUID(), url: 'https://ieeexplore.ieee.org/', title: 'Aprendendo a coordenar sem comunicação', subject: 'Computação', addedAt: at(3), lastSeenAt: at(3) },
  ]
}
