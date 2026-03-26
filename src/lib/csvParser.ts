// CSV 파싱 유틸리티
import { v4 as uuidv4 } from 'uuid';
import { SalesRecord, TaxInvoice, Customer, TransactionType } from '@/types/rice';

/**
 * CSV 텍스트를 파싱하여 배열로 반환 (BOM 자동 제거, \r 제거)
 */
export function parseCSV(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.trim().split('\n');
  return lines.map(line => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    const row = line.replace(/\r/g, '');
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
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
  const s = str.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, '-');
  if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{2}$/.test(s)) {
    const parts = s.split(/[\/\-]/);
    return `20${parts[0]}-${parts[1]}-${parts[2]}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const parts = s.split('/');
    return `${parts[2]}-${parts[0]}-${parts[1]}`;
  }
  return s;
}

/**
 * 거래 구분 텍스트 → TransactionType 변환
 * 매출 CSV의 '구분' 컬럼 값 처리
 * 매출→sale, 매입→purchase, 수금→receipt, 지불→payment
 */
export function parseTransactionType(str: string): TransactionType {
  const v = (str || '').trim();
  if (v === '매출' || v === '출고' || v === 'sale' || v === 'O') return 'sale';
  if (v === '매입' || v === '입고' || v === 'purchase' || v === 'I') return 'purchase';
  if (v === '수금' || v === '입금' || v === 'receipt') return 'receipt';
  if (v === '지불' || v === '출금' || v === '지급' || v === 'payment') return 'payment';
  return 'sale'; // 기본값
}

/**
 * 매출 CSV 파싱
 * 헤더: 거래일자, 구분(매출/매입/수금/지불), 거래처명, 품명, 규격, 수량, 단가, 금액, 합계, 비고
 */
export function parseSalesCSV(text: string): { records: SalesRecord[]; errors: string[] } {
  const rows = parseCSV(text);
  if (rows.length < 2) return { records: [], errors: ['데이터가 없습니다.'] };

  const headers = rows[0].map(h => h.toLowerCase().replace(/\s/g, ''));
  const records: SalesRecord[] = [];
  const errors: string[] = [];

  const findCol = (candidates: string[]) => {
    for (const c of candidates) {
      const idx = headers.findIndex(h => h.includes(c));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateIdx     = findCol(['거래일자', '날짜', 'date', '일자', '거래일']);
  const typeIdx     = findCol(['구분']);   // 매출/매입/수금/지불
  const companyIdx  = findCol(['거래처명', '거래처', '업체', '상호', 'company', '고객']);
  const productIdx  = findCol(['품명', '품목', '상품', 'product', '제품']);
  const specIdx     = findCol(['규격', 'spec', '사양']);
  const qtyIdx      = findCol(['수량', 'qty', 'quantity', '무게']);
  const unitPriceIdx= findCol(['단가', '단위가격']);
  const totalIdx    = findCol(['합계', '금액', '총액', 'total', 'amount']);
  const memoIdx     = findCol(['비고', 'memo', '메모', '특이']);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(cell => !cell)) continue;

    try {
      const date        = dateIdx >= 0 ? normalizeDate(row[dateIdx]) : '';
      const companyName = companyIdx >= 0 ? row[companyIdx] : row[0] || '알 수 없음';
      const baseProduct = productIdx >= 0 ? row[productIdx] : '';
      const spec        = specIdx >= 0 ? row[specIdx] : '';
      const productName = spec ? `${baseProduct} (${spec})` : baseProduct;
      const quantity    = qtyIdx >= 0 ? parseNumber(row[qtyIdx]) : 0;
      const unitPrice   = unitPriceIdx >= 0 ? parseNumber(row[unitPriceIdx]) : 0;
      const totalAmount = totalIdx >= 0 ? parseNumber(row[totalIdx]) : unitPrice * quantity;
      const memo        = memoIdx >= 0 ? row[memoIdx] : '';
      // ★ 거래 유형 파싱 - 구분 컬럼 값을 정확히 매핑
      const transactionType: TransactionType = typeIdx >= 0
        ? parseTransactionType(row[typeIdx])
        : 'sale';

      if (!companyName) {
        errors.push(`행 ${i + 1}: 거래처명 없음`);
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
        transactionType,
        unit: 'kg',
      });
    } catch (e) {
      errors.push(`행 ${i + 1}: 파싱 오류`);
    }
  }

  return { records, errors };
}

/**
 * 세금계산서 CSV 파싱
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

  const dateIdx    = findCol(['날짜', 'date', '발행일', '작성일', '일자']);
  const companyIdx = findCol(['업체', '거래처', 'company', '상호', '공급받는자']);
  const totalIdx   = findCol(['합계', '금액', '총액', 'total', 'amount', '공급가액', '세액']);
  const memoIdx    = findCol(['비고', 'memo']);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(cell => !cell)) continue;

    try {
      const issueDate   = dateIdx >= 0 ? normalizeDate(row[dateIdx]) : '';
      const companyName = companyIdx >= 0 ? row[companyIdx] : row[0] || '알 수 없음';
      const totalAmount = totalIdx >= 0 ? parseNumber(row[totalIdx]) : 0;
      const memo        = memoIdx >= 0 ? row[memoIdx] : '';

      if (!companyName) {
        errors.push(`행 ${i + 1}: 업체명 없음`);
        continue;
      }

      invoices.push({ id: uuidv4(), issueDate, companyName, totalAmount, memo });
    } catch (e) {
      errors.push(`행 ${i + 1}: 파싱 오류`);
    }
  }

  return { invoices, errors };
}

/**
 * 거래처구분 코드 → 한글 레이블
 * I=매입처, O=매출처, M=혼합처
 */
export function customerTypeLabel(code: string): string {
  if (code === 'I') return '매입처';
  if (code === 'O') return '매출처';
  if (code === 'M') return '혼합처';
  return code || '매출처';
}

/**
 * 거래처 관리 CSV 파싱
 * 헤더(예): 코드, 거래처명, 상호, 대표명, 사업자번호, ..., 거래처구분(I/O/M), ..., 전화번호1, 휴대폰1, 주소1, 업태, 종목, 메모
 *
 * 거래처구분: I=매입처, O=매출처, M=혼합처
 */
export function parseCustomerCSV(text: string): { customers: Customer[]; errors: string[]; skipped: number } {
  const rows = parseCSV(text);
  if (rows.length < 2) return { customers: [], errors: ['데이터가 없습니다.'], skipped: 0 };

  const headers = rows[0].map(h => h.toLowerCase().replace(/[\s()]/g, ''));
  const customers: Customer[] = [];
  const errors: string[] = [];
  let skipped = 0;

  const findCol = (candidates: string[]) => {
    for (const c of candidates) {
      const idx = headers.findIndex(h => h.includes(c));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  // 거래처 관리 CSV 컬럼 매핑
  const nameIdx    = findCol(['거래처명']);
  const ceoIdx     = findCol(['대표명', '대표자']);
  const bizNoIdx   = findCol(['사업자번호', '사업자']);
  const addr1Idx   = findCol(['주소1', '주소']);
  const bizTypeIdx = findCol(['업태']);
  const bizItemIdx = findCol(['종목']);
  // 거래처구분: 헤더에 "거래처구분" 또는 "구분" 포함된 컬럼
  const typeIdx    = findCol(['거래처구분', '구분']);
  const tel1Idx    = findCol(['전화번호1', '전화1', '전화번호', 'tel']);
  const mobile1Idx = findCol(['휴대폰1', '휴대폰', 'mobile', '핸드폰']);
  const memoIdx    = findCol(['메모', 'memo', '비고']);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(cell => !cell)) continue;

    try {
      const name = nameIdx >= 0 ? row[nameIdx] : row[1] || '';
      // 거래처명이 없거나 공백/특수문자만인 경우 건너뜀
      if (!name || !name.trim() || /^[\s!,.-]*$/.test(name)) {
        skipped++;
        continue;
      }

      // 사업자번호 정리 (공백/하이픈 정리)
      const rawBizNo = bizNoIdx >= 0 ? row[bizNoIdx] : '';
      const bizNo = rawBizNo.replace(/\s/g, '').replace(/\s*-\s*/g, '-');
      // 사업자번호가 "---" 형태면 빈값 처리
      const cleanBizNo = /^[-\s]*$/.test(bizNo) ? '' : bizNo;

      // 전화번호 (전화번호1 또는 휴대폰1)
      const tel   = tel1Idx >= 0 ? row[tel1Idx] : '';
      const mobile = mobile1Idx >= 0 ? row[mobile1Idx] : '';
      const phone = mobile || tel || '';

      // 거래처구분 파싱: 헤더 이름에서 I/O/M 값 추출
      let rawType = typeIdx >= 0 ? row[typeIdx] : 'O';
      // 헤더 자체에 "매입처:I, 매출처:O" 형태로 되어있으면 실제 값(row)에서 I/O/M
      rawType = rawType.trim();
      const customerType = (rawType === 'I' || rawType === 'O' || rawType === 'M')
        ? rawType : 'O';

      customers.push({
        id: uuidv4(),
        name: name.trim(),
        ceoName: ceoIdx >= 0 ? row[ceoIdx] : '',
        bizNo: cleanBizNo,
        address: addr1Idx >= 0 ? row[addr1Idx] : '',
        bizType: bizTypeIdx >= 0 ? row[bizTypeIdx] : '',
        bizItem: bizItemIdx >= 0 ? row[bizItemIdx] : '',
        phone,
        memo: memoIdx >= 0 ? row[memoIdx] : '',
        customerType,  // I=매입처, O=매출처, M=혼합처
      });
    } catch (e) {
      errors.push(`행 ${i + 1}: 파싱 오류`);
    }
  }

  return { customers, errors, skipped };
}

/**
 * File → Text 변환 (UTF-8 BOM / EUC-KR 자동 감지)
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const readerEuc = new FileReader();
    readerEuc.onload = (e) => {
      const text = e.target?.result as string;
      if (!text.includes('â€') && !text.includes('\uFFFD')) {
        resolve(text);
      } else {
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
