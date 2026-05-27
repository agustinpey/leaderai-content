-- Agrega columna ai_analysis a posts para guardar el feedback de "Analizar Reel"
alter table posts add column if not exists ai_analysis text;
alter table posts add column if not exists ai_analyzed_at timestamptz;
