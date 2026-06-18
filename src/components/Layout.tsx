import { NavLink, Outlet } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: '信号看板', enabled: true },
  { to: '/stock/600519.SH', label: '个股详情', enabled: true },
  { to: '/backtest', label: '策略回测', enabled: true },
  { to: '/trade', label: '交易', enabled: true },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <nav
        className="w-52 flex-shrink-0 flex flex-col gap-1 border-r p-4"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="mb-6 px-2">
          <span className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
            StockTrack
          </span>
          <div className="mt-0.5 text-xs" style={{ color: 'var(--color-muted)' }}>
            量化交易指挥台
          </div>
        </div>
        {NAV_ITEMS.map(({ to, label, enabled }) =>
          enabled ? (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm transition-colors ${
                  isActive ? 'font-semibold' : 'hover:opacity-80'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? 'var(--color-primary)22' : 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
              })}
            >
              {label}
            </NavLink>
          ) : (
            <span
              key={to}
              className="cursor-not-allowed rounded px-3 py-2 text-sm"
              style={{ color: 'var(--color-muted)' }}
            >
              {label}
            </span>
          ),
        )}
      </nav>

      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
