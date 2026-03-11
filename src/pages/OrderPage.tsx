// 간편 주문 페이지 (비회원 / 모바일 최적화)
import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, Plus, Minus, Trash2, ChevronRight, ChevronLeft,
  Package, Truck, Clock, CheckCircle, Phone, MapPin, Calendar,
  User, MessageSquare, X, AlertCircle, Loader2, Star, Zap
} from 'lucide-react';

// ─── 타입 ────────────────────────────────────────────────────────────────────
interface ShopProduct {
  id: string;
  name: string;
  description: string;
  unit: string;
  unit_options: string;
  price: number;
  image_url: string;
  is_available: number;
  sort_order: number;
}

interface CartItem {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

type Step = 'products' | 'cart' | 'info' | 'done';

const formatKRW = (v: number) => `₩${v.toLocaleString('ko-KR')}`;

const UNIT_STEPS: Record<string, number> = {
  'kg': 1, '포대': 1, '박스': 1, '개': 1, '10kg': 1, '20kg': 1,
};

function getStep(unit: string): number {
  return UNIT_STEPS[unit] ?? 1;
}

// 빠른 수량 선택 버튼
const QUICK_QTY = [1, 2, 3, 5, 10];

export default function OrderPage() {
  const [step, setStep] = useState<Step>('products');
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [orderResult, setOrderResult] = useState<{ orderNo: string; totalAmount: number } | null>(null);

  // 고객 정보
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [memo, setMemo] = useState('');

  // 선택된 상품 팝업
  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);
  const [selectQty, setSelectQty] = useState(1);

  // 최소 배송 희망일 (오늘 포함)
  const minDate = new Date().toISOString().slice(0, 10);

  // ─── 상품 로드 ───────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/shop/products');
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch {
        setProducts([]);
      }
      setLoading(false);
    };
    load();
  }, []);

  // ─── 장바구니 ────────────────────────────────────────────────────────────
  const addToCart = useCallback((product: ShopProduct, qty: number) => {
    setCart(prev => {
      const exist = prev.find(c => c.productId === product.id);
      if (exist) {
        return prev.map(c => c.productId === product.id
          ? { ...c, quantity: c.quantity + qty, totalPrice: (c.quantity + qty) * c.unitPrice }
          : c
        );
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity: qty,
        unitPrice: product.price,
        totalPrice: product.price * qty,
      }];
    });
    setSelectedProduct(null);
    setSelectQty(1);
  }, []);

  const updateCartQty = useCallback((productId: string, delta: number) => {
    setCart(prev => prev
      .map(c => c.productId === productId
        ? { ...c, quantity: Math.max(0, c.quantity + delta), totalPrice: Math.max(0, c.quantity + delta) * c.unitPrice }
        : c
      )
      .filter(c => c.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(c => c.productId !== productId));
  }, []);

  const cartTotal = cart.reduce((s, c) => s + c.totalPrice, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  // ─── 주문 제출 ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!name.trim()) { setError('이름을 입력해주세요.'); return; }
    if (!phone.trim()) { setError('연락처를 입력해주세요.'); return; }
    if (!address.trim()) { setError('주소를 입력해주세요.'); return; }
    if (!deliveryDate) { setError('배송 희망일을 선택해주세요.'); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/shop/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerAddress: address.trim(),
          deliveryDate,
          items: cart,
          memo: memo.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '주문 실패');
      setOrderResult({ orderNo: data.orderNo, totalAmount: data.totalAmount });
      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '주문 중 오류가 발생했습니다.');
    }
    setSubmitting(false);
  };

  // ─── 로딩 화면 ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-[#00d9ff] mx-auto" size={40} />
          <p className="text-gray-300 text-sm">상품 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // ─── 완료 화면 ───────────────────────────────────────────────────────────
  if (step === 'done' && orderResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-green-500/20 border-2 border-green-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={40} className="text-green-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">주문 완료!</h2>
            <p className="text-gray-400">주문이 정상적으로 접수되었습니다.</p>
          </div>
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6 text-left space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">주문번호</span>
              <span className="text-[#00d9ff] font-mono font-bold">{orderResult.orderNo}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">결제 예정 금액</span>
              <span className="text-white font-bold text-lg">{formatKRW(orderResult.totalAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">배송 희망일</span>
              <span className="text-white text-sm">{deliveryDate}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">주문자</span>
              <span className="text-white text-sm">{name} · {phone}</span>
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Phone size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-blue-300 text-sm">주문 확인 후 연락드리겠습니다. 당일 주문은 당일 배송 가능!</p>
            </div>
          </div>
          <button
            onClick={() => { setStep('products'); setCart([]); setName(''); setPhone(''); setAddress(''); setDeliveryDate(''); setMemo(''); setOrderResult(null); }}
            className="w-full py-3.5 bg-[#00d9ff] text-[#0f172a] font-bold rounded-2xl text-base active:scale-95 transition-transform"
          >
            새 주문하기
          </button>
        </div>
      </div>
    );
  }

  // ─── 메인 ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b] pb-32">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 bg-[#0f172a]/95 backdrop-blur border-b border-[#1e293b] px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-[#00d9ff] to-[#7c3aed] rounded-xl flex items-center justify-center text-base">
              🌾
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-tight">쌀집 간편 주문</h1>
              <p className="text-[#00d9ff] text-xs">신선한 쌀을 빠르게!</p>
            </div>
          </div>
          {cart.length > 0 && step === 'products' && (
            <button
              onClick={() => setStep('cart')}
              className="relative flex items-center gap-1.5 bg-[#00d9ff]/15 border border-[#00d9ff]/40 text-[#00d9ff] px-3 py-1.5 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
            >
              <ShoppingCart size={14} />
              장바구니
              <span className="absolute -top-1.5 -right-1.5 bg-[#00d9ff] text-[#0f172a] text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {cart.length}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* 당일 배송 배너 */}
      <div className="bg-gradient-to-r from-[#f59e0b] to-[#ef4444] px-4 py-2.5">
        <div className="max-w-lg mx-auto flex items-center justify-center gap-2">
          <Zap size={14} className="text-white flex-shrink-0" />
          <p className="text-white text-xs font-bold text-center">
            ⚡ 오전 11시 이전 주문 시 <span className="underline">당일 배송</span> 가능! · 지역 내 직접 배송
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 mt-4">
        {/* 스텝 인디케이터 */}
        {step !== 'done' && (
          <div className="flex items-center justify-center gap-2 mb-5">
            {(['products', 'cart', 'info'] as Step[]).map((s, i) => {
              const labels = ['상품선택', '장바구니', '주문정보'];
              const stepIdx = ['products', 'cart', 'info'].indexOf(step);
              const isActive = s === step;
              const isDone = i < stepIdx;
              return (
                <React.Fragment key={s}>
                  {i > 0 && <div className={`h-px flex-1 max-w-[40px] ${isDone ? 'bg-[#00d9ff]' : 'bg-[#334155]'}`} />}
                  <div className={`flex items-center gap-1 text-xs font-medium ${isActive ? 'text-[#00d9ff]' : isDone ? 'text-[#00d9ff]/70' : 'text-gray-600'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive ? 'bg-[#00d9ff] text-[#0f172a]' : isDone ? 'bg-[#00d9ff]/20 text-[#00d9ff]' : 'bg-[#334155] text-gray-600'}`}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    <span className="hidden sm:inline">{labels[i]}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* ── 상품 목록 ─────────────────────────────────────────────────── */}
        {step === 'products' && (
          <div className="space-y-3">
            <h2 className="text-white font-bold text-lg">상품 선택</h2>
            {products.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Package size={48} className="text-gray-600 mx-auto" />
                <p className="text-gray-500">현재 등록된 상품이 없습니다.</p>
                <p className="text-gray-600 text-sm">잠시 후 다시 확인해주세요.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {products.map(p => {
                  const inCart = cart.find(c => c.productId === p.id);
                  const unitOpts: string[] = (() => {
                    try { return JSON.parse(p.unit_options); } catch { return []; }
                  })();
                  return (
                    <div key={p.id} className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden">
                      {p.image_url && (
                        <div className="w-full h-36 bg-[#0f172a] overflow-hidden">
                          <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-white font-bold text-base leading-tight">{p.name}</h3>
                          {inCart && (
                            <span className="flex-shrink-0 bg-[#00d9ff]/20 text-[#00d9ff] text-xs font-bold px-2 py-0.5 rounded-full border border-[#00d9ff]/40">
                              담김 {inCart.quantity}{p.unit}
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-gray-400 text-sm mb-2 leading-relaxed">{p.description}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[#00d9ff] font-bold text-xl">{formatKRW(p.price)}</span>
                            <span className="text-gray-500 text-xs ml-1">/ {p.unit}</span>
                          </div>
                          <button
                            onClick={() => { setSelectedProduct(p); setSelectQty(1); }}
                            className="bg-[#00d9ff] text-[#0f172a] font-bold px-4 py-2 rounded-xl text-sm active:scale-95 transition-transform flex items-center gap-1.5"
                          >
                            <Plus size={14} />
                            담기
                          </button>
                        </div>
                        {unitOpts.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {unitOpts.map(opt => (
                              <span key={opt} className="text-xs text-gray-400 bg-[#334155] px-2 py-0.5 rounded-lg">{opt}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 장바구니 ──────────────────────────────────────────────────── */}
        {step === 'cart' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setStep('products')} className="text-gray-400 hover:text-white transition-colors">
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-white font-bold text-lg">장바구니</h2>
              <span className="text-gray-400 text-sm ml-1">({cart.length}개 상품)</span>
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <ShoppingCart size={48} className="text-gray-600 mx-auto" />
                <p className="text-gray-500">장바구니가 비었습니다.</p>
                <button onClick={() => setStep('products')} className="text-[#00d9ff] text-sm">
                  상품 담으러 가기 →
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.productId} className="bg-[#1e293b] border border-[#334155] rounded-2xl p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-white font-semibold">{item.productName}</p>
                          <p className="text-gray-400 text-sm">{formatKRW(item.unitPrice)} / {item.unit}</p>
                        </div>
                        <button onClick={() => removeFromCart(item.productId)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => updateCartQty(item.productId, -getStep(item.unit))}
                            className="w-9 h-9 bg-[#334155] hover:bg-[#475569] text-white rounded-xl flex items-center justify-center active:scale-95 transition-all"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-white font-bold text-lg min-w-[40px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQty(item.productId, getStep(item.unit))}
                            className="w-9 h-9 bg-[#00d9ff]/20 hover:bg-[#00d9ff]/30 text-[#00d9ff] rounded-xl flex items-center justify-center active:scale-95 transition-all"
                          >
                            <Plus size={14} />
                          </button>
                          <span className="text-gray-400 text-sm">{item.unit}</span>
                        </div>
                        <span className="text-[#00d9ff] font-bold text-lg">{formatKRW(item.totalPrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 합계 */}
                <div className="bg-[#1e293b] border border-[#00d9ff]/20 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-400">총 수량</span>
                    <span className="text-white">{cartCount.toLocaleString()} 단위</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-semibold">합계 금액</span>
                    <span className="text-[#00d9ff] font-bold text-xl">{formatKRW(cartTotal)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── 주문 정보 ─────────────────────────────────────────────────── */}
        {step === 'info' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setStep('cart')} className="text-gray-400 hover:text-white transition-colors">
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-white font-bold text-lg">주문 정보 입력</h2>
            </div>

            <div className="space-y-3">
              {/* 이름 */}
              <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-4 space-y-2">
                <label className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                  <User size={14} className="text-[#00d9ff]" />
                  주문자 이름 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00d9ff] transition-colors placeholder-gray-600"
                />
              </div>

              {/* 연락처 */}
              <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-4 space-y-2">
                <label className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                  <Phone size={14} className="text-[#00d9ff]" />
                  연락처 <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  inputMode="tel"
                  className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00d9ff] transition-colors placeholder-gray-600"
                />
              </div>

              {/* 배송 주소 */}
              <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-4 space-y-2">
                <label className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                  <MapPin size={14} className="text-[#00d9ff]" />
                  배송 주소 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="시/도, 시/군/구, 상세주소"
                  className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00d9ff] transition-colors placeholder-gray-600"
                />
              </div>

              {/* 배송 희망일 */}
              <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-4 space-y-2">
                <label className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                  <Calendar size={14} className="text-[#00d9ff]" />
                  배송 희망일 <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  min={minDate}
                  className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#00d9ff] transition-colors"
                />
                <p className="text-[#f59e0b] text-xs flex items-center gap-1">
                  <Zap size={11} />
                  오전 11시 전 주문 시 당일 배송 가능
                </p>
              </div>

              {/* 메모 */}
              <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-4 space-y-2">
                <label className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                  <MessageSquare size={14} className="text-[#00d9ff]" />
                  배송 요청사항 <span className="text-gray-500 text-xs">(선택)</span>
                </label>
                <textarea
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder="문 앞에 놔주세요, 경비실에 맡겨주세요 등"
                  rows={3}
                  className="w-full bg-[#0f172a] border border-[#334155] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#00d9ff] transition-colors placeholder-gray-600 resize-none"
                />
              </div>
            </div>

            {/* 주문 요약 */}
            <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-4 space-y-2">
              <h3 className="text-white font-semibold text-sm mb-3">주문 요약</h3>
              {cart.map(item => (
                <div key={item.productId} className="flex justify-between text-sm">
                  <span className="text-gray-400">{item.productName} × {item.quantity}{item.unit}</span>
                  <span className="text-white">{formatKRW(item.totalPrice)}</span>
                </div>
              ))}
              <div className="border-t border-[#334155] pt-2 mt-2 flex justify-between">
                <span className="text-white font-semibold">합계</span>
                <span className="text-[#00d9ff] font-bold text-lg">{formatKRW(cartTotal)}</span>
              </div>
            </div>

            {/* 오류 */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 하단 고정 버튼 ──────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        {/* 당일배송 홍보 배너 */}
        <div className="bg-gradient-to-r from-[#7c3aed] via-[#00d9ff] to-[#7c3aed] bg-[length:200%_100%] animate-gradient-x px-4 py-2">
          <div className="max-w-lg mx-auto flex items-center justify-center gap-3">
            <Truck size={14} className="text-white flex-shrink-0" />
            <p className="text-white text-xs font-medium">
              🚚 <strong>당일 배송 가능</strong> · 오전 11시 마감 · 지역 내 신속 배송
            </p>
            <Clock size={14} className="text-white flex-shrink-0" />
          </div>
        </div>

        <div className="bg-[#0f172a]/95 backdrop-blur border-t border-[#1e293b] px-4 py-3 safe-bottom">
          <div className="max-w-lg mx-auto">
            {step === 'products' && (
              <div className="flex gap-3">
                <div className="flex-1 bg-[#1e293b] border border-[#334155] rounded-2xl px-4 py-3 flex items-center justify-between">
                  <span className="text-gray-400 text-sm">장바구니</span>
                  <span className="text-[#00d9ff] font-bold">{formatKRW(cartTotal)}</span>
                </div>
                <button
                  onClick={() => cart.length > 0 ? setStep('cart') : null}
                  disabled={cart.length === 0}
                  className="flex-1 bg-[#00d9ff] disabled:bg-[#334155] disabled:text-gray-600 text-[#0f172a] font-bold py-3 rounded-2xl text-base active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={16} />
                  담은 상품 보기 {cart.length > 0 && `(${cart.length})`}
                </button>
              </div>
            )}
            {step === 'cart' && (
              <button
                onClick={() => cart.length > 0 ? setStep('info') : null}
                disabled={cart.length === 0}
                className="w-full bg-[#00d9ff] disabled:bg-[#334155] disabled:text-gray-600 text-[#0f172a] font-bold py-4 rounded-2xl text-base active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                주문 정보 입력
                <ChevronRight size={18} />
              </button>
            )}
            {step === 'info' && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-[#00d9ff] disabled:bg-[#00d9ff]/50 text-[#0f172a] font-bold py-4 rounded-2xl text-base active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 size={18} className="animate-spin" /> 주문 접수 중...</>
                ) : (
                  <><CheckCircle size={18} /> {formatKRW(cartTotal)} 주문 완료</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 상품 담기 팝업 ──────────────────────────────────────────────── */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedProduct(null)} />
          <div className="relative w-full sm:max-w-md bg-[#1e293b] border border-[#334155] rounded-t-3xl sm:rounded-3xl p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-bold text-lg">{selectedProduct.name}</h3>
                <p className="text-[#00d9ff] font-bold text-xl mt-1">
                  {formatKRW(selectedProduct.price)} <span className="text-sm text-gray-400 font-normal">/ {selectedProduct.unit}</span>
                </p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="text-gray-500 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            {selectedProduct.description && (
              <p className="text-gray-400 text-sm">{selectedProduct.description}</p>
            )}

            {/* 수량 선택 */}
            <div>
              <p className="text-gray-400 text-sm mb-2">수량 선택</p>
              {/* 빠른 선택 */}
              <div className="flex gap-2 mb-3 flex-wrap">
                {QUICK_QTY.map(q => (
                  <button
                    key={q}
                    onClick={() => setSelectQty(q)}
                    className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${selectQty === q ? 'bg-[#00d9ff] text-[#0f172a]' : 'bg-[#334155] text-gray-300 hover:bg-[#475569]'}`}
                  >
                    {q}{selectedProduct.unit}
                  </button>
                ))}
              </div>
              {/* 수동 수량 */}
              <div className="flex items-center gap-4 justify-center">
                <button
                  onClick={() => setSelectQty(q => Math.max(1, q - getStep(selectedProduct.unit)))}
                  className="w-12 h-12 bg-[#334155] hover:bg-[#475569] text-white rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                >
                  <Minus size={18} />
                </button>
                <span className="text-white font-bold text-2xl min-w-[60px] text-center">{selectQty}</span>
                <button
                  onClick={() => setSelectQty(q => q + getStep(selectedProduct.unit))}
                  className="w-12 h-12 bg-[#00d9ff]/20 hover:bg-[#00d9ff]/30 text-[#00d9ff] rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                >
                  <Plus size={18} />
                </button>
                <span className="text-gray-400">{selectedProduct.unit}</span>
              </div>
            </div>

            {/* 합계 및 담기 버튼 */}
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#0f172a] rounded-2xl px-4 py-3 text-center">
                <p className="text-gray-500 text-xs mb-0.5">합계</p>
                <p className="text-[#00d9ff] font-bold text-lg">{formatKRW(selectedProduct.price * selectQty)}</p>
              </div>
              <button
                onClick={() => addToCart(selectedProduct, selectQty)}
                className="flex-1 bg-[#00d9ff] text-[#0f172a] font-bold py-3 rounded-2xl text-base active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <ShoppingCart size={16} />
                장바구니 담기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
