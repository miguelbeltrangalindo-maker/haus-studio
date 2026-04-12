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

  const createExtra = async (session_id, concepto, monto) => {
    if (tableError) return { error: 'Tabla no disponible' }
    const { data, error } = await supabase
      .from('session_extras')
      .insert([{ session_id, concepto, monto }])
      .select()
      .single()
    if (error) return { error: error.message }
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
