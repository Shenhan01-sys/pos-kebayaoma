import { safeJson } from "@/lib/safe-json";
import type {
  Product,
  Variant,
  Category,
  Customer,
  Transaction,
  TransactionItem,
  Shift,
  Role,
} from "@/lib/dummy";

export function mapVariantRow(v: Record<string, any>): Variant {
  return {
    id: v.id,
    sku: v.sku,
    name: v.name,
    size: v.size,
    color: v.color,
    colorCode: v.color_code,
    sellingPrice: Number(v.selling_price),
    costPrice: Number(v.cost_price ?? 0),
    barcode: v.barcode,
  };
}

export function mapProductRow(p: Record<string, any>, variants: Variant[]): Product {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    categoryId: p.category_id,
    images: p.images || [],
    tags: p.tags || [],
    active: Boolean(p.active),
    stock: p.stock ?? 0,
    fabric: p.fabric,
    care: p.care,
    season: p.season ?? undefined,
    brand: p.brand ?? undefined,
    compareAt: p.compare_at ?? undefined,
    variants,
  };
}

export function mapCategoryRow(c: Record<string, any>): Category {
  return { id: c.id, name: c.name, slug: c.slug };
}

export function mapCustomerRow(c: Record<string, any>): Customer {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    totalPurchases: Number(c.total_purchases ?? 0),
    visitCount: Number(c.visit_count ?? 0),
    email: c.email ?? undefined,
    address: c.address ?? undefined,
    birthday: c.birthday ?? undefined,
    notes: c.notes ?? undefined,
    tags: Array.isArray(c.tags) ? c.tags : safeJson(c.tags, []),
  };
}

export function mapStaffRow(s: Record<string, any>): { id: string; name: string; role: Role; phone: string | undefined; active: boolean } {
  return {
    id: s.id,
    name: s.name,
    role: s.role,
    phone: s.phone ?? undefined,
    active: Boolean(s.active),
  };
}

export function mapTransactionItemRow(i: Record<string, any>): TransactionItem {
  return {
    productId: i.product_id,
    variantId: i.variant_id,
    name: i.name,
    sku: i.sku,
    size: i.size,
    color: i.color,
    quantity: Number(i.quantity),
    unitPrice: Number(i.unit_price),
    costPrice: Number(i.cost_price ?? 0),
    discount: Number(i.discount ?? 0),
    total: Number(i.total),
  };
}

export function mapTransactionRow(t: Record<string, any>, items: TransactionItem[]): Transaction {
  return {
    id: t.id,
    number: t.number,
    cashier: t.cashier,
    customerId: t.customer_id ?? undefined,
    customerName: t.customer_name ?? undefined,
    status: t.status,
    paymentMethod: t.payment_method,
    paymentStatus: t.payment_status,
    subtotal: Number(t.subtotal),
    tax: Number(t.tax ?? 0),
    discount: Number(t.discount ?? 0),
    total: Number(t.total),
    amountPaid: Number(t.amount_paid ?? 0),
    change: Number(t.change ?? 0),
    qrisRef: t.qris_ref ?? undefined,
    photoProof: t.photo_proof ?? undefined,
    createdAt: t.created_at,
    items,
  };
}

export function mapShiftRow(s: Record<string, any>): Shift {
  return {
    id: s.id,
    staff_name: s.staff_name,
    opened_at: s.opened_at,
    closed_at: s.closed_at ?? undefined,
    startingCash: Number(s.starting_cash),
    endingCash: s.ending_cash != null ? Number(s.ending_cash) : undefined,
    totalTransactions: Number(s.total_transactions ?? 0),
    totalSales: Number(s.total_sales ?? 0),
    totalQris: Number(s.total_qris ?? 0),
    totalCash: Number(s.total_cash ?? 0),
    status: s.status,
  };
}
