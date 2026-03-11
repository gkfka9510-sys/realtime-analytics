// 원가 및 순이익 관리 페이지 - 판매가는 매출 데이터에서 자동 계산
import React, { useState, useMemo } from 'react';
import { useRice } from '@/contexts/RiceContext';
import { RiceProduct } from '@/types/rice';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Plus, Edit2, Trash2, Package, TrendingUp, DollarSign, Percent, Save, X, Info } from 'lucide-react';

const formatKRW = (v: number) => `₩${v.toLocaleString('ko-KR')}`;
const formatNum = (v: number) => v.toLocaleString('ko-KR');

interface ProductFormData {
  name: string;
  weightPerBag: number;
  purchasePrice: number;
}

const DEFAULT_FORM: ProductFormData = { name: '', weightPerBag: 20, purchasePrice: 0 };

// 품목명 매칭 헬퍼 (공통)
function matchProduct(salesName: string, productName: string): boolean {
  const s = salesName.toLowerCase().replace(/\s/g, '');
  const p = productName.toLowerCase().replace(/\s/g, '');
  // 핵심 단어(공백 제거, 숫자 포함) 포함 여부 양방향 확인
  return s.includes(p) || p.includes(s) ||
    p.split(/\d+kg?/i)[0].trim().length > 1 && s.includes(p.split(/\d+kg?/i)[0].trim().toLowerCase());
}

export default function ProfitPage() {
  const { salesRecords, riceProducts, addRiceProduct, updateRiceProduct, deleteRiceProduct } = useRice();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormData>(DEFAULT_FORM);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // 월 목록
  const months = useMemo(() => {
    const set = new Set(salesRecords.map(r => r.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [salesRecords]);

  // 선택 월 매출 데이터
  const monthlySales = useMemo(() =>
    salesRecords.filter(r => r.date.startsWith(selectedMonth)),
    [salesRecords, selectedMonth]
  );

  // ── 핵심: 품목별 순이익 계산 (판매가 = 매출데이터에서 역산) ──
  const profitByProduct = useMemo(() => {
    return riceProducts.map(product => {
      // 해당 품목 매출 필터링
      const related = monthlySales.filter(r => matchProduct(r.productName, product.name));

      const revenue = related.reduce((s, r) => s + r.totalAmount, 0);
      const totalKg = related.reduce((s, r) => s + r.quantity, 0);
      const cost = totalKg * product.costPerKg;
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      // 실제 평균 판매가 (매출합계 / 판매kg) — 매출데이터에서 역산
      const avgSellingPricePerKg = totalKg > 0 ? revenue / totalKg : 0;
      const marginPerKg = avgSellingPricePerKg - product.costPerKg;

      return { ...product, revenue, cost, profit, margin, totalKg, avgSellingPricePerKg, marginPerKg };
    });
  }, [riceProducts, monthlySales]);

  // 매출 있는데 원가 미등록 품목 (경고용)
  const unmatchedSales = useMemo(() => {
    const matched = new Set<string>();
    monthlySales.forEach(r => {
      riceProducts.forEach(p => {
        if (matchProduct(r.productName, p.name)) matched.add(r.productName);
      });
    });
    const unmatched = monthlySales.filter(r => !matched.has(r.productName));
    const names = new Set(unmatched.map(r => r.productName));
    return Array.from(names).map(name => ({
      name,
      totalAmount: unmatched.filter(r => r.productName === name).reduce((s, r) => s + r.totalAmount, 0),
      totalKg: unmatched.filter(r => r.productName === name).reduce((s, r) => s + r.quantity, 0),
    }));
  }, [monthlySales, riceProducts]);

  // 전체 합계 (원가 매칭된 것만)
  const totals = useMemo(() => {
    const revenue = monthlySales.reduce((s, r) => s + r.totalAmount, 0);
    let cost = 0;
    monthlySales.forEach(r => {
      const product = riceProducts.find(p => matchProduct(r.productName, p.name));
      if (product) cost += r.quantity * product.costPerKg;
    });
    return {
      revenue,
      cost,
      profit: revenue - cost,
      margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
    };
  }, [monthlySales, riceProducts]);

  // 월별 순이익 추이
  const monthlyProfitData = useMemo(() => {
    const monthMap: Record<string, { revenue: number; cost: number }> = {};
    salesRecords.forEach(r => {
      const m = r.date.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { revenue: 0, cost: 0 };
      monthMap[m].revenue += r.totalAmount;
      const product = riceProducts.find(p => matchProduct(r.productName, p.name));
      if (product) monthMap[m].cost += r.quantity * product.costPerKg;
    });
    return Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, { revenue, cost }]) => ({
      month: month.replace('-', '년 ') + '월',
      revenue, cost,
      profit: revenue - cost,
    }));
  }, [salesRecords, riceProducts]);

  const handleSubmit = () => {
    if (!form.name || form.purchasePrice <= 0 || form.weightPerBag <= 0) {
      alert('품명, 포대당 무게, 매입가를 입력해주세요.');
      return;
    }
    if (editingId) {
      updateRiceProduct(editingId, { ...form, costPerKg: form.purchasePrice / form.weightPerBag });
      setEditingId(null);
    } else {
      addRiceProduct({ ...form, sellingPricePerKg: 0 });
    }
    setForm(DEFAULT_FORM);
    setShowForm(false);
  };

  const handleEdit = (p: RiceProduct) => {
    setEditingId(p.id);
    setForm({ name: p.name, weightPerBag: p.weightPerBag, purchasePrice: p.purchasePrice });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('이 품목을 삭제하시겠습니까?')) deleteRiceProduct(id);
  };

  const BAG_SIZES = [5, 10, 15, 20, 25, 30, 40, 50];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <DollarSign className="text-[#00d9ff]" size={28} />
          순이익 분석
        </h2>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(DEFAULT_FORM); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#00d9ff] hover:bg-[#00b8d9] text-[#1a1d29] font-semibold rounded-lg transition-colors text-sm"
        >
          <Plus size={16} />
          품목/원가 등록
        </button>
      </div>

      {/* 안내 배너 */}
      <div className="flex items-start gap-3 p-4 bg-[#00d9ff]/5 border border-[#00d9ff]/20 rounded-xl">
        <Info size={16} className="text-[#00d9ff] mt-0.5 flex-shrink-0" />
        <p className="text-gray-300 text-sm">
          <span className="text-[#00d9ff] font-medium">판매가는 매출 데이터에서 자동 계산</span>됩니다.
          품목별 원가(매입가)만 등록하면, 실제 매출 데이터의 합계금액 ÷ 판매 kg 으로 평균 판매가와 순이익이 자동 산출됩니다.
        </p>
      </div>

      {/* 품목 등록/수정 폼 */}
      {showForm && (
        <div className="bg-[#2d3142] border border-[#00d9ff]/30 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">{editingId ? '품목 수정' : '품목/원가 등록'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 품명 */}
            <div>
              <label className="block text-gray-400 text-xs mb-1">품명 *</label>
              <input
                type="text"
                placeholder="예: 신동진쌀 20kg"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#00d9ff] focus:outline-none"
              />
              <p className="text-gray-500 text-xs mt-1">매출 CSV의 품목명과 유사하게 입력</p>
            </div>

            {/* 포대 무게 */}
            <div>
              <label className="block text-gray-400 text-xs mb-1">포대당 무게 (kg) *</label>
              <div className="flex flex-wrap gap-1 mb-1">
                {BAG_SIZES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, weightPerBag: s }))}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${form.weightPerBag === s ? 'bg-[#00d9ff] text-[#1a1d29]' : 'bg-[#1a1d29] text-gray-400 hover:text-white border border-[#3d4362]'}`}
                  >
                    {s}kg
                  </button>
                ))}
              </div>
              <input
                type="number"
                placeholder="직접 입력 (kg)"
                value={form.weightPerBag || ''}
                onChange={e => setForm(f => ({ ...f, weightPerBag: Number(e.target.value) }))}
                className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none"
              />
            </div>

            {/* 매입가 */}
            <div>
              <label className="block text-gray-400 text-xs mb-1">포대당 매입가 (원) *</label>
              <input
                type="number"
                placeholder="예: 48000"
                value={form.purchasePrice || ''}
                onChange={e => setForm(f => ({ ...f, purchasePrice: Number(e.target.value) }))}
                className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#00d9ff] focus:outline-none"
              />
              {form.purchasePrice > 0 && form.weightPerBag > 0 && (
                <div className="mt-2 p-2 bg-[#1a1d29] rounded-lg">
                  <p className="text-[#00d9ff] text-xs">1kg당 원가: <span className="font-bold">{formatKRW(Math.round(form.purchasePrice / form.weightPerBag))}</span></p>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSubmit}
              className="flex items-center gap-2 px-5 py-2 bg-[#00d9ff] text-[#1a1d29] font-semibold rounded-lg hover:bg-[#00b8d9] transition-colors text-sm">
              <Save size={16} />
              {editingId ? '수정 완료' : '등록'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#3d4362] text-gray-300 rounded-lg hover:bg-[#4d5382] transition-colors text-sm">
              <X size={16} />
              취소
            </button>
          </div>
        </div>
      )}

      {/* 등록된 품목 원가표 */}
      {riceProducts.length > 0 && (
        <div className="bg-[#2d3142] rounded-xl border border-[#3d4362] overflow-hidden">
          <div className="p-4 border-b border-[#3d4362]">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Package size={18} className="text-[#00d9ff]" />
              등록 품목 원가표
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#3d4362]">
                  {['품명', '포대 무게', '포대 매입가', '1kg당 원가', ''].map(h => (
                    <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {riceProducts.map(p => (
                  <tr key={p.id} className="border-b border-[#3d4362]/50 hover:bg-[#3d4362]/20">
                    <td className="px-4 py-3 text-white font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-300">{p.weightPerBag}kg</td>
                    <td className="px-4 py-3 text-gray-300">{formatKRW(p.purchasePrice)}</td>
                    <td className="px-4 py-3 text-yellow-400 font-semibold">{formatKRW(Math.round(p.costPerKg))}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(p)} className="text-gray-400 hover:text-[#00d9ff] transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 원가 미등록 품목 경고 */}
      {unmatchedSales.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-yellow-400 text-sm font-semibold mb-2">⚠️ 원가 미등록 품목 — 순이익 계산에서 제외됨</p>
          <div className="space-y-1">
            {unmatchedSales.map(u => (
              <div key={u.name} className="flex items-center justify-between text-xs text-gray-400">
                <span className="text-white">「{u.name}」</span>
                <span>매출 {formatKRW(u.totalAmount)} / {formatNum(u.totalKg)}kg</span>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-2">위 품목명과 유사하게 원가를 등록하면 자동 매칭됩니다.</p>
        </div>
      )}

      {/* 월 선택 */}
      {salesRecords.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-white font-semibold">분석 기간:</h3>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-[#2d3142] border border-[#3d4362] text-white rounded-lg px-3 py-1.5 text-sm"
            >
              {months.map(m => (
                <option key={m} value={m}>{m.replace('-', '년 ')}월</option>
              ))}
            </select>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: '총 매출', value: formatKRW(totals.revenue), color: '#00d9ff', icon: DollarSign },
              { label: '총 원가', value: formatKRW(totals.cost), color: '#f59e0b', icon: Package },
              { label: '순이익', value: formatKRW(totals.profit), color: totals.profit >= 0 ? '#10b981' : '#ef4444', icon: TrendingUp },
              { label: '이익률', value: `${totals.margin.toFixed(1)}%`, color: totals.margin >= 10 ? '#10b981' : '#f59e0b', icon: Percent },
            ].map((card, i) => (
              <div key={i} className="bg-[#2d3142] rounded-xl p-4 border border-[#3d4362]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-xs">{card.label}</span>
                  <card.icon size={16} style={{ color: card.color }} />
                </div>
                <div className="font-bold text-lg" style={{ color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* 품목별 이익 (판매가 = 매출 데이터 역산) */}
          {profitByProduct.filter(p => p.revenue > 0).length > 0 && (
            <div className="bg-[#2d3142] rounded-xl border border-[#3d4362] overflow-hidden">
              <div className="p-4 border-b border-[#3d4362] flex items-center justify-between">
                <h3 className="text-white font-semibold">품목별 순이익 ({selectedMonth.replace('-', '년 ')}월)</h3>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Info size={12} />
                  평균판매가 = 매출합계 ÷ 판매량(kg)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#3d4362]">
                      {['품목', '판매량(kg)', '매출', '원가', '순이익', '평균판매가/kg', '1kg 마진', '이익률'].map(h => (
                        <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profitByProduct.filter(p => p.revenue > 0).map(p => (
                      <tr key={p.id} className="border-b border-[#3d4362]/50 hover:bg-[#3d4362]/20">
                        <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{p.name}</td>
                        <td className="px-4 py-3 text-gray-300">{formatNum(Math.round(p.totalKg))}kg</td>
                        <td className="px-4 py-3 text-[#00d9ff]">{formatKRW(p.revenue)}</td>
                        <td className="px-4 py-3 text-yellow-400">{formatKRW(Math.round(p.cost))}</td>
                        <td className={`px-4 py-3 font-semibold ${p.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatKRW(Math.round(p.profit))}</td>
                        <td className="px-4 py-3 text-[#00d9ff]">
                          {p.avgSellingPricePerKg > 0 ? formatKRW(Math.round(p.avgSellingPricePerKg)) : '-'}
                        </td>
                        <td className={`px-4 py-3 font-medium ${p.marginPerKg >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {p.avgSellingPricePerKg > 0 ? formatKRW(Math.round(p.marginPerKg)) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.margin >= 10 ? 'bg-green-500/20 text-green-400' : p.margin >= 5 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                            {p.margin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 월별 추이 차트 */}
          {monthlyProfitData.length > 1 && (
            <div className="bg-[#2d3142] rounded-xl p-5 border border-[#3d4362]">
              <h3 className="text-white font-semibold mb-4">월별 매출 / 원가 / 순이익 추이</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyProfitData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3d4362" />
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => `${(v / 1000000).toFixed(0)}M`} />
                  <Tooltip
                    contentStyle={{ background: '#1a1d29', border: '1px solid #3d4362', borderRadius: 8 }}
                    formatter={(v: number, name: string) => [formatKRW(v), name === 'revenue' ? '매출' : name === 'cost' ? '원가' : '순이익']}
                  />
                  <Legend formatter={v => v === 'revenue' ? '매출' : v === 'cost' ? '원가' : '순이익'} />
                  <Bar dataKey="revenue" fill="#00d9ff" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="cost" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="profit" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {riceProducts.length === 0 && salesRecords.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Package size={48} className="mx-auto mb-4 opacity-30" />
          <p>품목/원가를 등록하고 매출 데이터를 업로드하면 순이익을 분석할 수 있습니다.</p>
        </div>
      )}
    </div>
  );
}
