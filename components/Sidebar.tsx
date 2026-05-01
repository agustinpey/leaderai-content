'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/', label: 'Dashboard', icon: '⊞' },
  { href: '/chat', label: 'Chat con Claude', icon: '✦' },
  { href: '/calendar', label: 'Calendario', icon: '▦' },
  { href: '/library', label: 'Biblioteca', icon: '⊟' },
  { href: '/analytics', label: 'Analytics', icon: '◈' },
  { href: '/analyze', label: 'Analizar Reel', icon: '▶' },
  { href: '/settings', label: 'Integraciones', icon: '⚙' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-zinc-50 border-r border-zinc-200 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-200">
        <span className="text-sm font-semibold text-zinc-900 tracking-wide">LeaderAI</span>
        <span className="ml-1.5 text-xs text-zinc-400">content</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-zinc-900 text-white font-medium'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-200">
        <div className="text-xs text-zinc-400">Agustín / LeaderAI</div>
      </div>
    </aside>
  )
}
