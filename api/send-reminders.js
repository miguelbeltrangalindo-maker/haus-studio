import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validate Vercel cron secret to prevent unauthorized external calls
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers['authorization']
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Read reminder config
  const { data: configRow } = await supabase
    .from('config')
    .select('wa_settings')
    .eq('id', 1)
    .single()

  const wa         = configRow?.wa_settings || {}
  const r1Trigger  = 'days_before'
  const r1Days     = wa.reminder_enabled ? (wa.reminder_days ?? 1) : null
  const r2Enabled  = false
  const r2Days     = 0

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME
  const phoneId      = process.env.WHATSAPP_PHONE_ID
  const token        = process.env.WHATSAPP_TOKEN

  if (!templateName || !phoneId || !token) {
    return res.status(500).json({ error: 'Missing WhatsApp environment variables' })
  }

  const results = []

  // ── Helper: send one WA message ──
  const sendWA = async (session, dateLabel) => {
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
            { type: 'text', text: dateLabel },
            { type: 'text', text: horaStr },
          ]
        }]
      }
    }

    const waRes  = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    const waData = await waRes.json()
    return { ok: waRes.ok, waData }
  }

  // ── Helper: date string N days from today ──
  const dateStrDaysFromNow = (n) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d.toISOString().split('T')[0]
  }

  // ── Helper: Spanish date label ──
  const spanishDate = (dateStr) =>
    new Date(dateStr + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'long', day: 'numeric', month: 'long'
    })

  // ── Reminder (scheduled — on_booking is handled at session creation) ──
  if (r1Days !== null) {
    const targetDate = dateStrDaysFromNow(r1Days)
    const { data: sessions1 } = await supabase
      .from('sessions')
      .select('id, nombre, telefono, fecha, hora')
      .eq('fecha', targetDate)
      .eq('reminder_sent', false)
      .not('estatus', 'in', '("Cancelada","No show")')

    for (const session of (sessions1 || [])) {
      if (!session.telefono) continue
      try {
        const { ok, waData } = await sendWA(session, spanishDate(session.fecha))
        if (ok) {
          console.log(`R1 sent: ${session.nombre}, msg_id: ${waData.messages?.[0]?.id}`)
          await supabase.from('sessions').update({ reminder_sent: true }).eq('id', session.id)
          results.push({ type: 'r1', nombre: session.nombre, status: 'sent' })
        } else {
          console.error(`R1 error for session ${session.id}: code=${waData.error?.code}`)
          results.push({ type: 'r1', nombre: session.nombre, status: 'error', code: waData.error?.code })
        }
      } catch (err) {
        console.error(`R1 exception for session ${session.id}:`, err.message)
        results.push({ type: 'r1', nombre: session.nombre, status: 'exception' })
      }
    }
  }

  // ── Reminder 2 ──
  if (r2Enabled) {
    const targetDate = dateStrDaysFromNow(r2Days)
    const { data: sessions2 } = await supabase
      .from('sessions')
      .select('id, nombre, telefono, fecha, hora')
      .eq('fecha', targetDate)
      .eq('reminder_2_sent', false)
      .not('estatus', 'in', '("Cancelada","No show")')

    for (const session of (sessions2 || [])) {
      if (!session.telefono) continue
      try {
        const { ok, waData } = await sendWA(session, spanishDate(session.fecha))
        if (ok) {
          console.log(`R2 sent: ${session.nombre}, msg_id: ${waData.messages?.[0]?.id}`)
          await supabase.from('sessions').update({ reminder_2_sent: true }).eq('id', session.id)
          results.push({ type: 'r2', nombre: session.nombre, status: 'sent' })
        } else {
          console.error(`R2 error for session ${session.id}: code=${waData.error?.code}`)
          results.push({ type: 'r2', nombre: session.nombre, status: 'error', code: waData.error?.code })
        }
      } catch (err) {
        console.error(`R2 exception for session ${session.id}:`, err.message)
        results.push({ type: 'r2', nombre: session.nombre, status: 'exception' })
      }
    }
  }

  return res.status(200).json({
    sent: results.filter(r => r.status === 'sent').length,
    errors: results.filter(r => r.status !== 'sent').length,
    results,
  })
}
