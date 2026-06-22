/**
 * AroundLink est l'organisateur de la communauté : l'orga et les personnes
 * qui y sont rattachées NE doivent PAS apparaître dans les classements
 * (leaderboard membres/institutions, top contributeurs, annuaire des institutions).
 * Leur nombre de links reste compté et visible sur leur profil — on les exclut
 * uniquement des classements.
 *
 * Détection robuste : on normalise (espaces retirés + minuscules) et on cherche
 * "aroundlink", ce qui couvre "AroundLink", "Around Link",
 * "AroundLink International Community", etc.
 */
export function isAroundLinkOrg(institution?: string | null): boolean {
  if (!institution) return false
  return institution.replace(/\s+/g, '').toLowerCase().includes('aroundlink')
}
