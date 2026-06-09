/**
 * Normalizes an email domain to a base key used for institution matching.
 *
 * Examples:
 *   neoma-bs.fr   → neoma-bs
 *   neoma-bs.com  → neoma-bs   ← same institution, different TLD
 *   mit.edu       → mit
 *   ox.ac.uk      → ox
 *   hec.fr        → hec
 *   sciences-po.fr → sciences-po
 *
 * The normalized value is stored as `institution_domain` in the DB so that
 * users from different TLDs of the same school are grouped together.
 */

const STRIP_TLDS = new Set([
  // Generic
  'com', 'org', 'net', 'edu', 'io', 'co',
  // Country codes
  'fr', 'de', 'es', 'it', 'nl', 'be', 'ch', 'pt', 'pl', 'ro', 'cz', 'sk',
  'se', 'dk', 'no', 'fi', 'hu', 'at', 'gr', 'bg', 'hr', 'lt', 'lv', 'ee',
  'uk', 'ac',   // ac.uk  →  strip both
  'us', 'ca', 'au', 'nz', 'jp', 'cn', 'kr', 'br', 'mx', 'ar', 'cl',
  'za', 'ma', 'tn', 'dz', 'eg', 'ng', 'ke',
  'in', 'sg', 'hk', 'tw',
  'tr', 'sa', 'ae', 'il',
])

export function normalizeDomain(domain: string): string {
  const parts = domain.toLowerCase().trim().split('.')
  // Strip trailing TLD segments (right to left) until only the root remains
  while (parts.length > 1 && STRIP_TLDS.has(parts[parts.length - 1])) {
    parts.pop()
  }
  return parts.join('.')
}

/**
 * Returns true if two domains belong to the same institution.
 *   sameInstitution('neoma-bs.fr', 'neoma-bs.com') → true
 *   sameInstitution('hec.fr', 'mit.edu')           → false
 */
export function sameInstitution(domainA: string, domainB: string): boolean {
  return normalizeDomain(domainA) === normalizeDomain(domainB)
}
