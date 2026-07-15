import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { session_id } = req.body || {}
  if (!session_id) return res.status(400).json({ error: 'session_id required' })

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, nombre, telefono, fecha, hora, estatus, reminder_sent')
    .eq('id', session_id)
    .single()

  if (error || !session) return res.status(404).json({ error: 'Session not found' })
  if (!session.telefono)  return res.status(200).json({ skipped: 'no phone' })
  if (session.reminder_sent) return res.status(200).json({ skipped: 'already sent' })
  if (['Cancelada', 'No show'].includes(session.estatus)) {
    return res.status(200).json({ skipped: 'cancelled' })
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME
  const phoneId      = process.env.WHATSAPP_PHONE_ID
  const token        = process.env.WHATSAPP_TOKEN

  if (!templateName || !phoneId || !token) {
    return res.status(500).json({ error: 'Missing WhatsApp environment variables' })
  }

  const phone    = '52' + session.telefono.replace(/\D/g, '').replace(/^52/, '')
  const horaStr  = session.hora?.slice(0, 5) || ''
  const fechaStr = new Date(session.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'es_MX' },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: session.nombre },
          { type: 'text', text: fechaStr },
          { type: 'text', text: horaStr },
        ]
      }]
    }
  }

  try {
    const waRes  = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    const waData = await waRes.json()

    if (waRes.ok) {
      console.log(`Confirmation sent: ${session.nombre}, msg_id: ${waData.messages?.[0]?.id}`)
      await supabase.from('sessions').update({ reminder_sent: true }).eq('id', session_id)
      return res.status(200).json({ sent: true })
    } else {
      console.error(`Confirmation error for session ${session_id}: code=${waData.error?.code}`)
      return res.status(200).json({ sent: false, code: waData.error?.code })
    }
  } catch (err) {
    console.error(`Confirmation exception for session ${session_id}:`, err.message)
    return res.status(500).json({ error: 'WA send failed' })
  }
}
