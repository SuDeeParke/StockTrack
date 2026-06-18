import type { Signal } from '../types/index.js'
import { MOCK_SIGNALS } from './signals-mock.js'

interface CacheState {
  signals: Signal[]
  lastRefresh: string | null
  isRefreshing: boolean
}

const state: CacheState = {
  signals: [...MOCK_SIGNALS],
  lastRefresh: null,
  isRefreshing: false,
}

export function getCachedSignals(): Signal[] {
  return state.signals
}

export function getLastRefresh(): string | null {
  return state.lastRefresh
}

export function isRefreshing(): boolean {
  return state.isRefreshing
}

export async function refreshSignals(): Promise<void> {
  if (state.isRefreshing) return
  state.isRefreshing = true
  try {
    // In production this would call a real data source
    await new Promise((r) => setTimeout(r, 10))
    state.signals = MOCK_SIGNALS.map((s) => ({
      ...s,
      date: new Date().toISOString().slice(0, 10),
      stale: false,
    }))
    state.lastRefresh = new Date().toISOString()
  } finally {
    state.isRefreshing = false
  }
}
