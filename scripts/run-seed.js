require('dotenv').config({ path: '../.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID

console.log('Environment check:')
console.log('SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓' : '✗')
console.log('STORE_ID:', STORE_ID ? '✓' : '✗')

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !STORE_ID) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Dummy data (simplified for JS)
const categories = [
  { id: 'cat-kebaya', name: 'Kebaya', slug: 'kebaya' },
  { id: 'cat-batik', name: 'Kain Batik', slug: 'batik' },
  { id: 'cat-accessories', name: 'Aksesoris', slug: 'accessories' }
]

const products = [
  {
    id: 'p1', sku: 'KBY-2024-001', name: 'Kebaya Modern Pink',
    description: 'Kebaya modern cut dengan brokat halus',
    categoryId: 'cat-kebaya', images: [], tags: ['modern'], active: true,
    fabric: 'Brokat', care: 'Dry clean',
    variants: [
      { id: 'v1', sku: 'KBY-2024-001-S-PINK', size: 'S', color: 'Pink', colorCode: '#ec4899', stock: 5, sellingPrice: 450000, costPrice: 280000, barcode: '8995501S' },
      { id: 'v2', sku: 'KBY-2024-001-M-PINK', size: 'M', color: 'Pink', colorCode: '#ec4899', stock: 3, sellingPrice: 450000, costPrice: 280000, barcode: '8995501M' }
    ]
  },
  {
    id: 'p2', sku: 'KBY-2024-002', name: 'Kebaya Encim Biru',
    description: 'Kebaya encim khas',
    categoryId: 'cat-kebaya', images: [], tags: ['encim'], active: true,
    fabric: 'Sutra', care: 'Hand wash',
    variants: [
      { id: 'v4', sku: 'KBY-2024-002-M-BLUE', size: 'M', color: 'Blue', colorCode: '#3b82f6', stock: 8, sellingPrice: 520000, costPrice: 310000, barcode: '8995502M' }
    ]
  }
]

async function seed() {
  console.log('Seeding database...')

  // Insert categories
  console.log('Inserting categories...')
  const { error: catError } = await supabase
    .from('categories')
    .upsert(categories.map(c => ({ id: c.id, store_id: STORE_ID, name: c.name, slug: c.slug })), { onConflict: 'id' })

  if (catError) console.error('Categories error:', catError.message)
  else console.log('✓ Categories inserted')

  // Insert products
  console.log('Inserting products...')
  const { error: prodError } = await supabase
    .from('products')
    .upsert(products.map(p => ({
      id: p.id, store_id: STORE_ID, sku: p.sku, name: p.name,
      description: p.description, category_id: p.categoryId,
      images: p.images, tags: p.tags, active: p.active,
      fabric: p.fabric, care: p.care
    })), { onConflict: 'id' })

  if (prodError) console.error('Products error:', prodError.message)
  else console.log('✓ Products inserted')

  // Insert variants
  console.log('Inserting variants...')
  const variants = products.flatMap(p => p.variants.map(v => ({
    id: v.id, product_id: p.id, sku: v.sku, size: v.size,
    color: v.color, color_code: v.colorCode, stock: v.stock,
    selling_price: v.sellingPrice, cost_price: v.costPrice, barcode: v.barcode
  })))

  const { error: varError } = await supabase
    .from('variants')
    .upsert(variants, { onConflict: 'id' })

  if (varError) console.error('Variants error:', varError.message)
  else console.log('✓ Variants inserted')

  console.log('Seeding complete!')
}

seed().catch(err => console.error('Seed error:', err.message))
