export type PostFormat = 'reel' | 'carrusel' | 'historia' | 'foto'
export type PostStatus = 'borrador' | 'listo' | 'programado' | 'publicado'

export interface Post {
  id: string
  title: string
  caption: string | null
  script: string | null
  hooks: string[] | null
  format: PostFormat
  status: PostStatus
  scheduled_at: string | null
  published_at: string | null
  instagram_post_id: string | null
  media_url: string | null
  thumbnail_url: string | null
  tags: string[] | null
  ai_analysis: string | null
  ai_analyzed_at: string | null
  created_at: string
  updated_at: string
  metrics?: PostMetrics
}

export interface CompetitorPost {
  id: string
  competitor_id: string
  competitor_username: string
  caption: string | null
  hook_text: string | null
  post_type: string | null
  likes: number
  comments: number
  plays: number | null
  engagement_rate: number | null
  published_at: string | null
  ai_topic: string | null
  ai_hook_type: string | null
  ai_cta_type: string | null
  ai_content_gap: boolean
}

export interface PostMetrics {
  id: string
  post_id: string
  likes: number
  saves: number
  reach: number
  comments: number
  shares: number
  plays: number
  retention_rate: number | null
  collected_at: string
}

export interface WeeklyInsight {
  id: string
  week_start: string
  week_end: string
  total_posts: number
  avg_reach: number
  avg_saves: number
  top_post_id: string | null
  top_format: string | null
  top_hook_type: string | null
  recommendations: Recommendation[] | null
  raw_analysis: string | null
  created_at: string
}

export interface Recommendation {
  titulo: string
  descripcion: string
  accion: string
}

export interface Script {
  id: string
  title: string
  content: string
  hook: string | null
  format: PostFormat
  topic: string | null
  status: 'borrador' | 'aprobado' | 'usado'
  post_id: string | null
  created_at: string
}

export interface FileRecord {
  id: string
  name: string
  type: 'video' | 'image' | 'document'
  url: string
  storage_path: string
  size_bytes: number | null
  post_id: string | null
  created_at: string
}

export interface Notification {
  id: string
  post_id: string
  message: string
  type: 'publicar_ahora' | 'recordatorio' | 'analisis_listo'
  sent_at: string | null
  read_at: string | null
  created_at: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ContentContext {
  recentPosts: PostWithMetrics[]
  topPostsBySaves: PostWithMetrics[]
  latestInsight: WeeklyInsight | null
  pendingPosts: Post[]
  analyzedPosts: PostWithMetrics[]
  competitorPosts: CompetitorPost[]
}

export interface PostWithMetrics extends Omit<Post, 'metrics'> {
  metrics: PostMetrics | null
}
