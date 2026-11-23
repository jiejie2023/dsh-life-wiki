import type { IncomingMessage, ServerResponse } from 'node:http'
import { createHttpHandler } from './http.ts'
import { createSettingsStore } from './settings.ts'

export const name = 'life-wiki'
export const inject = ['webServer'] as const

interface DshHostContext {
  webServer: {
    register(route: {
      kind: 'prefix'
      path: string
      handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>
    }): (() => void) | void
  }
  get?: (name: string) => unknown
  effect?: (fn: () => (() => void) | void, label?: string) => void
}

function readTrustedHosts(ctx: DshHostContext): string[] {
  try {
    if (typeof ctx.get !== 'function') return []
    const runtime = ctx.get('webRuntime') as { trustedHosts?: unknown } | undefined
    if (runtime && Array.isArray(runtime.trustedHosts)) {
      return runtime.trustedHosts.filter((x): x is string => typeof x === 'string')
    }
  } catch {
    // Optional service absent in current profile
  }
  return []
}

export async function apply(ctx: DshHostContext): Promise<void> {
  const settings = await createSettingsStore()
  const handler = createHttpHandler({
    settings,
    getTrustedHosts: () => readTrustedHosts(ctx),
  })

  const registerRoute = () =>
    ctx.webServer.register({
      kind: 'prefix',
      path: '/api/life-wiki',
      handler,
    })

  if (typeof ctx.effect === 'function') {
    ctx.effect(registerRoute, 'life-wiki HTTP routes')
  } else {
    registerRoute()
  }
}
