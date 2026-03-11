// 쌀집 대시보드 메인 레이아웃
import React, { useState, useMemo } from 'react';
import { useRice } from '@/contexts/RiceContext';
import SalesPage from '@/pages/SalesPage';
import ProfitPage from '@/pages/ProfitPage';
import InventoryPage from '@/pages/InventoryPage';
import TaxInvoicePage from '@/pages/TaxInvoicePage';
import {
  TrendingUp, DollarSign, Package, FileText, Bell, Menu, X,
  BarChart2, ShoppingCart, AlertTriangle, ChevronRight
} from 'lucide-react';

const formatKRW = (v: number) => `₩${v.toLocaleString('ko-KR')}`;

type TabId = 'overview' | 'sales' | 'profit' | 'inventory' | 'tax';

const TABS: { id: TabId; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'overview', label: '홈', icon: BarChart2, color: '#00d9ff' },
  { id: 'sales', label: '매출 현황', icon: TrendingUp, color: '#00d9ff' },
  { id: 'profit', label: '순이익', icon: DollarSign, color: '#10b981' },
  { id: 'inventory', label: '재고 현황', icon: Package, color: '#f59e0b' },
  { id: 'tax', label: '세금계산서', icon: FileText, color: '#7c3aed' },
];

export default function RiceDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { salesRecords, riceProducts, inventory, taxInvoices } = useRice();

  // 이번달 통계
  const thisMonth = useMemo(() => {
    const d = new Date();
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const records = salesRecords.filter(r => r.date.startsWith(ym));
    const revenue = records.reduce((s, r) => s + r.totalAmount, 0);
    let cost = 0;
    records.forEach(r => {
      const product = riceProducts.find(p =>
        r.productName.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]) ||
        p.name.toLowerCase().includes(r.productName.toLowerCase().split(' ')[0])
      );
      if (product) cost += r.quantity * product.costPerKg;
    });
    const companies = new Set(records.map(r => r.companyName)).size;

    // 세금계산서 미발행
    const nextMonth = d.getMonth() === 11
      ? `${d.getFullYear() + 1}-01`
      : `${d.getFullYear()}-${String(d.getMonth() + 2).padStart(2, '0')}`;
    const rangeStart = `${ym}-01`;
    const rangeEnd = `${nextMonth}-15`;
    const invoicedCompanies = new Set(
      taxInvoices.filter(i => i.issueDate >= rangeStart && i.issueDate <= rangeEnd).map(i => i.companyName.trim())
    );
    const unissuedCount = Array.from(new Set(records.map(r => r.companyName.trim())))
      .filter(c => !invoicedCompanies.has(c)).length;

    return { ym, revenue, cost, profit: revenue - cost, companies, unissuedCount };
  }, [salesRecords, riceProducts, taxInvoices]);

  // 재고 부족 항목
  const lowStockItems = inventory.filter(i => i.currentStock < 5 && i.currentStock >= 0);

  // 전월 대비
  const lastMonth = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const records = salesRecords.filter(r => r.date.startsWith(ym));
    return records.reduce((s, r) => s + r.totalAmount, 0);
  }, [salesRecords]);

  const revenueChange = lastMonth > 0 ? ((thisMonth.revenue - lastMonth) / lastMonth) * 100 : 0;

  const OverviewPage = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">안녕하세요! 👋</h2>
        <p className="text-gray-400 text-sm">{thisMonth.ym.replace('-', '년 ')}월 현황을 확인하세요</p>
      </div>

      {/* 주요 지표 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: '이번달 매출',
            value: formatKRW(thisMonth.revenue),
            sub: revenueChange !== 0 ? `전월 대비 ${revenueChange > 0 ? '+' : ''}${revenueChange.toFixed(1)}%` : '전월 데이터 없음',
            subColor: revenueChange >= 0 ? 'text-green-400' : 'text-red-400',
            color: '#00d9ff',
            icon: TrendingUp,
            onClick: () => setActiveTab('sales'),
          },
          {
            label: '이번달 순이익',
            value: formatKRW(thisMonth.profit),
            sub: thisMonth.revenue > 0 ? `이익률 ${((thisMonth.profit / thisMonth.revenue) * 100).toFixed(1)}%` : '-',
            subColor: thisMonth.profit >= 0 ? 'text-green-400' : 'text-red-400',
            color: '#10b981',
            icon: DollarSign,
            onClick: () => setActiveTab('profit'),
          },
          {
            label: '거래 업체수',
            value: `${thisMonth.companies}개사`,
            sub: `총 ${salesRecords.length}건 매출`,
            subColor: 'text-gray-400',
            color: '#f59e0b',
            icon: ShoppingCart,
            onClick: () => setActiveTab('sales'),
          },
          {
            label: '세금계산서 미발행',
            value: `${thisMonth.unissuedCount}개사`,
            sub: thisMonth.unissuedCount > 0 ? '⚠️ 확인 필요' : '✅ 모두 발행됨',
            subColor: thisMonth.unissuedCount > 0 ? 'text-red-400' : 'text-green-400',
            color: thisMonth.unissuedCount > 0 ? '#ef4444' : '#10b981',
            icon: FileText,
            onClick: () => setActiveTab('tax'),
          },
        ].map((card, i) => (
          <div
            key={i}
            onClick={card.onClick}
            className="bg-[#2d3142] rounded-xl p-4 border border-[#3d4362] cursor-pointer hover:border-[#4d5382] transition-all hover:scale-[1.02] group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-xs">{card.label}</span>
              <div className="flex items-center gap-1">
                <card.icon size={16} style={{ color: card.color }} />
                <ChevronRight size={12} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
              </div>
            </div>
            <div className="font-bold text-xl mb-1" style={{ color: card.color }}>{card.value}</div>
            <div className={`text-xs ${card.subColor}`}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* 경고 알림 */}
      {(lowStockItems.length > 0 || thisMonth.unissuedCount > 0) && (
        <div className="space-y-2">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <AlertTriangle size={18} className="text-yellow-400" />
            주의 사항
          </h3>
          {thisMonth.unissuedCount > 0 && (
            <div
              className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-xl cursor-pointer hover:bg-red-500/15 transition-colors"
              onClick={() => setActiveTab('tax')}
            >
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-red-400" />
                <div>
                  <p className="text-white text-sm font-medium">세금계산서 미발행 업체 {thisMonth.unissuedCount}개사</p>
                  <p className="text-gray-400 text-xs">{thisMonth.ym.replace('-', '년 ')}월 기준</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-red-400" />
            </div>
          )}
          {lowStockItems.map(item => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl cursor-pointer hover:bg-yellow-500/15 transition-colors"
              onClick={() => setActiveTab('inventory')}
            >
              <div className="flex items-center gap-3">
                <Package size={18} className="text-yellow-400" />
                <div>
                  <p className="text-white text-sm font-medium">{item.productName} 재고 부족</p>
                  <p className="text-gray-400 text-xs">현재 {item.currentStock.toFixed(1)}포대 ({Math.round(item.currentStockKg)}kg)</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-yellow-400" />
            </div>
          ))}
        </div>
      )}

      {/* 빠른 이동 */}
      <div>
        <h3 className="text-white font-semibold mb-3">빠른 이동</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TABS.filter(t => t.id !== 'overview').map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center gap-3 p-5 bg-[#2d3142] hover:bg-[#3d4362] border border-[#3d4362] rounded-xl transition-all hover:scale-[1.02] group"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${tab.color}20` }}>
                <tab.icon size={22} style={{ color: tab.color }} />
              </div>
              <span className="text-white text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 시작 가이드 */}
      {salesRecords.length === 0 && (
        <div className="bg-[#2d3142] border border-[#3d4362] rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">🚀 시작하기</h3>
          <div className="space-y-3">
            {[
              { step: '1', text: '순이익 탭에서 취급 품목(쌀 종류)과 원가를 등록하세요', tab: 'profit' as TabId },
              { step: '2', text: '매출 현황 탭에서 매출 CSV 파일을 업로드하세요', tab: 'sales' as TabId },
              { step: '3', text: '매출 현황 탭에서 세금계산서 CSV 파일을 업로드하세요', tab: 'sales' as TabId },
              { step: '4', text: '재고 현황 탭에서 현재 재고를 설정하세요', tab: 'inventory' as TabId },
            ].map(item => (
              <div
                key={item.step}
                onClick={() => setActiveTab(item.tab)}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#3d4362] cursor-pointer transition-colors group"
              >
                <div className="w-6 h-6 rounded-full bg-[#00d9ff] text-[#1a1d29] font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  {item.step}
                </div>
                <span className="text-gray-300 text-sm group-hover:text-white transition-colors">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1a1d29] flex">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 사이드바 */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#2d3142] border-r border-[#3d4362] flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* 로고 */}
        <div className="p-6 border-b border-[#3d4362]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00d9ff] to-[#7c3aed] flex items-center justify-center text-xl">
                🌾
              </div>
              <div>
                <h1 className="text-white font-bold text-base">쌀집 대시보드</h1>
                <p className="text-gray-400 text-xs">Rice Business Manager</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 p-4 space-y-1">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-[#3d4362] to-[#3d4362] text-white'
                    : 'text-gray-400 hover:text-white hover:bg-[#3d4362]/50'
                }`}
              >
                <tab.icon size={18} style={{ color: isActive ? tab.color : undefined }} />
                {tab.label}
                {tab.id === 'tax' && thisMonth.unissuedCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {thisMonth.unissuedCount}
                  </span>
                )}
                {tab.id === 'inventory' && lowStockItems.length > 0 && (
                  <span className="ml-auto bg-yellow-500 text-black text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {lowStockItems.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* 하단 요약 */}
        <div className="p-4 border-t border-[#3d4362]">
          <div className="bg-[#1a1d29] rounded-xl p-3">
            <p className="text-gray-400 text-xs mb-1">이번달 순이익</p>
            <p className={`font-bold text-base ${thisMonth.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatKRW(thisMonth.profit)}
            </p>
          </div>
        </div>
      </aside>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 탑바 */}
        <header className="bg-[#2d3142] border-b border-[#3d4362] px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-400 hover:text-white">
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">🌾 쌀집 대시보드</span>
              <span className="text-gray-600">/</span>
              <span className="text-white font-medium">{TABS.find(t => t.id === activeTab)?.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {thisMonth.unissuedCount > 0 && (
              <button
                onClick={() => setActiveTab('tax')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors"
              >
                <Bell size={13} />
                미발행 {thisMonth.unissuedCount}건
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00d9ff] to-[#7c3aed] flex items-center justify-center text-sm">
              🌾
            </div>
          </div>
        </header>

        {/* 페이지 컨텐츠 */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {activeTab === 'overview' && <OverviewPage />}
          {activeTab === 'sales' && <SalesPage />}
          {activeTab === 'profit' && <ProfitPage />}
          {activeTab === 'inventory' && <InventoryPage />}
          {activeTab === 'tax' && <TaxInvoicePage />}
        </main>
      </div>
    </div>
  );
}
