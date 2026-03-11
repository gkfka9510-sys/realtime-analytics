// 세금계산서 미발행 업체 확인 페이지
import React, { useState, useMemo } from 'react';
import { useRice } from '@/contexts/RiceContext';
import { FileText, AlertTriangle, CheckCircle, Calendar, Building2, Filter } from 'lucide-react';

const formatKRW = (v: number) => `₩${v.toLocaleString('ko-KR')}`;
const formatNum = (v: number) => v.toLocaleString('ko-KR');

export default function TaxInvoicePage() {
  const { salesRecords, taxInvoices } = useRice();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showAll, setShowAll] = useState(false); // true: 전체, false: 미발행만

  // 매출이 있는 월 목록
  const months = useMemo(() => {
    const set = new Set(salesRecords.map(r => r.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [salesRecords]);

  // 선택 월 분석
  const analysis = useMemo(() => {
    // 해당 월 매출 업체 목록
    const monthlySales = salesRecords.filter(r => r.date.startsWith(selectedMonth));
    const salesByCompany = new Map<string, { count: number; totalAmount: number; dates: string[] }>();

    monthlySales.forEach(r => {
      const key = r.companyName.trim();
      if (!salesByCompany.has(key)) {
        salesByCompany.set(key, { count: 0, totalAmount: 0, dates: [] });
      }
      const v = salesByCompany.get(key)!;
      v.count++;
      v.totalAmount += r.totalAmount;
      if (!v.dates.includes(r.date)) v.dates.push(r.date);
    });

    // 해당 월 세금계산서 발행 업체 (발행일이 선택 월이거나, 그 다음달 10일까지)
    // 비교: 매출월 기준으로 ±1개월 세금계산서 존재 여부 확인
    const [year, month] = selectedMonth.split('-').map(Number);
    // 비교 범위: 선택월 ~ 다음달 15일
    const rangeStart = `${selectedMonth}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
    const rangeEnd = `${nextMonth}-15`;

    const invoicedCompanies = new Set<string>();
    taxInvoices.forEach(inv => {
      // 세금계산서 발행일이 해당 매출월 또는 다음달 15일 이전
      if (inv.issueDate >= rangeStart && inv.issueDate <= rangeEnd) {
        invoicedCompanies.add(inv.companyName.trim());
      }
    });

    // 결과 생성
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

  const displayResults = showAll
    ? analysis.results
    : analysis.results.filter(r => !r.hasInvoice);

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
        if (inv.issueDate >= rangeStart && inv.issueDate <= rangeEnd) {
          invoicedCompanies.add(inv.companyName.trim());
        }
      });

      const unissuedCount = Array.from(salesCompanies).filter(c => !invoicedCompanies.has(c)).length;

      return {
        month,
        label: month.replace('-', '년 ') + '월',
        totalCompanies: salesCompanies.size,
        invoicedCount: Array.from(salesCompanies).filter(c => invoicedCompanies.has(c)).size,
        unissuedCount,
        isComplete: unissuedCount === 0,
      };
    });
  }, [months, salesRecords, taxInvoices]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="text-[#00d9ff]" size={28} />
          세금계산서 발행 현황
        </h2>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <AlertTriangle size={14} className="text-yellow-400" />
          매달 10일 세금계산서 발행 기준
        </div>
      </div>

      {salesRecords.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <p>매출 데이터와 세금계산서 데이터를 업로드하면 분석할 수 있습니다.</p>
          <p className="text-sm mt-2">매출 현황 탭에서 CSV 파일을 업로드해주세요.</p>
        </div>
      ) : (
        <>
          {/* 월 선택 컨트롤 */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
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
            <div className="flex bg-[#2d3142] rounded-lg p-1">
              <button
                onClick={() => setShowAll(false)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${!showAll ? 'bg-red-500/80 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                미발행만
              </button>
              <button
                onClick={() => setShowAll(true)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${showAll ? 'bg-[#7c3aed] text-white' : 'text-gray-400 hover:text-white'}`}
              >
                전체 보기
              </button>
            </div>
          </div>

          {/* 요약 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: '총 거래 업체', value: `${analysis.totalCompanies}개사`, color: '#00d9ff', icon: Building2 },
              { label: '발행 완료', value: `${analysis.invoicedCount}개사`, color: '#10b981', icon: CheckCircle },
              { label: '미발행 업체', value: `${analysis.unissuedCount}개사`, color: '#ef4444', icon: AlertTriangle },
              { label: '당월 총 매출', value: formatKRW(analysis.totalSales), color: '#f59e0b', icon: FileText },
            ].map((card, i) => (
              <div key={i} className={`bg-[#2d3142] rounded-xl p-4 border ${i === 2 && analysis.unissuedCount > 0 ? 'border-red-500/50' : 'border-[#3d4362]'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-xs">{card.label}</span>
                  <card.icon size={16} style={{ color: card.color }} />
                </div>
                <div className="font-bold text-xl" style={{ color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* 발행률 프로그레스 바 */}
          <div className="bg-[#2d3142] rounded-xl p-4 border border-[#3d4362]">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">세금계산서 발행률</span>
              <span className="text-white font-semibold">
                {analysis.totalCompanies > 0
                  ? `${Math.round((analysis.invoicedCount / analysis.totalCompanies) * 100)}%`
                  : '0%'}
              </span>
            </div>
            <div className="w-full bg-[#1a1d29] rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all bg-gradient-to-r from-[#7c3aed] to-[#00d9ff]"
                style={{ width: `${analysis.totalCompanies > 0 ? (analysis.invoicedCount / analysis.totalCompanies) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>발행: {analysis.invoicedCount}개사</span>
              <span>미발행: {analysis.unissuedCount}개사</span>
            </div>
          </div>

          {/* 업체별 현황 테이블 */}
          <div className="bg-[#2d3142] rounded-xl border border-[#3d4362] overflow-hidden">
            <div className="p-4 border-b border-[#3d4362] flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <h3 className="text-white font-semibold">
                {showAll ? '전체 업체 현황' : '🚨 세금계산서 미발행 업체'} ({displayResults.length}개사)
              </h3>
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
                    <tr className="border-b border-[#3d4362]">
                      {['업체명', '매출 건수', '매출 금액', '매출 날짜', '발행 여부'].map(h => (
                        <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayResults
                      .sort((a, b) => a.hasInvoice ? 1 : -1) // 미발행 먼저
                      .map(r => (
                        <tr key={r.companyName} className={`border-b border-[#3d4362]/50 hover:bg-[#3d4362]/20 ${!r.hasInvoice ? 'bg-red-500/5' : ''}`}>
                          <td className="px-4 py-3 text-white font-medium">
                            <div className="flex items-center gap-2">
                              {!r.hasInvoice && <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />}
                              {r.companyName}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-300">{formatNum(r.salesCount)}건</td>
                          <td className="px-4 py-3 text-[#00d9ff] font-semibold">{formatKRW(r.totalSalesAmount)}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            <div className="flex flex-wrap gap-1">
                              {r.salesDates.slice(0, 3).map(d => (
                                <span key={d} className="bg-[#1a1d29] px-1.5 py-0.5 rounded">{d}</span>
                              ))}
                              {r.salesDates.length > 3 && (
                                <span className="text-gray-500">+{r.salesDates.length - 3}건</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {r.hasInvoice ? (
                              <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                                <CheckCircle size={14} />
                                발행 완료
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
                                <AlertTriangle size={14} />
                                미발행
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 월별 발행 현황 요약 */}
          {yearlyStatus.length > 1 && (
            <div className="bg-[#2d3142] rounded-xl border border-[#3d4362] overflow-hidden">
              <div className="p-4 border-b border-[#3d4362]">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Calendar size={18} className="text-[#00d9ff]" />
                  월별 발행 현황
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#3d4362]">
                      {['월', '총 업체수', '발행 완료', '미발행', '상태'].map(h => (
                        <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyStatus.map(s => (
                      <tr
                        key={s.month}
                        className={`border-b border-[#3d4362]/50 cursor-pointer hover:bg-[#3d4362]/20 ${s.month === selectedMonth ? 'bg-[#3d4362]/30' : ''}`}
                        onClick={() => setSelectedMonth(s.month)}
                      >
                        <td className="px-4 py-3 text-white font-medium">{s.label}</td>
                        <td className="px-4 py-3 text-gray-300">{s.totalCompanies}개사</td>
                        <td className="px-4 py-3 text-green-400">{s.invoicedCount}개사</td>
                        <td className="px-4 py-3 text-red-400">{s.unissuedCount}개사</td>
                        <td className="px-4 py-3">
                          {s.isComplete ? (
                            <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                              <CheckCircle size={14} />
                              완료
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
                              <AlertTriangle size={14} />
                              {s.unissuedCount}개 미발행
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
