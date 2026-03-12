// 소매 단골 고객 관리 페이지 (매출/순이익 미반영)
import React, { useState, useMemo, useCallback } from 'react';
import { useRice } from '@/contexts/RiceContext';
import { RetailCustomer, RetailSale, RetailGrade, PaymentMethod } from '@/types/rice';
import {
  Users, Plus, Edit2, Trash2, Save, X, Search, Phone, MapPin,
  Gift, ShoppingBag, Clock, Star, Crown, ChevronDown, ChevronUp,
  ArrowUpRight, Package, CreditCard, Banknote, Wallet, AlertCircle,
  Calendar, TrendingUp, ChevronRight, Info
} from 'lucide-react';

const formatKRW = (v: number) => `₩${v.toLocaleString('ko-KR')}`;
const formatDate = (d: string) => d ? d.replace(/-/g, '.') : '-';
const today = () => new Date().toISOString().slice(0, 10);

// 등급 설정
const GRADES: { value: RetailGrade; label: string; color: string; bg: string; icon: React.ElementType }[] = [
  { value: 'vip',     label: 'VIP',    color: 'text-yellow-400', bg: 'bg-yellow-400/15 border-yellow-400/40', icon: Crown },
  { value: 'regular', label: '단골',   color: 'text-[#22c55e]',  bg: 'bg-[#22c55e]/15 border-[#22c55e]/40',  icon: Star },
  { value: 'new',     label: '신규',   color: 'text-green-400',  bg: 'bg-green-400/15 border-green-400/40',   icon: Users },
];

// 결제 방법
const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { value: 'cash',     label: '현금',   icon: Banknote },
  { value: 'transfer', label: '계좌이체', icon: Wallet },
  { value: 'card',     label: '카드',   icon: CreditCard },
  { value: 'credit',   label: '외상',   icon: AlertCircle },
];

const EMPTY_CUSTOMER: Omit<RetailCustomer, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', phone: '', address: '', birthDate: '',
  preferredProduct: '', purchaseCycle: '', grade: 'regular', memo: '',
};

const EMPTY_SALE: Omit<RetailSale, 'id'> = {
  customerId: '',
  date: today(),
  productName: '',
  quantity: 0,
  unit: 'kg',
  unitPrice: 0,
  totalAmount: 0,
  paymentMethod: 'cash',
  memo: '',
};

const UNITS = ['kg', '포대', '박스', '개'];

export default function RetailCustomerPage() {
  const {
    retailCustomers, addRetailCustomer, updateRetailCustomer, deleteRetailCustomer,
    retailSales, addRetailSale, updateRetailSale, deleteRetailSale,
    items,
  } = useRice();

  // 고객 목록 상태
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<RetailGrade | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null); // 판매기록 보기용

  // 고객 폼 상태
  const [showCustForm, setShowCustForm] = useState(false);
  const [editingCustId, setEditingCustId] = useState<string | null>(null);
  const [custForm, setCustForm] = useState({ ...EMPTY_CUSTOMER });

  // 판매 기록 폼 상태
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [saleForm, setSaleForm] = useState({ ...EMPTY_SALE });
  const [showProductSug, setShowProductSug] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [saleMsg, setSaleMsg] = useState('');

  // ── 필터링 ──
  const filteredCustomers = useMemo(() => {
    let list = retailCustomers;
    if (gradeFilter !== 'all') list = list.filter(c => c.grade === gradeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.address || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [retailCustomers, gradeFilter, search]);

  // ── 고객별 판매 통계 ──
  const customerStats = useMemo(() => {
    const map: Record<string, { total: number; count: number; lastDate: string }> = {};
    retailSales.forEach(s => {
      if (!map[s.customerId]) map[s.customerId] = { total: 0, count: 0, lastDate: '' };
      map[s.customerId].total += s.totalAmount;
      map[s.customerId].count += 1;
      if (!map[s.customerId].lastDate || s.date > map[s.customerId].lastDate) {
        map[s.customerId].lastDate = s.date;
      }
    });
    return map;
  }, [retailSales]);

  // ── 마지막 구매 경과일 ──
  const daysSince = (dateStr: string) => {
    if (!dateStr) return null;
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    return diff;
  };

  // ── 재구매 유도 대상 (30일 이상 미구매) ──
  const reminderCustomers = useMemo(() =>
    retailCustomers.filter(c => {
      const stats = customerStats[c.id];
      if (!stats?.lastDate) return false;
      const days = daysSince(stats.lastDate);
      return days !== null && days >= 30;
    }).sort((a, b) => {
      const da = daysSince(customerStats[a.id]?.lastDate || '') || 0;
      const db = daysSince(customerStats[b.id]?.lastDate || '') || 0;
      return db - da;
    }),
    [retailCustomers, customerStats]
  );

  // ── 품목 자동완성 ──
  const productSuggestions = useMemo(() => {
    if (!productSearch) return [];
    const q = productSearch.toLowerCase();
    const fromItems = items.filter(i => i.name.toLowerCase().includes(q)).map(i => ({ name: i.name, unit: i.unit }));
    const fromRetail = [...new Set(retailSales.map(s => s.productName).filter(n => n.toLowerCase().includes(q)))]
      .map(n => ({ name: n, unit: 'kg' }));
    const combined = [...fromItems];
    fromRetail.forEach(s => { if (!combined.find(i => i.name === s.name)) combined.push(s); });
    return combined.slice(0, 6);
  }, [productSearch, items, retailSales]);

  // ── 고객 저장 ──
  const handleSaveCustomer = async () => {
    if (!custForm.name.trim()) { alert('고객명을 입력해주세요.'); return; }
    if (editingCustId) {
      await updateRetailCustomer(editingCustId, custForm);
    } else {
      await addRetailCustomer(custForm);
    }
    setShowCustForm(false);
    setEditingCustId(null);
    setCustForm({ ...EMPTY_CUSTOMER });
  };

  const handleEditCustomer = (c: RetailCustomer) => {
    setEditingCustId(c.id);
    setCustForm({
      name: c.name, phone: c.phone || '', address: c.address || '',
      birthDate: c.birthDate || '', preferredProduct: c.preferredProduct || '',
      purchaseCycle: c.purchaseCycle || '', grade: c.grade, memo: c.memo || '',
    });
    setShowCustForm(true);
    setExpandedId(null);
    setActiveCustomerId(null);
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`「${name}」 고객 및 판매 기록을 모두 삭제하시겠습니까?`)) return;
    await deleteRetailCustomer(id);
    if (activeCustomerId === id) setActiveCustomerId(null);
  };

  // ── 판매 기록 폼 핸들링 ──
  const handleSaleFormChange = useCallback((field: string, value: unknown) => {
    setSaleForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Number(value) : prev.quantity;
        const price = field === 'unitPrice' ? Number(value) : prev.unitPrice;
        next.totalAmount = Math.round(qty * price);
      }
      return next;
    });
  }, []);

  const openSaleForm = (customerId: string) => {
    setEditingSaleId(null);
    setSaleForm({ ...EMPTY_SALE, customerId, date: today() });
    setProductSearch('');
    setShowSaleForm(true);
    setSaleMsg('');
  };

  const handleEditSale = (s: RetailSale) => {
    setEditingSaleId(s.id);
    setSaleForm({
      customerId: s.customerId, date: s.date, productName: s.productName,
      quantity: s.quantity, unit: s.unit, unitPrice: s.unitPrice,
      totalAmount: s.totalAmount, paymentMethod: s.paymentMethod, memo: s.memo || '',
    });
    setProductSearch(s.productName);
    setShowSaleForm(true);
    setSaleMsg('');
  };

  const handleSaveSale = async () => {
    if (!saleForm.customerId) { setSaleMsg('고객을 선택해주세요.'); return; }
    if (!saleForm.date) { setSaleMsg('날짜를 입력해주세요.'); return; }
    if (editingSaleId) {
      await updateRetailSale(editingSaleId, saleForm);
    } else {
      await addRetailSale(saleForm);
    }
    setShowSaleForm(false);
    setEditingSaleId(null);
    setSaleMsg('');
    setProductSearch('');
  };

  const handleDeleteSale = async (id: string) => {
    if (!confirm('이 판매 기록을 삭제하시겠습니까?')) return;
    await deleteRetailSale(id);
  };

  // ── 해당 고객의 판매 기록 ──
  const activeSales = useMemo(() =>
    retailSales.filter(s => s.customerId === activeCustomerId)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [retailSales, activeCustomerId]
  );

  const activeCustomer = retailCustomers.find(c => c.id === activeCustomerId);

  return (
    <div className="space-y-5">
      {/* ── 헤더 ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="text-pink-400" size={28} />
            소매 단골 고객 관리
          </h2>
          <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1">
            <Info size={11} />
            이 페이지의 판매 기록은 매출현황·순이익에 반영되지 않습니다
          </p>
        </div>
        <button
          onClick={() => { setShowCustForm(v => !v); setEditingCustId(null); setCustForm({ ...EMPTY_CUSTOMER }); setActiveCustomerId(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          <Plus size={16} />
          고객 등록
        </button>
      </div>

      {/* ── 재구매 알림 배너 ── */}
      {reminderCustomers.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={15} className="text-yellow-400" />
            <span className="text-yellow-300 font-medium text-sm">재구매 유도 필요 고객 ({reminderCustomers.length}명)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {reminderCustomers.slice(0, 6).map(c => {
              const days = daysSince(customerStats[c.id]?.lastDate || '');
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCustomerId(c.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/30 rounded-lg text-xs text-yellow-300 transition-colors"
                >
                  <Phone size={10} />
                  {c.name}
                  <span className="text-yellow-500">({days}일 경과)</span>
                </button>
              );
            })}
            {reminderCustomers.length > 6 && (
              <span className="text-yellow-500 text-xs self-center">+{reminderCustomers.length - 6}명</span>
            )}
          </div>
        </div>
      )}

      {/* ── 통계 요약 카드 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '전체 고객', value: retailCustomers.length, sub: '명', color: 'text-pink-400', icon: Users },
          { label: 'VIP 고객', value: retailCustomers.filter(c => c.grade === 'vip').length, sub: '명', color: 'text-yellow-400', icon: Crown },
          { label: '이번달 판매', value: retailSales.filter(s => s.date.startsWith(new Date().toISOString().slice(0, 7))).length, sub: '건', color: 'text-[#22c55e]', icon: ShoppingBag },
          { label: '누적 매출', value: formatKRW(retailSales.reduce((s, r) => s + r.totalAmount, 0)), sub: '', color: 'text-green-400', icon: TrendingUp },
        ].map(card => (
          <div key={card.label} className="bg-[#1c1f2e] rounded-xl p-4 border border-[#2e3147]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-xs">{card.label}</span>
              <card.icon size={14} className={card.color} />
            </div>
            <div className={`text-xl font-bold ${card.color}`}>
              {card.value}{card.sub && <span className="text-sm font-normal text-gray-400 ml-1">{card.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── 고객 등록/수정 폼 ── */}
      {showCustForm && (
        <div className="bg-[#1c1f2e] border border-pink-500/30 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Users size={16} className="text-pink-400" />
            {editingCustId ? '고객 정보 수정' : '신규 고객 등록'}
          </h3>

          {/* 등급 선택 */}
          <div className="mb-4">
            <label className="text-gray-400 text-xs mb-2 block">고객 등급</label>
            <div className="flex gap-2 flex-wrap">
              {GRADES.map(g => (
                <button key={g.value} type="button"
                  onClick={() => setCustForm(f => ({ ...f, grade: g.value }))}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${custForm.grade === g.value ? g.bg + ' ' + g.color : 'bg-[#0f1117] text-gray-500 border-[#2e3147]'}`}
                >
                  <g.icon size={13} />
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-gray-400 text-xs mb-1.5 block">고객명 <span className="text-red-400">*</span></label>
              <input type="text" placeholder="홍길동" value={custForm.name}
                onChange={e => setCustForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-pink-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1.5 flex items-center gap-1"><Phone size={11} />연락처</label>
              <input type="text" placeholder="010-1234-5678" value={custForm.phone}
                onChange={e => setCustForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-pink-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1.5 flex items-center gap-1"><Gift size={11} />생년월일</label>
              <input type="date" value={custForm.birthDate}
                onChange={e => setCustForm(f => ({ ...f, birthDate: e.target.value }))}
                className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-pink-400 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-gray-400 text-xs mb-1.5 flex items-center gap-1"><MapPin size={11} />주소 (배달지)</label>
              <input type="text" placeholder="서울특별시 ..." value={custForm.address}
                onChange={e => setCustForm(f => ({ ...f, address: e.target.value }))}
                className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-pink-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1.5 flex items-center gap-1"><Package size={11} />선호 품목</label>
              <input type="text" placeholder="신동진쌀 20kg" value={custForm.preferredProduct}
                onChange={e => setCustForm(f => ({ ...f, preferredProduct: e.target.value }))}
                className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-pink-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1.5 flex items-center gap-1"><Clock size={11} />구매 주기</label>
              <input type="text" placeholder="예: 2주마다 20kg" value={custForm.purchaseCycle}
                onChange={e => setCustForm(f => ({ ...f, purchaseCycle: e.target.value }))}
                className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-pink-400 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-gray-400 text-xs mb-1.5 block">메모 (특이사항, 배달 요청 등)</label>
              <textarea rows={2} placeholder="배달 시 문 앞에 두고 가세요 등..." value={custForm.memo}
                onChange={e => setCustForm(f => ({ ...f, memo: e.target.value }))}
                className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2 text-sm focus:border-pink-400 focus:outline-none resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSaveCustomer}
              className="flex items-center gap-2 px-5 py-2 bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-lg text-sm transition-colors">
              <Save size={15} />{editingCustId ? '수정 완료' : '등록'}
            </button>
            <button onClick={() => { setShowCustForm(false); setEditingCustId(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#2e3147] text-gray-300 rounded-lg hover:bg-[#4d5382] text-sm transition-colors">
              <X size={15} />취소
            </button>
          </div>
        </div>
      )}

      {/* ── 검색 / 필터 ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text" placeholder="이름, 연락처, 주소 검색..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#1c1f2e] border border-[#2e3147] text-white rounded-xl text-sm focus:border-pink-400 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5">
          {[{ value: 'all', label: '전체' }, ...GRADES.map(g => ({ value: g.value, label: g.label }))].map(g => (
            <button key={g.value}
              onClick={() => setGradeFilter(g.value as RetailGrade | 'all')}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${gradeFilter === g.value ? 'bg-pink-500 text-white' : 'bg-[#1c1f2e] text-gray-400 hover:text-white border border-[#2e3147]'}`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 메인 레이아웃: 고객 목록 + 판매 기록 패널 ── */}
      <div className={`grid gap-4 ${activeCustomerId ? 'lg:grid-cols-5' : 'grid-cols-1'}`}>

        {/* 고객 목록 */}
        <div className={activeCustomerId ? 'lg:col-span-2' : 'col-span-1'}>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Users size={48} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">{search || gradeFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 단골 고객이 없습니다.'}</p>
              <p className="text-sm mt-1">고객을 등록하면 구매 이력을 관리할 수 있습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCustomers.map(c => {
                const grade = GRADES.find(g => g.value === c.grade) || GRADES[1];
                const stats = customerStats[c.id];
                const days = stats?.lastDate ? daysSince(stats.lastDate) : null;
                const isActive = activeCustomerId === c.id;

                return (
                  <div key={c.id}
                    className={`bg-[#1c1f2e] rounded-xl border overflow-hidden transition-all ${isActive ? 'border-pink-500/60 ring-1 ring-pink-500/30' : 'border-[#2e3147] hover:border-[#5d6382]'}`}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* 등급 아이콘 */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${grade.bg}`}>
                        <grade.icon size={16} className={grade.color} />
                      </div>

                      {/* 기본 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-semibold">{c.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium border ${grade.bg} ${grade.color}`}>{grade.label}</span>
                          {days !== null && days >= 30 && (
                            <span className="text-xs text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded border border-yellow-400/20">
                              {days}일 미구매
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                          {c.phone && <span className="flex items-center gap-1"><Phone size={10} />{c.phone}</span>}
                          {stats && (
                            <span className="flex items-center gap-1 text-[#22c55e]">
                              <ShoppingBag size={10} />{stats.count}회 · {formatKRW(stats.total)}
                            </span>
                          )}
                          {stats?.lastDate && (
                            <span className="flex items-center gap-1 text-gray-500">
                              <Clock size={10} />최근: {formatDate(stats.lastDate)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setActiveCustomerId(isActive ? null : c.id)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${isActive ? 'bg-pink-500 text-white' : 'bg-[#2e3147] text-gray-300 hover:bg-pink-500/20 hover:text-pink-400'}`}
                        >
                          <ShoppingBag size={12} />
                          <span className="hidden sm:inline">기록</span>
                        </button>
                        <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                          className="p-1.5 text-gray-500 hover:text-white transition-colors">
                          {expandedId === c.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                        <button onClick={() => handleEditCustomer(c)} className="p-1.5 text-gray-400 hover:text-[#22c55e] transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteCustomer(c.id, c.name)} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>

                    {/* 확장 상세 */}
                    {expandedId === c.id && (
                      <div className="px-4 pb-4 pt-1 border-t border-[#2e3147]/50 space-y-1.5 text-sm">
                        {c.address && (
                          <div className="flex items-start gap-2">
                            <MapPin size={12} className="text-gray-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-300">{c.address}</span>
                          </div>
                        )}
                        {c.preferredProduct && (
                          <div className="flex items-center gap-2">
                            <Package size={12} className="text-gray-500" />
                            <span className="text-gray-400">선호: <span className="text-white">{c.preferredProduct}</span></span>
                          </div>
                        )}
                        {c.purchaseCycle && (
                          <div className="flex items-center gap-2">
                            <Clock size={12} className="text-gray-500" />
                            <span className="text-gray-400">구매주기: <span className="text-white">{c.purchaseCycle}</span></span>
                          </div>
                        )}
                        {c.birthDate && (
                          <div className="flex items-center gap-2">
                            <Gift size={12} className="text-gray-500" />
                            <span className="text-gray-400">생년월일: <span className="text-white">{formatDate(c.birthDate)}</span></span>
                          </div>
                        )}
                        {c.memo && (
                          <div className="bg-[#0f1117] rounded-lg px-3 py-2 text-gray-400 text-xs mt-2">
                            📝 {c.memo}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 판매 기록 패널 ── */}
        {activeCustomerId && activeCustomer && (
          <div className="lg:col-span-3 bg-[#1c1f2e] rounded-xl border border-[#2e3147] overflow-hidden">
            {/* 패널 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e3147] bg-[#252838]">
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-pink-400" />
                <span className="text-white font-semibold">{activeCustomer.name} 판매 기록</span>
                <span className="text-gray-500 text-xs">({activeSales.length}건)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openSaleForm(activeCustomerId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Plus size={13} />판매 추가
                </button>
                <button onClick={() => setActiveCustomerId(null)} className="p-1.5 text-gray-400 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* 판매 추가/수정 폼 */}
            {showSaleForm && (
              <div className="p-4 border-b border-[#2e3147] bg-[#1e2130]">
                <h4 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
                  <ArrowUpRight size={14} className="text-pink-400" />
                  {editingSaleId ? '판매 수정' : '판매 기록 추가'}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">날짜</label>
                    <input type="date" value={saleForm.date}
                      onChange={e => handleSaleFormChange('date', e.target.value)}
                      className="w-full bg-[#1c1f2e] border border-[#2e3147] text-white rounded-lg px-3 py-2 text-sm focus:border-pink-400 focus:outline-none"
                    />
                  </div>
                  <div className="relative">
                    <label className="text-gray-400 text-xs mb-1 block">품목명</label>
                    <input type="text" placeholder="신동진쌀 20kg" value={productSearch}
                      onChange={e => { setProductSearch(e.target.value); handleSaleFormChange('productName', e.target.value); setShowProductSug(true); }}
                      onFocus={() => setShowProductSug(true)}
                      onBlur={() => setTimeout(() => setShowProductSug(false), 150)}
                      className="w-full bg-[#1c1f2e] border border-[#2e3147] text-white rounded-lg px-3 py-2 text-sm focus:border-pink-400 focus:outline-none"
                    />
                    {showProductSug && productSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-[#1c1f2e] border border-[#2e3147] rounded-lg shadow-xl z-20 max-h-36 overflow-y-auto">
                        {productSuggestions.map(s => (
                          <button key={s.name} type="button"
                            onMouseDown={() => { setProductSearch(s.name); handleSaleFormChange('productName', s.name); if (s.unit) handleSaleFormChange('unit', s.unit); setShowProductSug(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-[#2a2d3e] text-sm text-gray-300 hover:text-white transition-colors"
                          >
                            {s.name} <span className="text-gray-500 text-xs">({s.unit})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">단위</label>
                    <div className="flex gap-1">
                      {UNITS.map(u => (
                        <button key={u} type="button"
                          onClick={() => handleSaleFormChange('unit', u)}
                          className={`px-2 py-1.5 rounded text-xs transition-colors ${saleForm.unit === u ? 'bg-pink-500 text-white' : 'bg-[#1c1f2e] text-gray-400 border border-[#2e3147] hover:text-white'}`}
                        >{u}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">수량</label>
                    <input type="number" min="0" step="0.1" placeholder="0" value={saleForm.quantity || ''}
                      onChange={e => handleSaleFormChange('quantity', e.target.value)}
                      className="w-full bg-[#1c1f2e] border border-[#2e3147] text-white rounded-lg px-3 py-2 text-sm focus:border-pink-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">단가</label>
                    <input type="number" min="0" placeholder="0" value={saleForm.unitPrice || ''}
                      onChange={e => handleSaleFormChange('unitPrice', e.target.value)}
                      className="w-full bg-[#1c1f2e] border border-[#2e3147] text-white rounded-lg px-3 py-2 text-sm focus:border-pink-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">합계금액</label>
                    <input type="number" min="0" placeholder="자동계산" value={saleForm.totalAmount || ''}
                      onChange={e => handleSaleFormChange('totalAmount', e.target.value)}
                      className="w-full bg-[#1c1f2e] border border-pink-400/40 text-pink-300 rounded-lg px-3 py-2 text-sm focus:border-pink-400 focus:outline-none font-semibold"
                    />
                  </div>
                  {/* 결제 방법 */}
                  <div className="col-span-2 sm:col-span-3">
                    <label className="text-gray-400 text-xs mb-1.5 block">결제 방법</label>
                    <div className="flex gap-2 flex-wrap">
                      {PAYMENT_METHODS.map(pm => (
                        <button key={pm.value} type="button"
                          onClick={() => handleSaleFormChange('paymentMethod', pm.value)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${saleForm.paymentMethod === pm.value ? 'bg-pink-500/20 border-pink-500/50 text-pink-300' : 'bg-[#1c1f2e] border-[#2e3147] text-gray-400 hover:text-white'}`}
                        >
                          <pm.icon size={12} />{pm.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <label className="text-gray-400 text-xs mb-1 block">메모</label>
                    <input type="text" placeholder="배달 완료 등..." value={saleForm.memo}
                      onChange={e => handleSaleFormChange('memo', e.target.value)}
                      className="w-full bg-[#1c1f2e] border border-[#2e3147] text-white rounded-lg px-3 py-2 text-sm focus:border-pink-400 focus:outline-none"
                    />
                  </div>
                </div>
                {saleMsg && <p className="text-red-400 text-xs mt-2">{saleMsg}</p>}
                <div className="flex gap-2 mt-3">
                  <button onClick={handleSaveSale}
                    className="flex items-center gap-1.5 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium transition-colors">
                    <Save size={14} />{editingSaleId ? '수정' : '저장'}
                  </button>
                  <button onClick={() => { setShowSaleForm(false); setEditingSaleId(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#2e3147] text-gray-300 rounded-lg text-sm transition-colors">
                    <X size={14} />취소
                  </button>
                </div>
              </div>
            )}

            {/* 고객 요약 */}
            {(() => {
              const stats = customerStats[activeCustomerId];
              if (!stats) return null;
              const days = stats.lastDate ? daysSince(stats.lastDate) : null;
              return (
                <div className="px-4 py-3 border-b border-[#2e3147] grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="text-[#22c55e] font-bold text-lg">{stats.count}회</div>
                    <div className="text-gray-500 text-xs">총 구매 횟수</div>
                  </div>
                  <div className="text-center">
                    <div className="text-green-400 font-bold text-lg">{formatKRW(stats.total)}</div>
                    <div className="text-gray-500 text-xs">누적 구매액</div>
                  </div>
                  <div className="text-center">
                    <div className={`font-bold text-lg ${days !== null && days >= 30 ? 'text-yellow-400' : 'text-gray-300'}`}>
                      {days !== null ? `${days}일` : '-'}
                    </div>
                    <div className="text-gray-500 text-xs">마지막 구매</div>
                  </div>
                </div>
              );
            })()}

            {/* 판매 기록 목록 */}
            {activeSales.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <ShoppingBag size={40} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">판매 기록이 없습니다.</p>
                <button
                  onClick={() => openSaleForm(activeCustomerId)}
                  className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-pink-500/20 text-pink-400 rounded-lg text-sm mx-auto border border-pink-500/30 hover:bg-pink-500/30 transition-colors"
                >
                  <Plus size={14} />첫 판매 기록 추가
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#2e3147]/50 max-h-[500px] overflow-y-auto">
                {activeSales.map(s => {
                  const pm = PAYMENT_METHODS.find(p => p.value === s.paymentMethod);
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#2a2d3e]/20 transition-colors">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
                          <Calendar size={14} className="text-pink-400" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white text-sm font-medium">{s.productName || '기타'}</span>
                          {pm && (
                            <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5 ${s.paymentMethod === 'credit' ? 'bg-red-500/10 text-red-400' : 'bg-[#2e3147] text-gray-400'}`}>
                              <pm.icon size={10} />{pm.label}
                            </span>
                          )}
                        </div>
                        <div className="text-gray-400 text-xs mt-0.5">
                          {formatDate(s.date)} · {s.quantity}{s.unit} × {formatKRW(s.unitPrice)}
                          {s.memo && <span className="text-gray-500"> · {s.memo}</span>}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-pink-300 font-semibold text-sm">{formatKRW(s.totalAmount)}</div>
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => handleEditSale(s)} className="p-1 text-gray-500 hover:text-[#22c55e] transition-colors"><Edit2 size={12} /></button>
                          <button onClick={() => handleDeleteSale(s.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
