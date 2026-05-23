interface ContentIdea {
  id: string
  title: string
  pain_point: string
  content_angle: string
  format_suggestion: string
  topic_tag: string | null
  estimated_performance: 'bajo' | 'medio' | 'alto' | 'viral'
  hooks: string[] | null
  source: string
  status: 'nueva' | 'en_proceso' | 'usada' | 'descartada'
  full_brief: string | null
  created_at: string
}

const PERF_STYLE: Record<string, string> = {
  bajo: 'bg-zinc-100 text-zinc-500',
  medio: 'bg-blue-50 text-blue-600',
  alto: 'bg-emerald-50 text-emerald-700',
  viral: 'bg-purple-50 text-purple-700',
}

const STATUS_STYLE: Record<string, string> = {
  nueva: 'bg-zinc-100 text-zinc-500',
  en_proceso: 'bg-yellow-50 text-yellow-700',
  usada: 'bg-green-50 text-green-700',
  descartada: 'bg-red-50 text-red-600',
}

const FORMAT_ICON: Record<string, string> = {
  reel: '▶',
  carrusel: '⊟',
  historia: '○',
  foto: '□',
}

interface Props {
  idea: ContentIdea
  onExpand: (id: string) => void
  onSendToChat: (id: string) => void
  onStatusChange: (id: string, status: ContentIdea['status']) => void
  expanded?: boolean
  brief?: string
  briefLoading?: boolean
}

export default function IdeaCard({
  idea,
  onExpand,
  onSendToChat,
  onStatusChange,
  expanded,
  brief,
  briefLoading,
}: Props) {
  return (
    <div className={`border rounded-xl bg-white transition-all ${expanded ? 'border-zinc-300 shadow-sm' : 'border-zinc-200 hover:border-zinc-300'}`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-sm shrink-0 text-zinc-500">
            {FORMAT_ICON[idea.format_suggestion] || '▶'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900 leading-snug">{idea.title}</p>
            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{idea.pain_point}</p>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${PERF_STYLE[idea.estimated_performance]}`}>
            {idea.estimated_performance}
          </span>
          <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_STYLE[idea.status]}`}>
            {idea.status}
          </span>
          {idea.topic_tag && (
            <span className="text-xs rounded-full px-2 py-0.5 bg-zinc-50 text-zinc-500 border border-zinc-200">
              {idea.topic_tag.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onExpand(idea.id)}
            className="flex-1 text-xs border border-zinc-200 text-zinc-600 rounded-lg py-1.5 hover:bg-zinc-50 transition-colors"
          >
            {expanded ? '▲ Cerrar' : '▼ Ver brief'}
          </button>
          <button
            onClick={() => onSendToChat(idea.id)}
            className="flex-1 text-xs bg-zinc-900 hover:bg-zinc-700 text-white rounded-lg py-1.5 transition-colors"
          >
            ✦ Generar guión
          </button>
        </div>
      </div>

      {/* Expanded brief */}
      {expanded && (
        <div className="border-t border-zinc-100 p-4">
          {briefLoading && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <div className="w-4 h-4 border-2 border-zinc-200 border-t-zinc-600 rounded-full animate-spin" />
              <span className="text-xs text-zinc-400">Generando brief...</span>
            </div>
          )}
          {brief && !briefLoading && (
            <div className="space-y-1">
              {brief.split('\n').map((line, i) => {
                if (line.startsWith('## ')) {
                  return <h4 key={i} className="text-xs font-semibold text-zinc-900 mt-3 mb-1">{line.slice(3)}</h4>
                }
                if (line.startsWith('**') && line.endsWith('**')) {
                  return <p key={i} className="text-xs font-medium text-zinc-700">{line.replace(/\*\*/g, '')}</p>
                }
                if (line.trim() === '') return <div key={i} className="h-1" />
                return <p key={i} className="text-xs text-zinc-600 leading-relaxed">{line}</p>
              })}
            </div>
          )}

          {/* Status change */}
          <div className="flex gap-1.5 mt-4 pt-3 border-t border-zinc-100">
            <span className="text-xs text-zinc-400 self-center mr-1">Estado:</span>
            {(['nueva', 'en_proceso', 'usada', 'descartada'] as const).map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(idea.id, s)}
                className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                  idea.status === s
                    ? STATUS_STYLE[s] + ' font-medium'
                    : 'border border-zinc-200 text-zinc-400 hover:bg-zinc-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
