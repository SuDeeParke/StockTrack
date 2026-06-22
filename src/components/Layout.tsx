import { NavLink, Outlet } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: '信号看板', enabled: true },
  { to: '/backtest', label: '策略回测', enabled: true },
  { to: '/trade', label: '交易', enabled: true },
]

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-zinc-950 flex-col md:flex-row">
      <nav className="hidden md:flex w-52 flex-shrink-0 flex-col gap-1 border-r border-zinc-800 p-4">
        <div className="mb-6 px-2">
          <span className="font-mono text-lg font-bold text-zinc-50">
            StockTrack
          </span>
          <div className="mt-0.5 text-xs text-zinc-500">
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
                `relative flex items-center rounded-sm px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'text-zinc-50 font-medium before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:rounded-full before:bg-zinc-50'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`
              }
            >
              {label}
            </NavLink>
          ) : (
            <span
              key={to}
              className="cursor-not-allowed rounded-sm px-3 py-2 text-sm text-zinc-700"
            >
              {label}
            </span>
          ),
        )}
      </nav>

      <main className="flex-1 overflow-auto p-6 pb-20 md:pb-6">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 flex md:hidden border-t border-zinc-800 bg-zinc-950">
        {NAV_ITEMS.filter((item) => item.enabled).map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex flex-1 flex-col items-center justify-center py-2 text-xs gap-0.5 min-h-[52px]',
                isActive ? 'text-zinc-50' : 'text-zinc-500',
              ].join(' ')
            }
          >
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
 
