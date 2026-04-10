import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'LeaderAI Content',
  description: 'Workspace de contenido para Agustín / LeaderAI',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-zinc-950 text-zinc-100 flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </body>
    </html>
  )
}
