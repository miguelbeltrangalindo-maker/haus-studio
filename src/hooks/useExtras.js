import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useExtras() {
  const [extras, setExtras]         = useState([])
  const [tableError, setTableError] = useState(false)

  const fetch = async () => {
    const { data, error } = await supabase
      .from('session_extras')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) {
      if (error.code === '42P01') setTableError(true)
      return
    }
    setExtras(data || [])
  }

  useEffect(() => { fetch() }, [])

  const createExtra = async (session_id, concepto, monto, cantidad = 1, precio_unitario = null) => {
    if (tableError) return { error: 'Tabla no disponible' }
    const payload = { session_id, concepto, monto, cantidad }
    if (precio_unitario != null) payload.precio_unitario = precio_unitario
    const { data, error } = await supabase
      .from('session_extras')
      .insert([payload])
      .select()
      .single()
    if (error) {
      // Retry without new columns if schema not updated yet
      if (error.message.includes('column') || error.message.includes('schema cache')) {
        const { data: d2, error: e2 } = await supabase
          .from('session_extras')
          .insert([{ session_id, concepto, monto }])
          .select()
          .single()
        if (e2) return { error: e2.message }
        setExtras(prev => [...prev, d2])
        return { data: d2 }
      }
      return { error: error.message }
    }
    setExtras(prev => [...prev, data])
    return { data }
  }

  const deleteExtra = async (id) => {
    if (tableError) return { error: 'Tabla no disponible' }
    const { error } = await supabase.from('session_extras').delete().eq('id', id)
    if (error) return { error: error.message }
    setExtras(prev => prev.filter(e => e.id !== id))
    return {}
  }

  return { extras, tableError, createExtra, deleteExtra, fetch }
}
