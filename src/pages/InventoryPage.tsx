// 재고 현황 페이지 - 재고 탭에서 직접 재고 추가/입고 가능
import React, { useState, useMemo } from 'react';
import { useRice } from '@/contexts/RiceContext';
import { Package, Plus, RefreshCw, AlertTriangle, ArrowUp, ArrowDown, Save, X, TrendingUp } from 'lucide-react';

const formatKRW = (v: number) => `₩${v.toLocaleString('ko-KR')}`;
const formatNum = (v: number) => v.toLocaleString('ko-KR');

const BAG_SIZES = [5, 10, 15, 20, 25, 30, 40, 50];

export default function InventoryPage() {
  const { inventory, inventoryTransactions, riceProducts, addRiceProduct, initInventory, updateInventory } = useRice();

  // 입출고 모달
  const [modalState, setModalState] = useState<{
    open: boolean;
    productId: string;
    type: 'in' | 'out' | 'adjust' | 'init';
    productName: string;
    weightPerBag: number;
  } | null>(null);
  const [bagCount, setBagCount] = useState('');
  const [kgCount, setKgCount] = useState('');
  const [memo, setMemo] = useState('');
  const [inputMode, setInputMode] = useState<'bag' | 'kg'>('bag');

  // 새 품목 추가 폼
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', weightPerBag: 20, purchasePrice: 0 });
  const [addMsg, setAddMsg] = useState('');

  // 빠른 입고 패널 (상단 고정)
  const [quickInProductId, setQuickInProductId] = useState<string>('');

  // 필터
  const [filterProduct, setFilterProduct] = useState('all');

  // ── 입출고 모달 열기 ──
  const openModal = (
    productId: string, productName: string,
    type: 'in' | 'out' | 'adjust' | 'init', weightPerBag: number
  ) => {
    setModalState({ open: true, productId, type, productName, weightPerBag });
    setBagCount(''); setKgCount(''); setMemo(''); setInputMode('bag');
  };

  // ── 입출고 확인 ──
  const handleModalSubmit = () => {
    if (!modalState) return;
    let bags = 0;
    if (inputMode === 'bag') {
      bags = parseFloat(bagCount) || 0;
    } else {
      bags = (parseFloat(kgCount) || 0) / modalState.weightPerBag;
    }
    if (bags <= 0) { alert('수량을 입력해주세요.'); return; }

    if (modalState.type === 'init') {
      initInventory(modalState.productId, bags);
    } else {
      updateInventory(modalState.productId, bags, modalState.type, memo);
    }
    setModalState(null);
  };

  // ── 새 품목 추가 ──
  const handleAddProduct = async () => {
    if (!newProduct.name.trim()) { setAddMsg('품명을 입력해주세요.'); return; }
    if (newProduct.weightPerBag <= 0) { setAddMsg('포대 무게를 선택해주세요.'); return; }
    if (newProduct.purchasePrice <= 0) { setAddMsg('매입가를 입력해주세요.'); return; }

    await addRiceProduct({ ...newProduct, sellingPricePerKg: 0 });
    setNewProduct({ name: '', weightPerBag: 20, purchasePrice: 0 });
    setShowAddForm(false);
    setAddMsg('');
  };

  // 재고 + 원가 합산
  const inventoryWithCost = useMemo(() => {
    return inventory.map(item => {
      const product = riceProducts.find(p => p.id === item.productId);
      return {
        ...item,
        stockValue: product ? item.currentStockKg * product.costPerKg : 0,
        costPerKg: product?.costPerKg || 0,
        purchasePrice: product?.purchasePrice || 0,
      };
    });
  }, [inventory, riceProducts]);

  const totalStockValue = inventoryWithCost.reduce((s, i) => s + i.stockValue, 0);

  const recentTransactions = useMemo(() =>
    [...inventoryTransactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .filter(t => filterProduct === 'all' || t.productId === filterProduct)
      .slice(0, 60),
    [inventoryTransactions, filterProduct]
  );

  const typeInfo = (type: 'in' | 'out' | 'adjust') => {
    if (type === 'in') return { label: '입고', color: 'text-green-400', Icon: ArrowUp };
    if (type === 'out') return { label: '출고', color: 'text-red-400', Icon: ArrowDown };
    return { label: '조정', color: 'text-yellow-400', Icon: RefreshCw };
  };

  const modalTitle = () => {
    if (!modalState) return '';
    return { init: '최초 재고 설정', in: '입고 등록', out: '출고 등록', adjust: '재고 조정' }[modalState.type];
  };

  const previewKg = modalState
    ? inputMode === 'bag'
      ? (parseFloat(bagCount) || 0) * modalState.weightPerBag
      : parseFloat(kgCount) || 0
    : 0;

  const previewBags = modalState
    ? inputMode === 'kg'
      ? (parseFloat(kgCount) || 0) / modalState.weightPerBag
      : parseFloat(bagCount) || 0
    : 0;

  return (
    <div className="space-y-6">

      {/* ── 헤더 ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Package className="text-[#00d9ff]" size={28} />
          재고 현황
        </h2>
        <div className="flex items-center gap-3">
          <div className="bg-[#2d3142] rounded-xl px-4 py-2 border border-[#3d4362]">
            <span className="text-gray-400 text-xs block">총 재고 가치</span>
            <span className="text-[#00d9ff] font-bold text-lg">{formatKRW(totalStockValue)}</span>
          </div>
          <button
            onClick={() => { setShowAddForm(v => !v); setAddMsg(''); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#00d9ff] hover:bg-[#00b8d9] text-[#1a1d29] font-semibold rounded-xl transition-colors text-sm"
          >
            <Plus size={16} />
            품목 추가
          </button>
        </div>
      </div>

      {/* ── 빠른 입고 버튼 패널 (품목이 있을 때) ── */}
      {inventory.length > 0 && (
        <div className="bg-[#2d3142] border border-green-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowUp size={16} className="text-green-400" />
            <h3 className="text-white font-semibold text-sm">빠른 입고</h3>
            <span className="text-gray-500 text-xs">— 품목을 선택하여 바로 입고 등록</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {inventoryWithCost.map(item => (
              <button
                key={item.productId}
                onClick={() => openModal(item.productId, item.productName, 'in', item.weightPerBag)}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/25 border border-green-500/30 hover:border-green-500/60 text-green-300 hover:text-green-200 rounded-xl transition-all text-sm font-medium"
              >
                <ArrowUp size={13} />
                {item.productName}
                <span className="text-green-500 text-xs">({item.currentStock.toFixed(0)}포대)</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 새 품목 추가 폼 ── */}
      {showAddForm && (
        <div className="bg-[#2d3142] border border-[#00d9ff]/30 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Plus size={16} className="text-[#00d9ff]" />
            새 품목 추가
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 품명 */}
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">품명 *</label>
              <input
                type="text"
                placeholder="예: 신동진쌀 20kg"
                value={newProduct.name}
                onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#00d9ff] focus:outline-none"
              />
            </div>

            {/* 포대 무게 */}
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">포대당 무게 *</label>
              <div className="flex flex-wrap gap-1 mb-2">
                {BAG_SIZES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewProduct(p => ({ ...p, weightPerBag: s }))}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${newProduct.weightPerBag === s ? 'bg-[#00d9ff] text-[#1a1d29]' : 'bg-[#1a1d29] text-gray-400 hover:text-white border border-[#3d4362]'}`}
                  >
                    {s}kg
                  </button>
                ))}
              </div>
              <input
                type="number"
                placeholder="직접 입력 (kg)"
                value={newProduct.weightPerBag || ''}
                onChange={e => setNewProduct(p => ({ ...p, weightPerBag: Number(e.target.value) }))}
                className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none"
              />
            </div>

            {/* 매입가 */}
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">포대당 매입가 (원) *</label>
              <input
                type="number"
                placeholder="예: 48000"
                value={newProduct.purchasePrice || ''}
                onChange={e => setNewProduct(p => ({ ...p, purchasePrice: Number(e.target.value) }))}
                className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2.5 text-sm focus:border-[#00d9ff] focus:outline-none"
              />
              {newProduct.purchasePrice > 0 && newProduct.weightPerBag > 0 && (
                <p className="text-[#00d9ff] text-xs mt-1.5">
                  → 1kg 원가: <strong>{formatKRW(Math.round(newProduct.purchasePrice / newProduct.weightPerBag))}</strong>
                </p>
              )}
            </div>
          </div>

          {addMsg && (
            <p className="mt-3 text-red-400 text-sm">{addMsg}</p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddProduct}
              className="flex items-center gap-2 px-5 py-2 bg-[#00d9ff] text-[#1a1d29] font-semibold rounded-lg hover:bg-[#00b8d9] transition-colors text-sm"
            >
              <Save size={15} />
              품목 등록
            </button>
            <button
              onClick={() => { setShowAddForm(false); setAddMsg(''); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#3d4362] text-gray-300 rounded-lg hover:bg-[#4d5382] transition-colors text-sm"
            >
              <X size={15} />
              취소
            </button>
          </div>
        </div>
      )}

      {/* ── 재고 카드 그리드 ── */}
      {inventory.length === 0 ? (
        <div className="text-center py-14 text-gray-500">
          <Package size={52} className="mx-auto mb-4 opacity-20" />
          <p className="mb-2">등록된 품목이 없습니다.</p>
          <p className="text-sm">위의 <span className="text-[#00d9ff]">품목 추가</span> 버튼을 눌러 쌀 품목을 등록해보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {inventoryWithCost.map(item => {
            const isLow = item.currentStock > 0 && item.currentStock < 5;
            const isEmpty = item.currentStock === 0;
            return (
              <div
                key={item.id}
                className={`bg-[#2d3142] rounded-xl p-5 border relative transition-all
                  ${isEmpty ? 'border-gray-600/50 opacity-80' : isLow ? 'border-red-500/60' : 'border-[#3d4362]'}`}
              >
                {/* 상단 배지 */}
                {isLow && !isEmpty && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                    <AlertTriangle size={11} />
                    재고 부족
                  </div>
                )}
                {isEmpty && (
                  <div className="absolute top-3 right-3 text-xs text-gray-500 bg-[#1a1d29] px-2 py-0.5 rounded-full">
                    재고 없음
                  </div>
                )}

                <h3 className="text-white font-bold text-base mb-3 pr-20">{item.productName}</h3>

                {/* 수치 그리드 */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-[#1a1d29] rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-0.5">현재 재고</div>
                    <div className="text-[#00d9ff] font-bold text-xl leading-tight">
                      {formatNum(Math.round(item.currentStock * 10) / 10)}
                      <span className="text-sm ml-1 font-normal">포대</span>
                    </div>
                  </div>
                  <div className="bg-[#1a1d29] rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-0.5">kg 환산</div>
                    <div className="text-white font-bold text-xl leading-tight">
                      {formatNum(Math.round(item.currentStockKg))}
                      <span className="text-sm ml-1 font-normal">kg</span>
                    </div>
                  </div>
                  <div className="bg-[#1a1d29] rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-0.5">포대 규격</div>
                    <div className="text-gray-200 font-semibold">{item.weightPerBag}kg/포대</div>
                  </div>
                  <div className="bg-[#1a1d29] rounded-lg p-3">
                    <div className="text-gray-400 text-xs mb-0.5">재고 가치</div>
                    <div className="text-yellow-400 font-semibold text-sm">{formatKRW(item.stockValue)}</div>
                  </div>
                </div>

                {/* 재고 게이지 */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>재고 수준</span>
                    <span>{item.currentStock.toFixed(1)}포대 / 50포대 기준</span>
                  </div>
                  <div className="w-full bg-[#1a1d29] rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        item.currentStock >= 20 ? 'bg-green-500' :
                        item.currentStock >= 10 ? 'bg-yellow-500' :
                        item.currentStock > 0 ? 'bg-red-500' : 'bg-gray-700'
                      }`}
                      style={{ width: `${Math.min(100, (item.currentStock / 50) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => openModal(item.productId, item.productName, 'in', item.weightPerBag)}
                    className="flex flex-col items-center gap-1 py-2 bg-green-500/10 hover:bg-green-500/25 rounded-lg transition-colors"
                    title="입고 등록"
                  >
                    <ArrowUp size={14} className="text-green-400" />
                    <span className="text-[10px] text-green-400">입고</span>
                  </button>
                  <button
                    onClick={() => openModal(item.productId, item.productName, 'out', item.weightPerBag)}
                    className="flex flex-col items-center gap-1 py-2 bg-red-500/10 hover:bg-red-500/25 rounded-lg transition-colors"
                    title="출고 등록"
                  >
                    <ArrowDown size={14} className="text-red-400" />
                    <span className="text-[10px] text-red-400">출고</span>
                  </button>
                  <button
                    onClick={() => openModal(item.productId, item.productName, 'adjust', item.weightPerBag)}
                    className="flex flex-col items-center gap-1 py-2 bg-yellow-500/10 hover:bg-yellow-500/25 rounded-lg transition-colors"
                    title="재고 조정"
                  >
                    <RefreshCw size={14} className="text-yellow-400" />
                    <span className="text-[10px] text-yellow-400">조정</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 거래 이력 ── */}
      {inventoryTransactions.length > 0 && (
        <div className="bg-[#2d3142] rounded-xl border border-[#3d4362] overflow-hidden">
          <div className="p-4 border-b border-[#3d4362] flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <TrendingUp size={16} className="text-[#00d9ff]" />
              재고 변동 이력
            </h3>
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
                  {['일시', '품목', '유형', '포대', 'kg', '메모'].map(h => (
                    <th key={h} className="text-left text-gray-400 px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map(tx => {
                  const info = typeInfo(tx.type);
                  return (
                    <tr key={tx.id} className="border-b border-[#3d4362]/40 hover:bg-[#3d4362]/20">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(tx.date).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-white whitespace-nowrap">{tx.productName}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 text-xs font-medium whitespace-nowrap ${info.color}`}>
                          <info.Icon size={11} />
                          {info.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{(Math.round(tx.quantity * 10) / 10).toFixed(1)}포대</td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{formatNum(Math.round(tx.quantityKg))}kg</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">{tx.memo || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 입/출고/설정 모달 ── */}
      {modalState?.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2d3142] rounded-2xl p-6 w-full max-w-sm border border-[#3d4362] shadow-2xl">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-white font-bold text-lg">{modalTitle()}</h3>
              <button onClick={() => setModalState(null)} className="text-gray-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-5">
              {modalState.productName}
              <span className="ml-2 text-gray-600 text-xs">({modalState.weightPerBag}kg/포대)</span>
            </p>

            {/* 입력 모드 토글 */}
            <div className="flex bg-[#1a1d29] rounded-xl p-1 mb-4">
              <button
                onClick={() => setInputMode('bag')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${inputMode === 'bag' ? 'bg-[#00d9ff] text-[#1a1d29]' : 'text-gray-400 hover:text-white'}`}
              >
                포대 수 입력
              </button>
              <button
                onClick={() => setInputMode('kg')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${inputMode === 'kg' ? 'bg-[#00d9ff] text-[#1a1d29]' : 'text-gray-400 hover:text-white'}`}
              >
                kg 입력
              </button>
            </div>

            {/* 수량 입력 */}
            {inputMode === 'bag' ? (
              <div className="mb-3">
                <label className="block text-gray-400 text-xs mb-1.5">포대 수</label>
                <input
                  type="number" min="0" step="0.5"
                  placeholder="포대 수 입력"
                  value={bagCount}
                  onChange={e => setBagCount(e.target.value)}
                  className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-xl px-4 py-3 text-2xl font-bold text-center focus:border-[#00d9ff] focus:outline-none"
                  autoFocus
                />
                {bagCount && Number(bagCount) > 0 && (
                  <p className="text-[#00d9ff] text-sm mt-2 text-center">
                    = <strong>{formatNum(Math.round(Number(bagCount) * modalState.weightPerBag))}kg</strong>
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-3">
                <label className="block text-gray-400 text-xs mb-1.5">kg 수량</label>
                <input
                  type="number" min="0"
                  placeholder="kg 수량 입력"
                  value={kgCount}
                  onChange={e => setKgCount(e.target.value)}
                  className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-xl px-4 py-3 text-2xl font-bold text-center focus:border-[#00d9ff] focus:outline-none"
                  autoFocus
                />
                {kgCount && Number(kgCount) > 0 && (
                  <p className="text-[#00d9ff] text-sm mt-2 text-center">
                    = <strong>{((Number(kgCount)) / modalState.weightPerBag).toFixed(2)}포대</strong>
                  </p>
                )}
              </div>
            )}

            {/* 빠른 선택 버튼 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {(inputMode === 'bag' ? [1, 2, 5, 10, 20, 30, 50] : [100, 200, 500, 1000]).map(n => (
                <button
                  key={n}
                  onClick={() => inputMode === 'bag' ? setBagCount(String(n)) : setKgCount(String(n))}
                  className="px-3 py-1.5 bg-[#1a1d29] hover:bg-[#3d4362] text-gray-300 hover:text-white rounded-lg text-xs transition-colors border border-[#3d4362]"
                >
                  {n}{inputMode === 'bag' ? '포대' : 'kg'}
                </button>
              ))}
            </div>

            {/* 메모 */}
            {modalState.type !== 'init' && (
              <div className="mb-4">
                <label className="block text-gray-400 text-xs mb-1.5">메모 (선택)</label>
                <input
                  type="text"
                  placeholder="예: ○○농장 입고, 반품 등"
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-lg px-3 py-2 text-sm focus:border-[#00d9ff] focus:outline-none"
                />
              </div>
            )}

            {/* 확인 / 취소 */}
            <div className="flex gap-3">
              <button
                onClick={handleModalSubmit}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors ${
                  modalState.type === 'in' || modalState.type === 'init'
                    ? 'bg-green-500 hover:bg-green-400 text-white'
                    : modalState.type === 'out'
                    ? 'bg-red-500 hover:bg-red-400 text-white'
                    : 'bg-yellow-500 hover:bg-yellow-400 text-black'
                }`}
              >
                {modalState.type === 'init' ? '재고 설정' :
                 modalState.type === 'in' ? '입고 등록' :
                 modalState.type === 'out' ? '출고 등록' : '조정 완료'}
              </button>
              <button
                onClick={() => setModalState(null)}
                className="flex-1 py-3 bg-[#3d4362] hover:bg-[#4d5382] text-gray-300 rounded-xl text-sm transition-colors"
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
