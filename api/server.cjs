// 쌀집 대시보드 백엔드 서버
// Express + better-sqlite3 + JWT 인증

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ──────────────────────────────────────────────────────
// 설정
// ──────────────────────────────────────────────────────
const PORT = process.env.API_PORT || 4000;
const DB_PATH = path.join(__dirname, 'data', 'rice.db');

// JWT_SECRET: 서버 재시작해도 동일하게 유지 (파일에 저장)
const SECRET_FILE = path.join(__dirname, 'data', '.jwt_secret');
let JWT_SECRET;
if (process.env.JWT_SECRET) {
  JWT_SECRET = process.env.JWT_SECRET;
} else if (fs.existsSync(SECRET_FILE)) {
  JWT_SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();
} else {
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, JWT_SECRET, { mode: 0o600 });
}

// 스토리지 제한 설정
const STORAGE_LIMITS = {
  MAX_SALES_RECORDS: 50000,    // 매출 레코드 최대 개수
  MAX_TAX_INVOICES: 20000,     // 세금계산서 최대 개수
  MAX_INV_TRANSACTIONS: 30000, // 재고 거래 이력 최대 개수
  WARN_THRESHOLD: 0.8,         // 80% 도달시 경고
  AUTO_ARCHIVE_MONTHS: 24,     // 24개월 이상 된 데이터 자동 아카이빙 권고
};

// ──────────────────────────────────────────────────────
// DB 초기화
// ──────────────────────────────────────────────────────
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');  // 성능 최적화
db.pragma('cache_size = 10000');    // 캐시 증가
db.pragma('temp_store = memory');   // 임시 저장소를 메모리로

// WAL 체크포인트 - 시작 시 WAL 파일 정리
try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch(_) {}

// 테이블 생성
db.exec(`
  -- 사용자 테이블
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    last_login TEXT
  );

  -- 거래처 테이블
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    biz_no TEXT,
    address TEXT,
    ceo_name TEXT,
    biz_type TEXT,
    biz_item TEXT,
    email TEXT,
    memo TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);

  -- 품목 테이블 (기초데이터)
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    spec TEXT,
    unit TEXT NOT NULL DEFAULT 'kg',
    stock REAL DEFAULT 0,
    cost_price REAL DEFAULT 0,
    memo TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);

  -- 매출 데이터
  CREATE TABLE IF NOT EXISTS sales_records (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    company_name TEXT NOT NULL,
    product_name TEXT,
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'kg',
    unit_price REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    memo TEXT,
    transaction_type TEXT DEFAULT 'sale',
    customer_id TEXT,
    item_id TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_sales_user_date ON sales_records(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_sales_company ON sales_records(user_id, company_name);

  -- 세금계산서 데이터
  CREATE TABLE IF NOT EXISTS tax_invoices (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issue_date TEXT NOT NULL,
    company_name TEXT NOT NULL,
    total_amount REAL DEFAULT 0,
    memo TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_tax_user_date ON tax_invoices(user_id, issue_date);

  -- 쌀 품목/원가
  CREATE TABLE IF NOT EXISTS rice_products (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    weight_per_bag REAL NOT NULL,
    purchase_price REAL NOT NULL,
    cost_per_kg REAL NOT NULL,
    selling_price_per_kg REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  -- 재고 현황
  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES rice_products(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    weight_per_bag REAL NOT NULL,
    current_stock REAL DEFAULT 0,
    current_stock_kg REAL DEFAULT 0,
    last_updated TEXT DEFAULT (datetime('now','localtime'))
  );

  -- 재고 거래 이력
  CREATE TABLE IF NOT EXISTS inventory_transactions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('in','out','adjust')),
    quantity REAL NOT NULL,
    quantity_kg REAL NOT NULL,
    date TEXT NOT NULL,
    memo TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_inv_tx_user ON inventory_transactions(user_id, date);

  -- 데이터 삭제 이력 (감사 로그)
  CREATE TABLE IF NOT EXISTS delete_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    table_name TEXT NOT NULL,
    deleted_count INTEGER NOT NULL,
    reason TEXT,
    deleted_at TEXT DEFAULT (datetime('now','localtime'))
  );

  -- 소매 단골 고객 (B2C)
  CREATE TABLE IF NOT EXISTS retail_customers (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    birth_date TEXT DEFAULT '',
    preferred_product TEXT DEFAULT '',
    purchase_cycle TEXT DEFAULT '',
    grade TEXT DEFAULT 'regular',
    memo TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_retail_customers_user ON retail_customers(user_id);

  -- 소매 판매 기록 (순이익/매출현황에 미반영)
  CREATE TABLE IF NOT EXISTS retail_sales (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES retail_customers(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    product_name TEXT DEFAULT '',
    quantity REAL DEFAULT 0,
    unit TEXT DEFAULT 'kg',
    unit_price REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    payment_method TEXT DEFAULT 'cash',
    memo TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_retail_sales_user ON retail_sales(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_retail_sales_customer ON retail_sales(customer_id);

  -- 세금계산서 단건 등록 지원 (기존 bulk 외 단건)
  CREATE INDEX IF NOT EXISTS idx_tax_invoices_user ON tax_invoices(user_id, issue_date);

  -- 쇼핑몰 판매 상품 (관리자 등록, 주문 페이지에 표시)
  CREATE TABLE IF NOT EXISTS shop_products (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    unit TEXT DEFAULT 'kg',
    unit_options TEXT DEFAULT '[]',
    price REAL NOT NULL DEFAULT 0,
    image_url TEXT DEFAULT '',
    is_available INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_shop_products_user ON shop_products(user_id);

  -- 주문 헤더
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_no TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    delivery_date TEXT NOT NULL,
    total_amount REAL DEFAULT 0,
    memo TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_orders_no ON orders(user_id, order_no);

  -- 주문 상품 상세
  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT,
    product_name TEXT NOT NULL,
    unit TEXT DEFAULT 'kg',
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    total_price REAL NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`);

// ──────────────────────────────────────────────────────
// DB 마이그레이션 (기존 DB 컬럼 추가)
// ──────────────────────────────────────────────────────
const migrations = [
  // sales_records 테이블 컬럼 추가 (기존 DB 호환)
  `ALTER TABLE sales_records ADD COLUMN unit TEXT DEFAULT 'kg'`,
  `ALTER TABLE sales_records ADD COLUMN transaction_type TEXT DEFAULT 'sale'`,
  `ALTER TABLE sales_records ADD COLUMN customer_id TEXT`,
  `ALTER TABLE sales_records ADD COLUMN item_id TEXT`,
  // customers 테이블에 거래처구분 컬럼 추가
  `ALTER TABLE customers ADD COLUMN customer_type TEXT DEFAULT 'O'`,
  // inventory 테이블 인덱스
  `CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id)`,
];
for (const sql of migrations) {
  try { db.exec(sql); } catch(_) { /* 이미 존재하면 무시 */ }
}


const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({ origin: true, credentials: true }));

// ── Rate Limiting ──
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 20,
  message: { error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => false,
});
// API rate limit: 매우 넉넉하게 설정 (분당 2000개)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2000,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
  // 주문 페이지, 상품 조회, orders API는 rate limit 제외
  skip: (req) => {
    const p = req.path;
    return p === '/api/shop/orders' ||
           p === '/api/shop/products' ||
           p.startsWith('/api/orders') ||
           p.startsWith('/api/shop/products/admin');
  },
});
app.use('/api/', apiLimiter);

// ── JWT 미들웨어 ──
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: '토큰이 유효하지 않습니다.' });
  }
}

// ── 전역 에러 핸들러 (서버 크래시 방지) ──
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

// ── 스토리지 사용량 체크 헬퍼 ──
function getStorageStats(userId) {
  const salesCount = db.prepare('SELECT COUNT(*) as c FROM sales_records WHERE user_id=?').get(userId).c;
  const taxCount = db.prepare('SELECT COUNT(*) as c FROM tax_invoices WHERE user_id=?').get(userId).c;
  const invTxCount = db.prepare('SELECT COUNT(*) as c FROM inventory_transactions WHERE user_id=?').get(userId).c;
  const productCount = db.prepare('SELECT COUNT(*) as c FROM rice_products WHERE user_id=?').get(userId).c;

  const dbSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;

  return {
    sales: { count: salesCount, max: STORAGE_LIMITS.MAX_SALES_RECORDS, pct: Math.round((salesCount / STORAGE_LIMITS.MAX_SALES_RECORDS) * 100) },
    taxInvoices: { count: taxCount, max: STORAGE_LIMITS.MAX_TAX_INVOICES, pct: Math.round((taxCount / STORAGE_LIMITS.MAX_TAX_INVOICES) * 100) },
    inventoryTransactions: { count: invTxCount, max: STORAGE_LIMITS.MAX_INV_TRANSACTIONS, pct: Math.round((invTxCount / STORAGE_LIMITS.MAX_INV_TRANSACTIONS) * 100) },
    products: { count: productCount },
    dbSizeBytes: dbSize,
    dbSizeMB: Math.round((dbSize / 1024 / 1024) * 100) / 100,
    warnings: [
      salesCount / STORAGE_LIMITS.MAX_SALES_RECORDS >= STORAGE_LIMITS.WARN_THRESHOLD ? `매출 데이터가 ${Math.round((salesCount / STORAGE_LIMITS.MAX_SALES_RECORDS) * 100)}% 사용 중입니다.` : null,
      taxCount / STORAGE_LIMITS.MAX_TAX_INVOICES >= STORAGE_LIMITS.WARN_THRESHOLD ? `세금계산서 데이터가 ${Math.round((taxCount / STORAGE_LIMITS.MAX_TAX_INVOICES) * 100)}% 사용 중입니다.` : null,
    ].filter(Boolean),
  };
}

// ──────────────────────────────────────────────────────
// 인증 라우트
// ──────────────────────────────────────────────────────

// 회원가입
app.post('/api/auth/register', loginLimiter, async (req, res) => {
  const { username, password, displayName } = req.body;
  if (!username || !password) return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  if (username.length < 3) return res.status(400).json({ error: '아이디는 3자 이상이어야 합니다.' });
  if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });

  const exists = db.prepare('SELECT id FROM users WHERE username=?').get(username);
  if (exists) return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });

  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, display_name) VALUES (?,?,?)'
  ).run(username, hash, displayName || username);

  const token = jwt.sign({ id: result.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username, displayName: displayName || username, message: '회원가입 완료!' });
});

// 로그인
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });

  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!user) return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });

  db.prepare("UPDATE users SET last_login=datetime('now','localtime') WHERE id=?").run(user.id);
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username, displayName: user.display_name });
});

// 토큰 검증
app.get('/api/auth/verify', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT username, display_name, created_at, last_login FROM users WHERE id=?').get(req.user.id);
  res.json({ valid: true, user });
});

// 비밀번호 변경
app.put('/api/auth/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: '비밀번호를 입력해주세요.' });
  if (newPassword.length < 6) return res.status(400).json({ error: '새 비밀번호는 6자 이상이어야 합니다.' });

  const user = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id);
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });

  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, req.user.id);
  res.json({ message: '비밀번호가 변경되었습니다.' });
});

// ──────────────────────────────────────────────────────
// 스토리지 라우트
// ──────────────────────────────────────────────────────

// 스토리지 현황 조회
app.get('/api/storage/stats', authMiddleware, (req, res) => {
  res.json(getStorageStats(req.user.id));
});

// 오래된 매출 데이터 삭제 (N개월 이전)
app.delete('/api/storage/sales/old', authMiddleware, (req, res) => {
  const { months = 24 } = req.body;
  if (months < 6) return res.status(400).json({ error: '최소 6개월 이전 데이터만 삭제 가능합니다.' });

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  const count = db.prepare('SELECT COUNT(*) as c FROM sales_records WHERE user_id=? AND date<?').get(req.user.id, cutoff).c;
  if (count === 0) return res.json({ deleted: 0, message: '삭제할 데이터가 없습니다.' });

  db.prepare('DELETE FROM sales_records WHERE user_id=? AND date<?').run(req.user.id, cutoff);
  db.prepare('INSERT INTO delete_logs (user_id, table_name, deleted_count, reason) VALUES (?,?,?,?)').run(
    req.user.id, 'sales_records', count, `${months}개월 이전 데이터 정리`
  );
  res.json({ deleted: count, message: `${count}건 삭제 완료 (${cutoff} 이전 데이터)` });
});

// 재고 이력 정리 (N개월 이전)
app.delete('/api/storage/inventory-tx/old', authMiddleware, (req, res) => {
  const { months = 12 } = req.body;
  if (months < 3) return res.status(400).json({ error: '최소 3개월 이전 데이터만 삭제 가능합니다.' });

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);
  const cutoff = cutoffDate.toISOString();

  const count = db.prepare('SELECT COUNT(*) as c FROM inventory_transactions WHERE user_id=? AND date<?').get(req.user.id, cutoff).c;
  db.prepare('DELETE FROM inventory_transactions WHERE user_id=? AND date<?').run(req.user.id, cutoff);
  db.prepare('INSERT INTO delete_logs (user_id, table_name, deleted_count, reason) VALUES (?,?,?,?)').run(
    req.user.id, 'inventory_transactions', count, `${months}개월 이전 재고 이력 정리`
  );
  res.json({ deleted: count, message: `${count}건 삭제 완료` });
});

// 삭제 이력 조회
app.get('/api/storage/delete-logs', authMiddleware, (req, res) => {
  const logs = db.prepare('SELECT * FROM delete_logs WHERE user_id=? ORDER BY deleted_at DESC LIMIT 50').all(req.user.id);
  res.json(logs);
});

// ──────────────────────────────────────────────────────
// 매출 라우트
// ──────────────────────────────────────────────────────

app.get('/api/sales', authMiddleware, (req, res) => {
  const { from, to, limit = 5000 } = req.query;
  let sql = 'SELECT * FROM sales_records WHERE user_id=?';
  const params = [req.user.id];
  if (from) { sql += ' AND date>=?'; params.push(from); }
  if (to) { sql += ' AND date<=?'; params.push(to); }
  sql += ' ORDER BY date DESC LIMIT ?';
  params.push(Number(limit));
  res.json(db.prepare(sql).all(...params));
});

// 매출 단건 입력
app.post('/api/sales', authMiddleware, (req, res) => {
  const { id, date, companyName, productName, quantity, unit, unitPrice, totalAmount, memo, transactionType, customerId, itemId } = req.body;
  if (!id || !date || !companyName) return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
  db.prepare(
    'INSERT OR REPLACE INTO sales_records (id,user_id,date,company_name,product_name,quantity,unit,unit_price,total_amount,memo,transaction_type,customer_id,item_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(id, req.user.id, date, companyName, productName || '', quantity || 0, unit || 'kg', unitPrice || 0, totalAmount || 0, memo || '', transactionType || 'sale', customerId || null, itemId || null);
  res.json({ id });
});

// 매출 수정
app.put('/api/sales/:id', authMiddleware, (req, res) => {
  const { date, companyName, productName, quantity, unit, unitPrice, totalAmount, memo, transactionType, customerId, itemId } = req.body;
  db.prepare(
    'UPDATE sales_records SET date=?,company_name=?,product_name=?,quantity=?,unit=?,unit_price=?,total_amount=?,memo=?,transaction_type=?,customer_id=?,item_id=? WHERE id=? AND user_id=?'
  ).run(date, companyName, productName || '', quantity || 0, unit || 'kg', unitPrice || 0, totalAmount || 0, memo || '', transactionType || 'sale', customerId || null, itemId || null, req.params.id, req.user.id);
  res.json({ updated: true });
});

// 매출 단건 삭제
app.delete('/api/sales/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM sales_records WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ deleted: true });
});

app.post('/api/sales/bulk', authMiddleware, (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0)
    return res.status(400).json({ error: '레코드 배열이 필요합니다.' });

  // 용량 체크
  const stats = getStorageStats(req.user.id);
  if (stats.sales.count + records.length > STORAGE_LIMITS.MAX_SALES_RECORDS)
    return res.status(413).json({ error: `매출 데이터 한도 초과 (최대 ${STORAGE_LIMITS.MAX_SALES_RECORDS.toLocaleString()}건)` });

  const insert = db.prepare(
    'INSERT OR IGNORE INTO sales_records (id,user_id,date,company_name,product_name,quantity,unit,unit_price,total_amount,memo,transaction_type,customer_id,item_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  const insertMany = db.transaction((rows) => {
    let inserted = 0;
    for (const r of rows) {
      const result = insert.run(
        r.id, req.user.id, r.date, r.companyName, r.productName || '',
        r.quantity || 0, r.unit || 'kg', r.unitPrice || 0, r.totalAmount || 0,
        r.memo || '', r.transactionType || 'sale', r.customerId || null, r.itemId || null
      );
      inserted += result.changes;
    }
    return inserted;
  });

  const inserted = insertMany(records);
  res.json({ inserted, total: stats.sales.count + inserted });
});

app.delete('/api/sales/all', authMiddleware, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM sales_records WHERE user_id=?').get(req.user.id).c;
  db.prepare('DELETE FROM sales_records WHERE user_id=?').run(req.user.id);
  db.prepare('INSERT INTO delete_logs (user_id, table_name, deleted_count, reason) VALUES (?,?,?,?)').run(req.user.id, 'sales_records', count, '전체 삭제');
  res.json({ deleted: count });
});

// ──────────────────────────────────────────────────────
// 세금계산서 라우트
// ──────────────────────────────────────────────────────

app.get('/api/tax-invoices', authMiddleware, (req, res) => {
  const { from, to } = req.query;
  let sql = 'SELECT * FROM tax_invoices WHERE user_id=?';
  const params = [req.user.id];
  if (from) { sql += ' AND issue_date>=?'; params.push(from); }
  if (to) { sql += ' AND issue_date<=?'; params.push(to); }
  sql += ' ORDER BY issue_date DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/tax-invoices/bulk', authMiddleware, (req, res) => {
  const { invoices } = req.body;
  if (!Array.isArray(invoices) || invoices.length === 0)
    return res.status(400).json({ error: '인보이스 배열이 필요합니다.' });

  const stats = getStorageStats(req.user.id);
  if (stats.taxInvoices.count + invoices.length > STORAGE_LIMITS.MAX_TAX_INVOICES)
    return res.status(413).json({ error: `세금계산서 한도 초과 (최대 ${STORAGE_LIMITS.MAX_TAX_INVOICES.toLocaleString()}건)` });

  const insert = db.prepare(
    'INSERT OR IGNORE INTO tax_invoices (id,user_id,issue_date,company_name,total_amount,memo) VALUES (?,?,?,?,?,?)'
  );
  const insertMany = db.transaction((rows) => {
    let inserted = 0;
    for (const r of rows) {
      const result = insert.run(r.id, req.user.id, r.issueDate, r.companyName, r.totalAmount, r.memo || '');
      inserted += result.changes;
    }
    return inserted;
  });

  const inserted = insertMany(invoices);
  res.json({ inserted });
});

app.delete('/api/tax-invoices/all', authMiddleware, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as c FROM tax_invoices WHERE user_id=?').get(req.user.id).c;
  db.prepare('DELETE FROM tax_invoices WHERE user_id=?').run(req.user.id);
  db.prepare('INSERT INTO delete_logs (user_id, table_name, deleted_count, reason) VALUES (?,?,?,?)').run(req.user.id, 'tax_invoices', count, '전체 삭제');
  res.json({ deleted: count });
});

// ──────────────────────────────────────────────────────
// 쌀 품목/원가 라우트
// ──────────────────────────────────────────────────────

app.get('/api/products', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM rice_products WHERE user_id=? ORDER BY name').all(req.user.id));
});

app.post('/api/products', authMiddleware, (req, res) => {
  const { id, name, weightPerBag, purchasePrice, sellingPricePerKg } = req.body;
  if (!id || !name || !weightPerBag || !purchasePrice)
    return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
  const costPerKg = purchasePrice / weightPerBag;
  db.prepare(
    'INSERT OR REPLACE INTO rice_products (id,user_id,name,weight_per_bag,purchase_price,cost_per_kg,selling_price_per_kg,updated_at) VALUES (?,?,?,?,?,?,?,datetime(\'now\',\'localtime\'))'
  ).run(id, req.user.id, name, weightPerBag, purchasePrice, costPerKg, sellingPricePerKg || 0);
  res.json({ id, costPerKg });
});

app.put('/api/products/:id', authMiddleware, (req, res) => {
  const { name, weightPerBag, purchasePrice, sellingPricePerKg } = req.body;
  const costPerKg = purchasePrice / weightPerBag;
  db.prepare(
    "UPDATE rice_products SET name=?,weight_per_bag=?,purchase_price=?,cost_per_kg=?,selling_price_per_kg=?,updated_at=datetime('now','localtime') WHERE id=? AND user_id=?"
  ).run(name, weightPerBag, purchasePrice, costPerKg, sellingPricePerKg || 0, req.params.id, req.user.id);
  res.json({ costPerKg });
});

app.delete('/api/products/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM rice_products WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ deleted: true });
});

// ──────────────────────────────────────────────────────
// 재고 라우트
// ──────────────────────────────────────────────────────

app.get('/api/inventory', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM inventory WHERE user_id=? ORDER BY product_name').all(req.user.id));
});

app.put('/api/inventory/:productId', authMiddleware, (req, res) => {
  const { productId } = req.params;
  const { currentStock, currentStockKg, productName, weightPerBag } = req.body;
  const existing = db.prepare('SELECT id FROM inventory WHERE product_id=? AND user_id=?').get(productId, req.user.id);
  if (existing) {
    db.prepare("UPDATE inventory SET current_stock=?,current_stock_kg=?,last_updated=datetime('now','localtime') WHERE product_id=? AND user_id=?")
      .run(currentStock, currentStockKg, productId, req.user.id);
  } else {
    const { v4: uuidv4 } = require('crypto');
    db.prepare('INSERT INTO inventory (id,user_id,product_id,product_name,weight_per_bag,current_stock,current_stock_kg) VALUES (?,?,?,?,?,?,?)')
      .run(crypto.randomUUID(), req.user.id, productId, productName, weightPerBag, currentStock, currentStockKg);
  }
  res.json({ updated: true });
});

app.post('/api/inventory/init', authMiddleware, (req, res) => {
  const { productId, productName, weightPerBag, quantity } = req.body;
  const currentStockKg = quantity * weightPerBag;
  const existing = db.prepare('SELECT id FROM inventory WHERE product_id=? AND user_id=?').get(productId, req.user.id);
  if (existing) {
    db.prepare("UPDATE inventory SET current_stock=?,current_stock_kg=?,last_updated=datetime('now','localtime') WHERE product_id=? AND user_id=?")
      .run(quantity, currentStockKg, productId, req.user.id);
  } else {
    db.prepare('INSERT INTO inventory (id,user_id,product_id,product_name,weight_per_bag,current_stock,current_stock_kg) VALUES (?,?,?,?,?,?,?)')
      .run(crypto.randomUUID(), req.user.id, productId, productName, weightPerBag, quantity, currentStockKg);
  }
  res.json({ updated: true });
});

// 재고 거래 이력
app.get('/api/inventory/transactions', authMiddleware, (req, res) => {
  const { limit = 200, productId } = req.query;
  let sql = 'SELECT * FROM inventory_transactions WHERE user_id=?';
  const params = [req.user.id];
  if (productId) { sql += ' AND product_id=?'; params.push(productId); }
  sql += ' ORDER BY date DESC LIMIT ?';
  params.push(Number(limit));
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/inventory/transactions', authMiddleware, (req, res) => {
  const stats = getStorageStats(req.user.id);
  if (stats.inventoryTransactions.count >= STORAGE_LIMITS.MAX_INV_TRANSACTIONS)
    return res.status(413).json({ error: '재고 이력 한도 초과. 오래된 이력을 정리해주세요.' });

  const { id, productId, productName, type, quantity, quantityKg, date, memo } = req.body;
  db.prepare(
    'INSERT INTO inventory_transactions (id,user_id,product_id,product_name,type,quantity,quantity_kg,date,memo) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(id || crypto.randomUUID(), req.user.id, productId, productName, type, quantity, quantityKg, date, memo || '');
  res.json({ inserted: true });
});

// ──────────────────────────────────────────────────────
// 거래처 라우트
// ──────────────────────────────────────────────────────

app.get('/api/customers', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM customers WHERE user_id=? ORDER BY name').all(req.user.id));
});

app.post('/api/customers', authMiddleware, (req, res) => {
  const { id, name, phone, bizNo, address, ceoName, bizType, bizItem, email, memo, customerType } = req.body;
  if (!id || !name) return res.status(400).json({ error: '거래처명은 필수입니다.' });
  db.prepare(
    'INSERT OR REPLACE INTO customers (id,user_id,name,phone,biz_no,address,ceo_name,biz_type,biz_item,email,memo,customer_type,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime(\'now\',\'localtime\'))'
  ).run(id, req.user.id, name, phone||'', bizNo||'', address||'', ceoName||'', bizType||'', bizItem||'', email||'', memo||'', customerType||'O');
  res.json({ id });
});

app.put('/api/customers/:id', authMiddleware, (req, res) => {
  const { name, phone, bizNo, address, ceoName, bizType, bizItem, email, memo, customerType } = req.body;
  if (!name) return res.status(400).json({ error: '거래처명은 필수입니다.' });
  db.prepare(
    "UPDATE customers SET name=?,phone=?,biz_no=?,address=?,ceo_name=?,biz_type=?,biz_item=?,email=?,memo=?,customer_type=?,updated_at=datetime('now','localtime') WHERE id=? AND user_id=?"
  ).run(name, phone||'', bizNo||'', address||'', ceoName||'', bizType||'', bizItem||'', email||'', memo||'', customerType||'O', req.params.id, req.user.id);
  res.json({ updated: true });
});

app.delete('/api/customers/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM customers WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ deleted: true });
});

// 거래처 일괄 등록 (CSV import)
app.post('/api/customers/bulk', authMiddleware, (req, res) => {
  const { customers } = req.body;
  if (!Array.isArray(customers) || customers.length === 0)
    return res.status(400).json({ error: '거래처 배열이 필요합니다.' });

  const insert = db.prepare(
    'INSERT OR IGNORE INTO customers (id,user_id,name,phone,biz_no,address,ceo_name,biz_type,biz_item,email,memo,customer_type,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime(\'now\',\'localtime\'))'
  );
  const insertMany = db.transaction((rows) => {
    let inserted = 0;
    for (const c of rows) {
      const r = insert.run(
        c.id, req.user.id, c.name,
        c.phone||'', c.bizNo||'', c.address||'',
        c.ceoName||'', c.bizType||'', c.bizItem||'',
        c.email||'', c.memo||'', c.customerType||'O'
      );
      inserted += r.changes;
    }
    return inserted;
  });

  const inserted = insertMany(customers);
  const total = db.prepare('SELECT COUNT(*) as c FROM customers WHERE user_id=?').get(req.user.id).c;
  res.json({ inserted, total });
});

// ──────────────────────────────────────────────────────
// 품목(기초데이터) 라우트
// ──────────────────────────────────────────────────────

app.get('/api/items', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM items WHERE user_id=? ORDER BY name').all(req.user.id));
});

app.post('/api/items', authMiddleware, (req, res) => {
  const { id, name, spec, unit, stock, costPrice, memo } = req.body;
  if (!id || !name) return res.status(400).json({ error: '품명은 필수입니다.' });
  db.prepare(
    'INSERT OR REPLACE INTO items (id,user_id,name,spec,unit,stock,cost_price,memo,updated_at) VALUES (?,?,?,?,?,?,?,?,datetime(\'now\',\'localtime\'))'
  ).run(id, req.user.id, name, spec || '', unit || 'kg', stock || 0, costPrice || 0, memo || '');
  res.json({ id });
});

app.put('/api/items/:id', authMiddleware, (req, res) => {
  const { name, spec, unit, stock, costPrice, memo } = req.body;
  if (!name) return res.status(400).json({ error: '품명은 필수입니다.' });
  db.prepare(
    "UPDATE items SET name=?,spec=?,unit=?,stock=?,cost_price=?,memo=?,updated_at=datetime('now','localtime') WHERE id=? AND user_id=?"
  ).run(name, spec || '', unit || 'kg', stock || 0, costPrice || 0, memo || '', req.params.id, req.user.id);
  res.json({ updated: true });
});

app.delete('/api/items/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM items WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ deleted: true });
});

// ──────────────────────────────────────────────────────
// 세금계산서 단건 등록/수정/삭제
// ──────────────────────────────────────────────────────
app.post('/api/tax-invoices', authMiddleware, (req, res) => {
  const { id, issueDate, companyName, totalAmount, memo } = req.body;
  if (!id || !issueDate || !companyName) return res.status(400).json({ error: '필수 항목 누락' });
  db.prepare('INSERT OR REPLACE INTO tax_invoices (id,user_id,issue_date,company_name,total_amount,memo) VALUES (?,?,?,?,?,?)')
    .run(id, req.user.id, issueDate, companyName, totalAmount || 0, memo || '');
  res.json({ ok: true });
});
app.put('/api/tax-invoices/:id', authMiddleware, (req, res) => {
  const { issueDate, companyName, totalAmount, memo } = req.body;
  db.prepare("UPDATE tax_invoices SET issue_date=?,company_name=?,total_amount=?,memo=? WHERE id=? AND user_id=?")
    .run(issueDate, companyName, totalAmount || 0, memo || '', req.params.id, req.user.id);
  res.json({ ok: true });
});
app.delete('/api/tax-invoices/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM tax_invoices WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ deleted: true });
});

// ──────────────────────────────────────────────────────
// 소매 단골 고객 라우트 (retail_customers)
// ──────────────────────────────────────────────────────
app.get('/api/retail-customers', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM retail_customers WHERE user_id=? ORDER BY name').all(req.user.id);
  res.json(rows);
});
app.post('/api/retail-customers', authMiddleware, (req, res) => {
  const { id, name, phone, address, birthDate, preferredProduct, purchaseCycle, grade, memo } = req.body;
  if (!id || !name) return res.status(400).json({ error: '필수 항목 누락' });
  db.prepare('INSERT OR REPLACE INTO retail_customers (id,user_id,name,phone,address,birth_date,preferred_product,purchase_cycle,grade,memo,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime(\'now\',\'localtime\'))')
    .run(id, req.user.id, name, phone||'', address||'', birthDate||'', preferredProduct||'', purchaseCycle||'', grade||'regular', memo||'');
  res.json({ ok: true });
});
app.put('/api/retail-customers/:id', authMiddleware, (req, res) => {
  const { name, phone, address, birthDate, preferredProduct, purchaseCycle, grade, memo } = req.body;
  db.prepare("UPDATE retail_customers SET name=?,phone=?,address=?,birth_date=?,preferred_product=?,purchase_cycle=?,grade=?,memo=?,updated_at=datetime('now','localtime') WHERE id=? AND user_id=?")
    .run(name, phone||'', address||'', birthDate||'', preferredProduct||'', purchaseCycle||'', grade||'regular', memo||'', req.params.id, req.user.id);
  res.json({ ok: true });
});
app.delete('/api/retail-customers/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM retail_customers WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ deleted: true });
});

// ──────────────────────────────────────────────────────
// 소매 판매 기록 라우트 (retail_sales) — 매출/순이익 미반영
// ──────────────────────────────────────────────────────
app.get('/api/retail-sales', authMiddleware, (req, res) => {
  const { customerId, from, to } = req.query;
  let sql = 'SELECT * FROM retail_sales WHERE user_id=?';
  const params = [req.user.id];
  if (customerId) { sql += ' AND customer_id=?'; params.push(customerId); }
  if (from) { sql += ' AND date>=?'; params.push(from); }
  if (to) { sql += ' AND date<=?'; params.push(to); }
  sql += ' ORDER BY date DESC';
  res.json(db.prepare(sql).all(...params));
});
app.post('/api/retail-sales', authMiddleware, (req, res) => {
  const { id, customerId, date, productName, quantity, unit, unitPrice, totalAmount, paymentMethod, memo } = req.body;
  if (!id || !customerId || !date) return res.status(400).json({ error: '필수 항목 누락' });
  db.prepare('INSERT OR REPLACE INTO retail_sales (id,user_id,customer_id,date,product_name,quantity,unit,unit_price,total_amount,payment_method,memo) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, req.user.id, customerId, date, productName||'', quantity||0, unit||'kg', unitPrice||0, totalAmount||0, paymentMethod||'cash', memo||'');
  res.json({ ok: true });
});
app.put('/api/retail-sales/:id', authMiddleware, (req, res) => {
  const { date, productName, quantity, unit, unitPrice, totalAmount, paymentMethod, memo } = req.body;
  db.prepare('UPDATE retail_sales SET date=?,product_name=?,quantity=?,unit=?,unit_price=?,total_amount=?,payment_method=?,memo=? WHERE id=? AND user_id=?')
    .run(date, productName||'', quantity||0, unit||'kg', unitPrice||0, totalAmount||0, paymentMethod||'cash', memo||'', req.params.id, req.user.id);
  res.json({ ok: true });
});
app.delete('/api/retail-sales/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM retail_sales WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ deleted: true });
});

// ──────────────────────────────────────────────────────
// 쇼핑몰 상품 라우트 (shop_products)
// ──────────────────────────────────────────────────────

// 공개 상품 목록 (인증 불필요 - 주문 페이지용)
app.get('/api/shop/products', (req, res) => {
  try {
    const { userId } = req.query;
    let row;
    if (userId) {
      row = db.prepare('SELECT id FROM users WHERE id=?').get(userId);
    } else {
      row = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get();
    }
    if (!row) return res.json([]);
    const products = db.prepare(
      'SELECT * FROM shop_products WHERE user_id=? AND is_available=1 ORDER BY sort_order ASC, name ASC'
    ).all(row.id);
    res.json(products);
  } catch(err) {
    console.error('/api/shop/products error:', err.message);
    res.status(500).json({ error: '상품 조회 실패' });
  }
});

// 관리자용 전체 상품 목록 (인증 필요)
app.get('/api/shop/products/admin', authMiddleware, (req, res) => {
  try {
    const products = db.prepare(
      'SELECT * FROM shop_products WHERE user_id=? ORDER BY sort_order ASC, name ASC'
    ).all(req.user.id);
    res.json(products);
  } catch(err) {
    console.error('/api/shop/products/admin error:', err.message);
    res.status(500).json({ error: '상품 목록 조회 실패' });
  }
});

app.post('/api/shop/products', authMiddleware, (req, res) => {
  const { id, name, description, unit, unitOptions, price, imageUrl, isAvailable, sortOrder } = req.body;
  if (!id || !name || price == null) return res.status(400).json({ error: '필수 항목 누락' });
  db.prepare(
    "INSERT OR REPLACE INTO shop_products (id,user_id,name,description,unit,unit_options,price,image_url,is_available,sort_order,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))"
  ).run(id, req.user.id, name, description||'', unit||'kg', JSON.stringify(unitOptions||[]), price, imageUrl||'', isAvailable!==false?1:0, sortOrder||0);
  res.json({ ok: true });
});

app.put('/api/shop/products/:id', authMiddleware, (req, res) => {
  const { name, description, unit, unitOptions, price, imageUrl, isAvailable, sortOrder } = req.body;
  db.prepare(
    "UPDATE shop_products SET name=?,description=?,unit=?,unit_options=?,price=?,image_url=?,is_available=?,sort_order=?,updated_at=datetime('now','localtime') WHERE id=? AND user_id=?"
  ).run(name, description||'', unit||'kg', JSON.stringify(unitOptions||[]), price, imageUrl||'', isAvailable!==false?1:0, sortOrder||0, req.params.id, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/shop/products/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM shop_products WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ deleted: true });
});

// ──────────────────────────────────────────────────────
// 주문 라우트 (orders) — 비회원도 주문 가능
// ──────────────────────────────────────────────────────

// 주문 목록 (관리자용)
app.get('/api/orders', authMiddleware, (req, res) => {
  try {
    const { status, from, to, limit = 200 } = req.query;
    let sql = 'SELECT * FROM orders WHERE user_id=?';
    const params = [req.user.id];
    if (status) { sql += ' AND status=?'; params.push(status); }
    if (from) { sql += ' AND created_at>=?'; params.push(from); }
    if (to) { sql += ' AND created_at<=?'; params.push(to + ' 23:59:59'); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Number(limit));
    const orders = db.prepare(sql).all(...params);
    const result = orders.map(order => ({
      ...order,
      items: db.prepare('SELECT * FROM order_items WHERE order_id=?').all(order.id),
    }));
    res.json(result);
  } catch(err) {
    console.error('/api/orders error:', err.message);
    res.status(500).json({ error: '주문 목록 조회 실패' });
  }
});

// 주문 통계 (관리자용)
app.get('/api/orders/stats', authMiddleware, (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id=? AND date(created_at)=?").get(req.user.id, today).c;
    const todayAmount = db.prepare("SELECT COALESCE(SUM(total_amount),0) as s FROM orders WHERE user_id=? AND date(created_at)=?").get(req.user.id, today).s;
    const pendingCount = db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id=? AND status='pending'").get(req.user.id).c;
    const totalCount = db.prepare('SELECT COUNT(*) as c FROM orders WHERE user_id=?').get(req.user.id).c;
    const totalAmount = db.prepare('SELECT COALESCE(SUM(total_amount),0) as s FROM orders WHERE user_id=?').get(req.user.id).s;
    res.json({ todayCount, todayAmount, pendingCount, totalCount, totalAmount });
  } catch(err) {
    console.error('/api/orders/stats error:', err.message);
    res.status(500).json({ error: '주문 통계 조회 실패' });
  }
});

// 비회원 주문 생성 (인증 불필요 - 주문 페이지용)
app.post('/api/shop/orders', (req, res) => {
  const { customerName, customerPhone, customerAddress, deliveryDate, items, memo, userId } = req.body;
  if (!customerName || !customerPhone || !customerAddress || !deliveryDate || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
  }

  // 어느 사용자(상점)에 주문할지 결정
  let targetUserId;
  if (userId) {
    const u = db.prepare('SELECT id FROM users WHERE id=?').get(userId);
    if (!u) return res.status(400).json({ error: '존재하지 않는 상점입니다.' });
    targetUserId = u.id;
  } else {
    const u = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get();
    if (!u) return res.status(400).json({ error: '상점 정보를 찾을 수 없습니다.' });
    targetUserId = u.id;
  }

  const orderId = crypto.randomUUID();
  // 주문번호: ORD-YYYYMMDD-4자리랜덤
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const orderNo = `ORD-${dateStr}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const totalAmount = items.reduce((sum, item) => sum + (item.totalPrice || item.unitPrice * item.quantity), 0);

  const insertOrder = db.transaction(() => {
    db.prepare(
      "INSERT INTO orders (id,user_id,order_no,customer_name,customer_phone,customer_address,delivery_date,total_amount,memo,status) VALUES (?,?,?,?,?,?,?,?,?,'pending')"
    ).run(orderId, targetUserId, orderNo, customerName, customerPhone, customerAddress, deliveryDate, totalAmount, memo||'');

    const insertItem = db.prepare(
      'INSERT INTO order_items (id,order_id,product_id,product_name,unit,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?,?,?)'
    );
    for (const item of items) {
      insertItem.run(
        crypto.randomUUID(), orderId,
        item.productId || null,
        item.productName,
        item.unit || 'kg',
        item.quantity,
        item.unitPrice,
        item.totalPrice || item.unitPrice * item.quantity
      );
    }

    // 주문자를 소매 단골 고객에 자동 등록/업데이트
    const existingRetail = db.prepare(
      'SELECT id FROM retail_customers WHERE user_id=? AND phone=?'
    ).get(targetUserId, customerPhone);

    if (!existingRetail) {
      const rcId = crypto.randomUUID();
      db.prepare(
        "INSERT INTO retail_customers (id,user_id,name,phone,address,grade,memo,updated_at) VALUES (?,?,?,?,?,'regular','온라인 주문 자동 등록',datetime('now','localtime'))"
      ).run(rcId, targetUserId, customerName, customerPhone, customerAddress);
    } else {
      // 주소가 있으면 업데이트
      db.prepare(
        "UPDATE retail_customers SET name=?,address=?,updated_at=datetime('now','localtime') WHERE id=? AND user_id=?"
      ).run(customerName, customerAddress, existingRetail.id, targetUserId);
    }

    // 매출 데이터에도 반영 (sales_records에 주문 건 추가)
    const today = new Date().toISOString().slice(0, 10);
    for (const item of items) {
      const saleId = crypto.randomUUID();
      db.prepare(
        "INSERT INTO sales_records (id,user_id,date,company_name,product_name,quantity,unit,unit_price,total_amount,memo,transaction_type) VALUES (?,?,?,?,?,?,?,?,?,'온라인주문: ' || ?,'sale')"
      ).run(
        saleId, targetUserId, today,
        customerName,
        item.productName,
        item.quantity,
        item.unit || 'kg',
        item.unitPrice,
        item.totalPrice || item.unitPrice * item.quantity,
        orderNo
      );
    }
  });

  try {
    insertOrder();
    res.json({ orderId, orderNo, totalAmount });
  } catch (err) {
    console.error('주문 생성 오류:', err);
    res.status(500).json({ error: '주문 처리 중 오류가 발생했습니다.' });
  }
});

// 주문 상태 변경 (관리자용)
app.put('/api/orders/:id/status', authMiddleware, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
  db.prepare("UPDATE orders SET status=?,updated_at=datetime('now','localtime') WHERE id=? AND user_id=?")
    .run(status, req.params.id, req.user.id);
  res.json({ ok: true });
});

// 주문 삭제 (관리자용)
app.delete('/api/orders/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM orders WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ deleted: true });
});

// ──────────────────────────────────────────────────────
// 헬스체크
// ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 정적 파일 제공 (빌드된 프론트엔드 - webapp/dist)
const DIST_PATH = path.join(__dirname, '..', 'dist');
// JS/CSS는 해시 파일명으로 버전관리, HTML만 캐시 금지
app.use(express.static(DIST_PATH, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }
}));
app.get('/{*path}', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌾 쌀집 대시보드 서버 실행 중 - Port ${PORT}`);
  console.log(`📁 DB 경로: ${DB_PATH}`);
  console.log(`🔐 JWT 시크릿: ${JWT_SECRET.slice(0, 8)}...`);
});
