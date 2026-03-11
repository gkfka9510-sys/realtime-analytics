// 쌀집 대시보드 타입 정의

// ─────────────────────────────────────────────
// 기초데이터
// ─────────────────────────────────────────────

// 거래처 (Customer)
export interface Customer {
  id: string;
  name: string;           // 거래처명 *
  phone?: string;         // 연락처
  bizNo?: string;         // 사업자등록번호
  address?: string;       // 사업장 소재지
  ceoName?: string;       // 대표자명
  bizType?: string;       // 업태
  bizItem?: string;       // 업종
  email?: string;         // 이메일
  memo?: string;          // 메모
  createdAt?: string;
}

// 품목 (Item/Product)
export interface Item {
  id: string;
  name: string;           // 품명 *
  spec?: string;          // 규격 (예: 20kg, 1등급)
  unit: string;           // 단위 (예: kg, 포대, 박스)
  stock: number;          // 현재 재고 수량
  costPrice: number;      // 원가 (단가)
  memo?: string;
  createdAt?: string;
}

// ─────────────────────────────────────────────
// 소매 단골 고객 (B2C - 매출/순이익 미반영)
// ─────────────────────────────────────────────
export type RetailGrade = 'vip' | 'regular' | 'new';

export interface RetailCustomer {
  id: string;
  name: string;              // 고객명 *
  phone?: string;            // 연락처
  address?: string;          // 배달/자택 주소
  birthDate?: string;        // 생년월일 (YYYY-MM-DD)
  preferredProduct?: string; // 선호 품목
  purchaseCycle?: string;    // 구매 주기 (예: "2주마다 20kg")
  grade: RetailGrade;        // 등급: vip/regular/new
  memo?: string;             // 특이사항, 배달 메모 등
  createdAt?: string;
  updatedAt?: string;
}

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'credit';

export interface RetailSale {
  id: string;
  customerId: string;        // retail_customers.id
  date: string;              // YYYY-MM-DD
  productName: string;       // 품목명
  quantity: number;          // 수량
  unit: string;              // 단위
  unitPrice: number;         // 단가
  totalAmount: number;       // 합계 (수량 × 단가)
  paymentMethod: PaymentMethod; // 결제 방법
  memo?: string;
}

// ─────────────────────────────────────────────
// 매출 데이터 (CSV에서 파싱 or 직접 입력)
// ─────────────────────────────────────────────
export type TransactionType = 'sale' | 'purchase' | 'receipt' | 'payment';
// sale=매출, purchase=매입, receipt=수금, payment=지불

export interface SalesRecord {
  id: string;
  date: string;              // YYYY-MM-DD
  companyName: string;       // 업체명
  productName: string;       // 품목명
  quantity: number;          // 수량 (kg)
  unitPrice: number;         // 단가
  totalAmount: number;       // 합계금액 (공급가액)
  memo?: string;             // 비고
  transactionType?: TransactionType; // 거래 구분 (직접 입력 시)
  unit?: string;             // 단위
  customerId?: string;       // 연결된 거래처 ID
  itemId?: string;           // 연결된 품목 ID
}

// ─────────────────────────────────────────────
// 세금계산서
// ─────────────────────────────────────────────
export interface TaxInvoice {
  id: string;
  issueDate: string;      // 발행일 YYYY-MM-DD
  companyName: string;    // 업체명
  totalAmount: number;    // 합계금액
  memo?: string;
}

// ─────────────────────────────────────────────
// 쌀 원가 정보 (기존 - 순이익 계산용)
// ─────────────────────────────────────────────
export interface RiceProduct {
  id: string;
  name: string;           // 품명 (예: 신동진 20kg)
  weightPerBag: number;   // 포대당 무게 (kg)
  purchasePrice: number;  // 포대당 매입가 (원)
  costPerKg: number;      // 1kg당 원가 (자동 계산)
  sellingPricePerKg: number; // 1kg당 판매가
}

// ─────────────────────────────────────────────
// 재고
// ─────────────────────────────────────────────
export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  weightPerBag: number;   // kg/포대
  currentStock: number;   // 현재 재고 (포대)
  currentStockKg: number; // 현재 재고 (kg)
  lastUpdated: string;
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  type: 'in' | 'out' | 'adjust'; // 입고/출고/조정
  quantity: number;       // 포대 수
  quantityKg: number;     // kg
  date: string;
  memo?: string;
  relatedSaleId?: string;
}

// ─────────────────────────────────────────────
// 순이익 계산 결과
// ─────────────────────────────────────────────
export interface ProfitData {
  period: string;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
}

// ─────────────────────────────────────────────
// 세금계산서 미발행 업체
// ─────────────────────────────────────────────
export interface UnissuedTaxResult {
  companyName: string;
  month: string;          // YYYY-MM
  salesCount: number;     // 매출 건수
  totalSalesAmount: number; // 매출 합계
  hasInvoice: boolean;
  invoiceCount: number;
}


// ─────────────────────────────────────────────
// 매출 데이터 (CSV에서 파싱 or 직접 입력)
// ─────────────────────────────────────────────
export type TransactionType = 'sale' | 'purchase' | 'receipt' | 'payment';
// sale=매출, purchase=매입, receipt=수금, payment=지불

export interface SalesRecord {
  id: string;
  date: string;              // YYYY-MM-DD
  companyName: string;       // 업체명
  productName: string;       // 품목명
  quantity: number;          // 수량 (kg)
  unitPrice: number;         // 단가
  totalAmount: number;       // 합계금액 (공급가액)
  memo?: string;             // 비고
  transactionType?: TransactionType; // 거래 구분 (직접 입력 시)
  unit?: string;             // 단위
  customerId?: string;       // 연결된 거래처 ID
  itemId?: string;           // 연결된 품목 ID
}

// ─────────────────────────────────────────────
// 세금계산서
// ─────────────────────────────────────────────
export interface TaxInvoice {
  id: string;
  issueDate: string;      // 발행일 YYYY-MM-DD
  companyName: string;    // 업체명
  totalAmount: number;    // 합계금액
  memo?: string;
}

// ─────────────────────────────────────────────
// 쌀 원가 정보 (기존 - 순이익 계산용)
// ─────────────────────────────────────────────
export interface RiceProduct {
  id: string;
  name: string;           // 품명 (예: 신동진 20kg)
  weightPerBag: number;   // 포대당 무게 (kg)
  purchasePrice: number;  // 포대당 매입가 (원)
  costPerKg: number;      // 1kg당 원가 (자동 계산)
  sellingPricePerKg: number; // 1kg당 판매가
}

// ─────────────────────────────────────────────
// 재고
// ─────────────────────────────────────────────
export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  weightPerBag: number;   // kg/포대
  currentStock: number;   // 현재 재고 (포대)
  currentStockKg: number; // 현재 재고 (kg)
  lastUpdated: string;
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  type: 'in' | 'out' | 'adjust'; // 입고/출고/조정
  quantity: number;       // 포대 수
  quantityKg: number;     // kg
  date: string;
  memo?: string;
  relatedSaleId?: string;
}

// ─────────────────────────────────────────────
// 순이익 계산 결과
// ─────────────────────────────────────────────
export interface ProfitData {
  period: string;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
}

// ─────────────────────────────────────────────
// 세금계산서 미발행 업체
// ─────────────────────────────────────────────
export interface UnissuedTaxResult {
  companyName: string;
  month: string;          // YYYY-MM
  salesCount: number;     // 매출 건수
  totalSalesAmount: number; // 매출 합계
  hasInvoice: boolean;
  invoiceCount: number;
}
