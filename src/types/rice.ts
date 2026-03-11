// 쌀집 대시보드 타입 정의

// 매출 데이터 (CSV에서 파싱)
export interface SalesRecord {
  id: string;
  date: string;           // YYYY-MM-DD
  companyName: string;    // 업체명
  productName: string;    // 품목명
  quantity: number;       // 수량 (kg)
  unitPrice: number;      // 단가
  totalAmount: number;    // 합계금액
  memo?: string;          // 비고
}

// 세금계산서 데이터 (CSV에서 파싱)
export interface TaxInvoice {
  id: string;
  issueDate: string;      // 발행일 YYYY-MM-DD
  companyName: string;    // 업체명
  totalAmount: number;    // 합계금액
  memo?: string;
}

// 쌀 원가 정보
export interface RiceProduct {
  id: string;
  name: string;           // 품명 (예: 신동진 20kg)
  weightPerBag: number;   // 포대당 무게 (kg)
  purchasePrice: number;  // 포대당 매입가 (원)
  costPerKg: number;      // 1kg당 원가 (자동 계산)
  sellingPricePerKg: number; // 1kg당 판매가
}

// 재고 항목
export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  weightPerBag: number;   // kg/포대
  currentStock: number;   // 현재 재고 (포대)
  currentStockKg: number; // 현재 재고 (kg)
  lastUpdated: string;
}

// 재고 변동 이력
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

// 순이익 계산 결과
export interface ProfitData {
  period: string;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
}

// 세금계산서 미발행 업체
export interface UnissuedTaxResult {
  companyName: string;
  month: string;          // YYYY-MM
  salesCount: number;     // 매출 건수
  totalSalesAmount: number; // 매출 합계
  hasInvoice: boolean;
  invoiceCount: number;
}
