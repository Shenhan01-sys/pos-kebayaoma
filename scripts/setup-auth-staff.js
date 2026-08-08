/**
 * Setup auth staff: insert staff rows + buat Supabase Auth user (PIN jadi password).
 *
 * RUN:  node scripts/setup-auth-staff.js
 *
 * Memakai service role key (SUPABASE_SERVICE_ROLE_KEY) — jangan jalankan dari browser.
 * Email auth sintetis: staff-{id}@kebayaoma.local (lihat public.staff_auth_email()).
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STORE_ID) {
  console.error('Missing environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_STORE_ID)')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// staff dummy awal (PIN akan jadi password akun auth)
const SEED_STAFF = [
  { name: 'Ani',   pin: '1234', role: 'admin',   phone: '0812-1111-1111' },
  { name: 'Budi',  pin: '2345', role: 'cashier', phone: '0812-2222-2222' },
  { name: 'Citra', pin: '3456', role: 'manager', phone: '0812-3333-3333' },
]

async function main() {
  console.log('Setup auth staff...')

  for (const s of SEED_STAFF) {
    // 1. Cek staff dengan nama sama sudah ada?
    const { data: existing } = await admin
      .from('staff')
      .select('id, name, user_id')
      .eq('store_id', STORE_ID)
      .eq('name', s.name)
      .maybeSingle()

    let staffId = existing?.id

    if (!staffId) {
      const { data: inserted, error: insErr } = await admin
        .from('staff')
        .insert({ store_id: STORE_ID, name: s.name, role: s.role, phone: s.phone, active: true })
        .select('id')
        .single()
      if (insErr) { console.error(`✗ ${s.name}: insert staff gagal — ${insErr.message}`); continue }
      staffId = inserted.id
    }

    const email = `staff-${staffId}@kebayaoma.local`

    // 2. Sudah punya user auth?
    if (existing?.user_id) {
      console.log(`✓ ${s.name} (${s.role}) sudah punya user auth`)
      continue
    }

    // 3. Buat user auth (password = PIN)
    const { data: user, error: userErr } = await admin.auth.admin.createUser({
      email,
      password: s.pin,
      email_confirm: true,
      user_metadata: { staff_id: staffId, store_id: STORE_ID, role: s.role, name: s.name },
    })
    if (userErr) { console.error(`✗ ${s.name}: createUser gagal — ${userErr.message}`); continue }

    // 4. Link staff.user_id
    const { error: linkErr } = await admin
      .from('staff')
      .update({ user_id: user.user.id })
      .eq('id', staffId)
    if (linkErr) { console.error(`✗ ${s.name}: link user_id gagal — ${linkErr.message}`); continue }

    console.log(`✓ ${s.name} (${s.role}) → ${email} (PIN ${s.pin})`)
  }

  console.log('Selesai. Login di app: pilih kasir → masukkan PIN.')
}

main()
