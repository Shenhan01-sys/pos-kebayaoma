import { createClient } from '@supabase/supabase-js'
import { categories, products, customers, transactions, shifts } from '../lib/dummy'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function seed() {
  console.log('Seeding database...')
  console.log('Store ID:', STORE_ID)

  // 1. Insert categories
  console.log('Inserting categories...')
  const { error: catError } = await supabase
    .from('categories')
    .upsert(
      categories.map(c => ({
        id: c.id,
        store_id: STORE_ID,
        name: c.name,
        slug: c.slug
      })),
      { onConflict: 'id' }
    )
  if (catError) console.error('Categories error:', catError)
  else console.log('Categories inserted')

  // 2. Insert products
  console.log('Inserting products...')
  const { error: prodError } = await supabase
    .from('products')
    .upsert(
      products.map(p => ({
        id: p.id,
        store_id: STORE_ID,
        sku: p.sku,
        name: p.name,
        description: p.description,
        category_id: p.categoryId,
        images: p.images,
        tags: p.tags,
        active: p.active,
        fabric: p.fabric,
        care: p.care,
        stock: p.stock
      })),
      { onConflict: 'id' }
    )
  if (prodError) console.error('Products error:', prodError)
  else console.log('Products inserted')

  // 3. Insert variants
  console.log('Inserting variants...')
  const allVariants = products.flatMap(p => p.variants.map(v => ({
    id: v.id,
    product_id: p.id,
    sku: v.sku,
    name: v.name,
    size: v.size,
    color: v.color,
    color_code: v.colorCode,
    selling_price: v.sellingPrice,
    cost_price: v.costPrice,
    barcode: v.barcode
  })))

  const { error: varError } = await supabase
    .from('variants')
    .upsert(allVariants, { onConflict: 'id' })
  if (varError) console.error('Variants error:', varError)
  else console.log('Variants inserted')

  // 4. Insert customers
  console.log('Inserting customers...')
  const { error: custError } = await supabase
    .from('customers')
    .upsert(
      customers.map(c => ({
        id: c.id,
        store_id: STORE_ID,
        name: c.name,
        phone: c.phone,
        total_purchases: c.totalPurchases,
        visit_count: c.visitCount
      })),
      { onConflict: 'id' }
    )
  if (custError) console.error('Customers error:', custError)
  else console.log('Customers inserted')

  // 5. Insert transactions
  console.log('Inserting transactions...')
  const { error: txError } = await supabase
    .from('transactions')
    .upsert(
      transactions.map(t => ({
        id: t.id,
        store_id: STORE_ID,
        number: t.number,
        cashier: t.cashier,
        customer_id: t.customerId,
        customer_name: t.customerName,
        status: t.status,
        payment_method: t.paymentMethod,
        payment_status: t.paymentStatus,
        subtotal: t.subtotal,
        tax: t.tax,
        discount: t.discount,
        total: t.total,
        amount_paid: t.amountPaid,
        change: t.change,
        qris_ref: t.qrisRef,
        created_at: t.createdAt
      })),
      { onConflict: 'id' }
    )
  if (txError) console.error('Transactions error:', txError)
  else console.log('Transactions inserted')

  // 6. Insert transaction items
  console.log('Inserting transaction items...')
  const allItems = transactions.flatMap(t =>
    t.items.map(item => ({
      id: `${t.id}-${item.variantId}`,
      transaction_id: t.id,
      product_id: item.productId,
      variant_id: item.variantId,
      name: item.name,
      sku: item.sku,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount: item.discount,
      total: item.total
    }))
  )

  const { error: itemError } = await supabase
    .from('transaction_items')
    .upsert(allItems, { onConflict: 'id' })
  if (itemError) console.error('Transaction items error:', itemError)
  else console.log('Transaction items inserted')

  // 7. Insert shifts
  console.log('Inserting shifts...')
  const { error: shiftError } = await supabase
    .from('shifts')
    .upsert(
      shifts.map(s => ({
        id: s.id,
        store_id: STORE_ID,
        staff_name: s.staff_name,
        opened_at: s.opened_at,
        closed_at: s.closed_at,
        starting_cash: s.startingCash,
        ending_cash: s.endingCash,
        total_transactions: s.totalTransactions,
        total_sales: s.totalSales,
        total_qris: s.totalQris,
        total_cash: s.totalCash,
        status: s.status
      })),
      { onConflict: 'id' }
    )
  if (shiftError) console.error('Shifts error:', shiftError)
  else console.log('Shifts inserted')

  console.log('Seeding complete!')
}

seed().catch(console.error)
