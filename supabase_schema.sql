
-- Tabelas para Supabase
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text unique not null
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references public.categorias(id) on delete cascade,
  titulo text not null,
  conteudo text not null
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  destinatario text not null,
  remetentes text[],
  endereco text not null,
  cidade text,
  dia date,
  hora time,
  link_musica_inicio text,
  link_musica_final text,
  mensagem text,
  categoria text,
  template_titulo text,
  valor numeric,
  pix_key text,
  status text default 'novo'
);

-- Habilitar Realtime no Supabase: configure a replicação para as tabelas acima.
