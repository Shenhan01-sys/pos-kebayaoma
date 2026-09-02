-- ============================================================
-- 20260902_add_item_cost_price.sql
-- KOREKSI: Harga TETAP di variant (bukan pindah ke product).
-- Produk = nama umum (Kebaya, Kain, Batik, ...). Variant = detail
-- (Kebaya P, Kain Viscose, ...) — pemegang selling_price + cost_price.
-- Hanya transaction_items yang dapat snapshot cost_price (kolom "Cost"
-- / E di laporan Excel Cik Glory) supaya laporan tahu margin per baris
-- meskipun harga variant berubah di kemudian hari.
-- ============================================================

-- 1. Snapshot harga modal per baris item transaksi
ALTER TABLE public.transaction_items
  ADD COLUMN IF NOT EXISTS cost_price numeric(12,2) NOT NULL DEFAULT 0;

-- 2. Backfill riwayat transaction_items dari harga variant saat ini
UPDATE public.transaction_items ti
SET cost_price = coalesce(v.cost_price, 0)
FROM public.variants v
WHERE v.id = ti.variant_id
  AND ti.cost_price = 0;

-- 3. Trigger auto-snapshot: jika FE insert item tanpa cost_price,
--    isi otomatis dari variants.cost_price
CREATE OR REPLACE FUNCTION public.set_item_cost_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cost_price IS NULL OR NEW.cost_price = 0 THEN
    SELECT v.cost_price INTO NEW.cost_price
    FROM public.variants v
    WHERE v.id = NEW.variant_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_item_cost_price ON public.transaction_items;
CREATE TRIGGER trg_item_cost_price
  BEFORE INSERT ON public.transaction_items
  FOR EACH ROW EXECUTE FUNCTION public.set_item_cost_price();

-- 4. Keamanan: revoke EXECUTE function trigger dari publik
--    (konsisten dengan 20260830_stock_to_product.sql)
REVOKE EXECUTE ON FUNCTION public.set_item_cost_price() FROM anon, authenticated;
