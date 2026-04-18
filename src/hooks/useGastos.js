import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useGastos() {
  const [gastos, setGastos]                   = useState([])
  const [loading, setLoading]                 = useState(true)
  const [tableError, setTableError]           = useState(false)
  const [comisionSchemaReady, setComisionSchemaReady] = useState(false)

  const fetchGastos = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('gastos')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) { setTableError(true); setLoading(false); return }
    setGastos(data || [])
    setLoading(false)

    // Check if the commission columns exist
    const { error: schemaErr } = await supabase
      .from('gastos')
      .select('auto_comision, source_ref')
      .limit(1)
    setComisionSchemaReady(!schemaErr)
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

  const updateGasto = async (id, updates) => {
    const { data, error } = await supabase
      .from('gastos').update(updates).eq('id', id).select().single()
    if (error) return { error: error.message }
    setGastos(prev => prev.map(g => g.id === id ? data : g))
    return { data }
  }

  const deleteGasto = async (id) => {
    const { error } = await supabase.from('gastos').delete().eq('id', id)
    if (error) return { error: error.message }
    setGastos(prev => prev.filter(g => g.id !== id))
    return {}
  }

  // ── Comisión bancaria — métodos automáticos ──────────────────────────────

  /**
   * Crea un gasto de comisión vinculado a un pago o anticipo.
   * sourceRef: 'anticipo:{session_id}' | 'pago:{pago_id}'
   */
  const createComisionGasto = async (sourceRef, monto, concepto, fecha) => {
    if (!comisionSchemaReady) return { error: 'Schema no listo' }
    const roundedMonto = Math.round(monto * 100) / 100
    if (roundedMonto <= 0) return {}
    const { data, error } = await supabase
      .from('gastos')
      .insert([{
        concepto,
        monto: roundedMonto,
        fecha,
        categoria: 'Comisión bancaria',
        notas: 'Generado automáticamente por pago con tarjeta',
        auto_comision: true,
        source_ref: sourceRef,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single()
    if (error) return { error: error.message }
    setGastos(prev => [data, ...prev])
    return { data }
  }

  /**
   * Actualiza el monto del gasto de comisión vinculado a sourceRef.
   * Si newMonto <= 0, elimina el gasto.
   */
  const updateComisionByRef = async (sourceRef, newMonto) => {
    if (!comisionSchemaReady) return {}
    const { data: existing, error: findErr } = await supabase
      .from('gastos')
      .select('id')
      .eq('source_ref', sourceRef)
      .eq('auto_comision', true)
      .maybeSingle()
    if (findErr || !existing) return {}

    const rounded = Math.round(newMonto * 100) / 100
    if (rounded <= 0) return deleteComisionByRef(sourceRef)

    const { data, error } = await supabase
      .from('gastos')
      .update({ monto: rounded })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return { error: error.message }
    setGastos(prev => prev.map(g => g.id === existing.id ? data : g))
    return { data }
  }

  /**
   * Elimina el gasto de comisión vinculado a sourceRef.
   */
  const deleteComisionByRef = async (sourceRef) => {
    if (!comisionSchemaReady) return {}
    const { data: existing, error: findErr } = await supabase
      .from('gastos')
      .select('id')
      .eq('source_ref', sourceRef)
      .eq('auto_comision', true)
      .maybeSingle()
    if (findErr || !existing) return {}

    const { error } = await supabase.from('gastos').delete().eq('id', existing.id)
    if (error) return { error: error.message }
    setGastos(prev => prev.filter(g => g.id !== existing.id))
    return {}
  }

  return {
    gastos, loading, tableError, comisionSchemaReady,
    createGasto, updateGasto, deleteGasto, fetch: fetchGastos,
    createComisionGasto, updateComisionByRef, deleteComisionByRef,
  }
}
