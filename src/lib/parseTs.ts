/**
 * Parse une date ISO renvoyée par Supabase de façon robuste.
 *
 * PostgREST renvoie les timestamps avec des MICROSECONDES (6 décimales,
 * ex. "2026-06-26T09:52:59.704464+00:00"). Safari / iOS refuse ce format
 * (`new Date()` → Invalid Date) → heures buguées sur iPhone, alors que
 * Chrome/Android le tolèrent. On tronque les fractions de seconde à 3
 * chiffres (millisecondes), accepté par tous les navigateurs.
 */
export function parseTs(iso: string | null | undefined): Date {
  if (!iso) return new Date(NaN)
  return new Date(iso.replace(/(\.\d{3})\d+/, '$1'))
}
