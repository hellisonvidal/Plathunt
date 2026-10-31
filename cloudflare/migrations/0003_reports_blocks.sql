-- Conteúdo gerado pelos usuários (recado dos pedidos de boost): denúncias e
-- bloqueios, como pede a política da Google Play.
create table reports (
  id text primary key,
  reporter_account_id text not null,
  reported_account_id text not null,
  request_id text,
  reason text not null,
  created_at text not null
);
create index reports_reported_idx on reports (reported_account_id, created_at);

-- Quem bloqueou quem: o servidor não entrega pedidos de quem foi bloqueado.
create table blocks (
  blocker_account_id text not null,
  blocked_account_id text not null,
  created_at text not null,
  primary key (blocker_account_id, blocked_account_id)
);
