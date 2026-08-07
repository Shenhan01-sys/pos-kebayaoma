require('dotenv').config({ path: '../.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !STORE_ID) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function seed() {
  console.log('Seeding database with full dummy data...')

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

  if (catError) { console.error('Categories error:', catError.message); return }
  console.log('✓ Categories inserted')

  const catMap = {}
  catData.forEach(c => { catMap[c.name] = c.id })

  // 2. Insert products and variants
  console.log('Inserting products...')
  const products = [
    {
      sku: 'KBY-2024-001', name: 'Kebaya Modern Pink',
      description: 'Kebaya modern cut dengan brokat halus, cocok untuk acara semi-formal hingga pesta.',
      category_id: catMap['Kebaya'], images: ['https://placehold.co/400x500/831843/ffffff?text=Kebaya+Pink'],
      tags: ['modern', 'pink', 'pesta'], fabric: 'Brokat & satin',
      care: 'Cuci kering disarankan. Setrika suhu rendah.',
      variants: [
        { sku: 'KBY-2024-001-S-PINK', size: 'S', color: 'Pink', color_code: '#ec4899', stock: 5, selling_price: 450000, cost_price: 280000, barcode: '8995501S' },
        { sku: 'KBY-2024-001-M-PINK', size: 'M', color: 'Pink', color_code: '#ec4899', stock: 3, selling_price: 450000, cost_price: 280000, barcode: '8995501M' },
        { sku: 'KBY-2024-001-L-PINK', size: 'L', color: 'Pink', color_code: '#ec4899', stock: 0, selling_price: 450000, cost_price: 280000, barcode: '8995501L' }
      ]
    },
    {
      sku: 'KBY-2024-002', name: 'Kebaya Encim Biru',
      description: 'Kebaya encim khas dengan motif tulisan, nuansa biru elegan.',
      category_id: catMap['Kebaya'], images: ['https://placehold.co/400x500/831843/ffffff?text=Kebaya+Biru'],
      tags: ['encim', 'biru', 'traditional'], fabric: 'Sutra & katun',
      care: 'Cuci tangan dengan deterjen lembut.',
      variants: [
        { sku: 'KBY-2024-002-M-BLUE', size: 'M', color: 'Blue', color_code: '#3b82f6', stock: 8, selling_price: 520000, cost_price: 310000, barcode: '8995502M' },
        { sku: 'KBY-2024-002-L-BLUE', size: 'L', color: 'Blue', color_code: '#3b82f6', stock: 4, selling_price: 520000, cost_price: 310000, barcode: '8995502L' }
      ]
    },
    {
      sku: 'BTK-2024-010', name: 'Kain Batik Tulis Parang',
      description: 'Kain batik tulis motif parang, pewarnaan alami.',
      category_id: catMap['Kain Batik'], images: ['https://placehold.co/400x500/831843/ffffff?text=Batik+Parang'],
      tags: ['batik-tulis', 'parang'], fabric: 'Katun primisima',
      care: 'Cuci terpisah, hindari sinar matahari langsung.',
      variants: [
        { sku: 'BTK-2024-010-ONE', size: 'One Size', color: 'Coklat', color_code: '#92400e', stock: 12, selling_price: 850000, cost_price: 500000, barcode: '8995510O' }
      ]
    },
    {
      sku: 'ACC-2024-021', name: 'Selendang Sutra',
      description: 'Selendang sutra dengan ujung rumbai, melengkapi set kebaya.',
      category_id: catMap['Aksesoris'], images: ['https://placehold.co/400x500/831843/ffffff?text=Selendang'],
      tags: ['selendang', 'sutra'], fabric: 'Sutra', care: 'Cuci kering.',
      variants: [
        { sku: 'ACC-2024-021-ONE', size: 'One Size', color: 'Gold', color_code: '#d4af37', stock: 20, selling_price: 150000, cost_price: 70000, barcode: '8995521O' }
      ]
    },
    {
      sku: 'KBY-2024-003', name: 'Kebaya Kutubaru Cream',
      description: 'Kebaya kutubaru dengan dasar krem, serbaguna untuk harian.',
      category_id: catMap['Kebaya'], images: ['https://placehold.co/400x500/831843/ffffff?text=Kebaya+Cream'],
      tags: ['kutubaru', 'cream', 'daily'], fabric: 'Katun jacquard',
      care: 'Cuci mesin dengan mode lembut.',
      variants: [
        { sku: 'KBY-2024-003-S-CREAM', size: 'S', color: 'Cream', color_code: '#fef3c7', stock: 6, selling_price: 390000, cost_price: 240000, barcode: '8995503S' },
        { sku: 'KBY-2024-003-M-CREAM', size: 'M', color: 'Cream', color_code: '#fef3c7', stock: 7, selling_price: 390000, cost_price: 240000, barcode: '8995503M' }
      ]
    },
    {
      sku: 'KBY-2024-006', name: 'Kebaya Sogan Coklat',
      description: 'Kebaya sogan khas Yogyakarta dengan warna coklat alami, anggun untuk acara adat.',
      category_id: catMap['Kebaya'], images: ['https://placehold.co/400x500/831843/ffffff?text=Kebaya+Sogan'],
      tags: ['sogan', 'coklat', 'adat'], fabric: 'Katun soga',
      care: 'Cuci tangan dengan deterjen lembut.',
      variants: [
        { sku: 'KBY-2024-006-M-SOGAN', size: 'M', color: 'Sogan', color_code: '#92400e', stock: 7, selling_price: 480000, cost_price: 290000, barcode: '8995506M' }
      ]
    },
    {
      sku: 'ACC-2024-022', name: 'Selop Brokat',
      description: 'Selop brokat dengan hiasan payet, pelengkap serasi untuk kebaya.',
      category_id: catMap['Aksesoris'], images: ['https://placehold.co/400x500/831843/ffffff?text=Selop+Brokat'],
      tags: ['selop', 'brokat'], fabric: 'Brokat', care: 'Lap dengan kain lembap.',
      variants: [
        { sku: 'ACC-2024-022-ONE', size: 'One Size', color: 'Gold', color_code: '#d4af37', stock: 15, selling_price: 120000, cost_price: 60000, barcode: '8995522O' }
      ]
    }
  ]

  const { data: prodData, error: prodError } = await supabase
    .from('products')
    .upsert(products.map(({ variants, ...p }) => ({ store_id: STORE_ID, ...p })), { onConflict: 'store_id,sku' })
    .select()

  if (prodError) { console.error('Products error:', prodError.message); return }
  console.log('✓ Products inserted:', prodData.length)

  // 3. Insert variants
  console.log('Inserting variants...')
  const prodMap = {}
  prodData.forEach(p => { prodMap[p.sku] = p.id })

  const allVariants = []
  products.forEach(p => {
    p.variants.forEach(v => {
      allVariants.push({
        product_id: prodMap[p.sku],
        ...v
      })
    })
  })

  const { data: varData, error: varError } = await supabase
    .from('variants')
    .upsert(allVariants, { onConflict: 'product_id,sku' })
    .select()

  if (varError) { console.error('Variants error:', varError.message); return }
  console.log('✓ Variants inserted:', varData.length)

  // 4. Insert customers
  console.log('Inserting customers...')
  const { data: custData, error: custError } = await supabase
    .from('customers')
    .insert([
      { store_id: STORE_ID, name: 'Siti', phone: '0812-3456-7890', total_purchases: 1250000, visit_count: 3 },
      { store_id: STORE_ID, name: 'Dewi', phone: '0821-9988-7766', total_purchases: 870000, visit_count: 2 }
    ])
    .select()

  if (custError) { console.error('Customers error:', custError.message); return }
  console.log('✓ Customers inserted:', custData.length)

  console.log('Seeding complete!')
}

seed().catch(err => console.error('Seed error:', err.message))
