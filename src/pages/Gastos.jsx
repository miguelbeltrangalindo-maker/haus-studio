import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { todayStr } from '../lib/utils'
import { useToast } from '../hooks/useToast'

const CATEGORIAS = ['Equipo', 'Renta', 'Servicios', 'Marketing', 'Sueldos', 'Otros']

export default function Gastos({ gastos = [], loading, tableError, createGasto, updateGasto, deleteGasto }) {
  const toast = useToast()
  const [form, setForm] = useState({ concepto: '', monto: '', fecha: todayStr(), categoria: 'Otros', notas: '' })
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)

  const total = gastos.reduce((a, g) => a + (+g.monto || 0), 0)

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

  if (tableError) return (
    <>
      <div className="topbar">
        <div className="topbar-title">Gastos</div>
      </div>
      <div className="page-content">
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Crea la tabla en Supabase para habilitar este módulo</div>
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

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Gastos</div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancelar' : '+ Nuevo gasto'}
          </button>
        </div>
      </div>

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
                <input className="form-input" type="number" min="0" step="1" placeholder="0"
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
        {gastos.length > 0 && (
          <div className="gastos-hero">
            <div className="gastos-hero-label">Total registrado</div>
            <div className="gastos-hero-total">${total.toLocaleString()}</div>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div className="loading">Cargando…</div>
          ) : gastos.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              Sin gastos registrados aún
            </div>
          ) : (
            gastos.map(g => (
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
                        <input className="form-input" type="number" min="0" value={editForm.monto}
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
                      <span className="gasto-cat">{g.categoria}</span>
                      <div className="gasto-concepto">{g.concepto}</div>
                      {g.notas && <div className="gasto-notas">{g.notas}</div>}
                      <div className="gasto-fecha">
                        {format(new Date(g.fecha + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es })}
                      </div>
                    </div>
                    <div className="gasto-right">
                      <div className="gasto-monto">${(+g.monto).toLocaleString()}</div>
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
            ))
          )}
        </div>
      </div>
    </>
  )
}
