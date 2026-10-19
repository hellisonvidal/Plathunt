-- Recursos online do Plathunt (opcionais): perfis ligados ao ID da PSN,
-- curtidas compartilhadas e pedidos de boost enviados direto no app.
-- Só o Worker (src/index.ts) acessa o banco; cada rota só lê e grava os
-- dados de quem está logado.

create table profiles (
  account_id text primary key,
  online_id text not null,
  avatar_url text,
  updated_at text not null
);

create table likes (
  item_key text not null,
  owner_account_id text not null,
  liker_account_id text not null,
  reaction text not null,
  created_at text not null,
  primary key (item_key, liker_account_id, reaction)
);
create index likes_owner_idx on likes (owner_account_id, created_at);

create table boost_requests (
  id text primary key,
  from_account_id text not null,
  to_account_id text not null,
  payload text not null,
  status text not null default 'novo' check (status in ('novo', 'aceito', 'recusado')),
  created_at text not null
);
create index boost_requests_to_idx on boost_requests (to_account_id, created_at);
create index boost_requests_from_idx on boost_requests (from_account_id, created_at);
