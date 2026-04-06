import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useSessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('fecha', { ascending: false })
      .order('hora', { ascending: true })
    if (!error) setSessions(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const createSession = async (data) => {
    // Check conflict
    const { data: conflict } = await supabase
      .from('sessions')
      .select('id, nombre')
      .eq('fecha', data.fecha)
      .eq('hora', data.hora)
      .neq('estatus', 'Cancelada')
      .maybeSingle()
    if (conflict) return { error: `Ese horario ya está reservado para ${conflict.nombre}` }

    const { data: row, error } = await supabase
      .from('sessions')
      .insert([{ ...data, created_at: new Date().toISOString() }])
      .select()
      .single()
    if (error) return { error: error.message }
    setSessions(prev => [row, ...prev])
    return { data: row }
  }

  const updateSession = async (id, updates) => {
    // Conflict check when fecha/hora changes
    if (updates.fecha || updates.hora) {
      const current = sessions.find(s => s.id === id)
      const checkFecha = updates.fecha || current?.fecha
      const checkHora = updates.hora || current?.hora
      const { data: conflict } = await supabase
        .from('sessions')
        .select('id, nombre')
        .eq('fecha', checkFecha)
        .eq('hora', checkHora)
        .neq('estatus', 'Cancelada')
        .neq('id', id)
        .maybeSingle()
      if (conflict) return { error: `Ese horario ya está reservado para ${conflict.nombre}` }
    }

    const { data: row, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return { error: error.message }
    setSessions(prev => prev.map(s => s.id === id ? row : s))
    return { data: row }
  }

  const deleteSession = async (id) => {
    await supabase.from('sessions').delete().eq('id', id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  return { sessions, loading, fetch, createSession, updateSession, deleteSession }
}
