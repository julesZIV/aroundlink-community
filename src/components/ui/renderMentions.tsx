import React from 'react'

/**
 * Découpe un texte et met en surbrillance les mentions :
 *  - @all              → badge orange
 *  - @Prénom           → badge bleu
 *  - @Prénom Nom       → badge bleu (le 2e mot doit commencer par une majuscule)
 *
 * Regex : @all | @word | @word CapWord
 * Le 2e mot doit commencer par une lettre majuscule pour éviter
 * de capturer les mots normaux qui suivent la mention.
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
    return <span key={i}>{part}</span>
  })
}
