import { useEffect, useState } from 'react'
import { usePersisted } from './store'

export type FocusSession = { startedAt: number; minutes: number; endedAt: number; completed: boolean }
type Active = { startedAt: number; minutes: number }

export const FOCUS_OPTIONS = [15, 25, 50]
const PAGE_TITLE = document.title

const isToday = (t: number, now: number) => new Date(t).toDateString() === new Date(now).toDateString()
const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function useFocus() {
  // Persisted so a reload doesn't lose the running session
  const [active, setActive] = usePersisted<Active | null>('fiapo:focus-active', null)
  const [history, setHistory] = usePersisted<FocusSession[]>('fiapo:focus-history', [])
  const [tick, setTick] = useState(Date.now)
  const [finished, setFinished] = useState<FocusSession | null>(null)

  const end = active ? active.startedAt + active.minutes * 60_000 : 0
  const remaining = active ? Math.max(0, end - tick) : 0
  const progress = active ? 1 - remaining / (active.minutes * 60_000) : 0
  const label = active ? clock(remaining) : ''

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      const t = Date.now()
      setTick(t)
      if (t < end) return
      const session = { ...active, endedAt: end, completed: true }
      setHistory(h => [...h, session])
      setActive(null)
      setFinished(session)
      window.dispatchEvent(new Event('fiapo:party'))
    }, 1000)
    return () => clearInterval(id)
  }, [active, end, setActive, setHistory])

  useEffect(() => {
    if (!finished) return
    const id = setTimeout(() => setFinished(null), 4000)
    return () => clearTimeout(id)
  }, [finished])

  // Countdown in the tab title, so it shows while you study in another tab
  useEffect(() => { document.title = label ? `${label} · Fiapo tecendo` : PAGE_TITLE }, [label])

  // The walking spider stays around the focus card while a session runs
  useEffect(() => {
    if (active) document.documentElement.dataset.fiapoFocus = '1'
    else delete document.documentElement.dataset.fiapoFocus
  }, [active])

  const start = (minutes: number) => {
    const t = Date.now()
    setTick(t)
    setActive({ startedAt: t, minutes })
  }

  const giveUp = () => {
    if (!active) return
    setHistory(h => [...h, { ...active, endedAt: Date.now(), completed: false }])
    setActive(null)
  }

  const today = history.filter(s => isToday(s.endedAt, tick))
  const minutesToday = today.filter(s => s.completed).reduce((sum, s) => sum + s.minutes, 0)
  const lastCompleted = Math.max(0, ...history.filter(s => s.completed).map(s => s.endedAt))

  return { active, progress, label, today, minutesToday, lastCompleted, finished, start, giveUp }
}
