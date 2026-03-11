// 매출 현황 페이지 (CSV 업로드, 일별/월별 차트)
import React, { useState, useMemo, useRef } from 'react';
import { useRice } from '@/contexts/RiceContext';
import { parseSalesCSV, parseTaxInvoiceCSV, readFileAsText } from '@/lib/csvParser';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import { Upload, Calendar, TrendingUp, DollarSign, FileText, AlertTriangle, Trash2 } from 'lucide-react';

const formatKRW = (v: number) => `₩${v.toLocaleString('ko-KR')}`;
const formatNum = (v: number) => v.toLocaleString('ko-KR');

export default function SalesPage() {
  const { salesRecords, setSalesRecords, addSalesRecords, taxInvoices, addTaxInvoices } = useRice();
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [uploadMsg, setUploadMsg] = useState('');
  const [taxUploadMsg, setTaxUploadMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart');
  const salesRef = useRef<HTMLInputElement>(null);
  const taxRef = useRef<HTMLInputElement>(null);

  // 월 목록 추출
  const months = useMemo(() => {
    const set = new Set(salesRecords.map(r => r.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [salesRecords]);

  // 월별 매출 집계
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    salesRecords.forEach(r => {
      const m = r.date.slice(0, 7);
      map[m] = (map[m] || 0) + r.totalAmount;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({
      month,
      total,
      label: month.replace('-', '년 ') + '월',
    }));
  }, [salesRecords]);

  // 일별 매출 집계 (선택 월)
  const dailyData = useMemo(() => {
    const filtered = salesRecords.filter(r => r.date.startsWith(selectedMonth));
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      map[r.date] = (map[r.date] || 0) + r.totalAmount;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({
      date,
      total,
      label: date.slice(5), // MM-DD
    }));
  }, [salesRecords, selectedMonth]);

  // 요약 통계
  const stats = useMemo(() => {
    const thisMonth = salesRecords.filter(r => r.date.startsWith(selectedMonth));
    const total = thisMonth.reduce((s, r) => s + r.totalAmount, 0);
    const count = thisMonth.length;
    const companies = new Set(thisMonth.map(r => r.companyName)).size;
    const avgPerDay = dailyData.length > 0 ? total / dailyData.length : 0;
    return { total, count, companies, avgPerDay };
  }, [salesRecords, selectedMonth, dailyData]);

  // CSV 업로드 핸들러 (매출)
  const handleSalesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const { records, errors } = parseSalesCSV(text);
      if (records.length > 0) {
        addSalesRecords(records);
        setUploadMsg(`✅ ${records.length}건 업로드 완료${errors.length > 0 ? ` (오류 ${errors.length}건)` : ''}`);
      } else {
        setUploadMsg(`❌ 파싱 실패: ${errors.join(', ')}`);
      }
    } catch (err) {
      setUploadMsg('❌ 파일 읽기 오류');
    }
    if (salesRef.current) salesRef.current.value = '';
    setTimeout(() => setUploadMsg(''), 5000);
  };

  // CSV 업로드 핸들러 (세금계산서)
  const handleTaxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const { invoices, errors } = parseTaxInvoiceCSV(text);
      if (invoices.length > 0) {
        addTaxInvoices(invoices);
        setTaxUploadMsg(`✅ ${invoices.length}건 업로드 완료${errors.length > 0 ? ` (오류 ${errors.length}건)` : ''}`);
      } else {
        setTaxUploadMsg(`❌ 파싱 실패: ${errors.join(', ')}`);
      }
    } catch {
      setTaxUploadMsg('❌ 파일 읽기 오류');
    }
    if (taxRef.current) taxRef.current.value = '';
    setTimeout(() => setTaxUploadMsg(''), 5000);
  };

  const handleClearSales = () => {
    if (confirm('매출 데이터를 모두 삭제하시겠습니까?')) setSalesRecords([]);
  };

  // 테이블용 데이터
  const tableData = useMemo(() => {
    return salesRecords
      .filter(r => viewMode === 'monthly' ? true : r.date.startsWith(selectedMonth))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 100);
  }, [salesRecords, viewMode, selectedMonth]);

  const chartData = viewMode === 'daily' ? dailyData : monthlyData;
  const chartKey = viewMode === 'daily' ? 'label' : 'label';

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="text-[#00d9ff]" size={28} />
          매출 현황
        </h2>
        <div className="flex flex-wrap gap-2">
          {/* 매출 CSV 업로드 */}
          <label className="flex items-center gap-2 px-4 py-2 bg-[#00d9ff] hover:bg-[#00b8d9] text-[#1a1d29] font-semibold rounded-lg cursor-pointer transition-colors text-sm">
            <Upload size={16} />
            매출 CSV 업로드
            <input ref={salesRef} type="file" accept=".csv" className="hidden" onChange={handleSalesUpload} />
          </label>
          {/* 세금계산서 CSV 업로드 */}
          <label className="flex items-center gap-2 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold rounded-lg cursor-pointer transition-colors text-sm">
            <FileText size={16} />
            세금계산서 CSV 업로드
            <input ref={taxRef} type="file" accept=".csv" className="hidden" onChange={handleTaxUpload} />
          </label>
          <button
            onClick={handleClearSales}
            className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* 업로드 메시지 */}
      {uploadMsg && (
        <div className={`p-3 rounded-lg text-sm font-medium ${uploadMsg.startsWith('✅') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          매출: {uploadMsg}
        </div>
      )}
      {taxUploadMsg && (
        <div className={`p-3 rounded-lg text-sm font-medium ${taxUploadMsg.startsWith('✅') ? 'bg-purple-500/20 text-purple-400' : 'bg-red-500/20 text-red-400'}`}>
          세금계산서: {taxUploadMsg}
        </div>
      )}

      {/* CSV 형식 안내 */}
      {salesRecords.length === 0 && (
        <div className="bg-[#2d3142] border border-[#3d4362] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-yellow-400" />
            <span className="text-white font-semibold">CSV 파일 형식 안내</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[#00d9ff] font-medium mb-2">📊 매출 CSV 컬럼 (순서 자유)</p>
              <code className="block bg-[#1a1d29] p-3 rounded text-gray-300 text-xs">
                날짜, 업체명, 품목, 수량(kg), 단가, 합계금액, 비고<br/>
                2024-01-05, 한국식품, 신동진20kg, 100, 45000, 4500000, -
              </code>
            </div>
            <div>
              <p className="text-purple-400 font-medium mb-2">🧾 세금계산서 CSV 컬럼</p>
              <code className="block bg-[#1a1d29] p-3 rounded text-gray-300 text-xs">
                발행일, 업체명, 합계금액, 비고<br/>
                2024-01-10, 한국식품, 4500000, -
              </code>
            </div>
          </div>
        </div>
      )}

      {salesRecords.length > 0 && (
        <>
          {/* 컨트롤 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-[#2d3142] rounded-lg p-1">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'daily' ? 'bg-[#00d9ff] text-[#1a1d29]' : 'text-gray-400 hover:text-white'}`}
              >일별</button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'monthly' ? 'bg-[#00d9ff] text-[#1a1d29]' : 'text-gray-400 hover:text-white'}`}
              >월별</button>
            </div>
            {viewMode === 'daily' && months.length > 0 && (
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-[#2d3142] border border-[#3d4362] text-white rounded-lg px-3 py-1.5 text-sm"
              >
                {months.map(m => (
                  <option key={m} value={m}>{m.replace('-', '년 ')}월</option>
                ))}
              </select>
            )}
            <div className="flex bg-[#2d3142] rounded-lg p-1 ml-auto">
              <button
                onClick={() => setActiveTab('chart')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'chart' ? 'bg-[#7c3aed] text-white' : 'text-gray-400 hover:text-white'}`}
              >차트</button>
              <button
                onClick={() => setActiveTab('table')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'table' ? 'bg-[#7c3aed] text-white' : 'text-gray-400 hover:text-white'}`}
              >테이블</button>
            </div>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: viewMode === 'daily' ? `${selectedMonth} 매출` : '전체 총 매출', value: viewMode === 'daily' ? formatKRW(stats.total) : formatKRW(salesRecords.reduce((s,r)=>s+r.totalAmount,0)), icon: DollarSign, color: '#00d9ff' },
              { label: '매출 건수', value: `${formatNum(viewMode === 'daily' ? stats.count : salesRecords.length)}건`, icon: TrendingUp, color: '#7c3aed' },
              { label: '거래 업체수', value: `${formatNum(viewMode === 'daily' ? stats.companies : new Set(salesRecords.map(r=>r.companyName)).size)}개사`, icon: FileText, color: '#f59e0b' },
              { label: viewMode === 'daily' ? '일 평균 매출' : '월 평균 매출', value: viewMode === 'daily' ? formatKRW(stats.avgPerDay) : formatKRW(monthlyData.length > 0 ? salesRecords.reduce((s,r)=>s+r.totalAmount,0)/monthlyData.length : 0), icon: Calendar, color: '#10b981' },
            ].map((card, i) => (
              <div key={i} className="bg-[#2d3142] rounded-xl p-4 border border-[#3d4362]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-xs">{card.label}</span>
                  <card.icon size={16} style={{ color: card.color }} />
                </div>
                <div className="text-white font-bold text-lg">{card.value}</div>
              </div>
            ))}
          </div>

          {/* 차트 / 테이블 */}
          {activeTab === 'chart' ? (
            <div className="bg-[#2d3142] rounded-xl p-5 border border-[#3d4362]">
              <h3 className="text-white font-semibold mb-4">
                {viewMode === 'daily' ? `${selectedMonth} 일별 매출` : '월별 매출 추이'}
              </h3>
              {chartData.length === 0 ? (
                <div className="text-center text-gray-500 py-12">데이터가 없습니다</div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  {viewMode === 'monthly' ? (
                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3d4362" />
                      <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${(v/1000000).toFixed(0)}M`} />
                      <Tooltip
                        contentStyle={{ background: '#1a1d29', border: '1px solid #3d4362', borderRadius: 8 }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(v: number) => [formatKRW(v), '매출']}
                      />
                      <Bar dataKey="total" fill="#00d9ff" radius={[4,4,0,0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3d4362" />
                      <XAxis dataKey="label" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${(v/10000).toFixed(0)}만`} />
                      <Tooltip
                        contentStyle={{ background: '#1a1d29', border: '1px solid #3d4362', borderRadius: 8 }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(v: number) => [formatKRW(v), '매출']}
                      />
                      <Line type="monotone" dataKey="total" stroke="#00d9ff" strokeWidth={2} dot={{ fill: '#00d9ff', r: 4 }} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          ) : (
            <div className="bg-[#2d3142] rounded-xl border border-[#3d4362] overflow-hidden">
              <div className="p-4 border-b border-[#3d4362]">
                <h3 className="text-white font-semibold">매출 내역 ({tableData.length}건 표시)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#3d4362]">
                      {['날짜','업체명','품목','수량(kg)','단가','합계금액','비고'].map(h => (
                        <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map(r => (
                      <tr key={r.id} className="border-b border-[#3d4362]/50 hover:bg-[#3d4362]/30 transition-colors">
                        <td className="px-4 py-3 text-gray-300">{r.date}</td>
                        <td className="px-4 py-3 text-white font-medium">{r.companyName}</td>
                        <td className="px-4 py-3 text-gray-300">{r.productName}</td>
                        <td className="px-4 py-3 text-gray-300">{formatNum(r.quantity)}</td>
                        <td className="px-4 py-3 text-gray-300">{formatKRW(r.unitPrice)}</td>
                        <td className="px-4 py-3 text-[#00d9ff] font-semibold">{formatKRW(r.totalAmount)}</td>
                        <td className="px-4 py-3 text-gray-500">{r.memo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tableData.length === 0 && (
                  <div className="text-center text-gray-500 py-8">데이터가 없습니다</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
