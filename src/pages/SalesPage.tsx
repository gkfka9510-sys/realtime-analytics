// 매출 현황 페이지 - 직접입력 + CSV업로드 + 거래처별/기간별 거래장
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useRice } from '@/contexts/RiceContext';
import { SalesRecord, TransactionType } from '@/types/rice';
import { parseSalesCSV, parseTaxInvoiceCSV, readFileAsText } from '@/lib/csvParser';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import {
  Upload, Calendar, TrendingUp, DollarSign, FileText, Trash2, Plus,
  Edit2, Save, X, Search, BookOpen, Users, ChevronDown, AlertTriangle,
  ArrowUpRight, ArrowDownLeft, CreditCard, Banknote, Download
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const formatKRW = (v: number) => `₩${v.toLocaleString('ko-KR')}`;
const formatNum = (v: number) => v.toLocaleString('ko-KR');

// 거래 유형 설정
const TX_TYPES: { value: TransactionType; label: string; color: string; bg: string; icon: React.ElementType }[] = [
  { value: 'sale',     label: '매출', color: 'text-[#00d9ff]', bg: 'bg-[#00d9ff]/20 border-[#00d9ff]/50', icon: ArrowUpRight },
  { value: 'purchase', label: '매입', color: 'text-yellow-400', bg: 'bg-yellow-400/20 border-yellow-400/50', icon: ArrowDownLeft },
  { value: 'receipt',  label: '수금', color: 'text-green-400', bg: 'bg-green-400/20 border-green-400/50', icon: CreditCard },
  { value: 'payment',  label: '지불', color: 'text-red-400', bg: 'bg-red-400/20 border-red-400/50', icon: Banknote },
];

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  transactionType: 'sale' as TransactionType,
  companyName: '',
  productName: '',
  unit: 'kg',
  quantity: 0,
  unitPrice: 0,
  totalAmount: 0,
  memo: '',
};

type MainTab = 'chart' | 'ledger_customer' | 'ledger_period' | 'direct_input';

export default function SalesPage() {
  const {
    salesRecords, addSalesRecords, addSalesRecord, updateSalesRecord, deleteSalesRecord,
    taxInvoices, addTaxInvoices, customers, items
  } = useRice();

  const [mainTab, setMainTab] = useState<MainTab>('chart');
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [uploadMsg, setUploadMsg] = useState('');
  const [taxUploadMsg, setTaxUploadMsg] = useState('');
  const salesRef = useRef<HTMLInputElement>(null);
  const taxRef = useRef<HTMLInputElement>(null);

  // ── 거래처별 거래장 상태 ──
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [custDateFrom, setCustDateFrom] = useState('');
  const [custDateTo, setCustDateTo] = useState('');
  const [custTxFilter, setCustTxFilter] = useState<TransactionType | 'all'>('all');

  // ── 기간별 거래장 상태 ──
  const [periodFrom, setPeriodFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [periodTo, setPeriodTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodTxFilter, setPeriodTxFilter] = useState<TransactionType | 'all'>('all');
  const [periodSearch, setPeriodSearch] = useState('');

  // ── 직접 입력 상태 ──
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [showCompanySug, setShowCompanySug] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSug, setShowProductSug] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  // ── 월 목록 ──
  const months = useMemo(() => {
    const set = new Set(salesRecords.map(r => r.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [salesRecords]);

  // ── 월별 매출 집계 ──
  const monthlyData = useMemo(() => {
    const map: Record<string, { sale: number; purchase: number }> = {};
    salesRecords.forEach(r => {
      const m = r.date.slice(0, 7);
      if (!map[m]) map[m] = { sale: 0, purchase: 0 };
      if (r.transactionType === 'sale' || !r.transactionType) map[m].sale += r.totalAmount;
      else if (r.transactionType === 'purchase') map[m].purchase += r.totalAmount;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({
      month, sale: d.sale, purchase: d.purchase, label: month.replace('-', '년 ') + '월',
    }));
  }, [salesRecords]);

  // ── 일별 집계 ──
  const dailyData = useMemo(() => {
    const map: Record<string, number> = {};
    salesRecords.filter(r => r.date.startsWith(selectedMonth) && (!r.transactionType || r.transactionType === 'sale'))
      .forEach(r => { map[r.date] = (map[r.date] || 0) + r.totalAmount; });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({
      date: date.slice(5), total,
    }));
  }, [salesRecords, selectedMonth]);

  // ── 거래처 자동완성 ──
  const companySuggestions = useMemo(() => {
    if (!companySearch) return [];
    const q = companySearch.toLowerCase();
    const fromCustomers = customers.filter(c => c.name.toLowerCase().includes(q)).map(c => c.name);
    const fromSales = [...new Set(salesRecords.map(r => r.companyName).filter(n => n.toLowerCase().includes(q)))];
    return [...new Set([...fromCustomers, ...fromSales])].slice(0, 8);
  }, [companySearch, customers, salesRecords]);

  // ── 품목 자동완성 ──
  const productSuggestions = useMemo(() => {
    if (!productSearch) return [];
    const q = productSearch.toLowerCase();
    const fromItems = items.filter(i => i.name.toLowerCase().includes(q)).map(i => ({ name: i.name, unit: i.unit, price: i.costPrice }));
    const fromSales = [...new Set(salesRecords.map(r => r.productName).filter(n => n.toLowerCase().includes(q)))]
      .map(n => ({ name: n, unit: 'kg', price: 0 }));
    const combined = [...fromItems];
    fromSales.forEach(s => { if (!combined.find(i => i.name === s.name)) combined.push(s); });
    return combined.slice(0, 8);
  }, [productSearch, items, salesRecords]);

  // ── 직접 입력 폼 처리 ──
  const handleFormChange = useCallback((field: string, value: unknown) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // 공급가액 자동 계산
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Number(value) : prev.quantity;
        const price = field === 'unitPrice' ? Number(value) : prev.unitPrice;
        next.totalAmount = Math.round(qty * price);
      }
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!form.companyName.trim()) { setFormMsg('거래처명을 입력해주세요.'); return; }
    if (!form.date) { setFormMsg('날짜를 입력해주세요.'); return; }
    const record: SalesRecord = {
      id: editingId || uuidv4(),
      date: form.date,
      companyName: form.companyName.trim(),
      productName: form.productName.trim(),
      quantity: Number(form.quantity),
      unit: form.unit,
      unitPrice: Number(form.unitPrice),
      totalAmount: Number(form.totalAmount),
      memo: form.memo,
      transactionType: form.transactionType,
    };
    if (editingId) {
      await updateSalesRecord(editingId, record);
    } else {
      await addSalesRecord(record);
    }
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(false);
    setFormMsg('');
    setCompanySearch('');
    setProductSearch('');
  };

  const handleEdit = (r: SalesRecord) => {
    setEditingId(r.id);
    setForm({
      date: r.date, transactionType: r.transactionType || 'sale',
      companyName: r.companyName, productName: r.productName,
      unit: r.unit || 'kg', quantity: r.quantity, unitPrice: r.unitPrice,
      totalAmount: r.totalAmount, memo: r.memo || '',
    });
    setCompanySearch(r.companyName);
    setProductSearch(r.productName);
    setShowForm(true);
    setMainTab('direct_input');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 거래를 삭제하시겠습니까?')) return;
    await deleteSalesRecord(id);
  };

  // ── 거래처별 거래장 ──
  const customerLedger = useMemo(() => {
    let filtered = salesRecords.filter(r => {
      if (selectedCustomer && r.companyName !== selectedCustomer) return false;
      if (custSearch && !r.companyName.toLowerCase().includes(custSearch.toLowerCase())) return false;
      if (custDateFrom && r.date < custDateFrom) return false;
      if (custDateTo && r.date > custDateTo) return false;
      if (custTxFilter !== 'all' && r.transactionType !== custTxFilter) return false;
      return true;
    });
    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [salesRecords, selectedCustomer, custSearch, custDateFrom, custDateTo, custTxFilter]);

  const customerSummary = useMemo(() => {
    const map: Record<string, { sale: number; purchase: number; receipt: number; payment: number; count: number }> = {};
    customerLedger.forEach(r => {
      if (!map[r.companyName]) map[r.companyName] = { sale: 0, purchase: 0, receipt: 0, payment: 0, count: 0 };
      const t = r.transactionType || 'sale';
      map[r.companyName][t] = (map[r.companyName][t] || 0) + r.totalAmount;
      map[r.companyName].count++;
    });
    return Object.entries(map).map(([name, v]) => ({
      name, ...v, balance: v.sale - v.purchase - v.payment + v.receipt,
    })).sort((a, b) => b.sale - a.sale);
  }, [customerLedger]);

  // ── 기간별 거래장 ──
  const periodLedger = useMemo(() => {
    return salesRecords.filter(r => {
      if (r.date < periodFrom || r.date > periodTo) return false;
      if (periodTxFilter !== 'all' && r.transactionType !== periodTxFilter) return false;
      if (periodSearch && !r.companyName.toLowerCase().includes(periodSearch.toLowerCase()) &&
          !r.productName.toLowerCase().includes(periodSearch.toLowerCase())) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [salesRecords, periodFrom, periodTo, periodTxFilter, periodSearch]);

  const periodTotals = useMemo(() => ({
    sale: periodLedger.filter(r => !r.transactionType || r.transactionType === 'sale').reduce((s, r) => s + r.totalAmount, 0),
    purchase: periodLedger.filter(r => r.transactionType === 'purchase').reduce((s, r) => s + r.totalAmount, 0),
    receipt: periodLedger.filter(r => r.transactionType === 'receipt').reduce((s, r) => s + r.totalAmount, 0),
    payment: periodLedger.filter(r => r.transactionType === 'payment').reduce((s, r) => s + r.totalAmount, 0),
    count: periodLedger.length,
  }), [periodLedger]);

  // ── CSV 내보내기 ──
  const exportCSV = (data: SalesRecord[], filename: string) => {
    const headers = ['날짜', '유형', '거래처', '품목', '단위', '수량', '단가', '공급가액', '메모'];
    const rows = data.map(r => [
      r.date, TX_TYPES.find(t => t.value === r.transactionType)?.label || '매출',
      r.companyName, r.productName, r.unit || 'kg',
      r.quantity, r.unitPrice, r.totalAmount, r.memo || '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  };

  // ── CSV 업로드 ──
  const handleSalesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMsg('파일 파싱 중...');
    try {
      const text = await readFileAsText(file);
      const records = parseSalesCSV(text);
      if (records.length === 0) { setUploadMsg('⚠️ 파싱된 데이터가 없습니다.'); return; }
      await addSalesRecords(records);
      setUploadMsg(`✅ ${records.length}건 업로드 완료`);
    } catch (err) {
      setUploadMsg(`❌ 오류: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (salesRef.current) salesRef.current.value = '';
    setTimeout(() => setUploadMsg(''), 5000);
  };

  const handleTaxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTaxUploadMsg('파일 파싱 중...');
    try {
      const text = await readFileAsText(file);
      const invoices = parseTaxInvoiceCSV(text);
      if (invoices.length === 0) { setTaxUploadMsg('⚠️ 파싱된 데이터가 없습니다.'); return; }
      await addTaxInvoices(invoices);
      setTaxUploadMsg(`✅ ${invoices.length}건 업로드 완료`);
    } catch (err) {
      setTaxUploadMsg(`❌ 오류: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (taxRef.current) taxRef.current.value = '';
    setTimeout(() => setTaxUploadMsg(''), 5000);
  };

  // 거래 유형 배지
  const TxBadge = ({ type }: { type?: TransactionType }) => {
    const t = TX_TYPES.find(x => x.value === (type || 'sale')) || TX_TYPES[0];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${t.bg} ${t.color}`}>
        <t.icon size={10} />{t.label}
      </span>
    );
  };

  const uniqueCompanies = useMemo(() =>
    [...new Set(salesRecords.map(r => r.companyName))].sort(),
    [salesRecords]
  );

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="text-[#00d9ff]" size={28} />
          매출 관리
        </h2>
        <div className="flex flex-wrap gap-2">
          {/* CSV 업로드 */}
          <label className="flex items-center gap-2 px-3 py-2 bg-[#2d3142] hover:bg-[#3d4362] border border-[#3d4362] text-gray-300 rounded-xl text-xs cursor-pointer transition-colors">
            <Upload size={14} />매출 CSV
            <input ref={salesRef} type="file" accept=".csv" className="hidden" onChange={handleSalesUpload} />
          </label>
          <label className="flex items-center gap-2 px-3 py-2 bg-[#2d3142] hover:bg-[#3d4362] border border-[#3d4362] text-gray-300 rounded-xl text-xs cursor-pointer transition-colors">
            <Upload size={14} />세금계산서 CSV
            <input ref={taxRef} type="file" accept=".csv" className="hidden" onChange={handleTaxUpload} />
          </label>
          {uploadMsg && <span className={`text-xs py-2 ${uploadMsg.startsWith('✅') ? 'text-green-400' : 'text-yellow-400'}`}>{uploadMsg}</span>}
          {taxUploadMsg && <span className={`text-xs py-2 ${taxUploadMsg.startsWith('✅') ? 'text-green-400' : 'text-yellow-400'}`}>{taxUploadMsg}</span>}
        </div>
      </div>

      {/* 메인 탭 */}
      <div className="flex gap-1 bg-[#2d3142] rounded-xl p-1 border border-[#3d4362]">
        {[
          { id: 'chart' as MainTab, label: '매출 현황', shortLabel: '현황', icon: TrendingUp },
          { id: 'ledger_customer' as MainTab, label: '거래처별', shortLabel: '거래처', icon: Users },
          { id: 'ledger_period' as MainTab, label: '기간별', shortLabel: '기간별', icon: BookOpen },
          { id: 'direct_input' as MainTab, label: '거래 입력', shortLabel: '입력', icon: Plus },
        ].map(tab => (
          <button key={tab.id}
            onClick={() => setMainTab(tab.id)}
            className={`flex items-center gap-1.5 px-2 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex-1 justify-center ${mainTab === tab.id ? 'bg-[#00d9ff] text-[#1a1d29]' : 'text-gray-400 hover:text-white'}`}
          >
            <tab.icon size={14} />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.shortLabel}</span>
          </button>
        ))}
      </div>

      {/* ═══════ 매출 현황 탭 ═══════ */}
      {mainTab === 'chart' && (
        <div className="space-y-5">
          {/* 요약 카드 */}
          {(() => {
            const thisM = new Date();
            const ym = `${thisM.getFullYear()}-${String(thisM.getMonth() + 1).padStart(2, '0')}`;
            const thisMonthSales = salesRecords.filter(r => r.date.startsWith(ym) && (!r.transactionType || r.transactionType === 'sale'));
            const total = thisMonthSales.reduce((s, r) => s + r.totalAmount, 0);
            const companies = new Set(thisMonthSales.map(r => r.companyName)).size;
            return (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: '이번달 매출', value: formatKRW(total), color: '#00d9ff', icon: TrendingUp },
                  { label: '거래 건수', value: `${formatNum(thisMonthSales.length)}건`, color: '#7c3aed', icon: FileText },
                  { label: '거래 업체수', value: `${companies}개사`, color: '#f59e0b', icon: Users },
                ].map((c, i) => (
                  <div key={i} className="bg-[#2d3142] rounded-xl p-4 border border-[#3d4362]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-xs">{c.label}</span>
                      <c.icon size={16} style={{ color: c.color }} />
                    </div>
                    <div className="font-bold text-xl" style={{ color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* 차트 모드 전환 */}
          <div className="flex items-center gap-3">
            <div className="flex bg-[#2d3142] rounded-xl p-1 border border-[#3d4362]">
              <button onClick={() => setViewMode('monthly')}
                className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${viewMode === 'monthly' ? 'bg-[#00d9ff] text-[#1a1d29] font-medium' : 'text-gray-400 hover:text-white'}`}>
                월별
              </button>
              <button onClick={() => setViewMode('daily')}
                className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${viewMode === 'daily' ? 'bg-[#00d9ff] text-[#1a1d29] font-medium' : 'text-gray-400 hover:text-white'}`}>
                일별
              </button>
            </div>
            {viewMode === 'daily' && months.length > 0 && (
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                className="bg-[#2d3142] border border-[#3d4362] text-white rounded-xl px-3 py-1.5 text-sm">
                {months.map(m => <option key={m} value={m}>{m.replace('-', '년 ')}월</option>)}
              </select>
            )}
          </div>

          {/* 차트 */}
          {salesRecords.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <TrendingUp size={48} className="mx-auto mb-3 opacity-20" />
              <p>매출 데이터를 업로드하거나 직접 입력해주세요.</p>
            </div>
          ) : viewMode === 'monthly' ? (
            <div className="bg-[#2d3142] rounded-xl p-5 border border-[#3d4362]">
              <h3 className="text-white font-semibold mb-4">월별 매출 / 매입 추이</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3d4362" />
                  <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => `${(v / 1000000).toFixed(0)}M`} />
                  <Tooltip contentStyle={{ background: '#1a1d29', border: '1px solid #3d4362', borderRadius: 8 }}
                    formatter={(v: number, name: string) => [formatKRW(v), name === 'sale' ? '매출' : '매입']} />
                  <Legend formatter={v => v === 'sale' ? '매출' : '매입'} />
                  <Bar dataKey="sale" fill="#00d9ff" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="purchase" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-[#2d3142] rounded-xl p-5 border border-[#3d4362]">
              <h3 className="text-white font-semibold mb-4">{selectedMonth.replace('-', '년 ')}월 일별 매출</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={dailyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3d4362" />
                  <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => `${(v / 10000).toFixed(0)}만`} />
                  <Tooltip contentStyle={{ background: '#1a1d29', border: '1px solid #3d4362', borderRadius: 8 }}
                    formatter={(v: number) => [formatKRW(v), '매출']} />
                  <Line type="monotone" dataKey="total" stroke="#00d9ff" strokeWidth={2} dot={{ fill: '#00d9ff', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* 최근 거래 테이블 */}
          {salesRecords.length > 0 && (
            <div className="bg-[#2d3142] rounded-xl border border-[#3d4362] overflow-hidden">
              <div className="p-4 border-b border-[#3d4362] flex items-center justify-between">
                <h3 className="text-white font-semibold">최근 거래 내역</h3>
                <span className="text-gray-500 text-xs">총 {formatNum(salesRecords.length)}건</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#3d4362]">
                      {['날짜', '유형', '거래처', '품목', '수량', '단가', '공급가액', ''].map(h => (
                        <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salesRecords.slice(0, 30).map(r => (
                      <tr key={r.id} className="border-b border-[#3d4362]/40 hover:bg-[#3d4362]/20">
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{r.date}</td>
                        <td className="px-4 py-3"><TxBadge type={r.transactionType} /></td>
                        <td className="px-4 py-3 text-white whitespace-nowrap max-w-[120px] truncate">{r.companyName}</td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap max-w-[120px] truncate">{r.productName || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{r.quantity > 0 ? `${formatNum(r.quantity)}${r.unit || 'kg'}` : '-'}</td>
                        <td className="px-4 py-3 text-gray-400">{r.unitPrice > 0 ? formatKRW(r.unitPrice) : '-'}</td>
                        <td className="px-4 py-3 text-[#00d9ff] font-semibold whitespace-nowrap">{formatKRW(r.totalAmount)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => handleEdit(r)} className="text-gray-500 hover:text-[#00d9ff] transition-colors"><Edit2 size={13} /></button>
                            <button onClick={() => handleDelete(r.id)} className="text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ 거래처별 거래장 ═══════ */}
      {mainTab === 'ledger_customer' && (
        <div className="space-y-4">
          {/* 필터 */}
          <div className="bg-[#2d3142] rounded-xl p-4 border border-[#3d4362]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs mb-1.5 block">거래처 선택</label>
                <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}
                  className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none">
                  <option value="">전체 거래처</option>
                  {uniqueCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">거래 유형</label>
                <select value={custTxFilter} onChange={e => setCustTxFilter(e.target.value as TransactionType | 'all')}
                  className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none">
                  <option value="all">전체</option>
                  {TX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">검색</label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="text" placeholder="거래처명..." value={custSearch}
                    onChange={e => setCustSearch(e.target.value)}
                    className="w-full pl-8 bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">시작일</label>
                <input type="date" value={custDateFrom} onChange={e => setCustDateFrom(e.target.value)}
                  className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">종료일</label>
                <input type="date" value={custDateTo} onChange={e => setCustDateTo(e.target.value)}
                  className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none" />
              </div>
              <div className="flex items-end">
                <button onClick={() => exportCSV(customerLedger, `거래처별_거래장_${new Date().toLocaleDateString('ko-KR').replace(/\. /g, '-').replace('.', '')}.csv`)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#3d4362] hover:bg-[#4d5382] text-gray-300 rounded-lg text-sm transition-colors">
                  <Download size={14} />내보내기
                </button>
              </div>
            </div>
          </div>

          {/* 거래처별 합계 요약 */}
          {!selectedCustomer && customerSummary.length > 0 && (
            <div className="bg-[#2d3142] rounded-xl border border-[#3d4362] overflow-hidden">
              <div className="p-3 border-b border-[#3d4362]">
                <h3 className="text-white font-semibold text-sm">거래처별 요약</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#3d4362]">
                      {['거래처', '매출', '매입', '수금', '지불', '건수'].map(h => (
                        <th key={h} className="text-left text-gray-400 px-4 py-2.5 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {customerSummary.map(c => (
                      <tr key={c.name} className="border-b border-[#3d4362]/40 hover:bg-[#3d4362]/20 cursor-pointer"
                        onClick={() => setSelectedCustomer(c.name)}>
                        <td className="px-4 py-2.5 text-white font-medium">{c.name}</td>
                        <td className="px-4 py-2.5 text-[#00d9ff]">{c.sale > 0 ? formatKRW(c.sale) : '-'}</td>
                        <td className="px-4 py-2.5 text-yellow-400">{c.purchase > 0 ? formatKRW(c.purchase) : '-'}</td>
                        <td className="px-4 py-2.5 text-green-400">{c.receipt > 0 ? formatKRW(c.receipt) : '-'}</td>
                        <td className="px-4 py-2.5 text-red-400">{c.payment > 0 ? formatKRW(c.payment) : '-'}</td>
                        <td className="px-4 py-2.5 text-gray-400">{c.count}건</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 거래 상세 */}
          <div className="bg-[#2d3142] rounded-xl border border-[#3d4362] overflow-hidden">
            <div className="p-4 border-b border-[#3d4362] flex items-center justify-between">
              <h3 className="text-white font-semibold">{selectedCustomer || '전체'} 거래 내역</h3>
              <span className="text-gray-500 text-xs">{formatNum(customerLedger.length)}건</span>
            </div>
            {customerLedger.length === 0 ? (
              <div className="text-center py-10 text-gray-500">거래 내역이 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#3d4362]">
                      {['날짜', '유형', '거래처', '품목', '수량', '단가', '공급가액', '메모', ''].map(h => (
                        <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {customerLedger.map(r => (
                      <tr key={r.id} className="border-b border-[#3d4362]/40 hover:bg-[#3d4362]/20">
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{r.date}</td>
                        <td className="px-4 py-3"><TxBadge type={r.transactionType} /></td>
                        <td className="px-4 py-3 text-white whitespace-nowrap">{r.companyName}</td>
                        <td className="px-4 py-3 text-gray-300">{r.productName || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{r.quantity > 0 ? `${formatNum(r.quantity)}${r.unit || ''}` : '-'}</td>
                        <td className="px-4 py-3 text-gray-400">{r.unitPrice > 0 ? formatKRW(r.unitPrice) : '-'}</td>
                        <td className="px-4 py-3 font-semibold whitespace-nowrap">
                          <span className={r.transactionType === 'sale' || !r.transactionType ? 'text-[#00d9ff]' : r.transactionType === 'purchase' ? 'text-yellow-400' : r.transactionType === 'receipt' ? 'text-green-400' : 'text-red-400'}>
                            {formatKRW(r.totalAmount)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-[100px] truncate">{r.memo || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => handleEdit(r)} className="text-gray-500 hover:text-[#00d9ff]"><Edit2 size={13} /></button>
                            <button onClick={() => handleDelete(r.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ 기간별 거래장 ═══════ */}
      {mainTab === 'ledger_period' && (
        <div className="space-y-4">
          {/* 필터 */}
          <div className="bg-[#2d3142] rounded-xl p-4 border border-[#3d4362]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">시작일</label>
                <input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)}
                  className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">종료일</label>
                <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)}
                  className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">거래 유형</label>
                <select value={periodTxFilter} onChange={e => setPeriodTxFilter(e.target.value as TransactionType | 'all')}
                  className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none">
                  <option value="all">전체</option>
                  {TX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">검색</label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input type="text" placeholder="거래처/품목..." value={periodSearch}
                    onChange={e => setPeriodSearch(e.target.value)}
                    className="w-full pl-8 bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none" />
                </div>
              </div>
            </div>
            {/* 빠른 기간 선택 */}
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { label: '이번달', fn: () => { const d = new Date(); const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; setPeriodFrom(`${ym}-01`); setPeriodTo(d.toISOString().slice(0,10)); }},
                { label: '지난달', fn: () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-1); const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; const last = new Date(d.getFullYear(), d.getMonth()+1, 0); setPeriodFrom(`${ym}-01`); setPeriodTo(last.toISOString().slice(0,10)); }},
                { label: '최근 3개월', fn: () => { const d = new Date(); const f = new Date(); f.setMonth(f.getMonth()-3); setPeriodFrom(f.toISOString().slice(0,10)); setPeriodTo(d.toISOString().slice(0,10)); }},
                { label: '올해', fn: () => { const y = new Date().getFullYear(); setPeriodFrom(`${y}-01-01`); setPeriodTo(`${y}-12-31`); }},
              ].map(b => (
                <button key={b.label} onClick={b.fn}
                  className="px-3 py-1.5 bg-[#1a1d29] hover:bg-[#3d4362] border border-[#3d4362] text-gray-400 hover:text-white rounded-lg text-xs transition-colors">
                  {b.label}
                </button>
              ))}
              <button onClick={() => exportCSV(periodLedger, `기간별_거래장_${periodFrom}_${periodTo}.csv`)}
                className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-[#3d4362] hover:bg-[#4d5382] text-gray-300 rounded-lg text-xs transition-colors">
                <Download size={13} />내보내기
              </button>
            </div>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '매출 합계', value: formatKRW(periodTotals.sale), color: '#00d9ff' },
              { label: '매입 합계', value: formatKRW(periodTotals.purchase), color: '#f59e0b' },
              { label: '수금 합계', value: formatKRW(periodTotals.receipt), color: '#10b981' },
              { label: '지불 합계', value: formatKRW(periodTotals.payment), color: '#ef4444' },
            ].map((c, i) => (
              <div key={i} className="bg-[#2d3142] rounded-xl p-3 border border-[#3d4362]">
                <div className="text-gray-400 text-xs mb-1">{c.label}</div>
                <div className="font-bold" style={{ color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* 거래 목록 */}
          <div className="bg-[#2d3142] rounded-xl border border-[#3d4362] overflow-hidden">
            <div className="p-4 border-b border-[#3d4362] flex items-center justify-between">
              <h3 className="text-white font-semibold">기간 내 거래 내역</h3>
              <span className="text-gray-500 text-xs">{formatNum(periodLedger.length)}건</span>
            </div>
            {periodLedger.length === 0 ? (
              <div className="text-center py-10 text-gray-500">해당 기간에 거래 내역이 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#3d4362]">
                      {['날짜', '유형', '거래처', '품목', '수량', '단가', '공급가액', '메모', ''].map(h => (
                        <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periodLedger.map(r => (
                      <tr key={r.id} className="border-b border-[#3d4362]/40 hover:bg-[#3d4362]/20">
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{r.date}</td>
                        <td className="px-4 py-3"><TxBadge type={r.transactionType} /></td>
                        <td className="px-4 py-3 text-white whitespace-nowrap max-w-[120px] truncate">{r.companyName}</td>
                        <td className="px-4 py-3 text-gray-300 max-w-[100px] truncate">{r.productName || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{r.quantity > 0 ? `${formatNum(r.quantity)}${r.unit || ''}` : '-'}</td>
                        <td className="px-4 py-3 text-gray-400">{r.unitPrice > 0 ? formatKRW(r.unitPrice) : '-'}</td>
                        <td className="px-4 py-3 font-semibold whitespace-nowrap">
                          <span className={r.transactionType === 'sale' || !r.transactionType ? 'text-[#00d9ff]' : r.transactionType === 'purchase' ? 'text-yellow-400' : r.transactionType === 'receipt' ? 'text-green-400' : 'text-red-400'}>
                            {formatKRW(r.totalAmount)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-[100px] truncate">{r.memo || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => handleEdit(r)} className="text-gray-500 hover:text-[#00d9ff]"><Edit2 size={13} /></button>
                            <button onClick={() => handleDelete(r.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ 거래 직접 입력 탭 ═══════ */}
      {mainTab === 'direct_input' && (
        <div className="space-y-4">
          {/* 새 거래 입력 버튼 */}
          {!showForm && (
            <button
              onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...EMPTY_FORM }); setCompanySearch(''); setProductSearch(''); }}
              className="w-full flex items-center justify-center gap-2 py-3.5 border-2 border-dashed border-[#3d4362] hover:border-[#00d9ff] text-gray-400 hover:text-[#00d9ff] rounded-xl transition-colors"
            >
              <Plus size={20} />
              새 거래 입력
            </button>
          )}

          {/* 입력 폼 */}
          {showForm && (
            <div className="bg-[#2d3142] border border-[#00d9ff]/30 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
                <Plus size={16} className="text-[#00d9ff]" />
                {editingId ? '거래 수정' : '새 거래 입력'}
              </h3>

              {/* ① 거래 구분 선택 (가장 먼저) */}
              <div className="mb-5">
                <label className="text-gray-400 text-xs mb-2 block font-medium">① 거래 구분 선택 <span className="text-red-400">*</span></label>
                <div className="flex gap-3 flex-wrap">
                  {TX_TYPES.map(t => (
                    <button key={t.value}
                      onClick={() => handleFormChange('transactionType', t.value)}
                      className={`flex items-center gap-2 px-5 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        form.transactionType === t.value ? `${t.bg} ${t.color} border-2` : 'bg-[#1a1d29] text-gray-400 border-[#3d4362] hover:border-[#4d5382]'
                      }`}
                    >
                      <t.icon size={16} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 거래일자 */}
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 flex items-center gap-1">
                    <Calendar size={11} />거래일자 <span className="text-red-400">*</span>
                  </label>
                  <input type="date" value={form.date}
                    onChange={e => handleFormChange('date', e.target.value)}
                    className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#00d9ff] focus:outline-none"
                  />
                </div>

                {/* 거래처명 */}
                <div className="relative">
                  <label className="text-gray-400 text-xs mb-1.5 flex items-center gap-1">
                    <Users size={11} />거래처명 <span className="text-red-400">*</span>
                  </label>
                  <input type="text" placeholder="거래처 입력 또는 검색"
                    value={companySearch}
                    onChange={e => {
                      setCompanySearch(e.target.value);
                      handleFormChange('companyName', e.target.value);
                      setShowCompanySug(true);
                    }}
                    onFocus={() => setShowCompanySug(true)}
                    onBlur={() => setTimeout(() => setShowCompanySug(false), 150)}
                    className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#00d9ff] focus:outline-none"
                  />
                  {showCompanySug && companySuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 bg-[#1a1d29] border border-[#3d4362] rounded-lg mt-1 shadow-xl max-h-40 overflow-y-auto">
                      {companySuggestions.map(s => (
                        <button key={s} onMouseDown={() => { setCompanySearch(s); handleFormChange('companyName', s); setShowCompanySug(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#3d4362] hover:text-white transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 품명 */}
                <div className="relative">
                  <label className="text-gray-400 text-xs mb-1.5 flex items-center gap-1">
                    <Package size={11} />품명
                  </label>
                  <input type="text" placeholder="품목 입력 또는 검색"
                    value={productSearch}
                    onChange={e => {
                      setProductSearch(e.target.value);
                      handleFormChange('productName', e.target.value);
                      setShowProductSug(true);
                    }}
                    onFocus={() => setShowProductSug(true)}
                    onBlur={() => setTimeout(() => setShowProductSug(false), 150)}
                    className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#00d9ff] focus:outline-none"
                  />
                  {showProductSug && productSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 bg-[#1a1d29] border border-[#3d4362] rounded-lg mt-1 shadow-xl max-h-40 overflow-y-auto">
                      {productSuggestions.map(s => (
                        <button key={s.name} onMouseDown={() => {
                          setProductSearch(s.name);
                          setForm(prev => ({
                            ...prev, productName: s.name, unit: s.unit,
                            unitPrice: s.price > 0 ? s.price : prev.unitPrice,
                            totalAmount: s.price > 0 ? Math.round(prev.quantity * s.price) : prev.totalAmount,
                          }));
                          setShowProductSug(false);
                        }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-[#3d4362] hover:text-white transition-colors flex items-center justify-between">
                          <span>{s.name}</span>
                          <span className="text-gray-500 text-xs">{s.unit}{s.price > 0 ? ` · ${formatKRW(s.price)}` : ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 단위 */}
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">단위</label>
                  <div className="flex gap-1 flex-wrap mb-1">
                    {['kg', '포대', '박스', '개'].map(u => (
                      <button key={u} type="button" onClick={() => handleFormChange('unit', u)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors ${form.unit === u ? 'bg-[#00d9ff] text-[#1a1d29]' : 'bg-[#1a1d29] text-gray-400 border border-[#3d4362]'}`}>
                        {u}
                      </button>
                    ))}
                  </div>
                  <input type="text" value={form.unit} onChange={e => handleFormChange('unit', e.target.value)}
                    className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-1.5 text-sm focus:border-[#00d9ff] focus:outline-none" />
                </div>

                {/* 수량 */}
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">수량</label>
                  <input type="number" min="0" step="0.1" placeholder="0"
                    value={form.quantity || ''}
                    onChange={e => handleFormChange('quantity', e.target.value)}
                    className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#00d9ff] focus:outline-none"
                  />
                </div>

                {/* 단가 */}
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">단가 (원)</label>
                  <input type="number" min="0" placeholder="0"
                    value={form.unitPrice || ''}
                    onChange={e => handleFormChange('unitPrice', e.target.value)}
                    className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#00d9ff] focus:outline-none"
                  />
                </div>

                {/* 공급가액 (자동계산) */}
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">
                    공급가액 (원)
                    <span className="ml-2 text-[#00d9ff] text-xs">← 수량×단가 자동계산</span>
                  </label>
                  <input type="number" min="0" placeholder="자동계산 또는 직접입력"
                    value={form.totalAmount || ''}
                    onChange={e => setForm(prev => ({ ...prev, totalAmount: Number(e.target.value) }))}
                    className="w-full bg-[#1a1d29] border border-[#00d9ff]/40 text-[#00d9ff] font-bold rounded-lg px-3 py-2.5 text-sm focus:border-[#00d9ff] focus:outline-none"
                  />
                  {form.totalAmount > 0 && (
                    <p className="text-[#00d9ff] text-xs mt-1 font-semibold">{formatKRW(form.totalAmount)}</p>
                  )}
                </div>

                {/* 메모 */}
                <div className="md:col-span-2">
                  <label className="text-gray-400 text-xs mb-1.5 block">메모</label>
                  <input type="text" placeholder="비고사항 입력" value={form.memo}
                    onChange={e => handleFormChange('memo', e.target.value)}
                    className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#00d9ff] focus:outline-none"
                  />
                </div>
              </div>

              {formMsg && <p className="text-red-400 text-sm mt-3">{formMsg}</p>}

              <div className="flex gap-2 mt-5">
                <button onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#00d9ff] text-[#1a1d29] font-bold rounded-xl hover:bg-[#00b8d9] text-sm transition-colors">
                  <Save size={16} />{editingId ? '수정 완료' : '저장'}
                </button>
                <button onClick={() => { setShowForm(false); setEditingId(null); setFormMsg(''); }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#3d4362] text-gray-300 rounded-xl hover:bg-[#4d5382] text-sm transition-colors">
                  <X size={16} />취소
                </button>
              </div>
            </div>
          )}

          {/* 최근 입력된 거래 목록 */}
          {salesRecords.length > 0 && (
            <div className="bg-[#2d3142] rounded-xl border border-[#3d4362] overflow-hidden">
              <div className="p-4 border-b border-[#3d4362]">
                <h3 className="text-white font-semibold">전체 거래 내역 ({formatNum(salesRecords.length)}건)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#3d4362]">
                      {['날짜', '유형', '거래처', '품목', '수량', '단가', '공급가액', '메모', ''].map(h => (
                        <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salesRecords.slice(0, 100).map(r => (
                      <tr key={r.id} className="border-b border-[#3d4362]/40 hover:bg-[#3d4362]/20">
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{r.date}</td>
                        <td className="px-4 py-3"><TxBadge type={r.transactionType} /></td>
                        <td className="px-4 py-3 text-white whitespace-nowrap">{r.companyName}</td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap max-w-[120px] truncate">{r.productName || '-'}</td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{r.quantity > 0 ? `${formatNum(r.quantity)}${r.unit || ''}` : '-'}</td>
                        <td className="px-4 py-3 text-gray-400">{r.unitPrice > 0 ? formatKRW(r.unitPrice) : '-'}</td>
                        <td className="px-4 py-3 font-semibold whitespace-nowrap">
                          <span className={r.transactionType === 'sale' || !r.transactionType ? 'text-[#00d9ff]' : r.transactionType === 'purchase' ? 'text-yellow-400' : r.transactionType === 'receipt' ? 'text-green-400' : 'text-red-400'}>
                            {formatKRW(r.totalAmount)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 max-w-[100px] truncate">{r.memo || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => handleEdit(r)} className="text-gray-500 hover:text-[#00d9ff]"><Edit2 size={13} /></button>
                            <button onClick={() => handleDelete(r.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
