-- ============================================================
-- 20260912_cost_price_null_sentinel.sql
-- KOREKSI weak point #3: sentinel `= 0` pada trigger set_item_cost_price()
-- menggabungkan "harga modal tidak diketahui" dengan "modal memang nol".
-- Sekarang: cost_price NULL = belum terisi (trigger isi dari variant);
-- nilai eksplisit dihormati apa adanya.
-- ============================================================

-- 1. Kolom jadi nullable, tanpa default 0
ALTER TABLE public.transaction_items
 ALTER COLUMN cost_price DROP DEFAULT,
 ALTER COLUMN cost_price DROP NOT NULL;

-- 2. Trigger hanya mengisi saat NULL (bukan saat 0)
CREATE OR REPLACE FUNCTION public.set_item_cost_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
 IF NEW.cost_price IS NULL THEN
 SELECT v.cost_price INTO NEW.cost_price
 FROM public.variants v
 WHERE v.id = NEW.variant_id;
 END IF;
 RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_item_cost_price() FROM anon, authenticated;
