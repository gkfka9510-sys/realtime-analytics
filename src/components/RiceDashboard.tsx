// 태평농산 대시보드 — 브랜드 리뉴얼
import React, { useState, useMemo } from 'react';
import { useRice } from '@/contexts/RiceContext';
import SalesPage from '@/pages/SalesPage';
import ProfitPage from '@/pages/ProfitPage';
import InventoryPage from '@/pages/InventoryPage';
import TaxInvoicePage from '@/pages/TaxInvoicePage';
import SettingsPage from '@/pages/SettingsPage';
import MasterDataPage from '@/pages/MasterDataPage';
import RetailCustomerPage from '@/pages/RetailCustomerPage';
import ShopProductPage from '@/pages/ShopProductPage';
import OrderManagePage from '@/pages/OrderManagePage';
import {
  TrendingUp, DollarSign, Package, FileText, Bell, Menu, X,
  BarChart2, ShoppingCart, AlertTriangle, ChevronRight, Settings, Loader2,
  Building2, Users, Clock, Crown, Star, Heart, Store, ClipboardList, Leaf,
  ArrowUpRight, ArrowDownRight, Wheat
} from 'lucide-react';

const formatKRW = (v: number) => `₩${v.toLocaleString('ko-KR')}`;

// ── 태평농산 색상 팔레트 ──────────────────────────────────────
const C = {
  // 배경
  bg:         '#0f1a12',   // 딥 다크 그린
  surface:    '#172015',   // 카드 배경
  surfaceHov: '#1e2a1a',   // 카드 호버
  border:     '#253320',   // 테두리
  borderHov:  '#3a5030',   // 호버 테두리
  // 브랜드
  green:      '#2d9e4e',   // 메인 그린
  greenLight: '#3db866',   // 밝은 그린
  greenGlow:  'rgba(45,158,78,0.15)',
  gold:       '#c8a951',   // 골드
  goldLight:  '#f0c96a',
  goldGlow:   'rgba(200,169,81,0.15)',
  orange:     '#e8621a',
  // 텍스트
  textPri:    '#f0f4ee',   // 주요 텍스트
  textSec:    '#8aad80',   // 보조 텍스트
  textMute:   '#4a6b42',   // 뮤트 텍스트
  // 상태색
  red:        '#f87171',
  yellow:     '#fbbf24',
  blue:       '#60a5fa',
  pink:       '#f472b6',
};

const LOGO_IMAGE = 'https://www.genspark.ai/api/files/s/QTqN4PyP?cache_control=3600';

type TabId = 'overview' | 'master' | 'sales' | 'profit' | 'inventory' | 'tax' | 'retail' | 'shop' | 'orders' | 'settings';

const TABS: { id: TabId; label: string; icon: React.ElementType; color: string; group?: string }[] = [
  { id: 'overview',  label: '홈',        icon: BarChart2,     color: C.green,   group: '대시보드' },
  { id: 'sales',     label: '매출 관리',  icon: TrendingUp,    color: C.blue,    group: '운영관리' },
  { id: 'profit',    label: '순이익',     icon: DollarSign,    color: C.green,   group: '운영관리' },
  { id: 'inventory', label: '재고 현황',  icon: Package,       color: C.yellow,  group: '운영관리' },
  { id: 'tax',       label: '세금계산서', icon: FileText,      color: '#a78bfa', group: '운영관리' },
  { id: 'retail',    label: '단골 고객',  icon: Heart,         color: C.pink,    group: '고객관리' },
  { id: 'shop',      label: '상품 관리',  icon: Store,         color: C.green,   group: '쇼핑몰' },
  { id: 'orders',    label: '주문 관리',  icon: ClipboardList, color: C.orange,  group: '쇼핑몰' },
  { id: 'master',    label: '기초데이터', icon: Building2,     color: '#a78bfa', group: '설정' },
  { id: 'settings',  label: '설정',       icon: Settings,      color: C.textSec, group: '설정' },
];

interface Props { username: string; displayName: string; onLogout: () => void; }

export default function RiceDashboard({ username, displayName, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    salesRecords, riceProducts, inventory, taxInvoices,
    customers, items, retailCustomers, retailSales, orders, isLoading
  } = useRice();

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
    const nextMonth = d.getMonth() === 11
      ? `${d.getFullYear() + 1}-01`
      : `${d.getFullYear()}-${String(d.getMonth() + 2).padStart(2, '0')}`;
    const rangeStart = `${ym}-01`, rangeEnd = `${nextMonth}-15`;
    const invoicedCompanies = new Set(
      taxInvoices.filter(i => i.issueDate >= rangeStart && i.issueDate <= rangeEnd).map(i => i.companyName.trim())
    );
    const unissuedCount = Array.from(new Set(records.map(r => r.companyName.trim())))
      .filter(c => !invoicedCompanies.has(c)).length;
    return { ym, revenue, cost, profit: revenue - cost, companies, unissuedCount };
  }, [salesRecords, riceProducts, taxInvoices]);

  const lastMonth = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return salesRecords.filter(r => r.date.startsWith(ym)).reduce((s, r) => s + r.totalAmount, 0);
  }, [salesRecords]);

  const revenueChange = lastMonth > 0 ? ((thisMonth.revenue - lastMonth) / lastMonth) * 100 : 0;
  const lowStockItems = inventory.filter(i => i.currentStock < 5 && i.currentStock >= 0);

  const retailReminderCount = useMemo(() => {
    const lastPurchase: Record<string, string> = {};
    retailSales.forEach(s => {
      if (!lastPurchase[s.customerId] || s.date > lastPurchase[s.customerId]) lastPurchase[s.customerId] = s.date;
    });
    return retailCustomers.filter(c => {
      const last = lastPurchase[c.id];
      if (!last) return false;
      return Math.floor((Date.now() - new Date(last).getTime()) / 86400000) >= 30;
    }).length;
  }, [retailCustomers, retailSales]);

  const pendingOrderCount = useMemo(() => orders.filter(o => o.status === 'pending').length, [orders]);

  // ─── 로딩 화면 ──────────────────────────────────────────
  if (isLoading) return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:20, fontFamily:'"Noto Sans KR",sans-serif' }}>
      <div style={{ width:80, height:80, borderRadius:'50%', background:`linear-gradient(135deg,${C.green},${C.gold})`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 0 40px ${C.greenGlow}` }}>
        <Wheat size={40} color='#fff' />
      </div>
      <Loader2 size={28} color={C.green} style={{ animation:'spin 1s linear infinite' }} />
      <p style={{ color:C.textSec, fontSize:15 }}>태평농산 데이터를 불러오는 중...</p>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ─── 메인 대시보드 ──────────────────────────────────────
  const OverviewPage = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {/* 헤더 인사말 */}
      <div style={{ padding:'28px 28px 24px', background:`linear-gradient(135deg,${C.surface},${C.surfaceHov})`, borderRadius:20, border:`1px solid ${C.border}`, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', right:20, top:'50%', transform:'translateY(-50%)', opacity:0.06, fontSize:120, lineHeight:1 }}>🌾</div>
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:4 }}>
          <div style={{ width:48, height:48, borderRadius:14, background:`linear-gradient(135deg,${C.green},${C.gold})`, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 }}>
            <img src={LOGO_IMAGE} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none';}} />
          </div>
          <div>
            <h2 style={{ color:C.textPri, fontWeight:700, fontSize:22, margin:'0 0 4px', letterSpacing:-0.5 }}>
              안녕하세요, {displayName}님! 👋
            </h2>
            <p style={{ color:C.textSec, fontSize:13, margin:0 }}>
              태평농산 {thisMonth.ym.replace('-', '년 ')}월 현황
            </p>
          </div>
        </div>
      </div>

      {/* 주요 지표 카드 */}
      <div>
        <h3 style={{ color:C.textSec, fontSize:12, fontWeight:600, letterSpacing:1, textTransform:'uppercase', margin:'0 0 12px', display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:3, height:14, background:C.green, borderRadius:2, display:'inline-block' }} /> 이번달 핵심 지표
        </h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }} className="dashboard-metrics">
          {[
            { label:'이번달 매출', value:formatKRW(thisMonth.revenue), sub: revenueChange !== 0 ? `전월 대비 ${revenueChange > 0 ? '+' : ''}${revenueChange.toFixed(1)}%` : '전월 데이터 없음', up: revenueChange >= 0, color:C.green, icon:TrendingUp, onClick:()=>setActiveTab('sales') },
            { label:'이번달 순이익', value:formatKRW(thisMonth.profit), sub: thisMonth.revenue > 0 ? `이익률 ${((thisMonth.profit/thisMonth.revenue)*100).toFixed(1)}%` : '-', up: thisMonth.profit >= 0, color:C.gold, icon:DollarSign, onClick:()=>setActiveTab('profit') },
            { label:'거래 업체수', value:`${thisMonth.companies}개사`, sub:`총 ${salesRecords.length.toLocaleString()}건`, up: true, color:C.blue, icon:ShoppingCart, onClick:()=>setActiveTab('sales') },
            { label:'세금계산서 미발행', value:`${thisMonth.unissuedCount}개사`, sub: thisMonth.unissuedCount > 0 ? '⚠️ 확인 필요' : '✅ 모두 발행', up: thisMonth.unissuedCount === 0, color: thisMonth.unissuedCount > 0 ? C.red : C.green, icon:FileText, onClick:()=>setActiveTab('tax') },
            { label:'대기 주문', value:`${pendingOrderCount}건`, sub: orders.length > 0 ? `총 ${orders.length}건 접수` : '주문 없음', up: pendingOrderCount === 0, color: pendingOrderCount > 0 ? C.orange : C.textSec, icon:ClipboardList, onClick:()=>setActiveTab('orders') },
          ].map((card, i) => (
            <div key={i} onClick={card.onClick}
              style={{ background:C.surface, borderRadius:16, padding:'16px', border:`1px solid ${C.border}`, cursor:'pointer', transition:'all 0.2s', position:'relative', overflow:'hidden' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = card.color + '60'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${card.color}20`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
            >
              <div style={{ position:'absolute', right:12, top:12, width:36, height:36, borderRadius:10, background:`${card.color}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <card.icon size={18} color={card.color} />
              </div>
              <p style={{ color:C.textSec, fontSize:11, fontWeight:500, margin:'0 0 8px', letterSpacing:0.3 }}>{card.label}</p>
              <p style={{ color:card.color, fontWeight:800, fontSize:20, margin:'0 0 6px', letterSpacing:-0.5 }}>{card.value}</p>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                {card.up ? <ArrowUpRight size={12} color={C.green} /> : <ArrowDownRight size={12} color={C.red} />}
                <span style={{ fontSize:11, color: card.up ? C.green : C.red }}>{card.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 단골 고객 현황 */}
      {retailCustomers.length > 0 && (
        <div style={{ background:C.surface, borderRadius:16, padding:'18px 20px', border:`1px solid ${C.border}` }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h3 style={{ color:C.textPri, fontWeight:600, fontSize:14, margin:0, display:'flex', alignItems:'center', gap:8 }}>
              <Heart size={16} color={C.pink} /> 단골 고객 현황
            </h3>
            <button onClick={() => setActiveTab('retail')} style={{ color:C.pink, fontSize:12, background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
              자세히 <ChevronRight size={12} />
            </button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
            {[
              { label:'전체 고객', value:`${retailCustomers.length}명`, icon:Users, color:C.pink },
              { label:'VIP 고객', value:`${retailCustomers.filter(c=>c.grade==='vip').length}명`, icon:Crown, color:C.gold },
              { label:'이달 판매', value:`${retailSales.filter(s=>s.date.startsWith(thisMonth.ym)).length}건`, icon:ShoppingCart, color:C.blue },
              { label:'재구매 유도', value:`${retailReminderCount}명`, icon:Clock, color: retailReminderCount > 0 ? C.yellow : C.textMute },
            ].map(card => (
              <div key={card.label} onClick={() => setActiveTab('retail')}
                style={{ background:C.bg, borderRadius:12, padding:'12px', cursor:'pointer', border:`1px solid ${C.border}`, transition:'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = C.surfaceHov}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = C.bg}
              >
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                  <card.icon size={13} color={card.color} />
                  <span style={{ color:C.textSec, fontSize:11 }}>{card.label}</span>
                </div>
                <p style={{ color:card.color, fontWeight:700, fontSize:18, margin:0 }}>{card.value}</p>
              </div>
            ))}
          </div>
          {retailReminderCount > 0 && (
            <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:10 }}>
              <Clock size={13} color={C.yellow} />
              <p style={{ color:C.yellow, fontSize:12, margin:0, flex:1 }}>
                <strong>{retailReminderCount}명</strong>의 단골 고객이 30일 이상 미구매
              </p>
              <button onClick={() => setActiveTab('retail')} style={{ color:C.yellow, fontSize:11, background:'none', border:'none', cursor:'pointer', whiteSpace:'nowrap' }}>연락하기 →</button>
            </div>
          )}
        </div>
      )}

      {/* 경고 알림 */}
      {(lowStockItems.length > 0 || thisMonth.unissuedCount > 0 || pendingOrderCount > 0) && (
        <div>
          <h3 style={{ color:C.textSec, fontSize:12, fontWeight:600, letterSpacing:1, textTransform:'uppercase', margin:'0 0 12px', display:'flex', alignItems:'center', gap:6 }}>
            <AlertTriangle size={13} color={C.yellow} /> 주의 사항
          </h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {pendingOrderCount > 0 && (
              <div onClick={() => setActiveTab('orders')}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'rgba(232,98,26,0.08)', border:'1px solid rgba(232,98,26,0.25)', borderRadius:12, cursor:'pointer', transition:'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(232,98,26,0.14)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(232,98,26,0.08)'}
              >
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <ClipboardList size={18} color={C.orange} />
                  <div>
                    <p style={{ color:C.textPri, fontSize:13, fontWeight:600, margin:'0 0 2px' }}>대기 중인 주문 {pendingOrderCount}건</p>
                    <p style={{ color:C.textSec, fontSize:11, margin:0 }}>처리가 필요합니다</p>
                  </div>
                </div>
                <ChevronRight size={16} color={C.orange} />
              </div>
            )}
            {thisMonth.unissuedCount > 0 && (
              <div onClick={() => setActiveTab('tax')}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:12, cursor:'pointer', transition:'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(248,113,113,0.14)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(248,113,113,0.08)'}
              >
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <FileText size={18} color={C.red} />
                  <div>
                    <p style={{ color:C.textPri, fontSize:13, fontWeight:600, margin:'0 0 2px' }}>세금계산서 미발행 {thisMonth.unissuedCount}개사</p>
                    <p style={{ color:C.textSec, fontSize:11, margin:0 }}>{thisMonth.ym.replace('-', '년 ')}월 기준</p>
                  </div>
                </div>
                <ChevronRight size={16} color={C.red} />
              </div>
            )}
            {lowStockItems.map(item => (
              <div key={item.id} onClick={() => setActiveTab('inventory')}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.25)', borderRadius:12, cursor:'pointer', transition:'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(251,191,36,0.14)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(251,191,36,0.08)'}
              >
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Package size={18} color={C.yellow} />
                  <div>
                    <p style={{ color:C.textPri, fontSize:13, fontWeight:600, margin:'0 0 2px' }}>{item.productName} 재고 부족</p>
                    <p style={{ color:C.textSec, fontSize:11, margin:0 }}>현재 {item.currentStock.toFixed(1)}포대 ({Math.round(item.currentStockKg)}kg)</p>
                  </div>
                </div>
                <ChevronRight size={16} color={C.yellow} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 기초데이터 */}
      {(customers.length > 0 || items.length > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
          {[
            { label:'등록 거래처', value:`${customers.length}개사`, icon:Building2, color:'#a78bfa' },
            { label:'등록 품목', value:`${items.length}개`, icon:Package, color:'#a78bfa' },
          ].map(card => (
            <div key={card.label} onClick={() => setActiveTab('master')}
              style={{ background:C.surface, borderRadius:14, padding:'14px 16px', border:`1px solid ${C.border}`, cursor:'pointer', transition:'all 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = card.color + '50'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; }}
            >
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ color:C.textSec, fontSize:11 }}>{card.label}</span>
                <card.icon size={15} color={card.color} />
              </div>
              <p style={{ color:card.color, fontWeight:700, fontSize:20, margin:0 }}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 빠른 이동 */}
      <div>
        <h3 style={{ color:C.textSec, fontSize:12, fontWeight:600, letterSpacing:1, textTransform:'uppercase', margin:'0 0 12px', display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:3, height:14, background:C.gold, borderRadius:2, display:'inline-block' }} /> 빠른 이동
        </h3>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }} className="quick-nav">
          {TABS.filter(t => t.id !== 'overview' && t.id !== 'settings').map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'14px 8px', background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, cursor:'pointer', transition:'all 0.2s', color:C.textPri, fontFamily:'inherit' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = C.surfaceHov; (e.currentTarget as HTMLButtonElement).style.borderColor = tab.color + '50'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = C.surface; (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
            >
              <div style={{ width:40, height:40, borderRadius:12, background:`${tab.color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <tab.icon size={19} color={tab.color} />
              </div>
              <span style={{ fontSize:11, fontWeight:600, color:C.textSec }}>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 시작 가이드 */}
      {salesRecords.length === 0 && (
        <div style={{ background:C.surface, borderRadius:16, padding:'22px 24px', border:`1px solid ${C.border}` }}>
          <h3 style={{ color:C.textPri, fontWeight:700, fontSize:16, margin:'0 0 16px', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:20 }}>🚀</span> 태평농산 대시보드 시작하기
          </h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { step:'1', text:'기초데이터 탭에서 거래처와 품목을 먼저 등록하세요', tab:'master' as TabId },
              { step:'2', text:'순이익 탭에서 취급 품목(쌀 종류)과 원가를 등록하세요', tab:'profit' as TabId },
              { step:'3', text:'매출 관리 탭에서 CSV 업로드 또는 직접 입력하세요', tab:'sales' as TabId },
              { step:'4', text:'재고 현황 탭에서 현재 재고를 설정하세요', tab:'inventory' as TabId },
              { step:'5', text:'단골 고객 탭에서 소매 고객을 등록하고 구매 이력을 관리하세요', tab:'retail' as TabId },
              { step:'6', text:'상품 관리 탭에서 주문 페이지에 표시할 상품을 등록하세요', tab:'shop' as TabId },
            ].map(item => (
              <div key={item.step} onClick={() => setActiveTab(item.tab)}
                style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'10px 12px', borderRadius:10, cursor:'pointer', transition:'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = C.surfaceHov}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
              >
                <div style={{ width:24, height:24, borderRadius:'50%', background:`linear-gradient(135deg,${C.green},${C.gold})`, color:'#fff', fontWeight:700, fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                  {item.step}
                </div>
                <span style={{ color:C.textSec, fontSize:13, lineHeight:1.5 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 하단 반응형 그리드 CSS 지원 */}
      <style>{`
        @media(min-width:640px) {
          .dashboard-metrics { grid-template-columns: repeat(3,1fr) !important; }
          .quick-nav { grid-template-columns: repeat(4,1fr) !important; }
        }
        @media(min-width:1024px) {
          .dashboard-metrics { grid-template-columns: repeat(5,1fr) !important; }
          .quick-nav { grid-template-columns: repeat(5,1fr) !important; }
        }
      `}</style>
    </div>
  );

  // ─── 레이아웃 ────────────────────────────────────────────
  const groups = [...new Set(TABS.map(t => t.group))];

  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', fontFamily:'"Noto Sans KR",Apple SD Gothic Neo,sans-serif', color:C.textPri }}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes spin { from{transform:rotate(0)}to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${C.green}; }
      `}</style>

      {/* 사이드바 오버레이 (모바일) */}
      {sidebarOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:30 }} onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── 사이드바 ── */}
      <aside style={{
        position: 'fixed', top:0, left:0, bottom:0, zIndex:40, width:228,
        background:C.surface, borderRight:`1px solid ${C.border}`,
        display:'flex', flexDirection:'column',
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition:'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
      }} className="sidebar-desktop">
        <style>{`
          @media(min-width:1024px) {
            .sidebar-desktop { transform: translateX(0) !important; position: static !important; }
          }
        `}</style>

        {/* 로고 */}
        <div style={{ padding:'20px 18px 18px', borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:`linear-gradient(135deg,${C.green},${C.gold})`, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0, boxShadow:`0 4px 16px ${C.greenGlow}` }}>
                <img src={LOGO_IMAGE} alt="태평농산" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none';(e.currentTarget as HTMLImageElement).insertAdjacentText('afterend','🌾');}} />
              </div>
              <div>
                <p style={{ color:C.textPri, fontWeight:800, fontSize:15, margin:'0 0 2px', letterSpacing:-0.5 }}>태평농산</p>
                <p style={{ color:C.textSec, fontSize:10, margin:0, fontWeight:500 }}>관리 대시보드</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:C.textSec, padding:4, display:'none' }} className="sidebar-close">
              <X size={18} />
            </button>
          </div>
        </div>
        <style>{`@media(max-width:1023px){.sidebar-close{display:block!important;}}`}</style>

        {/* 네비게이션 */}
        <nav style={{ flex:1, padding:'12px 10px', overflowY:'auto' }}>
          {groups.map(group => (
            <div key={group} style={{ marginBottom:4 }}>
              <p style={{ color:C.textMute, fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', padding:'8px 8px 4px', margin:0 }}>{group}</p>
              {TABS.filter(t => t.group === group).map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                    style={{
                      width:'100%', display:'flex', alignItems:'center', gap:10,
                      padding:'9px 10px', borderRadius:10, marginBottom:2,
                      background: isActive ? `${tab.color}18` : 'transparent',
                      border: `1px solid ${isActive ? tab.color + '40' : 'transparent'}`,
                      color: isActive ? tab.color : C.textSec,
                      fontWeight: isActive ? 600 : 400,
                      fontSize:13, cursor:'pointer', fontFamily:'inherit',
                      transition:'all 0.15s', textAlign:'left',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = C.surfaceHov; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <tab.icon size={16} />
                    <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tab.label}</span>
                    {tab.id === 'tax' && thisMonth.unissuedCount > 0 && <span style={{ background:'#ef4444', color:'#fff', borderRadius:10, minWidth:18, height:18, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>{thisMonth.unissuedCount}</span>}
                    {tab.id === 'inventory' && lowStockItems.length > 0 && <span style={{ background:C.yellow, color:'#000', borderRadius:10, minWidth:18, height:18, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>{lowStockItems.length}</span>}
                    {tab.id === 'retail' && retailReminderCount > 0 && <span style={{ background:C.pink, color:'#fff', borderRadius:10, minWidth:18, height:18, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>{retailReminderCount}</span>}
                    {tab.id === 'orders' && pendingOrderCount > 0 && <span style={{ background:C.orange, color:'#fff', borderRadius:10, minWidth:18, height:18, fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>{pendingOrderCount}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* 하단 순이익 */}
        <div style={{ padding:'12px 14px', borderTop:`1px solid ${C.border}` }}>
          <div style={{ background:C.bg, borderRadius:12, padding:'12px 14px', border:`1px solid ${C.border}` }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
              <Leaf size={12} color={C.green} />
              <p style={{ color:C.textSec, fontSize:11, margin:0 }}>이번달 순이익</p>
            </div>
            <p style={{ fontWeight:800, fontSize:16, margin:0, color: thisMonth.profit >= 0 ? C.green : C.red }}>
              {formatKRW(thisMonth.profit)}
            </p>
          </div>
        </div>
      </aside>

      {/* ── 메인 영역 ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, marginLeft:0 }} className="main-content">
        <style>{`@media(min-width:1024px){.main-content{margin-left:228px;}}`}</style>

        {/* 헤더 */}
        <header style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', height:56, position:'sticky', top:0, zIndex:20, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background:'none', border:'none', cursor:'pointer', color:C.textSec, padding:4, display:'flex' }} className="menu-btn">
              <Menu size={22} />
            </button>
            <style>{`@media(min-width:1024px){.menu-btn{display:none!important;}}`}</style>
            {/* 브레드크럼 */}
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
              <span style={{ color:C.textMute, display:'flex', alignItems:'center', gap:4 }}>
                <Wheat size={14} /> 태평농산
              </span>
              <span style={{ color:C.border }}>›</span>
              <span style={{ color:C.textPri, fontWeight:600 }}>{TABS.find(t => t.id === activeTab)?.label}</span>
            </div>
          </div>

          {/* 헤더 알림 버튼들 */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {thisMonth.unissuedCount > 0 && (
              <button onClick={() => setActiveTab('tax')}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', background:'rgba(248,113,113,0.12)', color:C.red, borderRadius:8, fontSize:11, fontWeight:600, border:'1px solid rgba(248,113,113,0.25)', cursor:'pointer', fontFamily:'inherit' }}>
                <Bell size={12} /> <span className="hide-sm">미발행 </span>{thisMonth.unissuedCount}건
              </button>
            )}
            {retailReminderCount > 0 && (
              <button onClick={() => setActiveTab('retail')}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', background:'rgba(244,114,182,0.12)', color:C.pink, borderRadius:8, fontSize:11, fontWeight:600, border:'1px solid rgba(244,114,182,0.25)', cursor:'pointer', fontFamily:'inherit' }}>
                <Heart size={12} /> <span className="hide-sm">재구매 </span>{retailReminderCount}명
              </button>
            )}
            {pendingOrderCount > 0 && (
              <button onClick={() => setActiveTab('orders')}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', background:'rgba(232,98,26,0.12)', color:C.orange, borderRadius:8, fontSize:11, fontWeight:600, border:'1px solid rgba(232,98,26,0.25)', cursor:'pointer', fontFamily:'inherit' }}>
                <ClipboardList size={12} /> <span className="hide-sm">주문 </span>{pendingOrderCount}건
              </button>
            )}
            <button onClick={() => setActiveTab('settings')}
              style={{ width:36, height:36, borderRadius:'50%', background:`linear-gradient(135deg,${C.green},${C.gold})`, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 2px 12px ${C.greenGlow}`, overflow:'hidden', flexShrink:0 }}
              title={`${displayName} 설정`}
            >
              <img src={LOGO_IMAGE} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none';}} />
            </button>
          </div>
          <style>{`@media(max-width:640px){.hide-sm{display:none!important;}}`}</style>
        </header>

        {/* 콘텐츠 */}
        <main style={{ flex:1, padding:'20px 16px', overflowY:'auto', background:C.bg }}>
          <div style={{ maxWidth:1200, margin:'0 auto' }}>
            {activeTab === 'overview'  && <OverviewPage />}
            {activeTab === 'master'    && <MasterDataPage />}
            {activeTab === 'sales'     && <SalesPage />}
            {activeTab === 'profit'    && <ProfitPage />}
            {activeTab === 'inventory' && <InventoryPage />}
            {activeTab === 'tax'       && <TaxInvoicePage />}
            {activeTab === 'retail'    && <RetailCustomerPage />}
            {activeTab === 'shop'      && <ShopProductPage />}
            {activeTab === 'orders'    && <OrderManagePage />}
            {activeTab === 'settings'  && <SettingsPage onLogout={onLogout} username={username} displayName={displayName} />}
          </div>
        </main>
      </div>
    </div>
  );
}
