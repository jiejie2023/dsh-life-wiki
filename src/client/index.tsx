import React from 'react'
import { LifeWikiApp } from './App.tsx'

export const name = 'life-wiki-client'
export const inject = ['slots'] as const

interface SlotsService {
  register(
    slot:
      | { name: 'main'; key: string }
      | { name: 'sidebar.panellist'; id: string; order: number; label: () => string },
    component: React.ComponentType<{ size?: number }>,
  ): (() => void) | void
}

interface ClientContext {
  slots: SlotsService
}

function LifeWikiIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22V5.5z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5a2.5 2.5 0 0 1 2.5 2V5.5z" />
      <path d="M7.5 8h2" />
      <path d="M7.5 12h2" />
      <path d="M14.5 8h2" />
      <path d="M14.5 12h2" />
    </svg>
  )
}

export function apply(ctx: ClientContext): void {
  ctx.slots.register({ name: 'main', key: 'life-wiki' }, LifeWikiApp)
  ctx.slots.register(
    {
      name: 'sidebar.panellist',
      id: 'life-wiki',
      order: 25,
      label: () => 'Life Wiki',
    },
    LifeWikiIcon,
  )
}
