import type { Species } from './species'

/** Small SVG drawings of each seed for the shelf and cards. */
export function seedSvg(sp: Species): string {
  const s = sp.seed.size * 2.4
  const id = `g-${sp.id}`
  const open = `<svg viewBox="0 0 40 40" width="${s}" height="${s}" aria-hidden="true">`
  switch (sp.seed.shape) {
    case 'kidney':
      return `${open}<defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#f08a6a"/><stop offset="0.5" stop-color="#d2452f"/><stop offset="1" stop-color="#7a1e14"/></radialGradient></defs>
        <path d="M13 9c7-6 19-2 18 9-1 10-8 15-15 14-5-1-8-4-8-9 0-4 3-5 4-8 1-2-1-4 1-6z" fill="url(#${id})"/>
        <ellipse cx="16" cy="13" rx="4" ry="2.2" fill="rgba(255,255,255,0.35)" transform="rotate(-25 16 13)"/>
        <path d="M30 6c-2 4-3 8-3 12" stroke="#e9e2d2" stroke-width="1" fill="none" stroke-linecap="round"/></svg>`
    case 'oval':
      return `${open}<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#efe4c8"/><stop offset="1" stop-color="#bfa97c"/></linearGradient></defs>
        <ellipse cx="20" cy="20" rx="17" ry="10.5" fill="url(#${id})" transform="rotate(-18 20 20)"/>
        ${Array.from({ length: 9 }, (_, i) => `<path d="M${6 + i * 3.2} ${26 - i * 1.1}c3-4 7-6 12-7" stroke="rgba(120,90,50,${0.25 + (i % 3) * 0.12})" stroke-width="0.8" fill="none"/>`).join('')}
        <path d="M4 22c8-9 20-11 31-10" stroke="rgba(90,60,30,0.5)" stroke-width="1" fill="none"/></svg>`
    case 'teardrop':
      return `${open}<defs><radialGradient id="${id}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#8a5a3a"/><stop offset="0.6" stop-color="#4a2e1c"/><stop offset="1" stop-color="#241208"/></radialGradient></defs>
        <path d="M20 5c6 7 9 12 9 18a9 9 0 0 1-18 0c0-6 3-11 9-18z" fill="url(#${id})"/>
        <path d="M20 9v15" stroke="rgba(255,230,200,0.25)" stroke-width="1.2" stroke-linecap="round"/>
        <ellipse cx="16" cy="16" rx="2.2" ry="4" fill="rgba(255,255,255,0.3)" transform="rotate(-15 16 16)"/></svg>`
    case 'round':
      return `${open}<defs><radialGradient id="${id}" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="#c9a07a"/><stop offset="0.6" stop-color="#8a5a3c"/><stop offset="1" stop-color="#4e2f1c"/></radialGradient></defs>
        <circle cx="20" cy="21" r="12.5" fill="url(#${id})"/>
        <path d="M20 9c-1 6-1 14 0 24" stroke="rgba(60,30,15,0.5)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <path d="M12 16c3-3 6-4 10-4" stroke="rgba(255,240,220,0.35)" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>`
    case 'speck':
      return `${open}<defs><radialGradient id="${id}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#f1dc8a"/><stop offset="1" stop-color="#9a7a2a"/></radialGradient></defs>
        <ellipse cx="20" cy="20" rx="6.5" ry="8.5" fill="url(#${id})" transform="rotate(20 20 20)"/>
        <ellipse cx="18" cy="16" rx="1.8" ry="2.6" fill="rgba(255,255,255,0.55)"/></svg>`
  }
}
