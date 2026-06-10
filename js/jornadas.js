// ─────────────────────────────────────────────────────────
// jornadas.js — fechas de bloqueo de alineación por jornada
//
// Cada jornada se bloquea en la fecha indicada (hora España peninsular CEST = UTC+2)
// Una vez bloqueada, la alineación queda guardada y no se puede modificar.
//
// Definición de jornadas:
//   J1–J3  → Fase de grupos (cada "matchday" = 2 partidos por grupo jugados)
//   J4     → Round of 32
//   J5     → Round of 16
//   J6     → Cuartos de final
//   J7     → Semifinales
//   J8     → Final
// ─────────────────────────────────────────────────────────

export const JORNADAS = [
  {
    id: 1,
    nombre: 'Fase de Grupos — Jornada 1',
    // Primer partido: 11 jun 21:00 CEST. Bloqueo: 11 jun 20:45 CEST
    bloqueo: '2026-06-11T20:45:00+02:00',
  },
  {
    id: 2,
    nombre: 'Fase de Grupos — Jornada 2',
    // Segunda vuelta de partidos de grupo empieza ~17 jun
    bloqueo: '2026-06-18T17:45:00+02:00',
  },
  {
    id: 3,
    nombre: 'Fase de Grupos — Jornada 3',
    // Tercera vuelta (decisiva) empieza ~23 jun
    bloqueo: '2026-06-24T20:45:00+02:00',
  },
  {
    id: 4,
    nombre: 'Round of 32',
    // Empieza 28 jun
    bloqueo: '2026-06-28T20:45:00+02:00',
  },
  {
    id: 5,
    nombre: 'Octavos de Final (Round of 16)',
    // Empieza ~5 jul
    bloqueo: '2026-07-04T18:45:00+02:00',
  },
  {
    id: 6,
    nombre: 'Cuartos de Final',
    // Empieza ~10 jul
    bloqueo: '2026-07-09T21:45:00+02:00',
  },
  {
    id: 7,
    nombre: 'Semifinales',
    // Empieza ~14 jul
    bloqueo: '2026-07-14T20:45:00+02:00',
  },
  {
    id: 8,
    nombre: 'Tercer y Cuarto Puesto',
    // 19 jul 21:00 CEST
    bloqueo: '2026-07-18T22:45:00+02:00',
  },
  {
    id: 9,
    nombre: 'Final',
    // 19 jul 21:00 CEST
    bloqueo: '2026-07-19T20:45:00+02:00',
  },
];

/**
 * Devuelve la jornada activa actualmente (la primera cuya fecha de bloqueo
 * aún no ha pasado), o null si el torneo ha terminado.
 */
export function getJornadaActiva() {
  const now = new Date();
  return JORNADAS.find(j => new Date(j.bloqueo) > now) || null;
}

/**
 * Devuelve true si la jornada `id` ya está bloqueada (su fecha ya pasó).
 */
export function isJornadaBloqueada(id) {
  const j = JORNADAS.find(j => j.id === id);
  if (!j) return false;
  return new Date(j.bloqueo) <= new Date();
}

/**
 * Devuelve la última jornada bloqueada (la más reciente cuya fecha ya pasó).
 * Útil para saber qué alineación hay que "congelar".
 */
export function getUltimaJornadaBloqueada() {
  const now = new Date();
  const bloqueadas = JORNADAS.filter(j => new Date(j.bloqueo) <= now);
  return bloqueadas.length > 0 ? bloqueadas[bloqueadas.length - 1] : null;
}
