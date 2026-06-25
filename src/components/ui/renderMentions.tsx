import React from 'react'

/** URL http(s):// ou www. — capturée pour être rendue en lien cliquable. */
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi

/** Transforme les URLs d'un fragment de texte en liens cliquables (http/https only). */
function linkify(text: string, keyBase: string): React.ReactNode[] {
  return text.split(URL_RE).map((part, i) => {
    if (!part) return null
    if (/^(https?:\/\/|www\.)/i.test(part)) {
      // On retire la ponctuation finale qui ne fait pas partie de l'URL (. , ) ! …)
      const trail = part.match(/[)\].,;:!?'"»]+$/)?.[0] ?? ''
      const url = trail ? part.slice(0, part.length - trail.length) : part
      const href = url.startsWith('www.') ? `https://${url}` : url
      return (
        <React.Fragment key={`${keyBase}-${i}`}>
          <a href={href} target="_blank" rel="noopener noreferrer nofollow"
            className="text-blue-600 hover:underline break-all"
            onClick={e => e.stopPropagation()}>{url}</a>
          {trail}
        </React.Fragment>
      )
    }
    return <React.Fragment key={`${keyBase}-${i}`}>{part}</React.Fragment>
  })
}

/**
 * Découpe un texte et met en surbrillance les mentions, puis rend les URLs cliquables :
 *  - @all              → badge orange
 *  - @Prénom           → badge bleu
 *  - @Prénom Nom       → badge bleu (le 2e mot doit commencer par une majuscule)
 *  - http(s)://… / www.…→ lien cliquable (nouvel onglet)
 */
export function renderMentions(text: string): React.ReactNode[] {
  const MENTION_RE = /(@all|@[\wÀ-ÿ]+(?:\s[A-ZÀ-ÖÀ-ÖØ-Þ][\wÀ-ÿ]*)?)/g

  return text.split(MENTION_RE).map((part, i) => {
    if (part === '@all') {
      return (
        <span key={i} className="font-bold text-amber-700 bg-amber-100 rounded px-1">
          📢 @all
        </span>
      )
    }
    if (part.startsWith('@')) {
      return (
        <span key={i} className="font-semibold text-blue-600 bg-blue-50 rounded px-0.5">
          {part}
        </span>
      )
    }
    // Texte normal → on rend les URLs cliquables
    return <React.Fragment key={i}>{linkify(part, String(i))}</React.Fragment>
  })
}
