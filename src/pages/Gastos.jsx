import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { todayStr } from '../lib/utils'
import { useToast } from '../hooks/useToast'
import { exportGastos } from '../lib/exportExcel'

const CATEGORIAS = ['Equipo', 'Renta', 'Servicios', 'Marketing', 'Sueldos', 'Comisión bancaria', 'Otros']

const CAT_COLORS = {
  Equipo:               'var(--violet)',
  Renta:                'var(--amber)',
  Servicios:            '#1A7A9E',
  Marketing:            '#9E6B1A',
  Sueldos:              'var(--green)',
  'Comisión bancaria':  'var(--red)',
  Otros:                'var(--text3)',
}

const QUICK_RANGES = [
  { label: 'Este mes',   key: 'mes' },
  { label: 'Mes pasado', key: 'mes-pasado' },
  { label: 'Este año',   key: 'anio' },
  { label: 'Todo',       key: '' },
]

function getRange(key) {
  const now = new Date()
  if (key === 'mes')       return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') }
  if (key === 'mes-pasado') {
    const prev = subMonths(now, 1)
    return { from: format(startOfMonth(prev), 'yyyy-MM-dd'), to: format(endOfMonth(prev), 'yyyy-MM-dd') }
  }
  if (key === 'anio')     return { from: format(startOfYear(now), 'yyyy-MM-dd'), to: format(endOfYear(now), 'yyyy-MM-dd') }
  return { from: '', to: '' }
}

export default function Gastos({ gastos = [], loading, tableError, createGasto, updateGasto, deleteGasto }) {
  const toast = useToast()

  // ── form ──
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ concepto: '', monto: '', fecha: todayStr(), categoria: 'Otros', notas: '' })
  const [saving, setSaving]       = useState(false)

  // ── edit ──
  const [editId, setEditId]       = useState(null)
  const [editForm, setEditForm]   = useState({})
  const [editSaving, setEditSaving] = useState(false)

  // ── filters ──
  const [catFilter, setCatFilter] = useState('')
  const [quickRange, setQuickRange] = useState('mes')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [showCustom, setShowCustom] = useState(false)

  // ── view ──
  const [view, setView] = useState('lista') // lista | categoria | mensual

  const { from: rangeFrom, to: rangeTo } = showCustom
    ? { from: customFrom, to: customTo }
    : getRange(quickRange)

  const filtered = useMemo(() => {
    let list = [...gastos]
    if (catFilter)  list = list.filter(g => g.categoria === catFilter)
    if (rangeFrom)  list = list.filter(g => g.fecha >= rangeFrom)
    if (rangeTo)    list = list.filter(g => g.fecha <= rangeTo)
    return list.sort((a, b) => b.fecha > a.fecha ? 1 : -1)
  }, [gastos, catFilter, rangeFrom, rangeTo])

  const total = filtered.reduce((a, g) => a + (+g.monto || 0), 0)

  // ── resumen por categoría ──
  const byCategoria = useMemo(() => {
    const map = {}
    filtered.forEach(g => {
      const k = g.categoria || 'Otros'
      if (!map[k]) map[k] = { count: 0, total: 0 }
      map[k].count++
      map[k].total += +g.monto || 0
    })
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total)
  }, [filtered])

  // ── resumen mensual ──
  const byMes = useMemo(() => {
    const map = {}
    filtered.forEach(g => {
      const k = g.fecha?.slice(0, 7) || '?'
      if (!map[k]) map[k] = { label: '', total: 0, count: 0 }
      try {
        map[k].label = format(new Date(k + '-01'), "MMMM yyyy", { locale: es })
      } catch { map[k].label = k }
      map[k].total += +g.monto || 0
      map[k].count++
    })
    return Object.entries(map).sort((a, b) => b[0] > a[0] ? 1 : -1)
  }, [filtered])

  // ── handlers ──
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.concepto.trim() || !form.monto) return
    setSaving(true)
    const { error } = await createGasto({ ...form, monto: +form.monto })
    setSaving(false)
    if (error) { toast(error, 'error'); return }
    toast('Gasto registrado', 'success')
    setForm({ concepto: '', monto: '', fecha: todayStr(), categoria: 'Otros', notas: '' })
    setShowForm(false)
  }

  const startEdit = (g) => {
    setEditId(g.id)
    setEditForm({ concepto: g.concepto, monto: String(g.monto), fecha: g.fecha, categoria: g.categoria || 'Otros', notas: g.notas || '' })
  }

  const handleEditSave = async (id) => {
    if (!editForm.concepto.trim() || !editForm.monto) return
    setEditSaving(true)
    const { error } = await updateGasto(id, { ...editForm, monto: +editForm.monto })
    setEditSaving(false)
    if (error) { toast(error, 'error'); return }
    toast('Gasto actualizado', 'success')
    setEditId(null)
  }

  const handleDelete = async (id, concepto) => {
    if (!confirm(`¿Eliminar "${concepto}"?`)) return
    const { error } = await deleteGasto(id)
    if (error) toast(error, 'error')
    else toast('Gasto eliminado')
  }

  // ── tabla requerida ──
  if (tableError) return (
    <>
      <div className="topbar"><div className="topbar-title">Gastos</div></div>
      <div className="page-content">
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            Crea la tabla en Supabase para habilitar este módulo
          </div>
          <pre className="sql-block">{`create table gastos (
  id uuid default gen_random_uuid() primary key,
  concepto text not null,
  monto numeric(10,2) not null,
  fecha date not null default current_date,
  categoria text default 'Otros',
  notas text,
  created_at timestamptz default now()
);`}</pre>
        </div>
      </div>
    </>
  )

  const maxCat = byCategoria.length > 0 ? byCategoria[0][1].total : 1

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Gastos</div>
        <div className="topbar-right">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => exportGastos(filtered)}
            title="Exportar a Excel"
            disabled={filtered.length === 0}
          >
            ↓ Excel
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancelar' : '+ Nuevo gasto'}
          </button>
        </div>
      </div>

      {/* ── Formulario nuevo gasto ── */}
      {showForm && (
        <div className="gasto-form-panel">
          <form onSubmit={handleSubmit}>
            <div className="gasto-form-grid">
              <div className="form-field">
                <label className="form-label">Concepto *</label>
                <input className="form-input" placeholder="Ej. Renta del mes" value={form.concepto}
                  onChange={e => setForm(p => ({ ...p, concepto: e.target.value }))} required />
              </div>
              <div className="form-field">
                <label className="form-label">Monto *</label>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} required />
              </div>
              <div className="form-field">
                <label className="form-label">Fecha</label>
                <input className="form-input" type="date" value={form.fecha}
                  onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} required />
              </div>
              <div className="form-field">
                <label className="form-label">Categoría</label>
                <select className="form-input" value={form.categoria}
                  onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-field">
              <label className="form-label">Notas (opcional)</label>
              <input className="form-input" placeholder="Detalles adicionales…" value={form.notas}
                onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar gasto'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="page-content">

        {/* ── Filtros de período ── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
          {QUICK_RANGES.map(r => (
            <button
              key={r.key}
              className={`pill ${!showCustom && quickRange === r.key ? 'active' : ''}`}
              onClick={() => { setQuickRange(r.key); setShowCustom(false) }}
            >
              {r.label}
            </button>
          ))}
          <button
            className={`pill ${showCustom ? 'active' : ''}`}
            onClick={() => setShowCustom(v => !v)}
          >
            Rango
          </button>
        </div>

        {showCustom && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <input className="form-input" type="date" style={{ width: 160 }}
              value={customFrom} onChange={e => setCustomFrom(e.target.value)} placeholder="Desde" />
            <span style={{ color: 'var(--text3)', fontSize: 13 }}>—</span>
            <input className="form-input" type="date" style={{ width: 160 }} min={customFrom}
              value={customTo} onChange={e => setCustomTo(e.target.value)} placeholder="Hasta" />
          </div>
        )}

        {/* ── Filtro por categoría ── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
          <button
            className={`pill ${!catFilter ? 'active' : ''}`}
            onClick={() => setCatFilter('')}
          >
            Todas
          </button>
          {CATEGORIAS.map(c => (
            <button
              key={c}
              className={`pill ${catFilter === c ? 'active' : ''}`}
              onClick={() => setCatFilter(cat => cat === c ? '' : c)}
            >
              {c}
            </button>
          ))}
        </div>

        {/* ── Hero total ── */}
        {filtered.length > 0 && (
          <div className="gastos-hero">
            <div className="gastos-hero-label">
              Total {catFilter ? `· ${catFilter}` : ''}{filtered.length !== gastos.length ? ` · ${filtered.length} gasto${filtered.length !== 1 ? 's' : ''}` : ''}
            </div>
            <div className="gastos-hero-total">${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
          </div>
        )}

        {/* ── Tabs de vista ── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
          {[
            { key: 'lista',      label: 'Lista' },
            { key: 'categoria',  label: 'Por categoría' },
            { key: 'mensual',    label: 'Por mes' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13,
                fontWeight: view === t.key ? 600 : 400,
                background: view === t.key ? 'var(--accent)' : 'var(--bg2)',
                color: view === t.key ? '#fff' : 'var(--text2)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
            Sin gastos en el período seleccionado
          </div>
        ) : view === 'lista' ? (
          /* ── Vista Lista ── */
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {filtered.map(g => (
              <div key={g.id} className="gasto-item">
                {editId === g.id ? (
                  <div style={{ flex: 1, padding: '12px 0' }}>
                    <div className="gasto-form-grid" style={{ marginBottom: 8 }}>
                      <div className="form-field">
                        <label className="form-label">Concepto</label>
                        <input className="form-input" value={editForm.concepto}
                          onChange={e => setEditForm(p => ({ ...p, concepto: e.target.value }))} />
                      </div>
                      <div className="form-field">
                        <label className="form-label">Monto</label>
                        <input className="form-input" type="number" min="0" step="0.01" value={editForm.monto}
                          onChange={e => setEditForm(p => ({ ...p, monto: e.target.value }))} />
                      </div>
                      <div className="form-field">
                        <label className="form-label">Fecha</label>
                        <input className="form-input" type="date" value={editForm.fecha}
                          onChange={e => setEditForm(p => ({ ...p, fecha: e.target.value }))} />
                      </div>
                      <div className="form-field">
                        <label className="form-label">Categoría</label>
                        <select className="form-input" value={editForm.categoria}
                          onChange={e => setEditForm(p => ({ ...p, categoria: e.target.value }))}>
                          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-field" style={{ marginBottom: 10 }}>
                      <label className="form-label">Notas</label>
                      <input className="form-input" value={editForm.notas}
                        onChange={e => setEditForm(p => ({ ...p, notas: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleEditSave(g.id)} disabled={editSaving}>
                        {editSaving ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="gasto-left">
                      <span className="gasto-cat" style={{ background: CAT_COLORS[g.categoria] ? `${CAT_COLORS[g.categoria]}22` : undefined, color: CAT_COLORS[g.categoria] }}>
                        {g.categoria}
                      </span>
                      <div className="gasto-concepto">{g.concepto}</div>
                      {g.notas && <div className="gasto-notas">{g.notas}</div>}
                      <div className="gasto-fecha">
                        {format(new Date(g.fecha + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es })}
                      </div>
                    </div>
                    <div className="gasto-right">
                      <div className="gasto-monto">${(+g.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
                      <button className="btn btn-ghost btn-xs" onClick={() => startEdit(g)} title="Editar"
                        style={{ color: 'var(--text3)', padding: '4px 6px' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z"/>
                        </svg>
                      </button>
                      <button className="btn btn-ghost btn-xs gasto-del"
                        onClick={() => handleDelete(g.id, g.concepto)} title="Eliminar">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 5h10M6 5V3.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V5M5 5l.5 8h5L11 5"/>
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : view === 'categoria' ? (
          /* ── Vista Por categoría ── */
          <div className="card" style={{ padding: '20px 24px' }}>
            {byCategoria.map(([cat, { count, total: catTotal }]) => (
              <div key={cat} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="gasto-cat" style={{
                      background: CAT_COLORS[cat] ? `${CAT_COLORS[cat]}22` : undefined,
                      color: CAT_COLORS[cat],
                    }}>
                      {cat}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>{count} gasto{count !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {total > 0 ? `${Math.round((catTotal / total) * 100)}%` : '0%'}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text1)' }}>
                      ${catTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div style={{ height: 6, borderRadius: 6, background: 'var(--bg3)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 6, transition: 'width .4s ease',
                    background: CAT_COLORS[cat] || 'var(--accent)',
                    width: `${Math.round((catTotal / maxCat) * 100)}%`,
                  }} />
                </div>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>
                ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ) : (
          /* ── Vista Por mes ── */
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {byMes.map(([mesKey, { label, total: mesTotal, count }]) => (
              <div key={mesKey} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px', borderBottom: '1px solid var(--border)',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text1)', textTransform: 'capitalize' }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{count} gasto{count !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>
                  ${mesTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', background: 'var(--bg2)' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Total período</span>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>
                ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
