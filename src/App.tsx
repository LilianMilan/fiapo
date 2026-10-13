import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Activity, Globe2, Hourglass, Plus, Sparkles, X } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { PageCrawler } from './components/PageCrawler'
import { DAY, isForgotten, moodOf, sampleSources, sendFiapoTo, subjectColors, useSources, type Mood, type Source } from './fiapo/store'
import { ACCESSORIES, useWardrobe } from './fiapo/wardrobe'
import { FOCUS_OPTIONS, useFocus } from './fiapo/focus'
import './App.css'

const MOOD_LINES: Record<Mood, string> = {
  curioso: 'O Fiapo está esperando a primeira fonte.',
  animado: 'O Fiapo está animado: você estudou hoje!',
  tranquilo: 'O Fiapo está tranquilo, tecendo devagar.',
  sonolento: 'O Fiapo está com soninho… faz dias que ninguém traz uma fonte nova.',
}

const hostname = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

const daysAgo = (t: number, now: number) => {
  const days = Math.floor((now - t) / DAY)
  return days === 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`
}

// First ring holds 6 sources, the rest go to an outer ring
function webPosition(i: number, n: number) {
  const outer = i >= 6
  const count = outer ? n - 6 : Math.min(n, 6)
  const k = outer ? i - 6 : i
  const angle = -Math.PI / 2 + (k / count) * Math.PI * 2 + (outer ? Math.PI / count : 0)
  const r = outer ? 44 : 31
  return { x: 50 + Math.cos(angle) * r, y: 50 + Math.sin(angle) * r }
}

type WebProps = { sources: Source[]; colors: Map<string, string>; mood: Mood; now: number; onOpen: (id: string) => void; onRemove: (id: string) => void; onSample: () => void }

function StudyWeb({ sources, colors, mood, now, onOpen, onRemove, onSample }: WebProps) {
  const placed = sources.map((s, i) => ({ s, ...webPosition(i, sources.length) }))
  const threads = placed.flatMap((p, i) => {
    const next = placed.slice(i + 1).find(q => q.s.subject === p.s.subject)
    return next ? [{ from: p, to: next, color: colors.get(p.s.subject) }] : []
  })

  return <div className={`spider-stage${sources.length > 6 ? ' crowded' : ''}`}>
    <div className="stage-label"><span className="live-dot" />SUA TEIA</div>
    <svg className="web-lines" aria-hidden="true">
      <ellipse className="web-ring" cx="50%" cy="50%" rx="31%" ry="31%" />
      {sources.length > 6 && <ellipse className="web-ring inner" cx="50%" cy="50%" rx="44%" ry="44%" />}
      {placed.map(p => <line key={p.s.id} x1="50%" y1="50%" x2={`${p.x}%`} y2={`${p.y}%`} />)}
      {threads.map(t => <line key={t.from.s.id + t.to.s.id} className="subject-thread" style={{ stroke: t.color }} x1={`${t.from.x}%`} y1={`${t.from.y}%`} x2={`${t.to.x}%`} y2={`${t.to.y}%`} />)}
    </svg>
    {placed.map(({ s, x, y }) => {
      const forgotten = isForgotten(s, now)
      const color = colors.get(s.subject)
      return <article className="article-node source-node" key={s.id} data-source-id={s.id} data-forgotten={forgotten || undefined}
        style={{ left: `${x}%`, top: `${y}%`, '--node-color': color, '--touch-color': color, '--touch-alt': color } as CSSProperties}>
        <div className="node-top"><span><i />{s.subject.toUpperCase()}</span><button className="node-remove" aria-label={`Remover ${s.title}`} onClick={() => onRemove(s.id)}><X size={11} /></button></div>
        <h3><a href={s.url} target="_blank" rel="noreferrer" onClick={() => onOpen(s.id)}>{s.title}</a></h3>
        <div className="node-source">{hostname(s.url).toUpperCase()}</div>
        <div className="node-author">{forgotten ? `você não abre ${daysAgo(s.lastSeenAt, now)}` : `adicionada ${daysAgo(s.addedAt, now)}`}</div>
      </article>
    })}
    <div className={`spider-wrap ${mood}`}><div className="spider-halo" /><svg className="spider" viewBox="0 0 120 120" aria-hidden="true">
      <g className="legs" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M49 48 35 33 20 35 12 26M45 55 27 48 15 55 7 51M44 64 27 68 19 79 10 80M49 72 37 87 25 91 20 101M71 48 85 33 100 35 108 26M75 55 93 48 105 55 113 51M76 64 93 68 101 79 110 80M71 72 83 87 95 91 100 101" /></g>
      <ellipse cx="60" cy="63" rx="21" ry="25" fill="currentColor" opacity=".2" /><path d="M60 38c-12 0-19 11-19 25s7 25 19 25 19-11 19-25-7-25-19-25Z" fill="currentColor" /><circle cx="53" cy="57" r="3" fill="#d7fff0"/><circle cx="67" cy="57" r="3" fill="#d7fff0"/><path d="m53 73 7 4 7-4" fill="none" stroke="#d7fff0" strokeWidth="2" strokeLinecap="round"/>
    </svg><div className="spider-caption"><span>FIAPO</span><i>{mood.toUpperCase()}</i></div></div>
    {!sources.length && <div className="empty-web"><p>A teia ainda está vazia. Cole um link lá em cima pra dar a primeira fonte pro Fiapo.</p><button onClick={onSample}>Ver com exemplos</button></div>}
    {colors.size > 0 && <div className="graph-legend">{[...colors].map(([subject, color]) => <span key={subject}><i style={{ background: color }} />{subject}</span>)}</div>}
  </div>
}

function App() {
  const { sources, add, addMany, remove, markSeen } = useSources()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [justAdded, setJustAdded] = useState<string | null>(null)

  const [now, setNow] = useState(Date.now)
  const focus = useFocus()
  const mood = moodOf(sources, now, focus.lastCompleted)
  const colors = subjectColors(sources)
  const wardrobe = useWardrobe(sources, now)
  const forgotten = sources.filter(s => isForgotten(s, now)).sort((a, b) => a.lastSeenAt - b.lastSeenAt)
  const threadCount = sources.length + sources.filter((s, i) => sources.slice(i + 1).some(o => o.subject === s.subject)).length

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => { document.documentElement.dataset.fiapoMood = mood }, [mood])
  useEffect(() => { if (justAdded) sendFiapoTo(justAdded) }, [justAdded])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const source = add({ url: url.trim(), title: title.trim() || hostname(url.trim()), subject: subject.trim() || 'Geral' })
    setJustAdded(source.id)
    setNow(Date.now())
    setUrl('')
    setTitle('')
  }

  return <div className="app-shell"><PageCrawler /><Sidebar subjects={[...colors].map(([name, color]) => ({ name, color, count: sources.filter(s => s.subject === name).length }))} /><main className="main-content">
    <header className="topbar"><div className="breadcrumbs">Fiapo <span>/</span> <b>Minha teia</b></div></header>
    <section className="intro"><div className="eyebrow"><Sparkles size={13} /> SEU COMPANHEIRO DE ESTUDO</div><h1>Siga os <em>fios.</em></h1><p>{MOOD_LINES[mood]}</p>
      <form className="add-form" onSubmit={submit}>
        <input type="url" required placeholder="Cole o link do que você está estudando" value={url} onChange={e => setUrl(e.target.value)} />
        <input placeholder="Título (opcional)" value={title} onChange={e => setTitle(e.target.value)} />
        <input placeholder="Matéria" list="fiapo-subjects" value={subject} onChange={e => setSubject(e.target.value)} />
        <datalist id="fiapo-subjects">{[...colors.keys()].map(s => <option key={s} value={s} />)}</datalist>
        <button><Plus size={13} />Dar pro Fiapo</button>
      </form>
    </section>
    <section className={`focus-card${focus.active ? ' running' : ''}`} data-fiapo-focus>
      <div className="focus-head">
        <div><span className="section-kicker">SESSÃO DE FOCO</span>
          <h2>{focus.active ? `Tecendo ${focus.active.minutes} minutos de foco` : 'Estude e o Fiapo tece um fio'}</h2>
          <p>{focus.active ? 'Se desistir agora, o fio fica pela metade.' : 'Termine a sessão pra ganhar um fio completo.'}</p>
        </div>
        {focus.active
          ? <div className="focus-controls"><h3 className="focus-clock">{focus.label}</h3><button className="focus-quit" onClick={focus.giveUp}>Desistir</button></div>
          : <div className="focus-controls">{FOCUS_OPTIONS.map(m => <button key={m} className="focus-start" onClick={() => focus.start(m)}>{m} min</button>)}</div>}
      </div>
      {focus.active && <svg className="focus-thread" viewBox="0 0 600 24" preserveAspectRatio="none" aria-hidden="true">
        <path className="focus-thread-base" d="M0 12 Q 75 2 150 12 T 300 12 T 450 12 T 600 12" pathLength={1} />
        <path className="focus-thread-done" d="M0 12 Q 75 2 150 12 T 300 12 T 450 12 T 600 12" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - focus.progress} />
      </svg>}
      {focus.today.length > 0 && <div className="focus-today">
        <span>Hoje: {focus.minutesToday} min de foco</span>
        <span className="focus-threads">{focus.today.map(s => <i key={s.startedAt} className={s.completed ? 'done' : 'broken'} title={s.completed ? `${s.minutes} min completos` : 'Fio pela metade'} />)}</span>
      </div>}
    </section>
    <section className="network-section"><div className="network-heading"><div><span className="section-kicker">O QUE VOCÊ JÁ ESTUDOU</span><h2>A forma do seu aprendizado</h2></div></div>
      <StudyWeb sources={sources} colors={colors} mood={mood} now={now} onOpen={markSeen} onRemove={remove} onSample={() => addMany(sampleSources(now))} />
      <div className="network-footer">
        <div className="foot-stat"><span className="stat-orb"><Globe2 size={15} /></span><span><b>{sources.length} {sources.length === 1 ? 'fonte' : 'fontes'}</b><small>na sua teia</small></span></div>
        <div className="foot-stat"><span className="stat-orb purple-orb"><Activity size={15} /></span><span><b>{threadCount} fios</b><small>tecidos até agora</small></span></div>
        <div className="foot-stat"><span className="stat-orb amber-orb"><Hourglass size={15} /></span><span><b>{forgotten.length} esquecidas</b><small>sem abrir há 7+ dias</small></span></div>
        <button className="continue-button" disabled={!forgotten.length} onClick={() => sendFiapoTo(forgotten[0].id)}>Fiapo, me lembra de algo</button>
      </div>
    </section>
    <section className="wardrobe">
      <div className="network-heading"><div><span className="section-kicker">CONQUISTAS</span><h2>Gaveta do Fiapo</h2></div>
        {import.meta.env.DEV && <button className="view-button" onClick={wardrobe.toggleTestMode}>{wardrobe.testMode ? 'Sair do modo teste' : 'Liberar tudo (modo teste)'}</button>}
      </div>
      <div className="wardrobe-items">{ACCESSORIES.map(a => {
        const open = wardrobe.unlocked.includes(a.id)
        const wearing = wardrobe.worn.includes(a.id)
        return <div className={`wardrobe-item${open ? '' : ' locked'}`} key={a.id}>
          <span className="wardrobe-icon" aria-hidden="true">{open ? a.icon : '🔒'}</span>
          <span><b>{a.name}</b><small>{open ? (wearing ? 'Ele está usando' : 'Guardado na gaveta') : `${a.hint} · ${Math.min(a.progress(wardrobe.stats), a.goal)}/${a.goal}`}</small></span>
          {open && <button className={wearing ? 'wearing' : ''} onClick={() => wardrobe.toggle(a.id)}>{wearing ? 'Tirar' : 'Vestir'}</button>}
        </div>
      })}</div>
    </section>
    {wardrobe.toast.length > 0 && <div className="unlock-toast" role="status">{wardrobe.toast.map(a => a.icon).join(' ')} O Fiapo ganhou {wardrobe.toast.map(a => a.name.toLowerCase()).join(', ')}!</div>}
    {focus.finished && <div className="unlock-toast" role="status">🧵 Fio completo! {focus.finished.minutes} minutos de foco.</div>}
    <footer className="bottom-note"><span>Feito pra quem nunca para de perguntar.</span><span>Sua teia fica salva só neste navegador.</span></footer>
  </main></div>
}

export default App
