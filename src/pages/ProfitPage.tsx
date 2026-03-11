// 원가 및 순이익 관리 페이지
import React, { useState, useMemo } from 'react';
import { useRice } from '@/contexts/RiceContext';
import { RiceProduct } from '@/types/rice';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';
import { Plus, Edit2, Trash2, Package, TrendingUp, DollarSign, Percent, Save, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const formatKRW = (v: number) => `₩${v.toLocaleString('ko-KR')}`;
const formatNum = (v: number) => v.toLocaleString('ko-KR');

interface ProductFormData {
  name: string;
  weightPerBag: number;
  purchasePrice: number;
  sellingPricePerKg: number;
}

const DEFAULT_FORM: ProductFormData = {
  name: '',
  weightPerBag: 20,
  purchasePrice: 0,
  sellingPricePerKg: 0,
};

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

  // 품목별 순이익 계산
  const profitByProduct = useMemo(() => {
    return riceProducts.map(product => {
      // 해당 품목의 매출 필터 (품목명 유사 매칭)
      const related = monthlySales.filter(r =>
        r.productName.toLowerCase().includes(product.name.toLowerCase().split(' ')[0]) ||
        product.name.toLowerCase().includes(r.productName.toLowerCase().split(' ')[0])
      );
      const revenue = related.reduce((s, r) => s + r.totalAmount, 0);
      const totalKg = related.reduce((s, r) => s + r.quantity, 0);
      const cost = totalKg * product.costPerKg;
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return { ...product, revenue, cost, profit, margin, totalKg };
    });
  }, [riceProducts, monthlySales]);

  // 전체 합계
  const totals = useMemo(() => {
    const revenue = monthlySales.reduce((s, r) => s + r.totalAmount, 0);
    // 원가: 매출 품목과 등록 원가 매칭
    let cost = 0;
    monthlySales.forEach(r => {
      const product = riceProducts.find(p =>
        r.productName.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]) ||
        p.name.toLowerCase().includes(r.productName.toLowerCase().split(' ')[0])
      );
      if (product) {
        cost += r.quantity * product.costPerKg;
      }
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
      const product = riceProducts.find(p =>
        r.productName.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]) ||
        p.name.toLowerCase().includes(r.productName.toLowerCase().split(' ')[0])
      );
      if (product) {
        monthMap[m].cost += r.quantity * product.costPerKg;
      }
    });
    return Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, { revenue, cost }]) => ({
      month: month.replace('-', '년 ') + '월',
      revenue,
      cost,
      profit: revenue - cost,
    }));
  }, [salesRecords, riceProducts]);

  const handleSubmit = () => {
    if (!form.name || form.purchasePrice <= 0 || form.weightPerBag <= 0) {
      alert('품명, 포대당 무게, 매입가를 입력해주세요.');
      return;
    }
    if (editingId) {
      updateRiceProduct(editingId, {
        ...form,
        costPerKg: form.purchasePrice / form.weightPerBag,
      });
      setEditingId(null);
    } else {
      addRiceProduct(form);
    }
    setForm(DEFAULT_FORM);
    setShowForm(false);
  };

  const handleEdit = (p: RiceProduct) => {
    setEditingId(p.id);
    setForm({ name: p.name, weightPerBag: p.weightPerBag, purchasePrice: p.purchasePrice, sellingPricePerKg: p.sellingPricePerKg });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('이 품목을 삭제하시겠습니까?')) deleteRiceProduct(id);
  };

  // 포대 무게 선택지
  const BAG_SIZES = [1, 5, 10, 15, 20, 25, 30, 40, 50];

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

      {/* 품목 등록/수정 폼 */}
      {showForm && (
        <div className="bg-[#2d3142] border border-[#00d9ff]/30 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4">{editingId ? '품목 수정' : '품목/원가 등록'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1">품명 *</label>
              <input
                type="text"
                placeholder="예: 신동진쌀 20kg"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">포대당 무게 (kg) *</label>
              <div className="flex gap-1 flex-wrap">
                {BAG_SIZES.map(s => (
                  <button
                    key={s}
                    onClick={() => setForm(f => ({ ...f, weightPerBag: s }))}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${form.weightPerBag === s ? 'bg-[#00d9ff] text-[#1a1d29]' : 'bg-[#1a1d29] text-gray-400 hover:text-white'}`}
                  >
                    {s}kg
                  </button>
                ))}
                <input
                  type="number"
                  placeholder="직접입력"
                  value={form.weightPerBag}
                  onChange={e => setForm(f => ({ ...f, weightPerBag: Number(e.target.value) }))}
                  className="w-20 bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-2 py-1 text-xs focus:border-[#00d9ff] focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">포대당 매입가 (원) *</label>
              <input
                type="number"
                placeholder="예: 48000"
                value={form.purchasePrice || ''}
                onChange={e => setForm(f => ({ ...f, purchasePrice: Number(e.target.value) }))}
                className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none"
              />
              {form.purchasePrice > 0 && form.weightPerBag > 0 && (
                <p className="text-[#00d9ff] text-xs mt-1">
                  → 1kg당 원가: {formatKRW(Math.round(form.purchasePrice / form.weightPerBag))}
                </p>
              )}
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">판매가 (원/kg)</label>
              <input
                type="number"
                placeholder="예: 3200"
                value={form.sellingPricePerKg || ''}
                onChange={e => setForm(f => ({ ...f, sellingPricePerKg: Number(e.target.value) }))}
                className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none"
              />
              {form.sellingPricePerKg > 0 && form.purchasePrice > 0 && form.weightPerBag > 0 && (
                <p className="text-green-400 text-xs mt-1">
                  → kg당 마진: {formatKRW(Math.round(form.sellingPricePerKg - form.purchasePrice / form.weightPerBag))}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-4 py-2 bg-[#00d9ff] text-[#1a1d29] font-semibold rounded-lg hover:bg-[#00b8d9] transition-colors text-sm"
            >
              <Save size={16} />
              {editingId ? '수정 완료' : '등록'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#3d4362] text-gray-300 rounded-lg hover:bg-[#4d5382] transition-colors text-sm"
            >
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
                  {['품명', '포대 무게', '포대 매입가', '1kg당 원가', '판매가(kg)', 'kg당 마진', '마진율', ''].map(h => (
                    <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {riceProducts.map(p => {
                  const marginPerKg = p.sellingPricePerKg - p.costPerKg;
                  const marginRate = p.sellingPricePerKg > 0 ? (marginPerKg / p.sellingPricePerKg) * 100 : 0;
                  return (
                    <tr key={p.id} className="border-b border-[#3d4362]/50 hover:bg-[#3d4362]/20">
                      <td className="px-4 py-3 text-white font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-gray-300">{p.weightPerBag}kg</td>
                      <td className="px-4 py-3 text-gray-300">{formatKRW(p.purchasePrice)}</td>
                      <td className="px-4 py-3 text-yellow-400 font-semibold">{formatKRW(Math.round(p.costPerKg))}</td>
                      <td className="px-4 py-3 text-[#00d9ff]">{p.sellingPricePerKg > 0 ? formatKRW(p.sellingPricePerKg) : '-'}</td>
                      <td className="px-4 py-3 text-green-400">{p.sellingPricePerKg > 0 ? formatKRW(Math.round(marginPerKg)) : '-'}</td>
                      <td className="px-4 py-3">
                        {p.sellingPricePerKg > 0 ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${marginRate >= 10 ? 'bg-green-500/20 text-green-400' : marginRate >= 5 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                            {marginRate.toFixed(1)}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(p)} className="text-gray-400 hover:text-[#00d9ff] transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 월 선택 및 순이익 분석 */}
      {salesRecords.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <h3 className="text-white font-semibold">순이익 분석 기간:</h3>
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

          {/* 품목별 이익 */}
          {profitByProduct.length > 0 && (
            <div className="bg-[#2d3142] rounded-xl border border-[#3d4362] overflow-hidden">
              <div className="p-4 border-b border-[#3d4362]">
                <h3 className="text-white font-semibold">품목별 순이익 ({selectedMonth.replace('-', '년 ')}월)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#3d4362]">
                      {['품목', '판매량(kg)', '매출', '원가', '순이익', '이익률'].map(h => (
                        <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profitByProduct.map(p => (
                      <tr key={p.id} className="border-b border-[#3d4362]/50 hover:bg-[#3d4362]/20">
                        <td className="px-4 py-3 text-white font-medium">{p.name}</td>
                        <td className="px-4 py-3 text-gray-300">{formatNum(p.totalKg)}kg</td>
                        <td className="px-4 py-3 text-[#00d9ff]">{formatKRW(p.revenue)}</td>
                        <td className="px-4 py-3 text-yellow-400">{formatKRW(p.cost)}</td>
                        <td className={`px-4 py-3 font-semibold ${p.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatKRW(p.profit)}</td>
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

          {/* 월별 이익 추이 차트 */}
          {monthlyProfitData.length > 1 && (
            <div className="bg-[#2d3142] rounded-xl p-5 border border-[#3d4362]">
              <h3 className="text-white font-semibold mb-4">월별 매출/원가/순이익 추이</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyProfitData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3d4362" />
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={v => `${(v/1000000).toFixed(0)}M`} />
                  <Tooltip
                    contentStyle={{ background: '#1a1d29', border: '1px solid #3d4362', borderRadius: 8 }}
                    formatter={(v: number, name: string) => [formatKRW(v), name === 'revenue' ? '매출' : name === 'cost' ? '원가' : '순이익']}
                  />
                  <Legend formatter={(v) => v === 'revenue' ? '매출' : v === 'cost' ? '원가' : '순이익'} />
                  <Bar dataKey="revenue" fill="#00d9ff" radius={[3,3,0,0]} />
                  <Bar dataKey="cost" fill="#f59e0b" radius={[3,3,0,0]} />
                  <Bar dataKey="profit" fill="#10b981" radius={[3,3,0,0]} />
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
