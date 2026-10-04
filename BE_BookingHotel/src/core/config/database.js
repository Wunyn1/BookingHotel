const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const config = require('./index');

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: config.database.max,
  idleTimeoutMillis: config.database.idleTimeoutMillis,
  connectionTimeoutMillis: 10000,
});

// Schema Hotel Booking. Prefix hotel_ giúp tách dữ liệu khỏi database KTX cũ.
const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  full_name VARCHAR(150) NOT NULL, role VARCHAR(30) NOT NULL DEFAULT 'customer',
  is_active BOOLEAN NOT NULL DEFAULT TRUE, must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS hotel_room_types (
  id SERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL UNIQUE, code VARCHAR(30) NOT NULL UNIQUE,
  description TEXT DEFAULT '', area_m2 NUMERIC(8,2) NOT NULL DEFAULT 25,
  bed_type VARCHAR(80) NOT NULL DEFAULT '1 giường đôi', capacity INTEGER NOT NULL DEFAULT 2 CHECK (capacity > 0),
  base_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  weekend_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (weekend_price >= 0),
  amenities TEXT[] NOT NULL DEFAULT '{}', images TEXT[] NOT NULL DEFAULT '{}', is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS hotel_rooms (
  id SERIAL PRIMARY KEY, room_type_id INTEGER NOT NULL REFERENCES hotel_room_types(id) ON DELETE RESTRICT,
  room_number VARCHAR(20) NOT NULL UNIQUE, floor INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'available', is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE hotel_rooms ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE IF NOT EXISTS hotel_bookings (
  id SERIAL PRIMARY KEY, booking_code VARCHAR(40) NOT NULL UNIQUE, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  room_id INTEGER NOT NULL REFERENCES hotel_rooms(id) ON DELETE RESTRICT, guest_name VARCHAR(150) NOT NULL,
  guest_email VARCHAR(255) NOT NULL, guest_phone VARCHAR(30) NOT NULL, adults INTEGER NOT NULL DEFAULT 1 CHECK (adults > 0),
  children INTEGER NOT NULL DEFAULT 0 CHECK (children >= 0), check_in DATE NOT NULL, check_out DATE NOT NULL,
  special_request TEXT DEFAULT '', total_amount NUMERIC(14,2) NOT NULL DEFAULT 0, deposit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(30) NOT NULL DEFAULT 'pay_at_hotel', payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  status VARCHAR(30) NOT NULL DEFAULT 'confirmed', qr_token VARCHAR(100) NOT NULL UNIQUE,
  checked_in_at TIMESTAMPTZ, checked_out_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (check_out > check_in)
);
ALTER TABLE hotel_bookings ADD COLUMN IF NOT EXISTS room_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE hotel_bookings ADD COLUMN IF NOT EXISTS hold_id INTEGER;
ALTER TABLE hotel_bookings ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ;
ALTER TABLE hotel_bookings ADD COLUMN IF NOT EXISTS coupon_id INTEGER;
ALTER TABLE hotel_bookings ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE hotel_bookings ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMPTZ;
ALTER TABLE hotel_bookings ADD COLUMN IF NOT EXISTS confirmation_email_error TEXT;
CREATE TABLE IF NOT EXISTS hotel_booking_rooms (
  booking_id INTEGER NOT NULL REFERENCES hotel_bookings(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES hotel_rooms(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (booking_id, room_id)
);
INSERT INTO hotel_booking_rooms (booking_id, room_id)
SELECT id, room_id FROM hotel_bookings
ON CONFLICT (booking_id, room_id) DO NOTHING;
CREATE TABLE IF NOT EXISTS hotel_payments (
  id SERIAL PRIMARY KEY, booking_id INTEGER NOT NULL REFERENCES hotel_bookings(id) ON DELETE CASCADE,
  transaction_ref VARCHAR(100) NOT NULL UNIQUE, amount NUMERIC(14,2) NOT NULL CHECK (amount > 0), method VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'success', paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS hotel_room_holds (
  id SERIAL PRIMARY KEY,
  hold_token VARCHAR(100) NOT NULL UNIQUE,
  room_type_id INTEGER NOT NULL REFERENCES hotel_room_types(id) ON DELETE RESTRICT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  room_count INTEGER NOT NULL CHECK (room_count > 0),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','converted','expired','cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (check_out > check_in)
);
CREATE TABLE IF NOT EXISTS hotel_room_hold_rooms (
  hold_id INTEGER NOT NULL REFERENCES hotel_room_holds(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES hotel_rooms(id) ON DELETE RESTRICT,
  PRIMARY KEY (hold_id, room_id)
);
CREATE TABLE IF NOT EXISTS hotel_payment_transactions (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES hotel_bookings(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(120) NOT NULL UNIQUE,
  provider_reference VARCHAR(120) NOT NULL UNIQUE,
  method VARCHAR(30) NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed','refunded','cancelled')),
  gateway VARCHAR(30) NOT NULL DEFAULT 'sandbox',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS hotel_booking_guests (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES hotel_bookings(id) ON DELETE CASCADE,
  full_name VARCHAR(150) NOT NULL,
  document_type VARCHAR(30),
  document_last4 VARCHAR(4),
  nationality VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS hotel_services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS hotel_booking_services (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES hotel_bookings(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES hotel_services(id) ON DELETE SET NULL,
  service_name VARCHAR(120) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS hotel_invoices (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL UNIQUE REFERENCES hotel_bookings(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  room_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  services_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','paid','refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS hotel_housekeeping_tasks (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES hotel_rooms(id) ON DELETE RESTRICT,
  booking_id INTEGER REFERENCES hotel_bookings(id) ON DELETE SET NULL,
  task_type VARCHAR(30) NOT NULL DEFAULT 'checkout_cleaning',
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status VARCHAR(20) NOT NULL DEFAULT 'dirty' CHECK (status IN ('dirty','assigned','cleaning','ready','cancelled')),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS hotel_daily_rates (
  id SERIAL PRIMARY KEY,
  room_type_id INTEGER NOT NULL REFERENCES hotel_room_types(id) ON DELETE CASCADE,
  rate_date DATE NOT NULL,
  price NUMERIC(14,2) NOT NULL CHECK (price >= 0),
  UNIQUE (room_type_id, rate_date)
);
CREATE TABLE IF NOT EXISTS hotel_coupons (
  id SERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value NUMERIC(14,2) NOT NULL CHECK (discount_value > 0),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  minimum_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  maximum_discount NUMERIC(14,2),
  usage_limit INTEGER,
  usage_per_user INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (end_date >= start_date)
);
CREATE TABLE IF NOT EXISTS hotel_coupon_usages (
  id SERIAL PRIMARY KEY,
  coupon_id INTEGER NOT NULL REFERENCES hotel_coupons(id) ON DELETE CASCADE,
  booking_id INTEGER NOT NULL REFERENCES hotel_bookings(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coupon_id, booking_id)
);
CREATE TABLE IF NOT EXISTS hotel_audit_logs (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80),
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hotel_bookings_coupon_fk') THEN
    ALTER TABLE hotel_bookings ADD CONSTRAINT hotel_bookings_coupon_fk FOREIGN KEY (coupon_id) REFERENCES hotel_coupons(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hotel_bookings_hold_fk') THEN
    ALTER TABLE hotel_bookings ADD CONSTRAINT hotel_bookings_hold_fk FOREIGN KEY (hold_id) REFERENCES hotel_room_holds(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS hotel_reviews (
  id SERIAL PRIMARY KEY, booking_id INTEGER NOT NULL UNIQUE REFERENCES hotel_bookings(id) ON DELETE CASCADE,
  room_type_id INTEGER NOT NULL REFERENCES hotel_room_types(id) ON DELETE CASCADE, guest_name VARCHAR(150) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), comment TEXT DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hotel_bookings_room_count_positive') THEN
    ALTER TABLE hotel_bookings ADD CONSTRAINT hotel_bookings_room_count_positive CHECK (room_count > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hotel_bookings_status_valid') THEN
    ALTER TABLE hotel_bookings ADD CONSTRAINT hotel_bookings_status_valid CHECK (status IN ('pending_payment','confirmed','checked_in','checked_out','completed','cancelled','expired','no_show'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hotel_bookings_payment_status_valid') THEN
    ALTER TABLE hotel_bookings ADD CONSTRAINT hotel_bookings_payment_status_valid CHECK (payment_status IN ('pending','success','failed','refunded','cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hotel_rooms_status_valid') THEN
    ALTER TABLE hotel_rooms ADD CONSTRAINT hotel_rooms_status_valid CHECK (status IN ('available','reserved','occupied','dirty','cleaning','ready','maintenance'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_type_status ON hotel_rooms(room_type_id, status);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_dates ON hotel_bookings(room_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_hotel_bookings_status ON hotel_bookings(status, created_at);
CREATE INDEX IF NOT EXISTS idx_hotel_booking_rooms_room ON hotel_booking_rooms(room_id, booking_id);
CREATE INDEX IF NOT EXISTS idx_hotel_payments_booking ON hotel_payments(booking_id, status);
CREATE INDEX IF NOT EXISTS idx_hotel_holds_expiry ON hotel_room_holds(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_hotel_hold_rooms_room ON hotel_room_hold_rooms(room_id, hold_id);
CREATE INDEX IF NOT EXISTS idx_hotel_payment_transactions_booking ON hotel_payment_transactions(booking_id, status);
CREATE INDEX IF NOT EXISTS idx_hotel_booking_services_booking ON hotel_booking_services(booking_id, created_at);
CREATE INDEX IF NOT EXISTS idx_hotel_housekeeping_status ON hotel_housekeeping_tasks(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_hotel_daily_rates_type_date ON hotel_daily_rates(room_type_id, rate_date);
CREATE INDEX IF NOT EXISTS idx_hotel_audit_entity ON hotel_audit_logs(entity, entity_id, created_at);
`;

async function seedHotelData() {
  const hashes = await Promise.all(['Admin@123', 'Staff@123', 'Customer@123'].map((password) => bcrypt.hash(password, 10)));
  await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role) VALUES
      ('admin@hotel.local',$1,'Quản trị Hotel','admin'), ('reception@hotel.local',$2,'Lễ tân Hotel','receptionist'),
      ('customer@hotel.local',$3,'Khách hàng Demo','customer') ON CONFLICT (email) DO NOTHING`, hashes,
  );
  const types = [
    ['STD', 'Standard', 'Phòng tiêu chuẩn cho kỳ nghỉ ngắn ngày.', 24, '1 giường đôi', 2, 850000, 950000, ['Wi-Fi', 'Điều hòa', 'TV', 'Bữa sáng']],
    ['DLX', 'Deluxe', 'Phòng rộng, có cửa sổ và không gian làm việc.', 32, '1 giường king', 2, 1250000, 1450000, ['Wi-Fi', 'Điều hòa', 'TV', 'Bữa sáng', 'Ban công']],
    ['STE', 'Suite', 'Không gian cao cấp cho gia đình hoặc nhóm bạn.', 55, '1 king + sofa bed', 4, 2200000, 2500000, ['Wi-Fi', 'Điều hòa', 'TV', 'Bữa sáng', 'Ban công', 'Phòng khách']],
  ];
  for (const type of types) {
    await pool.query(`INSERT INTO hotel_room_types (code,name,description,area_m2,bed_type,capacity,base_price,weekend_price,amenities) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (code) DO NOTHING`, type);
  }
  const localizedTypes = [['STD', 'Standard', 'Tiêu chuẩn'], ['DLX', 'Deluxe', 'Cao cấp'], ['STE', 'Suite', 'Hạng sang']];
  for (const [code, oldName, newName] of localizedTypes) await pool.query('UPDATE hotel_room_types SET name=$1,updated_at=NOW() WHERE code=$2 AND name=$3', [newName, code, oldName]);
  const roomTypes = await pool.query('SELECT id, code FROM hotel_room_types ORDER BY id');
  for (const type of roomTypes.rows) {
    const count = type.code === 'STE' ? 3 : 6;
    const floor = type.code === 'STD' ? 1 : type.code === 'DLX' ? 2 : 3;
    for (let i = 1; i <= count; i += 1) {
      await pool.query(`INSERT INTO hotel_rooms (room_type_id,room_number,floor) VALUES ($1,$2,$3) ON CONFLICT (room_number) DO NOTHING`, [type.id, `${floor}${String(i).padStart(2, '0')}`, floor]);
    }
  }
  const services = [
    ['Airport pickup', 'Đón sân bay', 350000],
    ['Laundry', 'Giặt ủi', 120000],
    ['Breakfast', 'Bữa sáng', 150000],
    ['Mini-bar', 'Đồ uống minibar', 80000],
    ['Extra bed', 'Kê thêm giường phụ', 250000],
  ];
  for (const service of services) await pool.query('INSERT INTO hotel_services (name,description,unit_price) VALUES ($1,$2,$3) ON CONFLICT (name) DO NOTHING', service);
  const localizedServices = [['Airport pickup', 'Đón sân bay'], ['Laundry', 'Giặt ủi'], ['Breakfast', 'Bữa sáng'], ['Mini-bar', 'Đồ uống minibar'], ['Extra bed', 'Kê thêm giường phụ']];
  for (const [oldName, newName] of localizedServices) await pool.query('UPDATE hotel_services SET name=$1 WHERE name=$2 AND NOT EXISTS (SELECT 1 FROM hotel_services WHERE name=$1)', [newName, oldName]);
}

async function connectDatabase() {
  const client = await pool.connect();
  try { await client.query('SELECT 1'); await client.query(schemaSql); await seedHotelData(); console.log(`[DB] PostgreSQL connected -> ${config.database.name}`); }
  finally { client.release(); }
}
async function closeDatabase() { await pool.end(); }
module.exports = { pool, connectDatabase, connectDB: connectDatabase, closeDatabase };
