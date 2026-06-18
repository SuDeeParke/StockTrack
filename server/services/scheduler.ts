import cron from 'node-cron'
import { refreshSignals } from './data-cache.js'

let started = false

export function startScheduler(): void {
  if (started) return
  started = true

  // Refresh signals every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('[scheduler] Refreshing signals...')
    await refreshSignals()
    console.log('[scheduler] Signals refreshed.')
  })

  // Daily health log at 09:00
  cron.schedule('0 9 * * *', () => {
    console.log('[scheduler] Daily health check — server running.')
  })

  console.log('[scheduler] 2 cron jobs registered.')
}
