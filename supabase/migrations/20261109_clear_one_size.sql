-- 20261109_clear_one_size.sql (SUDAH diterapkan via MCP ke produksi 2026-11-09 sebagai "clear_one_size")
-- Hapus info "One Size" (210 varian + 79 baris nota); nilai lama dicadangkan di backup.one_size_20261109
-- (schema backup, bukan schema API). Default kolom variants.size jadi '' agar varian baru tak ber-"One Size".
-- Pulihkan: update public.variants v set size = b.old_size from backup.one_size_20261109 b where b.tbl='variants' and b.id=v.id;

create schema if not exists backup;
revoke all on schema backup from anon, authenticated;

create table if not exists backup.one_size_20261109 (
  tbl text not null,
  id uuid not null,
  old_size text,
  primary key (tbl, id)
);

insert into backup.one_size_20261109 (tbl, id, old_size)
select 'variants', id, size from public.variants
 where lower(btrim(size)) in ('one size', 'onesize')
on conflict do nothing;

insert into backup.one_size_20261109 (tbl, id, old_size)
select 'transaction_items', id, size from public.transaction_items
 where lower(btrim(coalesce(size, ''))) in ('one size', 'onesize')
on conflict do nothing;

update public.variants set size = ''
 where lower(btrim(size)) in ('one size', 'onesize');

update public.transaction_items set size = ''
 where lower(btrim(coalesce(size, ''))) in ('one size', 'onesize');

alter table public.variants alter column size set default '';
