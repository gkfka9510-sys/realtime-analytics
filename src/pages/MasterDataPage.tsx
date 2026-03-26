// 기초데이터 관리 페이지 - 거래처 & 품목 등록 + CSV 일괄 등록
import React, { useState, useMemo, useRef } from 'react';
import { useRice } from '@/contexts/RiceContext';
import { Customer, Item } from '@/types/rice';
import { parseCustomerCSV, readFileAsText } from '@/lib/csvParser';
import {
  Users, Package, Plus, Edit2, Trash2, Save, X, Search,
  Phone, MapPin, Building2, Mail, Hash, FileText,
  ChevronDown, ChevronUp, Upload, ShoppingCart, ShoppingBag, GitMerge
} from 'lucide-react';

const formatKRW = (v: number) => `₩${v.toLocaleString('ko-KR')}`;

type ActiveTab = 'customers' | 'items';

// 거래처구분 배지 컴포넌트
const CustomerTypeBadge = ({ type }: { type?: string }) => {
  if (type === 'I') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
      <ShoppingBag size={10} />매입처
    </span>
  );
  if (type === 'M') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
      <GitMerge size={10} />혼합처
    </span>
  );
  // O 또는 기본값
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
      <ShoppingCart size={10} />매출처
    </span>
  );
};

// 거래처구분 필터 탭
const TYPE_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'O',   label: '매출처' },
  { value: 'I',   label: '매입처' },
  { value: 'M',   label: '혼합처' },
];

const EMPTY_CUSTOMER: Omit<Customer, 'id' | 'createdAt'> = {
  name: '', phone: '', bizNo: '', address: '', ceoName: '',
  bizType: '', bizItem: '', email: '', memo: '', customerType: 'O',
};
const EMPTY_ITEM: Omit<Item, 'id' | 'createdAt'> = {
  name: '', spec: '', unit: 'kg', stock: 0, costPrice: 0, memo: '',
};

const UNITS = ['kg', '포대', '박스', '개', '톤', 'L', '병', '묶음', '세트'];

export default function MasterDataPage() {
  const { customers, addCustomer, bulkAddCustomers, updateCustomer, deleteCustomer, items, addItem, updateItem, deleteItem } = useRice();
  const [activeTab, setActiveTab] = useState<ActiveTab>('customers');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // ── 거래처 폼 ──
  const [showCustForm, setShowCustForm] = useState(false);
  const [editingCustId, setEditingCustId] = useState<string | null>(null);
  const [custForm, setCustForm] = useState(EMPTY_CUSTOMER);
  const [expandedCustId, setExpandedCustId] = useState<string | null>(null);

  // ── CSV 업로드 ──
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvMsg, setCsvMsg] = useState('');

  // ── 품목 폼 ──
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);

  // ── 필터 ──
  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (typeFilter !== 'all') list = list.filter(c => (c.customerType || 'O') === typeFilter);
    if (search) list = list.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.bizNo || '').includes(search) ||
      (c.phone || '').includes(search) ||
      (c.ceoName || '').toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [customers, search, typeFilter]);

  const filteredItems = useMemo(() =>
    items.filter(i =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.spec || '').toLowerCase().includes(search.toLowerCase())
    ), [items, search]);

  // 구분별 카운트
  const typeCounts = useMemo(() => ({
    all: customers.length,
    O: customers.filter(c => !c.customerType || c.customerType === 'O').length,
    I: customers.filter(c => c.customerType === 'I').length,
    M: customers.filter(c => c.customerType === 'M').length,
  }), [customers]);

  // ── CSV 업로드 핸들러 ──
  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvMsg('파싱 중...');
    try {
      const text = await readFileAsText(file);
      const { customers: parsed, errors, skipped } = parseCustomerCSV(text);
      if (parsed.length === 0) {
        setCsvMsg(`⚠️ 파싱된 거래처가 없습니다.${errors.length > 0 ? ' (' + errors[0] + ')' : ''}`);
        return;
      }
      const result = await bulkAddCustomers(parsed);
      const skipMsg = skipped > 0 ? `, ${skipped}건 건너뜀` : '';
      const errMsg  = errors.length > 0 ? `, 오류 ${errors.length}건` : '';
      setCsvMsg(`✅ ${result.inserted}건 등록 완료 (총 ${result.total}건${skipMsg}${errMsg})`);
    } catch (err) {
      setCsvMsg(`❌ 오류: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (csvRef.current) csvRef.current.value = '';
    setTimeout(() => setCsvMsg(''), 8000);
  };

  // ── 거래처 저장 ──
  const handleSaveCustomer = async () => {
    if (!custForm.name.trim()) { alert('거래처명을 입력해주세요.'); return; }
    if (editingCustId) {
      await updateCustomer(editingCustId, custForm);
    } else {
      await addCustomer(custForm);
    }
    setShowCustForm(false);
    setEditingCustId(null);
    setCustForm(EMPTY_CUSTOMER);
  };

  const handleEditCustomer = (c: Customer) => {
    setEditingCustId(c.id);
    setCustForm({
      name: c.name, phone: c.phone || '', bizNo: c.bizNo || '',
      address: c.address || '', ceoName: c.ceoName || '',
      bizType: c.bizType || '', bizItem: c.bizItem || '',
      email: c.email || '', memo: c.memo || '',
      customerType: c.customerType || 'O',
    });
    setShowCustForm(true);
    setExpandedCustId(null);
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`「${name}」 거래처를 삭제하시겠습니까?`)) return;
    await deleteCustomer(id);
  };

  // ── 품목 저장 ──
  const handleSaveItem = async () => {
    if (!itemForm.name.trim()) { alert('품명을 입력해주세요.'); return; }
    if (editingItemId) {
      await updateItem(editingItemId, itemForm);
    } else {
      await addItem(itemForm);
    }
    setShowItemForm(false);
    setEditingItemId(null);
    setItemForm(EMPTY_ITEM);
  };

  const handleEditItem = (item: Item) => {
    setEditingItemId(item.id);
    setItemForm({ name: item.name, spec: item.spec || '', unit: item.unit, stock: item.stock, costPrice: item.costPrice, memo: item.memo || '' });
    setShowItemForm(true);
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`「${name}」 품목을 삭제하시겠습니까?`)) return;
    await deleteItem(id);
  };

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Building2 className="text-[#22c55e]" size={28} />
          기초데이터 관리
        </h2>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="이름·사업자번호·연락처 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-[#1c1f2e] border border-[#2e3147] text-white rounded-xl text-sm focus:border-[#22c55e] focus:outline-none w-64"
          />
        </div>
      </div>

      {/* 탭 */}
      <div className="flex bg-[#1c1f2e] rounded-xl p-1 border border-[#2e3147] w-fit">
        <button
          onClick={() => { setActiveTab('customers'); setSearch(''); setShowCustForm(false); setShowItemForm(false); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'customers' ? 'bg-[#22c55e] text-[#0f1117]' : 'text-gray-400 hover:text-white'}`}
        >
          <Users size={16} />
          거래처 ({customers.length})
        </button>
        <button
          onClick={() => { setActiveTab('items'); setSearch(''); setShowCustForm(false); setShowItemForm(false); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'items' ? 'bg-[#22c55e] text-[#0f1117]' : 'text-gray-400 hover:text-white'}`}
        >
          <Package size={16} />
          품목 ({items.length})
        </button>
      </div>

      {/* ═══════════════════════════════ 거래처 탭 ═══════════════════════════════ */}
      {activeTab === 'customers' && (
        <div className="space-y-4">

          {/* 상단 액션 바 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* 거래처 구분 필터 */}
            <div className="flex bg-[#1c1f2e] rounded-xl p-1 border border-[#2e3147] gap-1">
              {TYPE_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setTypeFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    typeFilter === f.value
                      ? 'bg-[#22c55e] text-[#0f1117]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {f.label}
                  <span className={`ml-1 text-xs ${typeFilter === f.value ? 'text-[#0f1117]/70' : 'text-gray-600'}`}>
                    ({typeCounts[f.value as keyof typeof typeCounts] ?? 0})
                  </span>
                </button>
              ))}
            </div>

            {/* 버튼 그룹 */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* CSV 업로드 */}
              <label className="flex items-center gap-2 px-3 py-2 bg-[#1c1f2e] hover:bg-[#2a2d3e] border border-[#2e3147] text-gray-300 rounded-xl text-xs cursor-pointer transition-colors">
                <Upload size={14} />
                거래처 CSV 일괄 등록
                <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
              </label>
              {/* 수동 등록 */}
              <button
                onClick={() => { setShowCustForm(v => !v); setEditingCustId(null); setCustForm(EMPTY_CUSTOMER); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#22c55e] hover:bg-[#16a34a] text-[#0f1117] font-semibold rounded-xl text-sm transition-colors"
              >
                <Plus size={16} />
                거래처 등록
              </button>
            </div>
          </div>

          {/* CSV 업로드 결과 메시지 */}
          {csvMsg && (
            <div className={`px-4 py-2.5 rounded-xl text-sm border ${
              csvMsg.startsWith('✅') ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : csvMsg.startsWith('❌') ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
            }`}>
              {csvMsg}
              <span className="text-xs ml-2 opacity-60">
                (형식: 거래처명, 거래처구분(I=매입/O=매출/M=혼합), 사업자번호, 대표명, 연락처, 주소 포함된 CSV)
              </span>
            </div>
          )}

          {/* 거래처 폼 */}
          {showCustForm && (
            <div className="bg-[#1c1f2e] border border-[#22c55e]/30 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Users size={16} className="text-[#22c55e]" />
                {editingCustId ? '거래처 수정' : '거래처 등록'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 거래처명 */}
                <div>
                  <label className="flex items-center gap-1 text-gray-400 text-xs mb-1.5">
                    <Building2 size={12} />거래처명 <span className="text-red-400">*</span>
                  </label>
                  <input type="text" placeholder="예: (주)○○식품" value={custForm.name}
                    onChange={e => setCustForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#22c55e] focus:outline-none"
                  />
                </div>
                {/* 거래처 구분 ★ */}
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">거래처 구분</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'O', label: '매출처', icon: ShoppingCart, color: 'green' },
                      { value: 'I', label: '매입처', icon: ShoppingBag, color: 'blue' },
                      { value: 'M', label: '혼합처', icon: GitMerge, color: 'purple' },
                    ].map(opt => {
                      const Icon = opt.icon;
                      const active = custForm.customerType === opt.value;
                      const cls = active
                        ? opt.color === 'green' ? 'bg-green-500/20 border-green-500 text-green-400'
                          : opt.color === 'blue' ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                          : 'bg-purple-500/20 border-purple-500 text-purple-400'
                        : 'bg-[#0f1117] border-[#2e3147] text-gray-400 hover:text-white';
                      return (
                        <button key={opt.value} type="button"
                          onClick={() => setCustForm(f => ({ ...f, customerType: opt.value as 'O'|'I'|'M' }))}
                          className={`flex items-center gap-1.5 flex-1 px-2 py-2 rounded-lg border text-xs font-medium transition-all ${cls}`}
                        >
                          <Icon size={12} />{opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* 대표자명 */}
                <div>
                  <label className="flex items-center gap-1 text-gray-400 text-xs mb-1.5">
                    <Users size={12} />대표자명
                  </label>
                  <input type="text" placeholder="홍길동" value={custForm.ceoName}
                    onChange={e => setCustForm(f => ({ ...f, ceoName: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#22c55e] focus:outline-none"
                  />
                </div>
                {/* 연락처 */}
                <div>
                  <label className="flex items-center gap-1 text-gray-400 text-xs mb-1.5">
                    <Phone size={12} />연락처
                  </label>
                  <input type="text" placeholder="010-1234-5678" value={custForm.phone}
                    onChange={e => setCustForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#22c55e] focus:outline-none"
                  />
                </div>
                {/* 사업자등록번호 */}
                <div>
                  <label className="flex items-center gap-1 text-gray-400 text-xs mb-1.5">
                    <Hash size={12} />사업자등록번호
                  </label>
                  <input type="text" placeholder="000-00-00000" value={custForm.bizNo}
                    onChange={e => setCustForm(f => ({ ...f, bizNo: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#22c55e] focus:outline-none"
                  />
                </div>
                {/* 업태 */}
                <div>
                  <label className="flex items-center gap-1 text-gray-400 text-xs mb-1.5">
                    <FileText size={12} />업태
                  </label>
                  <input type="text" placeholder="도소매" value={custForm.bizType}
                    onChange={e => setCustForm(f => ({ ...f, bizType: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#22c55e] focus:outline-none"
                  />
                </div>
                {/* 업종 */}
                <div>
                  <label className="flex items-center gap-1 text-gray-400 text-xs mb-1.5">
                    <FileText size={12} />업종
                  </label>
                  <input type="text" placeholder="식료품" value={custForm.bizItem}
                    onChange={e => setCustForm(f => ({ ...f, bizItem: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#22c55e] focus:outline-none"
                  />
                </div>
                {/* 이메일 */}
                <div>
                  <label className="flex items-center gap-1 text-gray-400 text-xs mb-1.5">
                    <Mail size={12} />이메일
                  </label>
                  <input type="email" placeholder="example@company.com" value={custForm.email}
                    onChange={e => setCustForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#22c55e] focus:outline-none"
                  />
                </div>
                {/* 사업장 소재지 */}
                <div className="md:col-span-2">
                  <label className="flex items-center gap-1 text-gray-400 text-xs mb-1.5">
                    <MapPin size={12} />사업장 소재지
                  </label>
                  <input type="text" placeholder="서울특별시 ..." value={custForm.address}
                    onChange={e => setCustForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#22c55e] focus:outline-none"
                  />
                </div>
                {/* 메모 */}
                <div className="md:col-span-3">
                  <label className="text-gray-400 text-xs mb-1.5 block">메모</label>
                  <textarea rows={2} placeholder="기타 메모..." value={custForm.memo}
                    onChange={e => setCustForm(f => ({ ...f, memo: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2 text-sm focus:border-[#22c55e] focus:outline-none resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleSaveCustomer}
                  className="flex items-center gap-2 px-5 py-2 bg-[#22c55e] text-[#0f1117] font-semibold rounded-lg hover:bg-[#16a34a] text-sm transition-colors">
                  <Save size={15} />{editingCustId ? '수정 완료' : '등록'}
                </button>
                <button onClick={() => { setShowCustForm(false); setEditingCustId(null); }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2e3147] text-gray-300 rounded-lg hover:bg-[#4d5382] text-sm transition-colors">
                  <X size={15} />취소
                </button>
              </div>
            </div>
          )}

          {/* 거래처 목록 */}
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users size={48} className="mx-auto mb-3 opacity-20" />
              <p>{search || typeFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 거래처가 없습니다.'}</p>
              <p className="text-sm mt-1">거래처 CSV를 업로드하거나 직접 등록하세요.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* 카운트 안내 */}
              <p className="text-gray-500 text-xs px-1">{filteredCustomers.length}개 거래처</p>
              {filteredCustomers.map(c => (
                <div key={c.id} className="bg-[#1c1f2e] rounded-xl border border-[#2e3147] overflow-hidden">
                  {/* 기본 행 */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#22c55e]/10 flex items-center justify-center flex-shrink-0">
                        <Building2 size={16} className="text-[#22c55e]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-semibold">{c.name}</span>
                          {/* ★ 거래처 구분 배지 */}
                          <CustomerTypeBadge type={c.customerType} />
                          {c.bizType && <span className="text-gray-500 text-xs bg-[#2e3147] px-2 py-0.5 rounded">{c.bizType}</span>}
                          {c.bizItem && <span className="text-gray-500 text-xs bg-[#2e3147] px-2 py-0.5 rounded">{c.bizItem}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {c.ceoName && <span className="text-gray-400 text-xs">대표: {c.ceoName}</span>}
                          {c.phone && <span className="text-gray-400 text-xs flex items-center gap-1"><Phone size={10} />{c.phone}</span>}
                          {c.bizNo && <span className="text-gray-500 text-xs">{c.bizNo}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setExpandedCustId(expandedCustId === c.id ? null : c.id)}
                        className="text-gray-500 hover:text-[#22c55e] transition-colors p-1"
                      >
                        {expandedCustId === c.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <button onClick={() => handleEditCustomer(c)} className="text-gray-400 hover:text-[#22c55e] p-1 transition-colors"><Edit2 size={15} /></button>
                      <button onClick={() => handleDeleteCustomer(c.id, c.name)} className="text-gray-400 hover:text-red-400 p-1 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </div>

                  {/* 확장 상세 */}
                  {expandedCustId === c.id && (
                    <div className="px-4 pb-4 pt-1 border-t border-[#2e3147]/50">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        {c.address && (
                          <div className="col-span-2 md:col-span-3">
                            <span className="text-gray-500 text-xs flex items-center gap-1 mb-0.5"><MapPin size={10} />사업장 소재지</span>
                            <span className="text-gray-300">{c.address}</span>
                          </div>
                        )}
                        {c.email && (
                          <div>
                            <span className="text-gray-500 text-xs flex items-center gap-1 mb-0.5"><Mail size={10} />이메일</span>
                            <span className="text-gray-300">{c.email}</span>
                          </div>
                        )}
                        {c.memo && (
                          <div className="col-span-2">
                            <span className="text-gray-500 text-xs mb-0.5 block">메모</span>
                            <span className="text-gray-400">{c.memo}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════ 품목 탭 ═══════════════════════════════ */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => { setShowItemForm(v => !v); setEditingItemId(null); setItemForm(EMPTY_ITEM); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#22c55e] hover:bg-[#16a34a] text-[#0f1117] font-semibold rounded-xl text-sm transition-colors"
            >
              <Plus size={16} />품목 등록
            </button>
          </div>

          {showItemForm && (
            <div className="bg-[#1c1f2e] border border-[#22c55e]/30 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Package size={16} className="text-[#22c55e]" />
                {editingItemId ? '품목 수정' : '품목 등록'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">품명 <span className="text-red-400">*</span></label>
                  <input type="text" placeholder="예: 신동진쌀" value={itemForm.name}
                    onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#22c55e] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">규격</label>
                  <input type="text" placeholder="예: 20kg, 1등급" value={itemForm.spec}
                    onChange={e => setItemForm(f => ({ ...f, spec: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#22c55e] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">단위 <span className="text-red-400">*</span></label>
                  <div className="flex gap-1 flex-wrap mb-2">
                    {UNITS.map(u => (
                      <button key={u} type="button"
                        onClick={() => setItemForm(f => ({ ...f, unit: u }))}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${itemForm.unit === u ? 'bg-[#22c55e] text-[#0f1117]' : 'bg-[#0f1117] text-gray-400 hover:text-white border border-[#2e3147]'}`}
                      >{u}</button>
                    ))}
                  </div>
                  <input type="text" placeholder="직접 입력" value={itemForm.unit}
                    onChange={e => setItemForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2 text-sm focus:border-[#22c55e] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">초기 재고</label>
                  <input type="number" min="0" value={itemForm.stock || ''}
                    onChange={e => setItemForm(f => ({ ...f, stock: Number(e.target.value) }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#22c55e] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">원가 (단가 기준)</label>
                  <input type="number" min="0" value={itemForm.costPrice || ''}
                    onChange={e => setItemForm(f => ({ ...f, costPrice: Number(e.target.value) }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#22c55e] focus:outline-none"
                  />
                  {itemForm.costPrice > 0 && (
                    <p className="text-[#22c55e] text-xs mt-1">단위원가: {formatKRW(itemForm.costPrice)}/{itemForm.unit}</p>
                  )}
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">메모</label>
                  <input type="text" value={itemForm.memo}
                    onChange={e => setItemForm(f => ({ ...f, memo: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#22c55e] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleSaveItem}
                  className="flex items-center gap-2 px-5 py-2 bg-[#22c55e] text-[#0f1117] font-semibold rounded-lg hover:bg-[#16a34a] text-sm transition-colors">
                  <Save size={15} />{editingItemId ? '수정 완료' : '등록'}
                </button>
                <button onClick={() => { setShowItemForm(false); setEditingItemId(null); }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2e3147] text-gray-300 rounded-lg hover:bg-[#4d5382] text-sm transition-colors">
                  <X size={15} />취소
                </button>
              </div>
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package size={48} className="mx-auto mb-3 opacity-20" />
              <p>{search ? '검색 결과가 없습니다.' : '등록된 품목이 없습니다.'}</p>
            </div>
          ) : (
            <div className="bg-[#1c1f2e] rounded-xl border border-[#2e3147] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2e3147]">
                    {['품명', '규격', '단위', '재고', '원가', '메모', ''].map(h => (
                      <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => (
                    <tr key={item.id} className="border-b border-[#2e3147]/50 hover:bg-[#2a2d3e]/20">
                      <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-gray-400">{item.spec || '-'}</td>
                      <td className="px-4 py-3"><span className="bg-[#2e3147] text-gray-300 px-2 py-0.5 rounded text-xs">{item.unit}</span></td>
                      <td className="px-4 py-3 text-[#22c55e] font-semibold">{item.stock.toLocaleString()} {item.unit}</td>
                      <td className="px-4 py-3 text-yellow-400">{item.costPrice > 0 ? formatKRW(item.costPrice) : '-'}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">{item.memo || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleEditItem(item)} className="text-gray-400 hover:text-[#22c55e] transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => handleDeleteItem(item.id, item.name)} className="text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
