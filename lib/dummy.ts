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
  {
    id: "p6",
    sku: "KBY-2024-006",
    name: "Kebaya Sogan Coklat",
    description: "Kebaya sogan khas Yogyakarta dengan warna coklat alami, anggun untuk acara adat.",
    categoryId: "cat-kebaya",
    images: [img("Kebaya Sogan")],
    tags: ["sogan", "coklat", "adat"],
    active: true,
    fabric: "Katun soga",
    care: "Cuci tangan dengan deterjen lembut.",
    variants: [
      {
        id: "v10",
        sku: "KBY-2024-006-M-SOGAN",
        size: "M",
        color: "Sogan",
        colorCode: "#92400e",
        stock: 7,
        sellingPrice: 480000,
        costPrice: 290000,
        barcode: "8995506M",
      },
    ],
  },
  {
    id: "p7",
    sku: "ACC-2024-022",
    name: "Selop Brokat",
    description: "Selop brokat dengan hiasan payet, pelengkap serasi untuk kebaya.",
    categoryId: "cat-accessories",
    images: [img("Selop Brokat")],
    tags: ["selop", "brokat"],
    active: true,
    fabric: "Brokat",
    care: "Lap dengan kain lembap.",
    variants: [
      {
        id: "v11",
        sku: "ACC-2024-022-ONE",
        size: "One Size",
        color: "Gold",
        colorCode: "#d4af37",
        stock: 15,
        sellingPrice: 120000,
        costPrice: 60000,
        barcode: "8995522O",
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
    number: "TRX-20250110-001",
    cashier: "Ani",
    customerName: "Siti",
    status: "paid",
    paymentMethod: "qris",
    paymentStatus: "paid",
    subtotal: 900000,
    tax: 108000,
    discount: 0,
    total: 1008000,
    amountPaid: 1008000,
    change: 0,
    createdAt: "2025-01-10T10:12:00+07:00",
    qrisRef: "QRIS-XND-9f2a",
    items: [
      { productId: "p1", variantId: "v2", name: "Kebaya Modern Pink", sku: "KBY-2024-001-M-PINK", size: "M", color: "Pink", quantity: 2, unitPrice: 450000, discount: 0, total: 900000 },
    ],
  },
  {
    id: "t2",
    number: "TRX-20250110-002",
    cashier: "Budi",
    customerName: "Dewi",
    status: "paid",
    paymentMethod: "cash",
    paymentStatus: "paid",
    subtotal: 850000,
    tax: 102000,
    discount: 0,
    total: 952000,
    amountPaid: 1000000,
    change: 48000,
    createdAt: "2025-01-10T13:40:00+07:00",
    items: [
      { productId: "p3", variantId: "v6", name: "Kain Batik Tulis Parang", sku: "BTK-2024-010-ONE", size: "One Size", color: "Coklat", quantity: 1, unitPrice: 850000, discount: 0, total: 850000 },
    ],
  },
  {
    id: "t3",
    number: "TRX-20250111-003",
    cashier: "Ani",
    customerName: "Siti",
    status: "paid",
    paymentMethod: "qris",
    paymentStatus: "paid",
    subtotal: 520000,
    tax: 62400,
    discount: 0,
    total: 582400,
    amountPaid: 582400,
    change: 0,
    createdAt: "2025-01-11T09:30:00+07:00",
    qrisRef: "QRIS-XND-1a3b",
    items: [
      { productId: "p2", variantId: "v4", name: "Kebaya Encim Biru", sku: "KBY-2024-002-M-BLUE", size: "M", color: "Blue", quantity: 1, unitPrice: 520000, discount: 0, total: 520000 },
    ],
  },
  {
    id: "t4",
    number: "TRX-20250111-004",
    cashier: "Ani",
    customerName: "Rina",
    status: "paid",
    paymentMethod: "cash",
    paymentStatus: "paid",
    subtotal: 390000,
    tax: 46800,
    discount: 0,
    total: 436800,
    amountPaid: 450000,
    change: 13200,
    createdAt: "2025-01-11T15:05:00+07:00",
    items: [
      { productId: "p5", variantId: "v8", name: "Kebaya Kutubaru Cream", sku: "KBY-2024-003-S-CREAM", size: "S", color: "Cream", quantity: 1, unitPrice: 390000, discount: 0, total: 390000 },
    ],
  },
  {
    id: "t5",
    number: "TRX-20250112-005",
    cashier: "Budi",
    customerName: "Dewi",
    status: "paid",
    paymentMethod: "transfer",
    paymentStatus: "paid",
    subtotal: 450000,
    tax: 54000,
    discount: 0,
    total: 504000,
    amountPaid: 504000,
    change: 0,
    createdAt: "2025-01-12T11:20:00+07:00",
    items: [
      { productId: "p4", variantId: "v7", name: "Selendang Sutra", sku: "ACC-2024-021-ONE", size: "One Size", color: "Gold", quantity: 3, unitPrice: 150000, discount: 0, total: 450000 },
    ],
  },
  {
    id: "t6",
    number: "TRX-20250112-006",
    cashier: "Ani",
    customerName: "Siti",
    status: "paid",
    paymentMethod: "qris",
    paymentStatus: "paid",
    subtotal: 450000,
    tax: 54000,
    discount: 0,
    total: 504000,
    amountPaid: 504000,
    change: 0,
    createdAt: "2025-01-12T16:45:00+07:00",
    qrisRef: "QRIS-XND-7c9d",
    items: [
      { productId: "p1", variantId: "v1", name: "Kebaya Modern Pink", sku: "KBY-2024-001-S-PINK", size: "S", color: "Pink", quantity: 1, unitPrice: 450000, discount: 0, total: 450000 },
    ],
  },
  {
    id: "t7",
    number: "TRX-20250113-007",
    cashier: "Budi",
    customerName: "Dewi",
    status: "paid",
    paymentMethod: "cash",
    paymentStatus: "paid",
    subtotal: 1040000,
    tax: 124800,
    discount: 0,
    total: 1164800,
    amountPaid: 1200000,
    change: 35200,
    createdAt: "2025-01-13T10:05:00+07:00",
    items: [
      { productId: "p2", variantId: "v5", name: "Kebaya Encim Biru", sku: "KBY-2024-002-L-BLUE", size: "L", color: "Blue", quantity: 2, unitPrice: 520000, discount: 0, total: 1040000 },
    ],
  },
  {
    id: "t8",
    number: "TRX-20250113-008",
    cashier: "Budi",
    customerName: "Siti",
    status: "paid",
    paymentMethod: "transfer",
    paymentStatus: "paid",
    subtotal: 1700000,
    tax: 204000,
    discount: 0,
    total: 1904000,
    amountPaid: 1904000,
    change: 0,
    createdAt: "2025-01-13T18:30:00+07:00",
    items: [
      { productId: "p3", variantId: "v6", name: "Kain Batik Tulis Parang", sku: "BTK-2024-010-ONE", size: "One Size", color: "Coklat", quantity: 2, unitPrice: 850000, discount: 0, total: 1700000 },
    ],
  },
  {
    id: "t9",
    number: "TRX-20250114-009",
    cashier: "Ani",
    customerName: "Siti",
    status: "paid",
    paymentMethod: "qris",
    paymentStatus: "paid",
    subtotal: 390000,
    tax: 46800,
    discount: 0,
    total: 436800,
    amountPaid: 436800,
    change: 0,
    createdAt: "2025-01-14T09:15:00+07:00",
    qrisRef: "QRIS-XND-2e4f",
    items: [
      { productId: "p5", variantId: "v9", name: "Kebaya Kutubaru Cream", sku: "KBY-2024-003-M-CREAM", size: "M", color: "Cream", quantity: 1, unitPrice: 390000, discount: 0, total: 390000 },
    ],
  },
  {
    id: "t10",
    number: "TRX-20250114-010",
    cashier: "Ani",
    customerName: "Rina",
    status: "paid",
    paymentMethod: "cash",
    paymentStatus: "paid",
    subtotal: 300000,
    tax: 36000,
    discount: 0,
    total: 336000,
    amountPaid: 350000,
    change: 14000,
    createdAt: "2025-01-14T14:50:00+07:00",
    items: [
      { productId: "p4", variantId: "v7", name: "Selendang Sutra", sku: "ACC-2024-021-ONE", size: "One Size", color: "Gold", quantity: 2, unitPrice: 150000, discount: 0, total: 300000 },
    ],
  },
  {
    id: "t11",
    number: "TRX-20250115-011",
    cashier: "Budi",
    customerName: "Dewi",
    status: "paid",
    paymentMethod: "qris",
    paymentStatus: "paid",
    subtotal: 450000,
    tax: 54000,
    discount: 50000,
    total: 454000,
    amountPaid: 454000,
    change: 0,
    createdAt: "2025-01-15T10:12:00+07:00",
    qrisRef: "QRIS-XND-9f2a",
    items: [
      { productId: "p1", variantId: "v2", name: "Kebaya Modern Pink", sku: "KBY-2024-001-M-PINK", size: "M", color: "Pink", quantity: 1, unitPrice: 450000, discount: 50000, total: 400000 },
    ],
  },
  {
    id: "t12",
    number: "TRX-20250115-012",
    cashier: "Ani",
    customerName: "Siti",
    status: "paid",
    paymentMethod: "cash",
    paymentStatus: "paid",
    subtotal: 480000,
    tax: 57600,
    discount: 0,
    total: 537600,
    amountPaid: 550000,
    change: 12400,
    createdAt: "2025-01-15T13:40:00+07:00",
    items: [
      { productId: "p6", variantId: "v10", name: "Kebaya Sogan Coklat", sku: "KBY-2024-006-M-SOGAN", size: "M", color: "Sogan", quantity: 1, unitPrice: 480000, discount: 0, total: 480000 },
    ],
  },
  {
    id: "t13",
    number: "TRX-20250116-013",
    cashier: "Budi",
    customerName: "Dewi",
    status: "paid",
    paymentMethod: "transfer",
    paymentStatus: "paid",
    subtotal: 520000,
    tax: 62400,
    discount: 0,
    total: 582400,
    amountPaid: 582400,
    change: 0,
    createdAt: "2025-01-16T11:00:00+07:00",
    items: [
      { productId: "p2", variantId: "v4", name: "Kebaya Encim Biru", sku: "KBY-2024-002-M-BLUE", size: "M", color: "Blue", quantity: 1, unitPrice: 520000, discount: 0, total: 520000 },
    ],
  },
  {
    id: "t14",
    number: "TRX-20250116-014",
    cashier: "Ani",
    customerName: "Siti",
    status: "paid",
    paymentMethod: "qris",
    paymentStatus: "paid",
    subtotal: 780000,
    tax: 93600,
    discount: 0,
    total: 873600,
    amountPaid: 873600,
    change: 0,
    createdAt: "2025-01-16T17:25:00+07:00",
    qrisRef: "QRIS-XND-4b6c",
    items: [
      { productId: "p5", variantId: "v8", name: "Kebaya Kutubaru Cream", sku: "KBY-2024-003-S-CREAM", size: "S", color: "Cream", quantity: 2, unitPrice: 390000, discount: 0, total: 780000 },
    ],
  },
  {
    id: "t15",
    number: "TRX-20250117-015",
    cashier: "Budi",
    customerName: "Dewi",
    status: "paid",
    paymentMethod: "cash",
    paymentStatus: "paid",
    subtotal: 850000,
    tax: 102000,
    discount: 0,
    total: 952000,
    amountPaid: 1000000,
    change: 48000,
    createdAt: "2025-01-17T10:40:00+07:00",
    items: [
      { productId: "p3", variantId: "v6", name: "Kain Batik Tulis Parang", sku: "BTK-2024-010-ONE", size: "One Size", color: "Coklat", quantity: 1, unitPrice: 850000, discount: 0, total: 850000 },
    ],
  },
  {
    id: "t16",
    number: "TRX-20250117-016",
    cashier: "Ani",
    customerName: "Dewi",
    status: "paid",
    paymentMethod: "qris",
    paymentStatus: "paid",
    subtotal: 150000,
    tax: 18000,
    discount: 0,
    total: 168000,
    amountPaid: 168000,
    change: 0,
    createdAt: "2025-01-17T15:55:00+07:00",
    qrisRef: "QRIS-XND-8d1e",
    items: [
      { productId: "p4", variantId: "v7", name: "Selendang Sutra", sku: "ACC-2024-021-ONE", size: "One Size", color: "Gold", quantity: 1, unitPrice: 150000, discount: 0, total: 150000 },
    ],
  },
  {
    id: "t17",
    number: "TRX-20250118-017",
    cashier: "Budi",
    customerName: "Siti",
    status: "paid",
    paymentMethod: "transfer",
    paymentStatus: "paid",
    subtotal: 900000,
    tax: 108000,
    discount: 0,
    total: 1008000,
    amountPaid: 1008000,
    change: 0,
    createdAt: "2025-01-18T09:50:00+07:00",
    items: [
      { productId: "p1", variantId: "v1", name: "Kebaya Modern Pink", sku: "KBY-2024-001-S-PINK", size: "S", color: "Pink", quantity: 2, unitPrice: 450000, discount: 0, total: 900000 },
    ],
  },
  {
    id: "t18",
    number: "TRX-20250118-018",
    cashier: "Ani",
    customerName: "Rina",
    status: "paid",
    paymentMethod: "cash",
    paymentStatus: "paid",
    subtotal: 120000,
    tax: 14400,
    discount: 0,
    total: 134400,
    amountPaid: 150000,
    change: 15600,
    createdAt: "2025-01-18T16:10:00+07:00",
    items: [
      { productId: "p7", variantId: "v11", name: "Selop Brokat", sku: "ACC-2024-022-ONE", size: "One Size", color: "Gold", quantity: 1, unitPrice: 120000, discount: 0, total: 120000 },
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
