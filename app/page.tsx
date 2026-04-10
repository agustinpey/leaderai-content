import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

async function getDashboardData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [postsResult, insightResult, pendingResult, notifResult] = await Promise.all([
    supabaseAdmin
      .from('posts')
      .select('*, metrics:post_metrics(*)')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(5),

    supabaseAdmin
      .from('weekly_insights')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(1)
      .single(),

    supabaseAdmin
      .from('posts')
      .select('*')
      .in('status', ['programado'])
      .order('scheduled_at', { ascending: true })
      .limit(3),

    supabaseAdmin
      .from('notifications')
      .select('*, post:posts(title)')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return {
    recentPosts: postsResult.data || [],
    insight: insightResult.error ? null : insightResult.data,
    upcomingPosts: pendingResult.data || [],
    notifications: notifResult.data || [],
  }
}

export default async function DashboardPage() {
  const { recentPosts, insight, upcomingPosts, notifications } = await getDashboardData()

  const publishedPosts = recentPosts.filter((p: any) => p.status === 'publicado')
  const avgSaves =
    publishedPosts.length > 0
      ? Math.round(
          publishedPosts.reduce((acc: number, p: any) => acc + (p.metrics?.saves || 0), 0) /
            publishedPosts.length
        )
      : 0
  const avgReach =
    publishedPosts.length > 0
      ? Math.round(
          publishedPosts.reduce((acc: number, p: any) => acc + (p.metrics?.reach || 0), 0) /
            publishedPosts.length
        )
      : 0

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        </p>
      </div>

      {/* Notificaciones pendientes */}
      {notifications.length > 0 && (
        <div className="mb-6 space-y-2">
          {notifications.map((n: any) => (
            <div
              key={n.id}
              className="flex items-center gap-3 bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-3"
            >
              <span className="text-white text-sm">●</span>
              <div>
                <p className="text-sm text-zinc-200">{n.message}</p>
                {n.post && (
                  <p className="text-xs text-zinc-500 mt-0.5">Post: {n.post.title}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Posts este mes', value: recentPosts.length },
          { label: 'Avg. reach', value: avgReach.toLocaleString() },
          { label: 'Avg. saves', value: avgSaves },
          { label: 'Programados', value: upcomingPosts.length },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="text-2xl font-semibold text-zinc-100">{stat.value}</div>
            <div className="text-xs text-zinc-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Posts recientes */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-100">Posts recientes</h2>
            <Link href="/library" className="text-xs text-zinc-500 hover:text-zinc-300">
              Ver todos →
            </Link>
          </div>
          <div className="space-y-3">
            {recentPosts.length === 0 && (
              <p className="text-xs text-zinc-600">No hay posts aún</p>
            )}
            {recentPosts.map((post: any) => (
              <div key={post.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{post.title}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {post.format} ·{' '}
                    <span
                      className={
                        post.status === 'publicado'
                          ? 'text-green-500'
                          : post.status === 'programado'
                          ? 'text-blue-400'
                          : 'text-zinc-500'
                      }
                    >
                      {post.status}
                    </span>
                  </p>
                </div>
                {post.metrics && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-zinc-400">{post.metrics.saves} saves</p>
                    <p className="text-xs text-zinc-600">{post.metrics.reach} reach</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Última recomendación semanal */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-100">Análisis semanal</h2>
            <Link href="/analytics" className="text-xs text-zinc-500 hover:text-zinc-300">
              Ver completo →
            </Link>
          </div>
          {!insight ? (
            <p className="text-xs text-zinc-600">
              El análisis se genera cada lunes a las 8am automáticamente.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500">
                Semana del {format(new Date(insight.week_start), 'dd/MM')} al{' '}
                {format(new Date(insight.week_end), 'dd/MM')} · {insight.total_posts} posts
              </p>
              {insight.recommendations?.slice(0, 2).map((rec: any, i: number) => (
                <div key={i} className="border-l-2 border-zinc-700 pl-3">
                  <p className="text-sm text-zinc-200 font-medium">{rec.titulo}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{rec.descripcion}</p>
                </div>
              ))}
            </div>
          )}

          {/* Quick actions */}
          <div className="mt-5 pt-4 border-t border-zinc-800 grid grid-cols-2 gap-2">
            <Link
              href="/chat"
              className="text-center text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg py-2.5 transition-colors"
            >
              ✦ Generar guión
            </Link>
            <Link
              href="/calendar"
              className="text-center text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg py-2.5 transition-colors"
            >
              ▦ Programar post
            </Link>
          </div>
        </div>
      </div>

      {/* Próximos a publicar */}
      {upcomingPosts.length > 0 && (
        <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-zinc-100 mb-4">Próximos a publicar</h2>
          <div className="grid grid-cols-3 gap-3">
            {upcomingPosts.map((post: any) => (
              <div key={post.id} className="bg-zinc-800/60 rounded-lg p-3">
                <p className="text-sm text-zinc-200 font-medium truncate">{post.title}</p>
                <p className="text-xs text-zinc-500 mt-1">{post.format}</p>
                {post.scheduled_at && (
                  <p className="text-xs text-blue-400 mt-1">
                    {format(new Date(post.scheduled_at), 'dd/MM HH:mm')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
