// Row types that mirror the Supabase schema (see KiloCode/supabase/20250806_init.sql).
// These intentionally match the shapes already used in lib/dummy.ts so the
// Zustand stores can be swapped to Supabase with minimal UI changes.

export type Role = "manager" | "staff";

export interface StoreRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  tax_rate: number; // percent
  is_default: boolean;
  created_at: string;
}

export interface CategoryRow {
  id: string;
  store_id: string;
  name: string;
  slug: string;
}

export interface VariantRow {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  color_code: string | null;
  selling_price: number;
  cost_price: number;
  barcode: string | null;
}

export interface ProductRow {
  id: string;
  store_id: string;
  sku: string;
  name: string;
  description: string | null;
  category_id: string | null;
  images: string[] | null;
  tags: string[] | null;
  active: boolean;
  stock: number;
  fabric: string | null;
  care: string | null;
  season: string | null;
  brand: string | null;
  compare_at: number | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerRow {
  id: string;
  store_id: string;
  name: string;
  phone: string | null;
  total_purchases: number;
  visit_count: number;
}

export type PaymentMethod = "qris" | "cash" | "transfer" | "shopee";
export type TransactionStatus = "pending" | "paid" | "cancelled" | "refunded";
export type PaymentStatus = "pending" | "paid" | "failed" | "expired";

export interface TransactionItemRow {
  id: string;
  transaction_id: string;
  product_id: string;
  variant_id: string;
  name: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount: number;
  total: number;
}

export interface TransactionRow {
  id: string;
  store_id: string;
  number: string;
  cashier: string;
  customer_id: string | null;
  customer_name: string | null;
  status: TransactionStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amount_paid: number;
  change: number;
  qris_ref: string | null;
  created_at: string;
}

export type MovementType = "sale" | "restock" | "adjustment" | "return" | "transfer";

export interface StockMovementRow {
  id: string;
  store_id: string;
  variant_id: string;
  sku: string;
  product_name: string;
  type: MovementType;
  quantity: number; // signed (+ in / - out)
  reason: string | null;
  note: string | null;
  staff: string;
  created_at: string;
}

export interface StaffRow {
  id: string;
  store_id: string;
  name: string;
  role: Role;
  phone: string | null;
  active: boolean;
  user_id: string | null; // Supabase Auth user; PIN = password akun ini (lihat 20250809_auth_pin.sql)
}

export type ShiftStatus = "open" | "closed" | "reconciled";

export interface ShiftRow {
  id: string;
  store_id: string;
  staff_name: string;
  opened_at: string;
  closed_at: string | null;
  starting_cash: number;
  ending_cash: number | null;
  total_transactions: number;
  total_sales: number;
  total_qris: number;
  total_cash: number;
  status: ShiftStatus;
}

export interface QrLabelRow {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  qr_data: string;
  label_template: Record<string, unknown> | null;
  is_printed: boolean;
  printed_at: string | null;
  created_at: string;
}
