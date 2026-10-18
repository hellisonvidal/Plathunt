-- Recursos online do Plathunt (opcionais): perfis ligados ao ID da PSN,
-- curtidas compartilhadas e pedidos de boost enviados direto no app.
-- A identidade PSN é confirmada pela função psn-login; o app só lê e grava
-- o que as regras abaixo (RLS) permitem.

create table public.profiles (
  account_id text primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  online_id text not null,
  avatar_url text,
  updated_at timestamptz not null default now()
);

-- accountId da PSN de quem está logado (null se não estiver).
create function public.my_account_id() returns text
language sql stable security definer set search_path = ''
as $$ select account_id from public.profiles where user_id = (select auth.uid()) $$;

create table public.likes (
  id bigint generated always as identity primary key,
  item_key text not null check (char_length(item_key) <= 200),
  owner_account_id text not null,
  liker_account_id text not null references public.profiles (account_id) on delete cascade,
  reaction text not null check (char_length(reaction) <= 16),
  created_at timestamptz not null default now(),
  unique (item_key, liker_account_id, reaction)
);
create index likes_item_key_idx on public.likes (item_key);
create index likes_owner_idx on public.likes (owner_account_id, created_at desc);

create table public.boost_requests (
  id uuid primary key default gen_random_uuid(),
  from_account_id text not null references public.profiles (account_id) on delete cascade,
  to_account_id text not null,
  payload jsonb not null check (pg_column_size(payload) <= 8000),
  status text not null default 'novo' check (status in ('novo', 'aceito', 'recusado')),
  created_at timestamptz not null default now()
);
create index boost_requests_to_idx on public.boost_requests (to_account_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.likes enable row level security;
alter table public.boost_requests enable row level security;

-- Perfis: qualquer usuário logado vê quem usa o app (para achar amigos);
-- cada um só altera o próprio. A criação é feita pela função psn-login.
create policy "perfis visíveis para usuários do app" on public.profiles
  for select to authenticated using (true);
create policy "atualiza o próprio perfil" on public.profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Curtidas: visíveis para usuários do app; cada um cria e apaga só as suas.
create policy "curtidas visíveis" on public.likes
  for select to authenticated using (true);
create policy "curte em nome próprio" on public.likes
  for insert to authenticated with check (liker_account_id = (select public.my_account_id()));
create policy "descurte as próprias" on public.likes
  for delete to authenticated using (liker_account_id = (select public.my_account_id()));

-- Pedidos de boost: só remetente e destinatário veem; só o remetente envia;
-- só o destinatário muda o status (aceitar/recusar); remetente pode apagar.
create policy "pedidos de quem envia ou recebe" on public.boost_requests
  for select to authenticated using (
    from_account_id = (select public.my_account_id()) or to_account_id = (select public.my_account_id())
  );
create policy "envia pedidos em nome próprio" on public.boost_requests
  for insert to authenticated with check (
    from_account_id = (select public.my_account_id()) and to_account_id <> from_account_id
  );
create policy "destinatário responde" on public.boost_requests
  for update to authenticated using (to_account_id = (select public.my_account_id()))
  with check (to_account_id = (select public.my_account_id()));
create policy "remetente apaga" on public.boost_requests
  for delete to authenticated using (from_account_id = (select public.my_account_id()));

revoke execute on function public.my_account_id() from anon;

-- Colunas que o app pode alterar: o destinatário só muda o status; o perfil só nome e avatar.
revoke update on public.boost_requests from authenticated, anon;
grant update (status) on public.boost_requests to authenticated;
revoke update on public.profiles from authenticated, anon;
grant update (online_id, avatar_url, updated_at) on public.profiles to authenticated;
revoke insert on public.profiles from authenticated, anon;

-- (aplicado em seguida) A função só lê o próprio perfil, que o usuário logado já pode ler.
alter function public.my_account_id() security invoker;
revoke execute on function public.my_account_id() from public, anon;
grant execute on function public.my_account_id() to authenticated;
