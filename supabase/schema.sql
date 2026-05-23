-- LeaderAI Content App — Supabase Schema
-- Run this in the Supabase SQL editor

-- Posts: cada pieza de contenido (Reels, carruseles, etc.)
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  caption text,
  script text,
  hooks text[], -- array of hook options
  format text check (format in ('reel', 'carrusel', 'historia', 'foto')) default 'reel',
  status text check (status in ('borrador', 'listo', 'programado', 'publicado')) default 'borrador',
  scheduled_at timestamptz,
  published_at timestamptz,
  instagram_post_id text unique,
  media_url text,
  thumbnail_url text,
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Métricas de cada post (se cargan 24h+ después de publicar)
create table if not exists post_metrics (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  likes integer default 0,
  saves integer default 0,
  reach integer default 0,
  comments integer default 0,
  shares integer default 0,
  plays integer default 0, -- para Reels
  retention_rate numeric(5,2), -- porcentaje de retención promedio
  collected_at timestamptz default now()
);

-- Insights semanales generados por el cron de Claude
create table if not exists weekly_insights (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  total_posts integer default 0,
  avg_reach integer default 0,
  avg_saves integer default 0,
  top_post_id uuid references posts(id),
  top_format text,
  top_hook_type text,
  recommendations jsonb, -- array de {titulo, descripcion, accion}
  raw_analysis text, -- respuesta completa de Claude
  created_at timestamptz default now()
);

-- Guiones guardados en la biblioteca
create table if not exists scripts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  hook text,
  format text check (format in ('reel', 'carrusel', 'historia', 'foto')) default 'reel',
  topic text,
  status text check (status in ('borrador', 'aprobado', 'usado', 'pendiente', 'hecho', 'rehacer')) default 'pendiente',
  post_id uuid references posts(id),
  source_idea_id uuid,
  created_at timestamptz default now()
);

-- Archivos subidos (videos, imágenes, guiones en PDF)
create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null, -- 'video', 'image', 'document'
  url text not null,
  storage_path text not null,
  size_bytes bigint,
  post_id uuid references posts(id),
  created_at timestamptz default now()
);

-- Notificaciones de publicación
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  message text not null,
  type text check (type in ('publicar_ahora', 'recordatorio', 'analisis_listo')) default 'publicar_ahora',
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz default now()
);

-- Índices para performance
create index if not exists idx_posts_status on posts(status);
create index if not exists idx_posts_scheduled_at on posts(scheduled_at);
create index if not exists idx_post_metrics_post_id on post_metrics(post_id);
create index if not exists idx_weekly_insights_week_start on weekly_insights(week_start desc);

-- Trigger para actualizar updated_at en posts
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger posts_updated_at
  before update on posts
  for each row execute function update_updated_at();

-- RLS: habilitar (configurar políticas según tu auth setup)
alter table posts enable row level security;
alter table post_metrics enable row level security;
alter table weekly_insights enable row level security;
alter table scripts enable row level security;
alter table files enable row level security;
alter table notifications enable row level security;

-- Política temporal: acceso total (ajustar si agregás auth de usuario)
create policy "allow all" on posts for all using (true) with check (true);
create policy "allow all" on post_metrics for all using (true) with check (true);
create policy "allow all" on weekly_insights for all using (true) with check (true);
create policy "allow all" on scripts for all using (true) with check (true);
create policy "allow all" on files for all using (true) with check (true);
create policy "allow all" on notifications for all using (true) with check (true);

-- ==========================================
-- MÓDULO: COMPETIDORES
-- ==========================================

create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text,
  niche text default 'ai_sales',
  follower_count integer,
  avg_engagement_rate numeric(6,4),
  last_scraped_at timestamptz,
  active boolean default true,
  notes text,
  created_at timestamptz default now()
);

create table if not exists competitor_posts (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid references competitors(id) on delete cascade,
  apify_post_id text unique,
  instagram_url text,
  caption text,
  hook_text text,
  hashtags text[],
  post_type text check (post_type in ('reel', 'carrusel', 'foto')),
  likes integer default 0,
  comments integer default 0,
  plays integer,
  estimated_saves integer,
  engagement_rate numeric(6,4),
  published_at timestamptz,
  scraped_at timestamptz default now(),
  ai_topic text,
  ai_hook_type text,
  ai_cta_type text,
  ai_content_gap boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_competitors_active on competitors(active);
create index if not exists idx_competitor_posts_competitor on competitor_posts(competitor_id);
create index if not exists idx_competitor_posts_gap on competitor_posts(ai_content_gap) where ai_content_gap = true;

alter table competitors enable row level security;
alter table competitor_posts enable row level security;
create policy "allow all" on competitors for all using (true) with check (true);
create policy "allow all" on competitor_posts for all using (true) with check (true);

-- ==========================================
-- MÓDULO: BANCO DE IDEAS (INTELLIGENCE)
-- ==========================================

create table if not exists content_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  pain_point text not null,
  content_angle text not null,
  why_now text,
  format_suggestion text check (format_suggestion in ('reel', 'carrusel', 'historia', 'foto')) default 'reel',
  topic_tag text,
  estimated_performance text check (estimated_performance in ('bajo', 'medio', 'alto', 'viral')) default 'medio',
  estimated_save_rate numeric(5,2),
  hooks text[],
  source text check (source in ('competitor_gap', 'own_performance', 'niche_research', 'manual')) default 'niche_research',
  status text check (status in ('nueva', 'en_proceso', 'usada', 'descartada')) default 'nueva',
  full_brief text,
  brief_generated_at timestamptz,
  sent_to_chat_at timestamptz,
  converted_to_post_id uuid references posts(id),
  actual_save_rate numeric(5,2),
  generation_batch_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists intelligence_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text check (run_type in ('weekly', 'manual', 'competitor_only')) default 'manual',
  status text check (status in ('running', 'completed', 'failed')) default 'running',
  competitors_scraped integer default 0,
  competitor_posts_found integer default 0,
  ideas_generated integer default 0,
  own_posts_analyzed integer default 0,
  winning_posts_count integer default 0,
  saves_threshold numeric(5,2),
  error_message text,
  started_at timestamptz default now(),
  completed_at timestamptz
);

create index if not exists idx_content_ideas_status on content_ideas(status);
create index if not exists idx_content_ideas_topic on content_ideas(topic_tag);
create index if not exists idx_content_ideas_batch on content_ideas(generation_batch_id);

create trigger content_ideas_updated_at
  before update on content_ideas
  for each row execute function update_updated_at();

alter table content_ideas enable row level security;
alter table intelligence_runs enable row level security;
create policy "allow all" on content_ideas for all using (true) with check (true);
create policy "allow all" on intelligence_runs for all using (true) with check (true);
