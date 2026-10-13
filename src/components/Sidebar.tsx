import { Focus } from 'lucide-react'

type Subject = { name: string; color: string; count: number }

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><span /><span /><span /><span /><i /></div>
}

export function Sidebar({ subjects }: { subjects: Subject[] }) {
  return <aside className="sidebar">
    <div className="brand"><BrandMark /><span>fiapo</span><span className="beta">BETA</span></div>
    <div className="side-label">ESTUDO</div>
    <button className="nav-item active"><Focus size={16} />Minha teia</button>
    <div className="side-label collections-label">MATÉRIAS</div>
    {subjects.length
      ? subjects.map(s => <div className="collection" key={s.name}><i className="dot" style={{ background: s.color }} />{s.name} <small>{s.count}</small></div>)
      : <p className="side-empty">As matérias aparecem aqui quando você adiciona fontes.</p>}
  </aside>
}
