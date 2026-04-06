import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ConfigCtx = createContext(null)

const DEFAULT_CONFIG = {
  studio_name: 'HAUS',
  open_time: '09:00',
  close_time: '20:00',
  block_minutes: 30,
  session_minutes: 20,
  stats_start: '',
  stats_end: '',
  reminder_message: 'Hola, {nombre}. Te damos la bienvenida a HAUS. Te recordamos que tu sesión está agendada para el día {fecha} a las {hora}. Te pedimos presentarte 10 minutos antes de tu horario. La duración de tu sesión es de 20 minutos y cada espacio se agenda cada media hora para poder atender cualquier contratiempo de forma puntual. ¡Te esperamos!',
  delivery_message: 'Hola, {nombre}. Muchas gracias por visitar HAUS. Tus fotos ya están listas. Te compartimos el vínculo de entrega: {link} Gracias por confiar en nosotros.',
}

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.from('config').select('*').eq('id', 1).single()
      .then(({ data }) => {
        if (data) setConfig({ ...DEFAULT_CONFIG, ...data })
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const updateConfig = async (updates) => {
    const next = { ...config, ...updates }
    setConfig(next)
    await supabase.from('config').upsert({ id: 1, ...next })
    return next
  }

  return (
    <ConfigCtx.Provider value={{ config, updateConfig, loaded }}>
      {children}
    </ConfigCtx.Provider>
  )
}

export const useConfig = () => useContext(ConfigCtx)
