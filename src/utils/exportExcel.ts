import * as XLSX from 'xlsx'
import type { LlegadaTarde } from '../lib/supabaseClient'

const TURNO_LABEL: Record<string, string> = {
  'mañana': 'Mañana',
  'tarde': 'Tarde',
}

const METODO_LABEL: Record<string, string> = {
  'qr': 'QR',
  'manual': 'Manual',
}

export function exportarLlegadasExcel(llegadas: LlegadaTarde[], filename?: string) {
  const rows = llegadas.map((l) => ({
    Apellido: l.apellido,
    Nombre: l.nombre,
    Grado: l.grado,
    División: l.division,
    Fecha: l.fecha,
    Hora: l.hora,
    Turno: TURNO_LABEL[l.turno] ?? l.turno,
    Método: METODO_LABEL[l.metodo] ?? l.metodo,
    'Registrado por': l.registrado_por_email ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 20 }, // Apellido
    { wch: 20 }, // Nombre
    { wch: 10 }, // Grado
    { wch: 10 }, // División
    { wch: 12 }, // Fecha
    { wch: 10 }, // Hora
    { wch: 10 }, // Turno
    { wch: 10 }, // Método
    { wch: 30 }, // Registrado por
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Llegadas Tarde')

  const today = new Date().toISOString().slice(0, 10)
  const name = filename ?? `llegadas_tarde_${today}.xlsx`
  XLSX.writeFile(wb, name)
}
