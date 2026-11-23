import React from 'react'

interface IconProps {
  size?: number
  className?: string
}

const base = (size: number): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.65,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
})

export function IconInbox({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  )
}

export function IconSettings({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function IconGit({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="3" />
      <line x1="3" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="21" y2="12" />
    </svg>
  )
}

export function IconChevronLeft({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

export function IconChevronRight({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export function IconChevronDown({ size = 13, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function IconPlus({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export function IconCheck({ size = 12, className }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={2.4} className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function IconClock({ size = 13, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  )
}

export function IconCalendar({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

export function IconFile({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

export function IconFolder({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export function IconSearch({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function IconX({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function IconExternal({ size = 13, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

export function IconRefresh({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

export function IconStar({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2.4c.42 0 .8.24.98.62l2.46 5.06 5.56.78c.42.06.76.35.9.75.13.4.02.84-.29 1.13l-4.05 3.9.98 5.52c.07.42-.1.84-.44 1.09a1.08 1.08 0 0 1-1.15.08L12 18.7l-4.95 2.63a1.08 1.08 0 0 1-1.15-.08 1.08 1.08 0 0 1-.44-1.09l.98-5.52-4.05-3.9a1.08 1.08 0 0 1-.29-1.13c.14-.4.48-.69.9-.75l5.56-.78 2.46-5.06c.18-.38.56-.62.98-.62z" />
    </svg>
  )
}

export function IconProjectPie({
  ratio,
  size = 16,
}: {
  ratio: number
  size?: number
}) {
  const clamped = Math.max(0, Math.min(1, ratio))
  const r = 6.2
  const cx = 10
  const cy = 10
  const angle = clamped * 2 * Math.PI - Math.PI / 2
  const x = cx + r * Math.cos(angle)
  const y = cy + r * Math.sin(angle)
  const largeArc = clamped > 0.5 ? 1 : 0

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <circle
        cx={cx}
        cy={cy}
        r={8}
        stroke="var(--lw-accent)"
        strokeWidth="1.5"
        opacity={clamped === 0 ? 0.55 : 0.9}
      />
      {clamped >= 0.999 ? (
        <circle cx={cx} cy={cy} r={r} fill="var(--lw-accent)" />
      ) : clamped > 0 ? (
        <path
          d={`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`}
          fill="var(--lw-accent)"
        />
      ) : null}
    </svg>
  )
}
