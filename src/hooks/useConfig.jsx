import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ConfigCtx = createContext(null)

const DEFAULT_CONFIG = {
  studio_name: 'HAUS',
  open_time: '09:00',
  close_time: '20:00',
  block_minutes: 30,
  session_minutes: 20,
  extra_conceptos: [],
  closed_weekdays: [],
  blocked_dates: [],
  reminder_message: 'Hola, {nombre}. Te damos la bienvenida a HAUS. Te recordamos que tu sesión está agendada para el día {fecha} a las {hora}. Te pedimos presentarte 10 minutos antes de tu horario. La duración de tu sesión es de 20 minutos y cada espacio se agenda cada media hora para poder atender cualquier contratiempo de forma puntual. ¡Te esperamos!',
  delivery_message: 'Hola, {nombre}. Muchas gracias por visitar HAUS. Tus fotos ya están listas. Te compartimos el vínculo de entrega: {link} Gracias por confiar en nosotros.',
  wa_settings:       {
    on_booking: false, reminder_enabled: false, reminder_days: 1,
    cobranza_message: 'Hola, {nombre}. Te saludamos de HAUS. Tienes un saldo pendiente de {saldo} correspondiente a tu sesión del {fecha}. Puedes liquidarlo en efectivo, transferencia o tarjeta. ¡Gracias!',
  },
  payment_settings:  { comision_tarjeta: 0 },
  stats_settings:    { stats_start: '', stats_end: '' },
}

export function ConfigProvider({ children }) {
  const [config, setConfig]                   = useState(DEFAULT_CONFIG)
  const [loaded, setLoaded]                   = useState(false)
  const [statsSchemaReady, setStatsSchemaReady] = useState(false)

  useEffect(() => {
    supabase.from('config').select('*').eq('id', 1).single()
      .then(({ data }) => {
        if (data) {
          setStatsSchemaReady('stats_settings' in data)
          setConfig({
            ...DEFAULT_CONFIG,
            ...data,
            wa_settings:      { ...DEFAULT_CONFIG.wa_settings,      ...(data.wa_settings      || {}) },
            payment_settings: { ...DEFAULT_CONFIG.payment_settings, ...(data.payment_settings || {}) },
            stats_settings:   { ...DEFAULT_CONFIG.stats_settings,   ...(data.stats_settings   || {}) },
          })
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const updateConfig = async (updates) => {
    const next = { ...config, ...updates }
    setConfig(next)

    // Un solo upsert atómico con todo el estado
    const { error } = await supabase.from('config').upsert({ id: 1, ...next })
    if (!error) return next

    // Fallback para esquemas sin columnas nuevas: guardar campo por campo
    if (error.message.includes('schema cache') || error.message.includes('column') || error.message.includes('does not exist')) {
      const jsonFields = ['extra_conceptos', 'closed_weekdays', 'blocked_dates', 'wa_settings', 'payment_settings', 'stats_settings']
      for (const field of jsonFields) {
        if (updates[field] !== undefined) {
          await supabase.from('config').update({ [field]: updates[field] }).eq('id', 1)
        }
      }
      const { extra_conceptos, closed_weekdays, blocked_dates, wa_settings, payment_settings, stats_settings, session_minutes, ...safe } = next
      await supabase.from('config').upsert({ id: 1, ...safe })
    }
    return next
  }

  return (
    <ConfigCtx.Provider value={{ config, updateConfig, loaded, statsSchemaReady }}>
      {children}
    </ConfigCtx.Provider>
  )
}

export const useConfig = () => useContext(ConfigCtx)
