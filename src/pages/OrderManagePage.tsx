// 주문 관리 탭 - 실시간 주문 확인 및 처리
import React, { useState, useCallback, useEffect } from 'react';
import { useRice } from '@/contexts/RiceContext';
import { Order } from '@/types/rice';
import {
  ShoppingCart, Clock, CheckCircle, Truck, Package, XCircle,
  RefreshCw, ChevronDown, ChevronUp, Phone, MapPin, Calendar,
  User, MessageSquare, DollarSign, Bell, Filter, Eye, Trash2
} from 'lucide-react';

const formatKRW = (v: number) => `₩${v.toLocaleString('ko-KR')}`;
const formatDatetime = (s: string) => {
  if (!s) return '-';
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: '접수',    color: 'text-yellow-400', bg: 'bg-yellow-400/15 border-yellow-400/40',   icon: Clock },
  confirmed: { label: '확인',    color: 'text-blue-400',   bg: 'bg-blue-400/15 border-blue-400/40',       icon: CheckCircle },
  preparing: { label: '준비중',  color: 'text-purple-400', bg: 'bg-purple-400/15 border-purple-400/40',   icon: Package },
  shipped:   { label: '배송중',  color: 'text-[#22c55e]',  bg: 'bg-[#22c55e]/15 border-[#22c55e]/40',    icon: Truck },
  delivered: { label: '배송완료', color: 'text-green-400', bg: 'bg-green-400/15 border-green-400/40',     icon: CheckCircle },
  cancelled: { label: '취소',    color: 'text-red-400',    bg: 'bg-red-400/15 border-red-400/40',         icon: XCircle },
};

const STATUS_FLOW: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered'];

export default function OrderManagePage() {
  const { orders, orderStats, updateOrderStatus, deleteOrder, refreshOrders } = useRice();

  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // 30초마다 자동 새로고침
  useEffect(() => {
    const interval = setInterval(() => {
      refreshOrders();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshOrders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  };

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    await updateOrderStatus(orderId, status);
  };

  const handleDelete = async (id: string) => {
    await deleteOrder(id);
    setDeleteConfirm(null);
    if (expandedId === id) setExpandedId(null);
  };

  const filtered = filterStatus === 'all'
    ? orders
    : orders.filter(o => o.status === filterStatus);

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const todayOrders = orders.filter(o => o.createdAt?.startsWith(new Date().toISOString().slice(0, 10)));

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingCart size={20} className="text-[#22c55e]" />
            주문 관리
            {pendingCount > 0 && (
              <span className="bg-yellow-400 text-[#0f1117] text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingCount}건 접수
              </span>
            )}
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">30초마다 자동으로 업데이트됩니다.</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 bg-[#1c1f2e] border border-[#2e3147] text-gray-300 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex-shrink-0"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '오늘 주문', value: `${orderStats?.todayCount ?? todayOrders.length}건`, sub: formatKRW(orderStats?.todayAmount ?? todayOrders.reduce((s,o)=>s+o.totalAmount,0)), color: 'text-[#22c55e]', icon: ShoppingCart },
          { label: '대기중', value: `${pendingCount}건`, sub: '처리 필요', color: pendingCount > 0 ? 'text-yellow-400' : 'text-gray-500', icon: Clock },
          { label: '전체 주문', value: `${orderStats?.totalCount ?? orders.length}건`, sub: '누적', color: 'text-purple-400', icon: Package },
          { label: '총 매출', value: formatKRW(orderStats?.totalAmount ?? orders.reduce((s,o)=>s+o.totalAmount,0)), sub: '주문 기준', color: 'text-green-400', icon: DollarSign },
        ].map(card => (
          <div key={card.label} className="bg-[#1c1f2e] border border-[#2e3147] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-xs">{card.label}</span>
              <card.icon size={14} className={card.color} />
            </div>
            <div className={`font-bold text-lg ${card.color}`}>{card.value}</div>
            <div className="text-gray-500 text-xs">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(['all', ...Object.keys(STATUS_CONFIG)] as (OrderStatus | 'all')[]).map(s => {
          const count = s === 'all' ? orders.length : orders.filter(o => o.status === s).length;
          const cfg = s !== 'all' ? STATUS_CONFIG[s as OrderStatus] : null;
          const isActive = filterStatus === s;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 border ${
                isActive
                  ? cfg ? `${cfg.bg} ${cfg.color}` : 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/40'
                  : 'bg-[#1c1f2e] border-[#2e3147] text-gray-400 hover:text-white'
              }`}
            >
              {s === 'all' ? '전체' : cfg?.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/20' : 'bg-[#2e3147]'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 주문 목록 */}
      {filtered.length === 0 ? (
        <div className="bg-[#1c1f2e] border border-[#2e3147] rounded-xl p-12 text-center">
          <ShoppingCart size={48} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">
            {filterStatus === 'all' ? '아직 주문이 없습니다.' : `${STATUS_CONFIG[filterStatus as OrderStatus]?.label} 상태의 주문이 없습니다.`}
          </p>
          <p className="text-gray-500 text-sm mt-1">고객이 주문 페이지에서 주문하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const cfg = STATUS_CONFIG[order.status as OrderStatus] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const isExpanded = expandedId === order.id;
            const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(order.status as OrderStatus) + 1];

            return (
              <div key={order.id} className="bg-[#1c1f2e] border border-[#2e3147] rounded-xl overflow-hidden">
                {/* 헤더 */}
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-[#2a2d3e]/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${cfg.bg}`}>
                    <StatusIcon size={15} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-semibold text-sm">{order.customerName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-gray-500 text-xs font-mono">{order.orderNo}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-gray-400 text-xs flex items-center gap-1">
                        <Phone size={10} />{order.customerPhone}
                      </span>
                      <span className="text-gray-400 text-xs flex items-center gap-1">
                        <Calendar size={10} />배송: {order.deliveryDate}
                      </span>
                      <span className="text-[#22c55e] font-bold text-sm">{formatKRW(order.totalAmount)}</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">{formatDatetime(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isExpanded ? <ChevronUp size={15} className="text-gray-500" /> : <ChevronDown size={15} className="text-gray-500" />}
                  </div>
                </div>

                {/* 상세 */}
                {isExpanded && (
                  <div className="border-t border-[#2e3147] p-4 space-y-4">
                    {/* 주문 품목 */}
                    <div>
                      <h4 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-2">주문 품목</h4>
                      <div className="space-y-1.5">
                        {(order.items || []).map((item, i) => (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <span className="text-gray-300">{item.productName} × {item.quantity}{item.unit}</span>
                            <span className="text-white font-medium">{formatKRW(item.totalPrice)}</span>
                          </div>
                        ))}
                        <div className="border-t border-[#2e3147] pt-1.5 flex justify-between">
                          <span className="text-gray-400 text-sm">합계</span>
                          <span className="text-[#22c55e] font-bold">{formatKRW(order.totalAmount)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 배송 정보 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-[#0f1117] rounded-xl p-3 space-y-2">
                        <h4 className="text-gray-400 text-xs font-medium">주문자 정보</h4>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-sm">
                            <User size={12} className="text-gray-500" />
                            <span className="text-gray-300">{order.customerName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Phone size={12} className="text-gray-500" />
                            <a href={`tel:${order.customerPhone}`} className="text-[#22c55e] hover:underline">
                              {order.customerPhone}
                            </a>
                          </div>
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin size={12} className="text-gray-500 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-300 text-xs leading-relaxed">{order.customerAddress}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-[#0f1117] rounded-xl p-3 space-y-2">
                        <h4 className="text-gray-400 text-xs font-medium">배송 정보</h4>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar size={12} className="text-gray-500" />
                            <span className="text-gray-300">희망일: {order.deliveryDate}</span>
                          </div>
                          {order.memo && (
                            <div className="flex items-start gap-2 text-sm">
                              <MessageSquare size={12} className="text-gray-500 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-300 text-xs">{order.memo}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 상태 변경 버튼 */}
                    {order.status !== 'cancelled' && order.status !== 'delivered' && (
                      <div>
                        <h4 className="text-gray-400 text-xs font-medium mb-2">상태 변경</h4>
                        <div className="flex flex-wrap gap-2">
                          {STATUS_FLOW.map(s => {
                            const sCfg = STATUS_CONFIG[s];
                            const isCurrent = order.status === s;
                            const isPast = STATUS_FLOW.indexOf(s) < STATUS_FLOW.indexOf(order.status as OrderStatus);
                            return (
                              <button
                                key={s}
                                onClick={() => !isCurrent && handleStatusChange(order.id, s)}
                                disabled={isCurrent}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                                  isCurrent
                                    ? `${sCfg.bg} ${sCfg.color} cursor-default`
                                    : isPast
                                    ? 'bg-[#0f1117] border-[#2e3147] text-gray-600 hover:text-gray-400'
                                    : 'bg-[#1c1f2e] border-[#2e3147] text-gray-300 hover:border-[#22c55e]/50 hover:text-white'
                                }`}
                              >
                                <sCfg.icon size={11} />
                                {sCfg.label}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => handleStatusChange(order.id, 'cancelled')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
                          >
                            <XCircle size={11} />
                            취소
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 삭제 버튼 */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => setDeleteConfirm(order.id)}
                        className="flex items-center gap-1.5 text-gray-500 hover:text-red-400 text-xs transition-colors"
                      >
                        <Trash2 size={12} />
                        주문 삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-[#1c1f2e] border border-[#2e3147] rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold">주문 삭제</h3>
                <p className="text-gray-400 text-sm">이 주문을 삭제하시겠습니까?</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-[#2e3147] text-gray-300 rounded-xl font-medium text-sm hover:bg-[#4d5382] transition-colors">
                취소
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition-colors">
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
