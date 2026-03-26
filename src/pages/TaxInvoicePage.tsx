// 세금계산서 발행 현황 + 직접 등록/수정/삭제
import React, { useState, useMemo } from 'react';
import { useRice } from '@/contexts/RiceContext';
import { TaxInvoice } from '@/types/rice';
import {
  FileText, AlertTriangle, CheckCircle, Calendar, Building2, Filter,
  Plus, Edit2, Trash2, Save, X, Upload, Search, ChevronDown
} from 'lucide-react';
import { parseTaxInvoiceCSV, readFileAsText } from '@/lib/csvParser';
import { v4 as uuidv4 } from 'uuid';

const formatKRW = (v: number) => `₩${v.toLocaleString('ko-KR')}`;
const formatNum = (v: number) => v.toLocaleString('ko-KR');

const EMPTY_FORM = {
  issueDate: new Date().toISOString().slice(0, 10),
  companyName: '',
  totalAmount: 0,
  memo: '',
};

type MainTab = 'status' | 'list';

export default function TaxInvoicePage() {
  const { salesRecords, taxInvoices, addTaxInvoices, addTaxInvoice, updateTaxInvoice, deleteTaxInvoice, customers } = useRice();

  const [mainTab, setMainTab] = useState<MainTab>('status');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showAll, setShowAll] = useState(false);

  // 직접 등록 폼
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [companySug, setCompanySug] = useState<string[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  // 세금계산서 목록 필터
  const [listSearch, setListSearch] = useState('');
  const [listMonth, setListMonth] = useState('');

  // CSV 업로드
  const taxRef = React.useRef<HTMLInputElement>(null);
  const [uploadMsg, setUploadMsg] = useState('');

  // 매출이 있는 월 목록
  const months = useMemo(() => {
    const set = new Set(salesRecords.map(r => r.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [salesRecords]);

  // 세금계산서 전체 월 목록
  const taxMonths = useMemo(() => {
    const set = new Set(taxInvoices.map(t => t.issueDate.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [taxInvoices]);

  // 거래처 자동완성
  const companyOptions = useMemo(() => {
    const q = form.companyName.toLowerCase();
    if (!q) return [];
    const fromCustomers = customers.map(c => c.name);
    const fromSales = [...new Set(salesRecords.map(r => r.companyName))];
    const fromInvoices = [...new Set(taxInvoices.map(t => t.companyName))];
    return [...new Set([...fromCustomers, ...fromSales, ...fromInvoices])]
      .filter(n => n.toLowerCase().includes(q))
      .slice(0, 8);
  }, [form.companyName, customers, salesRecords, taxInvoices]);

  // 선택 월 분석
  const analysis = useMemo(() => {
    const monthlySales = salesRecords.filter(r => r.date.startsWith(selectedMonth));
    const salesByCompany = new Map<string, { count: number; totalAmount: number; dates: string[] }>();

    monthlySales.forEach(r => {
      const key = r.companyName.trim();
      if (!salesByCompany.has(key)) salesByCompany.set(key, { count: 0, totalAmount: 0, dates: [] });
      const v = salesByCompany.get(key)!;
      v.count++;
      v.totalAmount += r.totalAmount;
      if (!v.dates.includes(r.date)) v.dates.push(r.date);
    });

    const [year, month] = selectedMonth.split('-').map(Number);
    const rangeStart = `${selectedMonth}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
    const rangeEnd = `${nextMonth}-15`;

    const invoicedCompanies = new Set<string>();
    taxInvoices.forEach(inv => {
      if (inv.issueDate >= rangeStart && inv.issueDate <= rangeEnd)
        invoicedCompanies.add(inv.companyName.trim());
    });

    const results = Array.from(salesByCompany.entries()).map(([companyName, data]) => ({
      companyName,
      salesCount: data.count,
      totalSalesAmount: data.totalAmount,
      hasInvoice: invoicedCompanies.has(companyName),
      salesDates: data.dates.sort(),
    }));

    return {
      results,
      totalCompanies: results.length,
      invoicedCount: results.filter(r => r.hasInvoice).length,
      unissuedCount: results.filter(r => !r.hasInvoice).length,
      totalSales: monthlySales.reduce((s, r) => s + r.totalAmount, 0),
    };
  }, [salesRecords, taxInvoices, selectedMonth]);

  const displayResults = showAll ? analysis.results : analysis.results.filter(r => !r.hasInvoice);

  // 연간 월별 현황
  const yearlyStatus = useMemo(() => {
    return months.slice(0, 12).map(month => {
      const monthlySales = salesRecords.filter(r => r.date.startsWith(month));
      const salesCompanies = new Set(monthlySales.map(r => r.companyName.trim()));
      const [year, m] = month.split('-').map(Number);
      const nextMonth = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`;
      const rangeStart = `${month}-01`;
      const rangeEnd = `${nextMonth}-15`;
      const invoicedCompanies = new Set<string>();
      taxInvoices.forEach(inv => {
        if (inv.issueDate >= rangeStart && inv.issueDate <= rangeEnd)
          invoicedCompanies.add(inv.companyName.trim());
      });
      const unissuedCount = Array.from(salesCompanies).filter(c => !invoicedCompanies.has(c)).length;
      return {
        month, label: month.replace('-', '년 ') + '월',
        totalCompanies: salesCompanies.size,
        invoicedCount: Array.from(salesCompanies).filter(c => invoicedCompanies.has(c)).size,
        unissuedCount, isComplete: unissuedCount === 0,
      };
    });
  }, [months, salesRecords, taxInvoices]);

  // 세금계산서 목록 필터링
  const filteredInvoices = useMemo(() => {
    let list = [...taxInvoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
    if (listMonth) list = list.filter(t => t.issueDate.startsWith(listMonth));
    if (listSearch) {
      const q = listSearch.toLowerCase();
      list = list.filter(t => t.companyName.toLowerCase().includes(q) || (t.memo || '').toLowerCase().includes(q));
    }
    return list;
  }, [taxInvoices, listMonth, listSearch]);

  // 세금계산서 저장
  const handleSave = async () => {
    if (!form.companyName.trim()) { setFormMsg('업체명을 입력해주세요.'); return; }
    if (!form.issueDate) { setFormMsg('발행일을 입력해주세요.'); return; }
    const invoice: TaxInvoice = {
      id: editingId || uuidv4(),
      issueDate: form.issueDate,
      companyName: form.companyName.trim(),
      totalAmount: Number(form.totalAmount),
      memo: form.memo,
    };
    if (editingId) {
      await updateTaxInvoice(editingId, invoice);
    } else {
      await addTaxInvoice(invoice);
    }
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormMsg('');
  };

  const handleEdit = (t: TaxInvoice) => {
    setEditingId(t.id);
    setForm({ issueDate: t.issueDate, companyName: t.companyName, totalAmount: t.totalAmount, memo: t.memo || '' });
    setShowForm(true);
    setMainTab('list');
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」 세금계산서를 삭제하시겠습니까?`)) return;
    await deleteTaxInvoice(id);
  };

  // CSV 업로드
  const handleTaxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const { invoices, errors } = parseTaxInvoiceCSV(text);
      if (invoices.length === 0) { setUploadMsg('파싱된 데이터가 없습니다.'); return; }
      await addTaxInvoices(invoices);
      setUploadMsg(`✅ ${invoices.length}건 업로드 완료${errors.length > 0 ? ` (오류 ${errors.length}건)` : ''}`);
    } catch (err) {
      setUploadMsg(`❌ 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    }
    setTimeout(() => setUploadMsg(''), 5000);
    if (taxRef.current) taxRef.current.value = '';
  };

  // 미발행 업체 클릭 시 등록 폼 열기
  const handleRegisterForCompany = (companyName: string) => {
    setForm({ issueDate: new Date().toISOString().slice(0, 10), companyName, totalAmount: 0, memo: '' });
    setEditingId(null);
    setShowForm(true);
    setMainTab('list');
  };

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="text-[#7c3aed]" size={28} />
          세금계산서 관리
        </h2>
        <div className="flex items-center gap-2">
          <input ref={taxRef} type="file" accept=".csv" onChange={handleTaxUpload} className="hidden" />
          <button onClick={() => taxRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#1c1f2e] border border-[#2e3147] text-gray-300 hover:text-white rounded-xl text-sm transition-colors">
            <Upload size={14} />CSV 업로드
          </button>
          <button
            onClick={() => { setShowForm(v => !v); setEditingId(null); setForm({ ...EMPTY_FORM }); setMainTab('list'); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d2bd0] text-white font-semibold rounded-xl text-sm transition-colors"
          >
            <Plus size={15} />직접 등록
          </button>
        </div>
      </div>

      {uploadMsg && (
        <div className={`p-3 rounded-xl text-sm ${uploadMsg.startsWith('✅') ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
          {uploadMsg}
        </div>
      )}

      {/* 탭 */}
      <div className="flex bg-[#1c1f2e] rounded-xl p-1 border border-[#2e3147] w-fit">
        <button onClick={() => setMainTab('status')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${mainTab === 'status' ? 'bg-[#7c3aed] text-white' : 'text-gray-400 hover:text-white'}`}>
          발행 현황
        </button>
        <button onClick={() => setMainTab('list')}
          className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-all ${mainTab === 'list' ? 'bg-[#7c3aed] text-white' : 'text-gray-400 hover:text-white'}`}>
          세금계산서 목록
          <span className="bg-[#2e3147] text-gray-300 text-xs px-1.5 py-0.5 rounded-full">{taxInvoices.length}</span>
        </button>
      </div>

      {/* ─────── 발행 현황 탭 ─────── */}
      {mainTab === 'status' && (
        salesRecords.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <FileText size={48} className="mx-auto mb-4 opacity-30" />
            <p>매출 데이터가 없습니다. 매출 관리 탭에서 데이터를 입력해주세요.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 월 선택 */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-gray-400" />
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                  className="bg-[#1c1f2e] border border-[#2e3147] text-white rounded-lg px-3 py-1.5 text-sm">
                  {months.map(m => <option key={m} value={m}>{m.replace('-', '년 ')}월</option>)}
                </select>
              </div>
              <div className="flex bg-[#1c1f2e] rounded-lg p-1">
                <button onClick={() => setShowAll(false)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${!showAll ? 'bg-red-500/80 text-white' : 'text-gray-400 hover:text-white'}`}>
                  미발행만
                </button>
                <button onClick={() => setShowAll(true)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${showAll ? 'bg-[#7c3aed] text-white' : 'text-gray-400 hover:text-white'}`}>
                  전체 보기
                </button>
              </div>
            </div>

            {/* 요약 카드 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: '총 거래 업체', value: `${analysis.totalCompanies}개사`, color: '#22c55e', icon: Building2 },
                { label: '발행 완료', value: `${analysis.invoicedCount}개사`, color: '#10b981', icon: CheckCircle },
                { label: '미발행 업체', value: `${analysis.unissuedCount}개사`, color: '#ef4444', icon: AlertTriangle },
                { label: '당월 총 매출', value: formatKRW(analysis.totalSales), color: '#f59e0b', icon: FileText },
              ].map((card, i) => (
                <div key={i} className={`bg-[#1c1f2e] rounded-xl p-4 border ${i === 2 && analysis.unissuedCount > 0 ? 'border-red-500/50' : 'border-[#2e3147]'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs">{card.label}</span>
                    <card.icon size={16} style={{ color: card.color }} />
                  </div>
                  <div className="font-bold text-xl" style={{ color: card.color }}>{card.value}</div>
                </div>
              ))}
            </div>

            {/* 발행률 */}
            <div className="bg-[#1c1f2e] rounded-xl p-4 border border-[#2e3147]">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">세금계산서 발행률</span>
                <span className="text-white font-semibold">
                  {analysis.totalCompanies > 0 ? `${Math.round((analysis.invoicedCount / analysis.totalCompanies) * 100)}%` : '0%'}
                </span>
              </div>
              <div className="w-full bg-[#0f1117] rounded-full h-3">
                <div className="h-3 rounded-full transition-all bg-gradient-to-r from-[#7c3aed] to-[#22c55e]"
                  style={{ width: `${analysis.totalCompanies > 0 ? (analysis.invoicedCount / analysis.totalCompanies) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>발행: {analysis.invoicedCount}개사</span>
                <span>미발행: {analysis.unissuedCount}개사</span>
              </div>
            </div>

            {/* 업체별 현황 테이블 */}
            <div className="bg-[#1c1f2e] rounded-xl border border-[#2e3147] overflow-hidden">
              <div className="p-4 border-b border-[#2e3147] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-400" />
                  <h3 className="text-white font-semibold">
                    {showAll ? '전체 업체 현황' : '🚨 미발행 업체'} ({displayResults.length}개사)
                  </h3>
                </div>
              </div>
              {displayResults.length === 0 ? (
                <div className="text-center py-10 text-green-400 flex flex-col items-center gap-3">
                  <CheckCircle size={40} />
                  <p className="font-semibold">모든 업체에 세금계산서가 발행되었습니다! 🎉</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#2e3147]">
                        {['업체명', '매출건수', '매출금액', '발행여부', ''].map(h => (
                          <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayResults.sort((a, b) => a.hasInvoice ? 1 : -1).map(r => (
                        <tr key={r.companyName} className={`border-b border-[#2e3147]/50 hover:bg-[#2a2d3e]/20 ${!r.hasInvoice ? 'bg-red-500/5' : ''}`}>
                          <td className="px-4 py-3 text-white font-medium">
                            <div className="flex items-center gap-2">
                              {!r.hasInvoice && <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />}
                              {r.companyName}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-300">{formatNum(r.salesCount)}건</td>
                          <td className="px-4 py-3 text-[#22c55e] font-semibold">{formatKRW(r.totalSalesAmount)}</td>
                          <td className="px-4 py-3">
                            {r.hasInvoice ? (
                              <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                                <CheckCircle size={13} />발행완료
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
                                <AlertTriangle size={13} />미발행
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {!r.hasInvoice && (
                              <button onClick={() => handleRegisterForCompany(r.companyName)}
                                className="text-xs px-2.5 py-1 bg-[#7c3aed]/20 text-[#a78bfa] border border-[#7c3aed]/30 rounded-lg hover:bg-[#7c3aed]/30 transition-colors whitespace-nowrap">
                                + 등록
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 월별 현황 요약 */}
            {yearlyStatus.length > 1 && (
              <div className="bg-[#1c1f2e] rounded-xl border border-[#2e3147] overflow-hidden">
                <div className="p-4 border-b border-[#2e3147]">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Calendar size={18} className="text-[#22c55e]" />
                    월별 발행 현황
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#2e3147]">
                        {['월', '총업체', '발행완료', '미발행', '상태'].map(h => (
                          <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {yearlyStatus.map(s => (
                        <tr key={s.month}
                          className={`border-b border-[#2e3147]/50 cursor-pointer hover:bg-[#2a2d3e]/20 ${s.month === selectedMonth ? 'bg-[#2e3147]/30' : ''}`}
                          onClick={() => setSelectedMonth(s.month)}>
                          <td className="px-4 py-3 text-white font-medium">{s.label}</td>
                          <td className="px-4 py-3 text-gray-300">{s.totalCompanies}</td>
                          <td className="px-4 py-3 text-green-400">{s.invoicedCount}</td>
                          <td className="px-4 py-3 text-red-400">{s.unissuedCount}</td>
                          <td className="px-4 py-3">
                            {s.isComplete ? (
                              <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle size={13} />완료</span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-400 text-xs"><AlertTriangle size={13} />{s.unissuedCount}건 미발행</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* ─────── 세금계산서 목록 탭 ─────── */}
      {mainTab === 'list' && (
        <div className="space-y-4">
          {/* 직접 등록/수정 폼 */}
          {showForm && (
            <div className="bg-[#1c1f2e] border border-[#7c3aed]/40 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <FileText size={16} className="text-[#7c3aed]" />
                {editingId ? '세금계산서 수정' : '세금계산서 직접 등록'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">발행일 <span className="text-red-400">*</span></label>
                  <input type="date" value={form.issueDate}
                    onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#7c3aed] focus:outline-none"
                  />
                </div>
                <div className="relative sm:col-span-1">
                  <label className="text-gray-400 text-xs mb-1.5 block">업체명 <span className="text-red-400">*</span></label>
                  <input type="text" placeholder="업체명 입력" value={form.companyName}
                    onChange={e => { setForm(f => ({ ...f, companyName: e.target.value })); setShowSug(true); }}
                    onFocus={() => setShowSug(true)}
                    onBlur={() => setTimeout(() => setShowSug(false), 150)}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#7c3aed] focus:outline-none"
                  />
                  {showSug && companyOptions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1c1f2e] border border-[#2e3147] rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto">
                      {companyOptions.map(c => (
                        <button key={c} type="button" onMouseDown={() => { setForm(f => ({ ...f, companyName: c })); setShowSug(false); }}
                          className="w-full text-left px-3 py-2 hover:bg-[#2a2d3e] text-sm text-gray-300 hover:text-white">
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">공급가액</label>
                  <input type="number" min="0" placeholder="0" value={form.totalAmount || ''}
                    onChange={e => setForm(f => ({ ...f, totalAmount: Number(e.target.value) }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#7c3aed] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">메모</label>
                  <input type="text" placeholder="메모" value={form.memo}
                    onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#7c3aed] focus:outline-none"
                  />
                </div>
              </div>
              {formMsg && <p className="text-red-400 text-xs mt-2">{formMsg}</p>}
              <div className="flex gap-2 mt-4">
                <button onClick={handleSave}
                  className="flex items-center gap-2 px-5 py-2 bg-[#7c3aed] hover:bg-[#6d2bd0] text-white font-semibold rounded-lg text-sm transition-colors">
                  <Save size={15} />{editingId ? '수정 완료' : '등록'}
                </button>
                <button onClick={() => { setShowForm(false); setEditingId(null); setFormMsg(''); }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2e3147] text-gray-300 rounded-lg hover:bg-[#4d5382] text-sm transition-colors">
                  <X size={15} />취소
                </button>
              </div>
            </div>
          )}

          {/* 목록 필터 */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="text" placeholder="업체명 검색..." value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#1c1f2e] border border-[#2e3147] text-white rounded-xl text-sm focus:border-[#7c3aed] focus:outline-none"
              />
            </div>
            <select value={listMonth} onChange={e => setListMonth(e.target.value)}
              className="bg-[#1c1f2e] border border-[#2e3147] text-white rounded-xl px-3 py-2 text-sm">
              <option value="">전체 기간</option>
              {taxMonths.map(m => <option key={m} value={m}>{m.replace('-', '년 ')}월</option>)}
            </select>
          </div>

          {/* 세금계산서 목록 */}
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText size={48} className="mx-auto mb-3 opacity-20" />
              <p>{listSearch || listMonth ? '검색 결과가 없습니다.' : '등록된 세금계산서가 없습니다.'}</p>
              <button onClick={() => setShowForm(true)}
                className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-[#7c3aed]/20 text-[#a78bfa] rounded-lg text-sm mx-auto border border-[#7c3aed]/30 hover:bg-[#7c3aed]/30 transition-colors">
                <Plus size={14} />첫 세금계산서 등록
              </button>
            </div>
          ) : (
            <div className="bg-[#1c1f2e] rounded-xl border border-[#2e3147] overflow-hidden">
              <div className="p-3 border-b border-[#2e3147] flex items-center justify-between">
                <span className="text-gray-400 text-sm">총 {filteredInvoices.length}건</span>
                <span className="text-[#7c3aed] font-semibold text-sm">
                  합계: {formatKRW(filteredInvoices.reduce((s, t) => s + t.totalAmount, 0))}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2e3147]">
                      {['발행일', '업체명', '공급가액', '메모', ''].map(h => (
                        <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map(t => (
                      <tr key={t.id} className="border-b border-[#2e3147]/50 hover:bg-[#2a2d3e]/20">
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{t.issueDate}</td>
                        <td className="px-4 py-3 text-white font-medium">{t.companyName}</td>
                        <td className="px-4 py-3 text-[#7c3aed] font-semibold">{t.totalAmount > 0 ? formatKRW(t.totalAmount) : '-'}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">{t.memo || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => handleEdit(t)} className="text-gray-400 hover:text-[#7c3aed] transition-colors"><Edit2 size={14} /></button>
                            <button onClick={() => handleDelete(t.id, t.companyName)} className="text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
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
