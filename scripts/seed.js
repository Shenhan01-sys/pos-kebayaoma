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

async function seed() {
  console.log('Seeding database...')

  // 1. Insert categories
  console.log('Inserting categories...')
  const { data: catData, error: catError } = await supabase
    .from('categories')
    .upsert([
      { store_id: STORE_ID, name: 'Kebaya', slug: 'kebaya' },
      { store_id: STORE_ID, name: 'Kain Batik', slug: 'batik' },
      { store_id: STORE_ID, name: 'Aksesoris', slug: 'accessories' }
    ], { onConflict: 'store_id,slug' })
    .select()

  if (catError) {
    console.error('Categories error:', catError.message)
    return
  }
  console.log('✓ Categories inserted:', catData.length)

  // Create category map
  const catMap = {}
  catData.forEach(c => { catMap[c.slug] = c.id })

  // 2. Insert products
  console.log('Inserting products...')
  const products = [
    {
      store_id: STORE_ID,
      sku: 'KBY-2024-001',
      name: 'Kebaya Modern Pink',
      description: 'Kebaya modern cut dengan brokat halus, cocok untuk acara semi-formal hingga pesta.',
      category_id: catMap['kebaya'],
      images: ['https://placehold.co/400x500/831843/ffffff?text=Kebaya+Pink'],
      tags: ['modern', 'pink', 'pesta'],
      active: true,
      fabric: 'Brokat & satin',
      care: 'Cuci kering disarankan. Setrika suhu rendah.'
    },
    {
      store_id: STORE_ID,
      sku: 'KBY-2024-002',
      name: 'Kebaya Encim Biru',
      description: 'Kebaya encim khas dengan motif tulisan, nuansa biru elegan.',
      category_id: catMap['kebaya'],
      images: ['https://placehold.co/400x500/831843/ffffff?text=Kebaya+Biru'],
      tags: ['encim', 'biru', 'traditional'],
      active: true,
      fabric: 'Sutra & katun',
      care: 'Cuci tangan dengan deterjen lembut.'
    }
  ]

  const { data: prodData, error: prodError } = await supabase
    .from('products')
    .upsert(products, { onConflict: 'store_id,sku' })
    .select()

  if (prodError) {
    console.error('Products error:', prodError.message)
    return
  }
  console.log('✓ Products inserted:', prodData.length)

  // Create product map by SKU
  const prodMap = {}
  prodData.forEach(p => { prodMap[p.sku] = p.id })

  // 3. Insert variants
  console.log('Inserting variants...')
  const variants = [
    {
      product_id: prodMap['KBY-2024-001'],
      sku: 'KBY-2024-001-S-PINK',
      size: 'S',
      color: 'Pink',
      color_code: '#ec4899',
      stock: 5,
      selling_price: 450000,
      cost_price: 280000,
      barcode: '8995501S'
    },
    {
      product_id: prodMap['KBY-2024-001'],
      sku: 'KBY-2024-001-M-PINK',
      size: 'M',
      color: 'Pink',
      color_code: '#ec4899',
      stock: 3,
      selling_price: 450000,
      cost_price: 280000,
      barcode: '8995501M'
    },
    {
      product_id: prodMap['KBY-2024-002'],
      sku: 'KBY-2024-002-M-BLUE',
      size: 'M',
      color: 'Blue',
      color_code: '#3b82f6',
      stock: 8,
      selling_price: 520000,
      cost_price: 310000,
      barcode: '8995502M'
    }
  ]

  const { data: varData, error: varError } = await supabase
    .from('variants')
    .upsert(variants, { onConflict: 'product_id,sku' })
    .select()

  if (varError) {
    console.error('Variants error:', varError.message)
    return
  }
  console.log('✓ Variants inserted:', varData.length)

  console.log('Seeding complete!')
}

seed().catch(err => console.error('Seed error:', err.message))
