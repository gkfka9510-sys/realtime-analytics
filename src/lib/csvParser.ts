// CSV 파싱 유틸리티
import { v4 as uuidv4 } from 'uuid';
import { SalesRecord, TaxInvoice } from '@/types/rice';

/**
 * CSV 텍스트를 파싱하여 배열로 반환
 */
export function parseCSV(text: string): string[][] {
  // BOM 제거
  const cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.trim().split('\n');
  return lines.map(line => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if ((ch === ',' || ch === '\t') && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  });
}

/**
 * 숫자 문자열 파싱 (쉼표, 원화기호 제거)
 */
export function parseNumber(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[₩,\s원]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * 날짜 문자열 정규화 → YYYY-MM-DD
 */
export function normalizeDate(str: string): string {
  if (!str) return '';
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) return str.replace(/\//g, '-');
  // YYYYMMDD
  if (/^\d{8}$/.test(str)) return `${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}`;
  // YY-MM-DD or YY/MM/DD
  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{2}$/.test(str)) {
    const parts = str.split(/[\/\-]/);
    return `20${parts[0]}-${parts[1]}-${parts[2]}`;
  }
  // MM/DD/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const parts = str.split('/');
    return `${parts[2]}-${parts[0]}-${parts[1]}`;
  }
  return str;
}

/**
 * 매출 CSV 파싱
 * 예상 컬럼: 날짜, 업체명, 품목, 수량(kg), 단가, 합계금액, 비고
 */
export function parseSalesCSV(text: string): { records: SalesRecord[]; errors: string[] } {
  const rows = parseCSV(text);
  if (rows.length < 2) return { records: [], errors: ['데이터가 없습니다.'] };

  const headers = rows[0].map(h => h.toLowerCase().replace(/\s/g, ''));
  const records: SalesRecord[] = [];
  const errors: string[] = [];

  // 컬럼 인덱스 자동 탐지
  const findCol = (candidates: string[]) => {
    for (const c of candidates) {
      const idx = headers.findIndex(h => h.includes(c));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateIdx = findCol(['거래일자', '날짜', 'date', '일자', '거래일']);
  const companyIdx = findCol(['거래처명', '업체', '거래처', 'company', '상호', '고객']);
  const productIdx = findCol(['품명', '품목', '상품', 'product', '제품']);
  const qtyIdx = findCol(['수량', 'qty', 'quantity', '무게']);
  const unitPriceIdx = findCol(['단가', '단위가격']);
  const specIdx = findCol(['규격', 'spec', '사양']);
  const totalIdx = findCol(['합계', '금액', '총액', 'total', 'amount', '매출']);
  const memoIdx = findCol(['비고', 'memo', '메모', '특이']);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(cell => !cell)) continue; // 빈 행 무시

    try {
      const date = dateIdx >= 0 ? normalizeDate(row[dateIdx].replace(/\r/g, '')) : '';
      const companyName = companyIdx >= 0 ? row[companyIdx] : row[0] || '알 수 없음';
      const baseProduct = productIdx >= 0 ? row[productIdx] : '';
      const spec = specIdx >= 0 ? row[specIdx] : '';
      const productName = spec ? `${baseProduct} (${spec})` : baseProduct;
      const quantity = qtyIdx >= 0 ? parseNumber(row[qtyIdx]) : 0;
      const unitPrice = unitPriceIdx >= 0 ? parseNumber(row[unitPriceIdx]) : 0;
      const totalAmount = totalIdx >= 0 ? parseNumber(row[totalIdx]) : unitPrice * quantity;
      const memo = memoIdx >= 0 ? row[memoIdx] : '';

      if (!companyName) {
        errors.push(`행 ${i + 1}: 업체명 없음`);
        continue;
      }

      records.push({
        id: uuidv4(),
        date,
        companyName,
        productName,
        quantity,
        unitPrice,
        totalAmount,
        memo,
      });
    } catch (e) {
      errors.push(`행 ${i + 1}: 파싱 오류`);
    }
  }

  return { records, errors };
}

/**
 * 세금계산서 CSV 파싱
 * 예상 컬럼: 발행일, 업체명, 합계금액, 비고
 */
export function parseTaxInvoiceCSV(text: string): { invoices: TaxInvoice[]; errors: string[] } {
  const rows = parseCSV(text);
  if (rows.length < 2) return { invoices: [], errors: ['데이터가 없습니다.'] };

  const headers = rows[0].map(h => h.toLowerCase().replace(/\s/g, ''));
  const invoices: TaxInvoice[] = [];
  const errors: string[] = [];

  const findCol = (candidates: string[]) => {
    for (const c of candidates) {
      const idx = headers.findIndex(h => h.includes(c));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateIdx = findCol(['날짜', 'date', '발행일', '작성일', '일자']);
  const companyIdx = findCol(['업체', '거래처', 'company', '상호', '공급받는자']);
  const totalIdx = findCol(['합계', '금액', '총액', 'total', 'amount', '공급가액', '세액']);
  const memoIdx = findCol(['비고', 'memo']);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(cell => !cell)) continue;

    try {
      const issueDate = dateIdx >= 0 ? normalizeDate(row[dateIdx]) : '';
      const companyName = companyIdx >= 0 ? row[companyIdx] : row[0] || '알 수 없음';
      const totalAmount = totalIdx >= 0 ? parseNumber(row[totalIdx]) : 0;
      const memo = memoIdx >= 0 ? row[memoIdx] : '';

      if (!companyName) {
        errors.push(`행 ${i + 1}: 업체명 없음`);
        continue;
      }

      invoices.push({
        id: uuidv4(),
        issueDate,
        companyName,
        totalAmount,
        memo,
      });
    } catch (e) {
      errors.push(`행 ${i + 1}: 파싱 오류`);
    }
  }

  return { invoices, errors };
}

/**
 * File → Text 변환 (UTF-8, EUC-KR 자동 감지)
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // EUC-KR 시도
    const readerEuc = new FileReader();
    readerEuc.onload = (e) => {
      const text = e.target?.result as string;
      // 한글 깨짐 감지: EUC-KR 디코드 결과에 대체문자(□)가 없으면 사용
      if (!text.includes('â€') && !text.includes('\uFFFD')) {
        resolve(text);
      } else {
        // UTF-8로 재시도
        const readerUtf = new FileReader();
        readerUtf.onload = (e2) => resolve(e2.target?.result as string);
        readerUtf.onerror = reject;
        readerUtf.readAsText(file, 'UTF-8');
      }
    };
    readerEuc.onerror = reject;
    readerEuc.readAsText(file, 'EUC-KR');
  });
}
