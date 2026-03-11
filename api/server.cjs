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
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

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

  -- 매출 데이터
  CREATE TABLE IF NOT EXISTS sales_records (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    company_name TEXT NOT NULL,
    product_name TEXT,
    quantity REAL DEFAULT 0,
    unit_price REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    memo TEXT,
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
`);

// ──────────────────────────────────────────────────────
// Express 앱
// ──────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({ origin: true, credentials: true }));

// ── Rate Limiting ──
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 10,
  message: { error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: '요청이 너무 많습니다.' },
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

app.post('/api/sales/bulk', authMiddleware, (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0)
    return res.status(400).json({ error: '레코드 배열이 필요합니다.' });

  // 용량 체크
  const stats = getStorageStats(req.user.id);
  if (stats.sales.count + records.length > STORAGE_LIMITS.MAX_SALES_RECORDS)
    return res.status(413).json({ error: `매출 데이터 한도 초과 (최대 ${STORAGE_LIMITS.MAX_SALES_RECORDS.toLocaleString()}건)` });

  const insert = db.prepare(
    'INSERT OR IGNORE INTO sales_records (id,user_id,date,company_name,product_name,quantity,unit_price,total_amount,memo) VALUES (?,?,?,?,?,?,?,?,?)'
  );
  const insertMany = db.transaction((rows) => {
    let inserted = 0;
    for (const r of rows) {
      const result = insert.run(r.id, req.user.id, r.date, r.companyName, r.productName, r.quantity, r.unitPrice, r.totalAmount, r.memo || '');
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
// 헬스체크
// ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 정적 파일 제공 (빌드된 프론트엔드)
app.use(express.static(path.join(__dirname, 'dist')));
app.get('/{*path}', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌾 쌀집 대시보드 서버 실행 중 - Port ${PORT}`);
  console.log(`📁 DB 경로: ${DB_PATH}`);
  console.log(`🔐 JWT 시크릿: ${JWT_SECRET.slice(0, 8)}...`);
});
