export function SkeletonRows({ count = 4 }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skel-row">
          <span className="skel skel-avatar" />
          <div className="skel-block">
            <span className="skel skel-line" style={{ width: `${55 + ((i * 13) % 30)}%` }} />
            <span className="skel skel-line" style={{ width: `${30 + ((i * 7) % 25)}%`, height: 10 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ glyph = '◯', title, sub, action }) {
  return (
    <div className="empty-state-rich">
      <div className="es-glyph">{glyph}</div>
      <div className="es-title">{title}</div>
      {sub && <div className="es-sub">{sub}</div>}
      {action}
    </div>
  )
}
