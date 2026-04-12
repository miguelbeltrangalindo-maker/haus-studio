import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useGastos() {
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)

  const fetchGastos = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('gastos')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) setTableError(true)
    else setGastos(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchGastos() }, [])

  const createGasto = async (form) => {
    const { data, error } = await supabase
      .from('gastos')
      .insert([{ ...form, created_at: new Date().toISOString() }])
      .select()
      .single()
    if (error) return { error: error.message }
    setGastos(prev => [data, ...prev])
    return { data }
  }

  const deleteGasto = async (id) => {
    const { error } = await supabase.from('gastos').delete().eq('id', id)
    if (error) return { error: error.message }
    setGastos(prev => prev.filter(g => g.id !== id))
    return {}
  }

  return { gastos, loading, tableError, createGasto, deleteGasto, fetch: fetchGastos }
}
