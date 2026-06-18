'use client'
import { useState, useEffect, type CSSProperties, type ReactNode } from 'react'

/**
 * Affiche une photo de profil et retombe proprement sur les initiales
 * (le `fallback`) quand il n'y a pas d'URL OU quand l'image échoue à charger
 * (ex. URL LinkedIn expirée → HTTP 403). Évite d'afficher le texte « alt »
 * cassé du navigateur.
 *
 * À glisser exactement là où on écrivait `{src ? <img .../> : fallback}` :
 * le parent fournit déjà le cercle de couleur et la taille.
 */
export default function AvatarImg({
  src,
  alt,
  fallback,
  style,
}: {
  src: string | null | undefined
  alt: string
  fallback: ReactNode
  style?: CSSProperties
}) {
  const [failed, setFailed] = useState(false)

  // Si l'URL change (nouvel avatar), on retente le chargement
  useEffect(() => { setFailed(false) }, [src])

  if (!src || failed) return <>{fallback}</>

  return (
    <img
      src={src}
      alt={alt}
      style={style ?? { width: '100%', height: '100%', objectFit: 'cover' }}
      onError={() => setFailed(true)}
    />
  )
}
