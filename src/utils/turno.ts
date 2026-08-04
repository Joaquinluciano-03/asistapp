/**
 * Utilidades de turno/fecha para el sistema de asistencia.
 * Usa la zona horaria de Argentina y el mismo umbral que el trigger de Supabase:
 *   hora >= 13 → 'tarde', hora < 13 → 'mañana'
 */

/** Devuelve la fecha actual en Buenos Aires como 'YYYY-MM-DD'. */
export function getFechaArgentina(): string {
  // 'en-CA' produce el formato YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date())
}

/** Devuelve el turno actual según la hora en Buenos Aires (igual al trigger de Supabase). */
export function getTurnoActual(): 'mañana' | 'tarde' {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: 'numeric',
    hour12: false,
    hourCycle: 'h23',
  }).format(new Date())
  const hora = parseInt(hourStr, 10)
  // Mismo umbral que el trigger fill_llegada en Supabase
  return hora >= 13 ? 'tarde' : 'mañana'
}

/** Label legible del turno para mensajes de UI. */
export function turnoLabel(turno: 'mañana' | 'tarde'): string {
  return turno === 'mañana' ? 'turno mañana' : 'turno tarde'
}
