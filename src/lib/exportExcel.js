import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ── helpers ──────────────────────────────────────────────────────────────────
const today = () => format(new Date(), 'yyyy-MM-dd')

const fmtFecha = (d) => {
  if (!d) return ''
  try { return format(new Date(d + 'T12:00:00'), "d 'de' MMMM yyyy", { locale: es }) }
  catch { return d }
}

const pct = (n, d) => d > 0 ? `${Math.round((n / d) * 100)}%` : '0%'

const autoWidth = (ws) => {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  const widths = []
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let max = 10
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
      if (cell && cell.v != null) {
        const len = String(cell.v).length
        if (len > max) max = len
      }
    }
    widths.push({ wch: Math.min(max + 2, 40) })
  }
  ws['!cols'] = widths
}

const download = (wb, name) => {
  XLSX.writeFile(wb, `${name}-${today()}.xlsx`)
}

// ── Sesiones ─────────────────────────────────────────────────────────────────
export function exportSesiones(sessions) {
  const headers = [
    'Nombre', 'Teléfono', 'Fecha', 'Hora', 'Personas', 'Niños (<2)',
    'Estatus', 'Anticipo', 'Método anticipo', 'Pagos cobrados',
    'Saldo pendiente', 'Descuento', 'Total facturado',
    'Recordatorio WA', 'Fotos enviadas', 'Link galería', 'Notas', 'Seguimiento',
  ]

  const rows = sessions.map(s => {
    const anticipo   = +s.anticipo  || 0
    const pagos      = +s.pagos     || 0
    const restante   = +s.restante  || 0
    const descuento  = +s.descuento || 0
    const facturado  = anticipo + pagos + restante
    return [
      s.nombre        || '',
      s.telefono      || '',
      fmtFecha(s.fecha),
      s.hora?.slice(0, 5) || '',
      s.personas      || '',
      s.ninos         || 0,
      s.estatus       || '',
      anticipo,
      s.metodo_anticipo || '',
      pagos,
      restante,
      descuento,
      facturado,
      s.reminder_sent ? 'Sí' : 'No',
      s.link_sent     ? 'Sí' : 'No',
      s.link          || '',
      (s.notas        || '').replace(/\n/g, ' '),
      (s.seguimiento  || '').replace(/\n/g, ' '),
    ]
  })

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // Currency format columns: Anticipo(H=7), Pagos(J=9), Saldo(K=10), Descuento(L=11), Facturado(M=12)
  const currencyCols = [7, 9, 10, 11, 12]
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let R = 1; R <= range.e.r; ++R) {
    currencyCols.forEach(C => {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      if (ws[addr]) ws[addr].z = '"$"#,##0.00'
    })
  }

  autoWidth(ws)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sesiones')
  download(wb, 'sesiones')
}

// ── Clientes ─────────────────────────────────────────────────────────────────
export function exportClientes(sessions) {
  // Build client map (same logic as Clientes.jsx)
  const map = {}
  sessions.forEach(s => {
    const phone = s.telefono?.replace(/\D/g, '').slice(-10) || 'sin-telefono'
    if (!map[phone]) map[phone] = { phone, nombre: s.nombre, telefono: s.telefono, sesiones: [] }
    map[phone].sesiones.push(s)
  })

  const clientes = Object.values(map).map(c => {
    const activas  = c.sesiones.filter(s => !['Cancelada', 'No show'].includes(s.estatus))
    const sorted   = [...c.sesiones].sort((a, b) => b.fecha > a.fecha ? 1 : -1)
    const latest   = sorted[0]
    const totalGastado   = activas.reduce((a, s) => a + (+s.anticipo || 0) + (+s.pagos || 0), 0)
    const saldoPendiente = activas.reduce((a, s) => a + (+s.restante  || 0), 0)
    return {
      nombre: latest?.nombre || c.nombre,
      telefono: latest?.telefono || c.telefono,
      ultimaVisita: latest?.fecha || '',
      totalSesiones: activas.length,
      totalCanceladas: c.sesiones.length - activas.length,
      totalGastado,
      saldoPendiente,
    }
  }).sort((a, b) => b.ultimaVisita > a.ultimaVisita ? 1 : -1)

  // Sheet 1: Resumen de clientes
  const hdrs = [
    'Nombre', 'Teléfono', 'Última visita', 'Sesiones activas',
    'Canceladas', 'Total gastado', 'Saldo pendiente',
  ]
  const rows = clientes.map(c => [
    c.nombre,
    c.telefono,
    fmtFecha(c.ultimaVisita),
    c.totalSesiones,
    c.totalCanceladas,
    c.totalGastado,
    c.saldoPendiente,
  ])

  const ws1 = XLSX.utils.aoa_to_sheet([hdrs, ...rows])
  const range1 = XLSX.utils.decode_range(ws1['!ref'])
  for (let R = 1; R <= range1.e.r; ++R) {
    [5, 6].forEach(C => {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      if (ws1[addr]) ws1[addr].z = '"$"#,##0.00'
    })
  }
  autoWidth(ws1)

  // Sheet 2: Detalle de sesiones por cliente
  const hdrs2 = ['Cliente', 'Teléfono', 'Fecha sesión', 'Hora', 'Personas', 'Estatus', 'Anticipo', 'Pagos', 'Saldo']
  const rows2 = []
  clientes.forEach(c => {
    const clientSessions = sessions
      .filter(s => s.telefono?.replace(/\D/g, '').slice(-10) === c.telefono?.replace(/\D/g, '').slice(-10))
      .sort((a, b) => b.fecha > a.fecha ? 1 : -1)
    clientSessions.forEach(s => rows2.push([
      c.nombre, c.telefono, fmtFecha(s.fecha), s.hora?.slice(0, 5) || '',
      s.personas, s.estatus, +s.anticipo || 0, +s.pagos || 0, +s.restante || 0,
    ]))
  })
  const ws2 = XLSX.utils.aoa_to_sheet([hdrs2, ...rows2])
  const range2 = XLSX.utils.decode_range(ws2['!ref'])
  for (let R = 1; R <= range2.e.r; ++R) {
    [6, 7, 8].forEach(C => {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      if (ws2[addr]) ws2[addr].z = '"$"#,##0.00'
    })
  }
  autoWidth(ws2)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'Clientes')
  XLSX.utils.book_append_sheet(wb, ws2, 'Historial sesiones')
  download(wb, 'clientes')
}

// ── Gastos ────────────────────────────────────────────────────────────────────
export function exportGastos(gastos) {
  // Sheet 1: Lista completa
  const hdrs = ['Fecha', 'Categoría', 'Concepto', 'Monto', 'Notas']
  const sorted = [...gastos].sort((a, b) => b.fecha > a.fecha ? 1 : -1)
  const rows = sorted.map(g => [
    fmtFecha(g.fecha), g.categoria || 'Otros', g.concepto, +g.monto || 0, g.notas || '',
  ])

  const total = gastos.reduce((a, g) => a + (+g.monto || 0), 0)
  rows.push(['', '', 'TOTAL', total, ''])

  const ws1 = XLSX.utils.aoa_to_sheet([hdrs, ...rows])
  const range1 = XLSX.utils.decode_range(ws1['!ref'])
  for (let R = 1; R <= range1.e.r; ++R) {
    const addr = XLSX.utils.encode_cell({ r: R, c: 3 })
    if (ws1[addr]) ws1[addr].z = '"$"#,##0.00'
  }
  autoWidth(ws1)

  // Sheet 2: Resumen por categoría
  const bycat = gastos.reduce((acc, g) => {
    const k = g.categoria || 'Otros'
    acc[k] = (acc[k] || 0) + (+g.monto || 0)
    return acc
  }, {})
  const catRows = Object.entries(bycat).sort((a, b) => b[1] - a[1])
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['Categoría', 'Total', '% del gasto'],
    ...catRows.map(([cat, monto]) => [cat, monto, pct(monto, total)]),
    ['TOTAL', total, '100%'],
  ])
  const range2 = XLSX.utils.decode_range(ws2['!ref'])
  for (let R = 1; R <= range2.e.r; ++R) {
    const addr = XLSX.utils.encode_cell({ r: R, c: 1 })
    if (ws2[addr]) ws2[addr].z = '"$"#,##0.00'
  }
  autoWidth(ws2)

  // Sheet 3: Resumen mensual
  const byMonth = gastos.reduce((acc, g) => {
    const k = g.fecha?.slice(0, 7) || 'desconocido'
    if (!acc[k]) acc[k] = { total: 0, items: 0 }
    acc[k].total += +g.monto || 0
    acc[k].items++
    return acc
  }, {})
  const monthRows = Object.entries(byMonth).sort((a, b) => b[0] > a[0] ? 1 : -1)
  const ws3 = XLSX.utils.aoa_to_sheet([
    ['Mes', 'Total gastos', 'Nº gastos'],
    ...monthRows.map(([mes, { total: t, items }]) => {
      try {
        const label = format(new Date(mes + '-01'), "MMMM yyyy", { locale: es })
        return [label, t, items]
      } catch { return [mes, t, items] }
    }),
  ])
  const range3 = XLSX.utils.decode_range(ws3['!ref'])
  for (let R = 1; R <= range3.e.r; ++R) {
    const addr = XLSX.utils.encode_cell({ r: R, c: 1 })
    if (ws3[addr]) ws3[addr].z = '"$"#,##0.00'
  }
  autoWidth(ws3)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'Gastos')
  XLSX.utils.book_append_sheet(wb, ws2, 'Por categoría')
  XLSX.utils.book_append_sheet(wb, ws3, 'Por mes')
  download(wb, 'gastos')
}

// ── Estadísticas ──────────────────────────────────────────────────────────────
export function exportEstadisticas({ sessions, gastos, pagos, extras, rangeStart, rangeEnd }) {
  const rangeActive = sessions.filter(s =>
    s.fecha >= rangeStart && s.fecha <= rangeEnd &&
    !['Cancelada', 'No show'].includes(s.estatus)
  )
  const canceladas = sessions.filter(s =>
    s.fecha >= rangeStart && s.fecha <= rangeEnd &&
    ['Cancelada', 'No show'].includes(s.estatus)
  )
  const rangeGastos = gastos.filter(g => g.fecha >= rangeStart && g.fecha <= rangeEnd)

  const totalAnticipo  = rangeActive.reduce((a, s) => a + (+s.anticipo  || 0), 0)
  const totalPagos     = rangeActive.reduce((a, s) => a + (+s.pagos     || 0), 0)
  const totalRestante  = rangeActive.reduce((a, s) => a + (+s.restante  || 0), 0)
  const totalFacturado = totalAnticipo + totalPagos + totalRestante
  const totalCobrado   = totalAnticipo + totalPagos
  const totalGastos    = rangeGastos.reduce((a, g) => a + (+g.monto || 0), 0)
  const balanceNeto    = totalCobrado - totalGastos
  const totalDescuentos = rangeActive.reduce((a, s) => a + (+s.descuento || 0), 0)

  const sessionIdsInRange = new Set(rangeActive.map(s => s.id))
  const rangePagos  = pagos.filter(p => sessionIdsInRange.has(p.session_id))
  const rangeExtras = extras.filter(e => sessionIdsInRange.has(e.session_id))
  const totalExtras = rangeExtras.reduce((a, e) => a + (+e.monto || 0), 0)

  const liquidadas = rangeActive.filter(s =>
    ['Completada', 'Entregada', 'Pendiente de entrega'].includes(s.estatus) &&
    (+s.restante === 0 || !s.restante)
  )

  // ── Sheet 1: Resumen general ──
  const wsResumen = XLSX.utils.aoa_to_sheet([
    ['RESUMEN ESTADÍSTICO', `${fmtFecha(rangeStart)} — ${fmtFecha(rangeEnd)}`],
    [],
    ['FINANCIERO', ''],
    ['Total facturado',            totalFacturado],
    ['Total cobrado',              totalCobrado],
    ['Saldo por cobrar',           totalRestante],
    ['Total gastos',               totalGastos],
    ['Balance neto',               balanceNeto],
    ['Descuentos aplicados',       totalDescuentos],
    ['Cargos extras (sesiones)',   totalExtras],
    [],
    ['SESIONES', ''],
    ['Sesiones activas',           rangeActive.length],
    ['Canceladas / No show',       canceladas.length],
    ['Liquidadas (saldo en cero)', liquidadas.length],
    ['Sesiones con anticipo',      rangeActive.filter(s => +s.anticipo > 0).length],
    ['Sesiones con deuda',         rangeActive.filter(s => +s.restante > 0).length],
    ['Tasa de cancelación',        canceladas.length + rangeActive.length > 0
      ? `${Math.round(canceladas.length / (canceladas.length + rangeActive.length) * 100)}%` : '0%'],
    ['% cobrado sobre facturado',  totalFacturado > 0
      ? `${Math.round(totalCobrado / totalFacturado * 100)}%` : '0%'],
    ['Valor promedio por sesión',  rangeActive.length > 0
      ? Math.round(totalFacturado / rangeActive.length) : 0],
    [],
    ['ANTICIPOS', ''],
    ['Total anticipos',            totalAnticipo],
    ['Anticipos efectivo',         rangeActive.filter(s => s.metodo_anticipo === 'efectivo').reduce((a, s) => a + (+s.anticipo || 0), 0)],
    ['Anticipos transferencia',    rangeActive.filter(s => s.metodo_anticipo === 'transferencia').reduce((a, s) => a + (+s.anticipo || 0), 0)],
    ['Cupones usados (count)',      rangeActive.filter(s => s.metodo_anticipo === 'cupon').length],
    ['Cupones usados (monto)',      rangeActive.filter(s => s.metodo_anticipo === 'cupon').reduce((a, s) => a + (+s.anticipo || 0), 0)],
  ])

  // Format currency rows (column B)
  const currencyRows = [3, 4, 5, 6, 7, 8, 9, 21, 22, 23, 24, 26]
  currencyRows.forEach(r => {
    const addr = XLSX.utils.encode_cell({ r, c: 1 })
    if (wsResumen[addr] && typeof wsResumen[addr].v === 'number') wsResumen[addr].z = '"$"#,##0.00'
  })
  autoWidth(wsResumen)

  // ── Sheet 2: Desglose por estatus ──
  const STATUS_MAP = [
    { label: 'Reservada / Confirmada / Llegó / En sesión', statuses: ['Reservada', 'Confirmada', 'Llegó', 'En sesión'] },
    { label: 'Completada',          statuses: ['Completada'] },
    { label: 'Pendiente de entrega', statuses: ['Pendiente de entrega'] },
    { label: 'Pendiente de pago',   statuses: ['Pendiente de pago'] },
    { label: 'Entregada',           statuses: ['Entregada'] },
    { label: 'Cancelada',           statuses: ['Cancelada'] },
    { label: 'No show',             statuses: ['No show'] },
  ]
  const wsEstatus = XLSX.utils.aoa_to_sheet([
    ['Estatus', 'Cantidad', 'Facturado', 'Cobrado', 'Saldo pendiente'],
    ...STATUS_MAP.map(({ label, statuses }) => {
      const group = sessions.filter(s => s.fecha >= rangeStart && s.fecha <= rangeEnd && statuses.includes(s.estatus))
      const fact  = group.reduce((a, s) => a + (+s.anticipo || 0) + (+s.pagos || 0) + (+s.restante || 0), 0)
      const cob   = group.reduce((a, s) => a + (+s.anticipo || 0) + (+s.pagos || 0), 0)
      const saldo = group.reduce((a, s) => a + (+s.restante || 0), 0)
      return [label, group.length, fact, cob, saldo]
    }),
  ])
  const range2 = XLSX.utils.decode_range(wsEstatus['!ref'])
  for (let R = 1; R <= range2.e.r; ++R) {
    [2, 3, 4].forEach(C => {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      if (wsEstatus[addr]) wsEstatus[addr].z = '"$"#,##0.00'
    })
  }
  autoWidth(wsEstatus)

  // ── Sheet 3: Gastos por categoría ──
  const bycat = rangeGastos.reduce((acc, g) => {
    const k = g.categoria || 'Otros'
    acc[k] = (acc[k] || 0) + (+g.monto || 0)
    return acc
  }, {})
  const catRows = Object.entries(bycat).sort((a, b) => b[1] - a[1])
  const wsGastos = XLSX.utils.aoa_to_sheet([
    ['Categoría', 'Total', '% del gasto'],
    ...catRows.map(([cat, monto]) => [cat, monto, pct(monto, totalGastos)]),
    ['TOTAL', totalGastos, '100%'],
  ])
  const range3 = XLSX.utils.decode_range(wsGastos['!ref'])
  for (let R = 1; R <= range3.e.r; ++R) {
    const addr = XLSX.utils.encode_cell({ r: R, c: 1 })
    if (wsGastos[addr]) wsGastos[addr].z = '"$"#,##0.00'
  }
  autoWidth(wsGastos)

  // ── Sheet 4: Cobros por método ──
  const metodosMap = rangePagos.reduce((acc, p) => {
    const key = p.metodo || 'efectivo'
    acc[key] = (acc[key] || 0) + (+p.monto || 0)
    return acc
  }, {})
  rangeActive.forEach(s => {
    if (!s.metodo_anticipo || !+s.anticipo) return
    metodosMap[s.metodo_anticipo] = (metodosMap[s.metodo_anticipo] || 0) + (+s.anticipo)
  })
  const wsMetodos = XLSX.utils.aoa_to_sheet([
    ['Método de pago', 'Monto cobrado', '% del cobro total'],
    ...Object.entries(metodosMap).sort((a, b) => b[1] - a[1])
      .map(([met, monto]) => [met, monto, pct(monto, totalCobrado)]),
    ['TOTAL', totalCobrado, '100%'],
  ])
  const range4 = XLSX.utils.decode_range(wsMetodos['!ref'])
  for (let R = 1; R <= range4.e.r; ++R) {
    const addr = XLSX.utils.encode_cell({ r: R, c: 1 })
    if (wsMetodos[addr]) wsMetodos[addr].z = '"$"#,##0.00'
  }
  autoWidth(wsMetodos)

  // ── Sheet 5: Deudores (saldo pendiente) ──
  const deudores = rangeActive
    .filter(s => +s.restante > 0)
    .sort((a, b) => (+b.restante) - (+a.restante))
  const wsDeudores = XLSX.utils.aoa_to_sheet([
    ['Cliente', 'Teléfono', 'Fecha sesión', 'Estatus', 'Anticipo', 'Pagos cobrados', 'Saldo pendiente'],
    ...deudores.map(s => [
      s.nombre, s.telefono, fmtFecha(s.fecha), s.estatus,
      +s.anticipo || 0, +s.pagos || 0, +s.restante || 0,
    ]),
    ['', '', '', 'TOTAL', '', '', deudores.reduce((a, s) => a + (+s.restante || 0), 0)],
  ])
  const range5 = XLSX.utils.decode_range(wsDeudores['!ref'])
  for (let R = 1; R <= range5.e.r; ++R) {
    [4, 5, 6].forEach(C => {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      if (wsDeudores[addr]) wsDeudores[addr].z = '"$"#,##0.00'
    })
  }
  autoWidth(wsDeudores)

  // ── Sheet 6: Extras por concepto ──
  const extrasByConcepto = rangeExtras.reduce((acc, e) => {
    acc[e.concepto] = (acc[e.concepto] || 0) + (+e.monto || 0)
    return acc
  }, {})
  const wsExtras = XLSX.utils.aoa_to_sheet([
    ['Concepto extra', 'Total'],
    ...Object.entries(extrasByConcepto).sort((a, b) => b[1] - a[1])
      .map(([c, m]) => [c, m]),
    ['TOTAL', totalExtras],
  ])
  const range6 = XLSX.utils.decode_range(wsExtras['!ref'])
  for (let R = 1; R <= range6.e.r; ++R) {
    const addr = XLSX.utils.encode_cell({ r: R, c: 1 })
    if (wsExtras[addr]) wsExtras[addr].z = '"$"#,##0.00'
  }
  autoWidth(wsExtras)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsResumen,  'Resumen')
  XLSX.utils.book_append_sheet(wb, wsEstatus,  'Por estatus')
  XLSX.utils.book_append_sheet(wb, wsGastos,   'Gastos por categoría')
  XLSX.utils.book_append_sheet(wb, wsMetodos,  'Cobros por método')
  XLSX.utils.book_append_sheet(wb, wsDeudores, 'Deudores')
  XLSX.utils.book_append_sheet(wb, wsExtras,   'Cargos extras')
  download(wb, 'estadisticas')
}
