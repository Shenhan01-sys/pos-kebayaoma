import { column, Schema, Table } from "@powersync/web";

// ============================================================================
// PowerSync Schema — mirror dari Supabase schema
// ============================================================================

const categories = new Table({
  id: column.text,
  store_id: column.text,
  name: column.text,
  slug: column.text,
});

const products = new Table({
  id: column.text,
  store_id: column.text,
  sku: column.text,
  name: column.text,
  description: column.text,
  category_id: column.text,
  images: column.text,
  tags: column.text,
  active: column.integer,
  fabric: column.text,
  care: column.text,
  season: column.text,
  brand: column.text,
  compare_at: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const variants = new Table({
  id: column.text,
  product_id: column.text,
  sku: column.text,
  size: column.text,
  color: column.text,
  color_code: column.text,
  stock: column.integer,
  selling_price: column.real,
  cost_price: column.real,
  barcode: column.text,
});

const customers = new Table({
  id: column.text,
  store_id: column.text,
  name: column.text,
  phone: column.text,
  email: column.text,
  address: column.text,
  birthday: column.text,
  notes: column.text,
  tags: column.text,
  total_purchases: column.real,
  visit_count: column.integer,
});

const staff = new Table({
  id: column.text,
  store_id: column.text,
  user_id: column.text,
  name: column.text,
  role: column.text,
  phone: column.text,
  active: column.integer,
});

const transactions = new Table({
  id: column.text,
  store_id: column.text,
  number: column.text,
  cashier: column.text,
  customer_id: column.text,
  customer_name: column.text,
  status: column.text,
  payment_method: column.text,
  payment_status: column.text,
  subtotal: column.real,
  tax: column.real,
  discount: column.real,
  total: column.real,
  amount_paid: column.real,
  change: column.real,
  qris_ref: column.text,
  photo_proof: column.text,
  created_at: column.text,
});

const transaction_items = new Table({
  id: column.text,
  transaction_id: column.text,
  product_id: column.text,
  variant_id: column.text,
  name: column.text,
  sku: column.text,
  size: column.text,
  color: column.text,
  quantity: column.integer,
  unit_price: column.real,
  discount: column.real,
  total: column.real,
});

const stock_movements = new Table({
  id: column.text,
  store_id: column.text,
  variant_id: column.text,
  sku: column.text,
  product_name: column.text,
  type: column.text,
  quantity: column.integer,
  reason: column.text,
  note: column.text,
  staff: column.text,
  created_at: column.text,
});

const shifts = new Table({
  id: column.text,
  store_id: column.text,
  staff_name: column.text,
  opened_at: column.text,
  closed_at: column.text,
  starting_cash: column.real,
  ending_cash: column.real,
  total_transactions: column.integer,
  total_sales: column.real,
  total_qris: column.real,
  total_cash: column.real,
  status: column.text,
});

export const schema = new Schema({
  categories,
  products,
  variants,
  customers,
  staff,
  transactions,
  transaction_items,
  stock_movements,
  shifts,
});
