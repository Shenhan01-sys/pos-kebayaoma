export type Role = "admin" | "manager" | "cashier";

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Variant {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorCode: string;
  stock: number;
  sellingPrice: number;
  costPrice: number;
  barcode?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  images: string[];
  tags: string[];
  active: boolean;
  variants: Variant[];
  fabric: string;
  care: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  totalPurchases: number;
  visitCount: number;
}

export type PaymentMethod = "qris" | "cash" | "transfer";
export type TransactionStatus = "pending" | "paid" | "cancelled" | "refunded";

export interface TransactionItem {
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface Transaction {
  id: string;
  number: string;
  cashier: string;
  customerId?: string;
  customerName?: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: "pending" | "paid" | "failed" | "expired";
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amountPaid: number;
  change: number;
  items: TransactionItem[];
  createdAt: string;
  qrisRef?: string;
}

export interface Shift {
  id: string;
  user: string;
  start: string;
  end?: string;
  startingCash: number;
  endingCash?: number;
  totalTransactions: number;
  totalSales: number;
  totalQris: number;
  totalCash: number;
  status: "open" | "closed" | "reconciled";
}

export const BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : "https://kebaya-oma.id";

export const categories: Category[] = [
  { id: "cat-kebaya", name: "Kebaya", slug: "kebaya" },
  { id: "cat-batik", name: "Kain Batik", slug: "batik" },
  { id: "cat-accessories", name: "Aksesoris", slug: "accessories" },
];

function img(emoji: string): string {
  return `https://placehold.co/400x500/831843/ffffff?text=${encodeURIComponent(emoji)}`;
}

export const products: Product[] = [
  {
    id: "p1",
    sku: "KBY-2024-001",
    name: "Kebaya Modern Pink",
    description:
      "Kebaya modern cut dengan brokat halus, cocok untuk acara semi-formal hingga pesta.",
    categoryId: "cat-kebaya",
    images: [img("Kebaya Pink"), img("Detail")],
    tags: ["modern", "pink", "pesta"],
    active: true,
    fabric: "Brokat & satin",
    care: "Cuci kering disarankan. Setrika suhu rendah.",
    variants: [
      {
        id: "v1",
        sku: "KBY-2024-001-S-PINK",
        size: "S",
        color: "Pink",
        colorCode: "#ec4899",
        stock: 5,
        sellingPrice: 450000,
        costPrice: 280000,
        barcode: "8995501S",
      },
      {
        id: "v2",
        sku: "KBY-2024-001-M-PINK",
        size: "M",
        color: "Pink",
        colorCode: "#ec4899",
        stock: 3,
        sellingPrice: 450000,
        costPrice: 280000,
        barcode: "8995501M",
      },
      {
        id: "v3",
        sku: "KBY-2024-001-L-PINK",
        size: "L",
        color: "Pink",
        colorCode: "#ec4899",
        stock: 0,
        sellingPrice: 450000,
        costPrice: 280000,
        barcode: "8995501L",
      },
    ],
  },
  {
    id: "p2",
    sku: "KBY-2024-002",
    name: "Kebaya Encim Biru",
    description: "Kebaya encim khas dengan motif tulisan, nuansa biru elegan.",
    categoryId: "cat-kebaya",
    images: [img("Kebaya Biru")],
    tags: ["encim", "biru", "traditional"],
    active: true,
    fabric: "Sutra & katun",
    care: "Cuci tangan dengan deterjen lembut.",
    variants: [
      {
        id: "v4",
        sku: "KBY-2024-002-M-BLUE",
        size: "M",
        color: "Blue",
        colorCode: "#3b82f6",
        stock: 8,
        sellingPrice: 520000,
        costPrice: 310000,
        barcode: "8995502M",
      },
      {
        id: "v5",
        sku: "KBY-2024-002-L-BLUE",
        size: "L",
        color: "Blue",
        colorCode: "#3b82f6",
        stock: 4,
        sellingPrice: 520000,
        costPrice: 310000,
        barcode: "8995502L",
      },
    ],
  },
  {
    id: "p3",
    sku: "BTK-2024-010",
    name: "Kain Batik Tulis Parang",
    description: "Kain batik tulis motif parang, pewarnaan alami.",
    categoryId: "cat-batik",
    images: [img("Batik Parang")],
    tags: ["batik-tulis", "parang"],
    active: true,
    fabric: "Katun primisima",
    care: "Cuci terpisah, hindari sinar matahari langsung.",
    variants: [
      {
        id: "v6",
        sku: "BTK-2024-010-ONE",
        size: "One Size",
        color: "Coklat",
        colorCode: "#92400e",
        stock: 12,
        sellingPrice: 850000,
        costPrice: 500000,
        barcode: "8995510O",
      },
    ],
  },
  {
    id: "p4",
    sku: "ACC-2024-021",
    name: "Selendang Sutra",
    description: "Selendang sutra dengan ujung rumbai, melengkapi set kebaya.",
    categoryId: "cat-accessories",
    images: [img("Selendang")],
    tags: ["selendang", "sutra"],
    active: true,
    fabric: "Sutra",
    care: "Cuci kering.",
    variants: [
      {
        id: "v7",
        sku: "ACC-2024-021-ONE",
        size: "One Size",
        color: "Gold",
        colorCode: "#d4af37",
        stock: 20,
        sellingPrice: 150000,
        costPrice: 70000,
        barcode: "8995521O",
      },
    ],
  },
  {
    id: "p5",
    sku: "KBY-2024-003",
    name: "Kebaya Kutubaru Cream",
    description: "Kebaya kutubaru dengan dasar krem, serbaguna untuk harian.",
    categoryId: "cat-kebaya",
    images: [img("Kebaya Cream")],
    tags: ["kutubaru", "cream", "daily"],
    active: true,
    fabric: "Katun jacquard",
    care: "Cuci mesin dengan mode lembut.",
    variants: [
      {
        id: "v8",
        sku: "KBY-2024-003-S-CREAM",
        size: "S",
        color: "Cream",
        colorCode: "#fef3c7",
        stock: 6,
        sellingPrice: 390000,
        costPrice: 240000,
        barcode: "8995503S",
      },
      {
        id: "v9",
        sku: "KBY-2024-003-M-CREAM",
        size: "M",
        color: "Cream",
        colorCode: "#fef3c7",
        stock: 7,
        sellingPrice: 390000,
        costPrice: 240000,
        barcode: "8995503M",
      },
    ],
  },
];

export const customers: Customer[] = [
  { id: "c1", name: "Siti", phone: "0812-3456-7890", totalPurchases: 1250000, visitCount: 3 },
  { id: "c2", name: "Dewi", phone: "0821-9988-7766", totalPurchases: 870000, visitCount: 2 },
];

export const transactions: Transaction[] = [
  {
    id: "t1",
    number: "TRX-20250115-001",
    cashier: "Ani",
    customerName: "Siti",
    status: "paid",
    paymentMethod: "qris",
    paymentStatus: "paid",
    subtotal: 900000,
    tax: 0,
    discount: 0,
    total: 900000,
    amountPaid: 900000,
    change: 0,
    createdAt: "2025-01-15T10:12:00+07:00",
    qrisRef: "QRIS-XND-9f2a",
    items: [
      {
        productId: "p1",
        variantId: "v2",
        name: "Kebaya Modern Pink",
        sku: "KBY-2024-001-M-PINK",
        size: "M",
        color: "Pink",
        quantity: 2,
        unitPrice: 450000,
        discount: 0,
        total: 900000,
      },
    ],
  },
  {
    id: "t2",
    number: "TRX-20250115-002",
    cashier: "Budi",
    customerName: "Dewi",
    status: "paid",
    paymentMethod: "cash",
    paymentStatus: "paid",
    subtotal: 850000,
    tax: 0,
    discount: 0,
    total: 850000,
    amountPaid: 1000000,
    change: 150000,
    createdAt: "2025-01-15T13:40:00+07:00",
    items: [
      {
        productId: "p3",
        variantId: "v6",
        name: "Kain Batik Tulis Parang",
        sku: "BTK-2024-010-ONE",
        size: "One Size",
        color: "Coklat",
        quantity: 1,
        unitPrice: 850000,
        discount: 0,
        total: 850000,
      },
    ],
  },
];

export const shifts: Shift[] = [
  {
    id: "s1",
    user: "Ani",
    start: "2025-01-15T09:00:00+07:00",
    startingCash: 500000,
    totalTransactions: 14,
    totalSales: 6750000,
    totalQris: 4200000,
    totalCash: 2550000,
    status: "open",
  },
];

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function getProductBySku(sku: string): Product | undefined {
  return products.find((p) => p.sku === sku);
}

export function categoryName(id: string): string {
  return categories.find((c) => c.id === id)?.name ?? "—";
}
