-- Reforço de segurança dos recursos online.

-- 1. Nome e avatar vêm só da PSN (gravados pela função psn-login a cada
--    entrada): ninguém troca o próprio nome para se passar por outro jogador.
drop policy if exists "atualiza o próprio perfil" on public.profiles;
revoke update on public.profiles from authenticated, anon;

-- 2. Só quem entrou pela PSN (tem perfil confirmado) vê perfis e curtidas.
--    Uma conta criada direto no Supabase, sem passar pela PSN, não vê nada.
--    my_account_id() volta a ser security definer para ler o próprio perfil
--    sem passar pela regra que depende dela (evita recursão); só devolve o
--    accountId de quem chama.
alter function public.my_account_id() security definer;
alter function public.my_account_id() set search_path = '';
revoke execute on function public.my_account_id() from public, anon;
grant execute on function public.my_account_id() to authenticated;

alter policy "perfis visíveis para usuários do app" on public.profiles
  using ((select public.my_account_id()) is not null);
alter policy "curtidas visíveis" on public.likes
  using ((select public.my_account_id()) is not null);

-- 3. Limite de pedidos de boost: no máximo 30 por hora por jogador (evita spam).
create or replace function public.limit_boost_requests() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (
    select count(*) from public.boost_requests
    where from_account_id = new.from_account_id and created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'Limite de pedidos de boost por hora atingido.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.limit_boost_requests() from public, anon, authenticated;
drop trigger if exists boost_requests_limit on public.boost_requests;
create trigger boost_requests_limit before insert on public.boost_requests
  for each row execute function public.limit_boost_requests();
