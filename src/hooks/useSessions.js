import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useSessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  // updateSession se llama desde closures viejas (toasts "Deshacer"): leer siempre el estado actual
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions

  const fetch = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('fecha', { ascending: false })
      .order('hora', { ascending: true })
    if (error) {
      setLoadError(true)
    } else {
      setSessions(data || [])
      setLoadError(false)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  // Columns added after initial deploy — require ALTER TABLE in Supabase.
  // If the DB doesn't have them yet, we strip & retry so the app doesn't crash.
  // pagos = running total of balance payments collected (not counting anticipo)
  const OPTIONAL_COLS = ['metodo_pago', 'pagos', 'metodo_anticipo', 'descuento', 'ninos', 'apartado']
  const stripOptional = (obj) => {
    const out = { ...obj }
    OPTIONAL_COLS.forEach(c => delete out[c])
    return out
  }
  const isSchemaError = (msg = '') =>
    msg.includes('schema cache') || msg.includes('column') || msg.includes('does not exist')
  // fecha/hora aún NOT NULL en la base: falta correr alter_sessions_apartados_sin_fecha.sql
  const friendlyError = (msg = '') =>
    msg.includes('null value') && (msg.includes('"fecha"') || msg.includes('"hora"'))
      ? 'Para guardar apartados sin fecha falta correr la migración alter_sessions_apartados_sin_fecha.sql en Supabase'
      : msg

  // Choque de horario: otra sesión activa ese día cuya hora cae dentro del mismo bloque
  // (no solo la misma hora exacta). Se trae la lista del día en vez de maybeSingle, que
  // devolvía error —y por tanto "sin conflicto"— cuando ya había dos sesiones en el slot.
  const INACTIVAS = ['Cancelada', 'No show']
  const toMin = (h) => { const [hh, mm] = String(h).split(':').map(Number); return hh * 60 + (mm || 0) }
  const findConflict = async (fecha, hora, excludeId = null) => {
    const { data: block } = await supabase.from('config').select('block_minutes').eq('id', 1).maybeSingle()
    const blockMin = +block?.block_minutes || 30
    let q = supabase.from('sessions').select('id, nombre, hora, estatus').eq('fecha', fecha)
    if (excludeId) q = q.neq('id', excludeId)
    const { data: delDia, error } = await q
    if (error) return { error: 'No se pudo verificar la disponibilidad — revisa tu conexión' }
    const m = toMin(hora)
    const choque = (delDia || []).find(s =>
      s.hora && !INACTIVAS.includes(s.estatus) && Math.abs(toMin(s.hora) - m) < blockMin)
    return choque ? { error: `Ese horario ya está reservado para ${choque.nombre} (${choque.hora.slice(0, 5)})` } : {}
  }

  const createSession = async (data) => {
    // Un apartado sin fecha no ocupa horario
    if (data.fecha && data.hora && !INACTIVAS.includes(data.estatus)) {
      const c = await findConflict(data.fecha, data.hora)
      if (c.error) return c
    }

    let payload = { ...data, created_at: new Date().toISOString() }
    let { data: row, error } = await supabase.from('sessions').insert([payload]).select().single()
    if (error && isSchemaError(error.message)) {
      ;({ data: row, error } = await supabase.from('sessions').insert([stripOptional(payload)]).select().single())
    }
    if (error) return { error: friendlyError(error.message) }
    setSessions(prev => [row, ...prev])
    return { data: row }
  }

  const updateSession = async (id, updates) => {
    // Revisar choque si cambia fecha/hora o si una sesión cancelada se reactiva
    const current = sessionsRef.current.find(s => s.id === id)
    const nextEstatus = updates.estatus ?? current?.estatus
    const reactivada = updates.estatus && INACTIVAS.includes(current?.estatus) && !INACTIVAS.includes(updates.estatus)
    if ((updates.fecha || updates.hora || reactivada) && !INACTIVAS.includes(nextEstatus)) {
      const checkFecha = 'fecha' in updates ? updates.fecha : current?.fecha
      const checkHora  = 'hora'  in updates ? updates.hora  : current?.hora
      if (checkFecha && checkHora) {
        const c = await findConflict(checkFecha, checkHora, id)
        if (c.error) return c
      }
    }

    let { data: row, error } = await supabase.from('sessions').update(updates).eq('id', id).select().single()
    if (error && isSchemaError(error.message)) {
      ;({ data: row, error } = await supabase.from('sessions').update(stripOptional(updates)).eq('id', id).select().single())
    }
    if (error) return { error: friendlyError(error.message) }
    setSessions(prev => prev.map(s => s.id === id ? row : s))
    return { data: row }
  }

  const deleteSession = async (id) => {
    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (error) return { error: error.message }
    setSessions(prev => prev.filter(s => s.id !== id))
    return {}
  }

  return { sessions, loading, loadError, fetch, createSession, updateSession, deleteSession }
}
