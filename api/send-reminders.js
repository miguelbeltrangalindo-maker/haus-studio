import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // Only allow GET (Vercel cron) or POST with secret for manual trigger
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  // Tomorrow's date in YYYY-MM-DD
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  // Sessions tomorrow that haven't been reminded, not cancelled
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, nombre, telefono, fecha, hora, estatus')
    .eq('fecha', tomorrowStr)
    .eq('reminder_sent', false)
    .not('estatus', 'in', '("Cancelada","No show")')

  if (error) {
    console.error('Supabase error:', error)
    return res.status(500).json({ error: error.message })
  }

  if (!sessions || sessions.length === 0) {
    return res.status(200).json({ message: 'No sessions tomorrow', sent: 0 })
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME
  const phoneId     = process.env.WHATSAPP_PHONE_ID
  const token       = process.env.WHATSAPP_TOKEN

  if (!templateName || !phoneId || !token) {
    return res.status(500).json({ error: 'Missing WhatsApp environment variables' })
  }

  // Format date in Spanish: "lunes 14 de abril"
  const fechaDate = new Date(tomorrowStr + 'T12:00:00')
  const fechaStr  = fechaDate.toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const results = []

  for (const session of sessions) {
    const phone   = '52' + session.telefono.replace(/\D/g, '').replace(/^52/, '')
    const horaStr = session.hora?.slice(0, 5) || ''

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
      const waRes = await fetch(
        `https://graph.facebook.com/v25.0/${phoneId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      )

      const waData = await waRes.json()
      console.log(`WA response for ${session.nombre} (${phone}):`, JSON.stringify(waData))

      if (waRes.ok) {
        await supabase
          .from('sessions')
          .update({ reminder_sent: true })
          .eq('id', session.id)
        results.push({ nombre: session.nombre, phone, status: 'sent' })
      } else {
        console.error(`WA error for ${session.nombre}:`, JSON.stringify(waData))
        results.push({ nombre: session.nombre, phone, status: 'error', detail: waData })
      }
    } catch (err) {
      results.push({ nombre: session.nombre, phone, status: 'exception', detail: err.message })
    }
  }

  return res.status(200).json({
    date: tomorrowStr,
    sent: results.filter(r => r.status === 'sent').length,
    errors: results.filter(r => r.status !== 'sent').length,
    results,
  })
}
