import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function usePagos() {
  const [pagos, setPagos]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [tableError, setTableError] = useState(false)

  const fetch = async () => {
    const { data, error } = await supabase
      .from('session_pagos')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) {
      if (error.code === '42P01') setTableError(true)
      setLoading(false)
      return
    }
    setPagos(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const createPago = async (session_id, monto, metodo, nota = '') => {
    if (tableError) return { error: 'Tabla no disponible' }
    const { data, error } = await supabase
      .from('session_pagos')
      .insert([{ session_id, monto, metodo, nota }])
      .select()
      .single()
    if (error) return { error: error.message }
    setPagos(prev => [...prev, data])
    return { data }
  }

  const updatePago = async (id, updates) => {
    if (tableError) return { error: 'Tabla no disponible' }
    const { data, error } = await supabase
      .from('session_pagos')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return { error: error.message }
    setPagos(prev => prev.map(p => p.id === id ? data : p))
    return { data }
  }

  const deletePago = async (id) => {
    if (tableError) return { error: 'Tabla no disponible' }
    const { error } = await supabase.from('session_pagos').delete().eq('id', id)
    if (error) return { error: error.message }
    setPagos(prev => prev.filter(p => p.id !== id))
    return {}
  }

  return { pagos, loading, tableError, createPago, updatePago, deletePago, fetch }
}
