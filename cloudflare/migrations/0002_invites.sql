-- Convites de boost com link curto (https://…/c/<id>) para mandar no WhatsApp:
-- o pedido fica guardado aqui e o link leva só o código.
create table invites (
  id text primary key,
  from_account_id text not null,
  payload text not null,
  created_at text not null
);
create index invites_from_idx on invites (from_account_id, created_at);
