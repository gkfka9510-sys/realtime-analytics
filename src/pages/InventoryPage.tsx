// 재고 현황 페이지
import React, { useState, useMemo } from 'react';
import { useRice } from '@/contexts/RiceContext';
import { Package, Plus, Minus, RefreshCw, AlertTriangle, ArrowUp, ArrowDown, Settings } from 'lucide-react';

const formatKRW = (v: number) => `₩${v.toLocaleString('ko-KR')}`;
const formatNum = (v: number) => v.toLocaleString('ko-KR');

export default function InventoryPage() {
  const { inventory, inventoryTransactions, riceProducts, initInventory, updateInventory } = useRice();
  const [modalState, setModalState] = useState<{
    open: boolean;
    productId: string;
    type: 'in' | 'out' | 'adjust' | 'init';
    productName: string;
    weightPerBag: number;
  } | null>(null);
  const [quantity, setQuantity] = useState('');
  const [bagCount, setBagCount] = useState('');
  const [memo, setMemo] = useState('');
  const [inputMode, setInputMode] = useState<'bag' | 'kg'>('bag');
  const [filterProduct, setFilterProduct] = useState('all');

  const handleAction = (
    productId: string,
    productName: string,
    type: 'in' | 'out' | 'adjust' | 'init',
    weightPerBag: number
  ) => {
    setModalState({ open: true, productId, type, productName, weightPerBag });
    setQuantity('');
    setBagCount('');
    setMemo('');
    setInputMode('bag');
  };

  const handleSubmit = () => {
    const ms = modalState;
    if (!ms) return;

    let bagsNum = 0;
    if (inputMode === 'bag') {
      bagsNum = parseFloat(bagCount) || 0;
    } else {
      const kgNum = parseFloat(quantity) || 0;
      bagsNum = kgNum / ms.weightPerBag;
    }

    if (bagsNum <= 0) { alert('수량을 입력해주세요.'); return; }

    if (ms.type === 'init') {
      initInventory(ms.productId, bagsNum);
    } else {
      updateInventory(ms.productId, bagsNum, ms.type, memo);
    }

    setModalState(null);
  };

  // 재고 현황 + 원가 정보
  const inventoryWithCost = useMemo(() => {
    return inventory.map(item => {
      const product = riceProducts.find(p => p.id === item.productId);
      const stockValue = product ? item.currentStockKg * product.costPerKg : 0;
      return { ...item, stockValue, costPerKg: product?.costPerKg || 0 };
    });
  }, [inventory, riceProducts]);

  // 재고 거래 이력 (최신순)
  const recentTransactions = useMemo(() => {
    return [...inventoryTransactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .filter(t => filterProduct === 'all' || t.productId === filterProduct)
      .slice(0, 50);
  }, [inventoryTransactions, filterProduct]);

  // 전체 재고 가치
  const totalStockValue = inventoryWithCost.reduce((s, i) => s + i.stockValue, 0);

  const typeLabel = (type: 'in' | 'out' | 'adjust') => {
    if (type === 'in') return { label: '입고', color: 'text-green-400', bg: 'bg-green-500/20', icon: ArrowUp };
    if (type === 'out') return { label: '출고', color: 'text-red-400', bg: 'bg-red-500/20', icon: ArrowDown };
    return { label: '조정', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: RefreshCw };
  };

  const modalTitle = () => {
    if (!modalState) return '';
    const t = modalState.type;
    if (t === 'init') return '최초 재고 설정';
    if (t === 'in') return '입고 등록';
    if (t === 'out') return '출고 등록';
    return '재고 조정';
  };

  const computedKg = () => {
    if (!modalState) return 0;
    if (inputMode === 'bag') return (parseFloat(bagCount) || 0) * modalState.weightPerBag;
    return parseFloat(quantity) || 0;
  };

  const computedBags = () => {
    if (!modalState) return 0;
    if (inputMode === 'kg') return (parseFloat(quantity) || 0) / modalState.weightPerBag;
    return parseFloat(bagCount) || 0;
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Package className="text-[#00d9ff]" size={28} />
          재고 현황
        </h2>
        <div className="bg-[#2d3142] rounded-xl px-4 py-2 border border-[#3d4362]">
          <span className="text-gray-400 text-xs">총 재고 가치</span>
          <div className="text-[#00d9ff] font-bold text-lg">{formatKRW(totalStockValue)}</div>
        </div>
      </div>

      {/* 재고 현황 카드 */}
      {inventory.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Package size={48} className="mx-auto mb-4 opacity-30" />
          <p>순이익 분석 탭에서 품목을 등록하면 재고를 관리할 수 있습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {inventoryWithCost.map(item => {
            const isLow = item.currentStock < 5; // 5포대 미만 경고
            return (
              <div key={item.id} className={`bg-[#2d3142] rounded-xl p-5 border ${isLow ? 'border-red-500/50' : 'border-[#3d4362]'} relative`}>
                {isLow && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-red-400">
                    <AlertTriangle size={12} />
                    재고 부족
                  </div>
                )}
                <h3 className="text-white font-bold text-base mb-3">{item.productName}</h3>
                
                {/* 재고 현황 */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#1a1d29] rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">현재 재고</div>
                    <div className="text-[#00d9ff] font-bold text-xl">{formatNum(Math.round(item.currentStock * 10) / 10)}<span className="text-sm ml-1">포대</span></div>
                  </div>
                  <div className="bg-[#1a1d29] rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">kg 환산</div>
                    <div className="text-white font-bold text-xl">{formatNum(Math.round(item.currentStockKg))}<span className="text-sm ml-1">kg</span></div>
                  </div>
                  <div className="bg-[#1a1d29] rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">포대 규격</div>
                    <div className="text-gray-300 font-semibold">{item.weightPerBag}kg/포대</div>
                  </div>
                  <div className="bg-[#1a1d29] rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-1">재고 가치</div>
                    <div className="text-yellow-400 font-semibold text-sm">{formatKRW(item.stockValue)}</div>
                  </div>
                </div>

                {/* 재고 진행바 */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>재고 수준</span>
                    <span>{item.currentStock.toFixed(1)}포대</span>
                  </div>
                  <div className="w-full bg-[#1a1d29] rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${item.currentStock >= 20 ? 'bg-green-500' : item.currentStock >= 10 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, (item.currentStock / 50) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => handleAction(item.productId, item.productName, 'init', item.weightPerBag)}
                    className="flex flex-col items-center gap-1 px-2 py-2 bg-[#1a1d29] hover:bg-[#3d4362] rounded-lg transition-colors"
                    title="최초 재고 설정"
                  >
                    <Settings size={14} className="text-gray-400" />
                    <span className="text-xs text-gray-400">설정</span>
                  </button>
                  <button
                    onClick={() => handleAction(item.productId, item.productName, 'in', item.weightPerBag)}
                    className="flex flex-col items-center gap-1 px-2 py-2 bg-green-500/10 hover:bg-green-500/20 rounded-lg transition-colors"
                  >
                    <ArrowUp size={14} className="text-green-400" />
                    <span className="text-xs text-green-400">입고</span>
                  </button>
                  <button
                    onClick={() => handleAction(item.productId, item.productName, 'out', item.weightPerBag)}
                    className="flex flex-col items-center gap-1 px-2 py-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <ArrowDown size={14} className="text-red-400" />
                    <span className="text-xs text-red-400">출고</span>
                  </button>
                  <button
                    onClick={() => handleAction(item.productId, item.productName, 'adjust', item.weightPerBag)}
                    className="flex flex-col items-center gap-1 px-2 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-lg transition-colors"
                  >
                    <RefreshCw size={14} className="text-yellow-400" />
                    <span className="text-xs text-yellow-400">조정</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 거래 이력 */}
      {inventoryTransactions.length > 0 && (
        <div className="bg-[#2d3142] rounded-xl border border-[#3d4362] overflow-hidden">
          <div className="p-4 border-b border-[#3d4362] flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-white font-semibold">재고 변동 이력</h3>
            <select
              value={filterProduct}
              onChange={e => setFilterProduct(e.target.value)}
              className="bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">전체 품목</option>
              {inventory.map(i => (
                <option key={i.productId} value={i.productId}>{i.productName}</option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#3d4362]">
                  {['일시', '품목', '유형', '포대 수', 'kg', '메모'].map(h => (
                    <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map(tx => {
                  const info = typeLabel(tx.type);
                  return (
                    <tr key={tx.id} className="border-b border-[#3d4362]/50 hover:bg-[#3d4362]/20">
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(tx.date).toLocaleString('ko-KR')}</td>
                      <td className="px-4 py-3 text-white">{tx.productName}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs font-medium ${info.color}`}>
                          <info.icon size={12} />
                          {info.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{(Math.round(tx.quantity * 10) / 10).toFixed(1)}포대</td>
                      <td className="px-4 py-3 text-gray-300">{formatNum(Math.round(tx.quantityKg))}kg</td>
                      <td className="px-4 py-3 text-gray-500">{tx.memo || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 입/출고 모달 */}
      {modalState?.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2d3142] rounded-2xl p-6 w-full max-w-md border border-[#3d4362]">
            <h3 className="text-white font-bold text-lg mb-1">{modalTitle()}</h3>
            <p className="text-gray-400 text-sm mb-5">{modalState.productName} ({modalState.weightPerBag}kg/포대)</p>

            {/* 입력 모드 선택 */}
            <div className="flex bg-[#1a1d29] rounded-lg p-1 mb-4">
              <button
                onClick={() => setInputMode('bag')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${inputMode === 'bag' ? 'bg-[#00d9ff] text-[#1a1d29]' : 'text-gray-400 hover:text-white'}`}
              >
                포대 수로 입력
              </button>
              <button
                onClick={() => setInputMode('kg')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${inputMode === 'kg' ? 'bg-[#00d9ff] text-[#1a1d29]' : 'text-gray-400 hover:text-white'}`}
              >
                kg으로 입력
              </button>
            </div>

            {inputMode === 'bag' ? (
              <div className="mb-4">
                <label className="block text-gray-400 text-sm mb-2">포대 수</label>
                <input
                  type="number"
                  placeholder="포대 수 입력"
                  value={bagCount}
                  onChange={e => setBagCount(e.target.value)}
                  className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-4 py-3 text-lg focus:border-[#00d9ff] focus:outline-none"
                  autoFocus
                />
                {bagCount && (
                  <p className="text-[#00d9ff] text-sm mt-2">
                    = {formatNum(Math.round((parseFloat(bagCount) || 0) * modalState.weightPerBag))}kg
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-gray-400 text-sm mb-2">kg 수량</label>
                <input
                  type="number"
                  placeholder="kg 수량 입력"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-4 py-3 text-lg focus:border-[#00d9ff] focus:outline-none"
                  autoFocus
                />
                {quantity && (
                  <p className="text-[#00d9ff] text-sm mt-2">
                    = {((parseFloat(quantity) || 0) / modalState.weightPerBag).toFixed(2)}포대
                  </p>
                )}
              </div>
            )}

            {/* 빠른 선택 (포대 모드일 때) */}
            {inputMode === 'bag' && (
              <div className="flex flex-wrap gap-2 mb-4">
                {[1, 2, 5, 10, 20, 30, 50].map(n => (
                  <button
                    key={n}
                    onClick={() => setBagCount(String(n))}
                    className="px-3 py-1 bg-[#1a1d29] hover:bg-[#3d4362] text-gray-300 rounded-lg text-sm transition-colors"
                  >
                    {n}포대
                  </button>
                ))}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">메모 (선택)</label>
              <input
                type="text"
                placeholder="예: OO농장 입고"
                value={memo}
                onChange={e => setMemo(e.target.value)}
                className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-4 py-2 text-sm focus:border-[#00d9ff] focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-colors ${
                  modalState.type === 'in' || modalState.type === 'init' ? 'bg-green-500 hover:bg-green-600 text-white' :
                  modalState.type === 'out' ? 'bg-red-500 hover:bg-red-600 text-white' :
                  'bg-yellow-500 hover:bg-yellow-600 text-black'
                }`}
              >
                확인
              </button>
              <button
                onClick={() => setModalState(null)}
                className="flex-1 py-3 bg-[#3d4362] hover:bg-[#4d5382] text-gray-300 rounded-xl font-semibold text-sm transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
