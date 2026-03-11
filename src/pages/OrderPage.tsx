// 태평농산 간편주문 페이지 — 모바일/PC 완전 최적화
import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, Plus, Minus, Trash2, ChevronRight, ChevronLeft,
  Package, Truck, Clock, CheckCircle, Phone, MapPin, Calendar,
  User, MessageSquare, X, Loader2, Zap, Leaf, Star, ArrowRight,
  ShoppingBag, Award, Shield
} from 'lucide-react';

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
const QUICK_QTY = [1, 2, 3, 5, 10];

// 태평농산 브랜드 색상 팔레트
const BRAND = {
  green:      '#1a5c2a',
  greenLight: '#2d7a3e',
  greenPale:  '#e8f5eb',
  gold:       '#c8a951',
  goldLight:  '#f7d97a',
  goldPale:   '#fdf8ec',
  orange:     '#e8621a',
  orangeLight:'#f07d3a',
  cream:      '#fafaf5',
  dark:       '#1c2614',
  gray:       '#6b7280',
  grayLight:  '#f3f4f6',
  white:      '#ffffff',
};

// 히어로 배너 이미지 (AI 생성)
const HERO_IMAGE = 'https://www.genspark.ai/api/files/s/f8bEv0ee?cache_control=3600';
const LOGO_IMAGE = 'https://www.genspark.ai/api/files/s/QTqN4PyP?cache_control=3600';

// 기본 쌀 상품 이미지 플레이스홀더
const DEFAULT_PRODUCT_IMAGES: Record<string, string> = {
  default: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
};

export default function OrderPage() {
  const [step, setStep] = useState<Step>('products');
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [orderResult, setOrderResult] = useState<{ orderNo: string; totalAmount: number } | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [memo, setMemo] = useState('');

  const [selectedProduct, setSelectedProduct] = useState<ShopProduct | null>(null);
  const [selectQty, setSelectQty] = useState(1);

  const minDate = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetch('/api/shop/products')
      .then(r => r.json())
      .then(d => setProducts(Array.isArray(d) ? d : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

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
        productId: product.id, productName: product.name,
        unit: product.unit, quantity: qty,
        unitPrice: product.price, totalPrice: product.price * qty,
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
      ).filter(c => c.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(c => c.productId !== productId));
  }, []);

  const cartTotal = cart.reduce((s, c) => s + c.totalPrice, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const handleSubmit = async () => {
    if (!name.trim()) { setError('이름을 입력해주세요.'); return; }
    if (!phone.trim()) { setError('연락처를 입력해주세요.'); return; }
    if (!address.trim()) { setError('주소를 입력해주세요.'); return; }
    if (!deliveryDate) { setError('배송 희망일을 선택해주세요.'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await fetch('/api/shop/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name.trim(), customerPhone: phone.trim(),
          customerAddress: address.trim(), deliveryDate,
          items: cart, memo: memo.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '주문 실패');
      setOrderResult({ orderNo: data.orderNo, totalAmount: data.totalAmount });
      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '주문 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────
  // RENDER: 로딩
  // ─────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:'100vh', background:BRAND.cream, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ width:72, height:72, borderRadius:'50%', background:`linear-gradient(135deg,${BRAND.green},${BRAND.gold})`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Leaf size={36} color={BRAND.white} />
      </div>
      <Loader2 size={28} color={BRAND.green} style={{ animation:'spin 1s linear infinite' }} />
      <p style={{ color:BRAND.gray, fontSize:15 }}>태평농산 상품을 불러오는 중...</p>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ─────────────────────────────────────────────────────
  // RENDER: 주문완료
  // ─────────────────────────────────────────────────────
  if (step === 'done' && orderResult) return (
    <div style={{ minHeight:'100vh', background:BRAND.cream, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px 16px' }}>
      <div style={{ width:'100%', maxWidth:480, background:BRAND.white, borderRadius:24, boxShadow:'0 20px 60px rgba(26,92,42,0.15)', overflow:'hidden' }}>
        {/* 헤더 */}
        <div style={{ background:`linear-gradient(135deg,${BRAND.green},${BRAND.greenLight})`, padding:'40px 32px 32px', textAlign:'center' }}>
          <div style={{ width:80, height:80, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <CheckCircle size={44} color={BRAND.white} />
          </div>
          <h2 style={{ color:BRAND.white, fontSize:24, fontWeight:700, margin:'0 0 8px' }}>주문 완료!</h2>
          <p style={{ color:'rgba(255,255,255,0.85)', fontSize:14, margin:0 }}>소중한 주문 감사드립니다 🌾</p>
        </div>
        {/* 주문 정보 */}
        <div style={{ padding:'28px 28px 24px' }}>
          <div style={{ background:BRAND.greenPale, borderRadius:16, padding:'20px 24px', marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <span style={{ color:BRAND.gray, fontSize:13 }}>주문번호</span>
              <span style={{ color:BRAND.green, fontWeight:700, fontSize:15 }}>{orderResult.orderNo}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <span style={{ color:BRAND.gray, fontSize:13 }}>결제금액</span>
              <span style={{ color:BRAND.green, fontWeight:700, fontSize:18 }}>{formatKRW(orderResult.totalAmount)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ color:BRAND.gray, fontSize:13 }}>배송 희망일</span>
              <span style={{ color:BRAND.dark, fontWeight:600, fontSize:14 }}>{deliveryDate}</span>
            </div>
          </div>
          {/* 당일배송 안내 */}
          <div style={{ background:`linear-gradient(135deg,${BRAND.orange},${BRAND.orangeLight})`, borderRadius:16, padding:'16px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
            <Zap size={24} color={BRAND.white} />
            <div>
              <p style={{ color:BRAND.white, fontWeight:700, fontSize:14, margin:'0 0 2px' }}>당일배송 가능!</p>
              <p style={{ color:'rgba(255,255,255,0.9)', fontSize:12, margin:0 }}>오전 11시 이전 주문 → 당일 배송</p>
            </div>
          </div>
          {/* 안내 */}
          <div style={{ background:BRAND.grayLight, borderRadius:12, padding:'14px 16px', marginBottom:20 }}>
            <p style={{ color:BRAND.gray, fontSize:13, margin:'0 0 6px', fontWeight:600 }}>📞 배송 확인은 아래로 문의하세요</p>
            <p style={{ color:BRAND.dark, fontSize:14, fontWeight:600, margin:0 }}>태평농산 고객센터</p>
          </div>
          <button
            onClick={() => { setStep('products'); setCart([]); setName(''); setPhone(''); setAddress(''); setDeliveryDate(''); setMemo(''); setOrderResult(null); }}
            style={{ width:'100%', padding:'16px', borderRadius:16, background:`linear-gradient(135deg,${BRAND.green},${BRAND.greenLight})`, color:BRAND.white, fontWeight:700, fontSize:16, border:'none', cursor:'pointer' }}
          >
            새로운 주문하기
          </button>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────
  // RENDER: 메인 레이아웃
  // ─────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:BRAND.cream, fontFamily:'"Noto Sans KR",Apple SD Gothic Neo,sans-serif' }}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        input, textarea, select { font-family: inherit; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes slideUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        .product-card:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(26,92,42,0.18) !important; }
        .product-card { transition: transform 0.2s, box-shadow 0.2s; }
        .btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
        .btn-primary { transition: opacity 0.15s, transform 0.15s; }
        @media(max-width:640px) {
          .pc-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .hero-title { font-size: 28px !important; }
          .hero-sub { font-size: 14px !important; }
        }
        @media(min-width:641px) {
          .pc-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .hero-title { font-size: 40px !important; }
        }
        @media(min-width:1024px) {
          .pc-grid { grid-template-columns: repeat(4, 1fr) !important; }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${BRAND.grayLight}; }
        ::-webkit-scrollbar-thumb { background: ${BRAND.green}; border-radius: 3px; }
      `}</style>

      {/* ── 상단 배송 알림 띠 ── */}
      <div style={{ background:`linear-gradient(90deg,${BRAND.green},${BRAND.greenLight})`, padding:'8px 16px', textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
        <Zap size={14} color={BRAND.goldLight} />
        <span style={{ color:BRAND.white, fontSize:13, fontWeight:600 }}>오전 11시 이전 주문 시 당일 배송!</span>
        <Zap size={14} color={BRAND.goldLight} />
      </div>

      {/* ── 헤더 ── */}
      <header style={{ background:BRAND.white, borderBottom:`1px solid ${BRAND.grayLight}`, position:'sticky', top:0, zIndex:100, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', height:60 }}>
          {/* 로고 */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:38, height:38, borderRadius:'50%', background:`linear-gradient(135deg,${BRAND.green},${BRAND.gold})`, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
              <img src={LOGO_IMAGE} alt="태평농산" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display='none'; }} />
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:17, color:BRAND.dark, letterSpacing:-0.5, lineHeight:1.2 }}>태평농산</div>
              <div style={{ fontSize:10, color:BRAND.gold, fontWeight:600 }}>TAEPYUNG NONGSAN</div>
            </div>
          </div>
          {/* 장바구니 버튼 */}
          {step === 'products' && (
            <button
              onClick={() => cart.length > 0 && setStep('cart')}
              style={{ position:'relative', background: cart.length > 0 ? BRAND.green : BRAND.grayLight, border:'none', borderRadius:12, padding:'8px 16px', display:'flex', alignItems:'center', gap:8, cursor: cart.length > 0 ? 'pointer' : 'default', color: cart.length > 0 ? BRAND.white : BRAND.gray }}
            >
              <ShoppingCart size={18} />
              <span style={{ fontWeight:700, fontSize:14 }}>{formatKRW(cartTotal)}</span>
              {cartCount > 0 && (
                <span style={{ position:'absolute', top:-6, right:-6, background:BRAND.orange, color:BRAND.white, borderRadius:'50%', width:20, height:20, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>
                  {cartCount}
                </span>
              )}
            </button>
          )}
          {step !== 'products' && step !== 'done' && (
            <button onClick={() => setStep(step === 'info' ? 'cart' : 'products')} style={{ border:'none', background:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, color:BRAND.green, fontWeight:600, fontSize:14, padding:'8px 12px' }}>
              <ChevronLeft size={18} /> 이전
            </button>
          )}
        </div>
      </header>

      {/* ── STEP 진행 표시 ── */}
      {step !== 'done' && (
        <div style={{ background:BRAND.white, borderBottom:`1px solid ${BRAND.grayLight}`, padding:'12px 16px' }}>
          <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center', gap:0 }}>
            {(['products','cart','info'] as Step[]).map((s, i) => {
              const labels = ['상품선택','장바구니','주문정보'];
              const icons = [<Package size={14}/>, <ShoppingCart size={14}/>, <User size={14}/>];
              const active = step === s;
              const done = (['products','cart','info'] as Step[]).indexOf(step) > i;
              return (
                <React.Fragment key={s}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, minWidth:70 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background: done ? BRAND.green : active ? BRAND.green : BRAND.grayLight, color: done||active ? BRAND.white : BRAND.gray, fontWeight:700, fontSize:12, border: active ? `2px solid ${BRAND.gold}` : 'none', transition:'all 0.3s' }}>
                      {done ? <CheckCircle size={16}/> : icons[i]}
                    </div>
                    <span style={{ fontSize:11, fontWeight: active ? 700 : 400, color: active ? BRAND.green : done ? BRAND.green : BRAND.gray }}>{labels[i]}</span>
                  </div>
                  {i < 2 && <div style={{ flex:1, height:2, background: done ? BRAND.green : BRAND.grayLight, maxWidth:60, margin:'0 4px', marginBottom:18, transition:'background 0.3s' }} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          STEP 1: 상품 목록
      ════════════════════════════════════════════════════════ */}
      {step === 'products' && (
        <div style={{ maxWidth:1100, margin:'0 auto', padding:'0 16px 120px' }}>

          {/* 히어로 배너 */}
          <div style={{ position:'relative', borderRadius:20, overflow:'hidden', margin:'16px 0 20px', minHeight:200, background:`linear-gradient(135deg,${BRAND.green} 0%,${BRAND.greenLight} 50%,${BRAND.gold} 100%)` }}>
            <img src={HERO_IMAGE} alt="태평농산" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.5 }} onError={e => { (e.currentTarget as HTMLImageElement).style.opacity='0'; }} />
            <div style={{ position:'relative', padding:'32px 28px', zIndex:1 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.2)', borderRadius:20, padding:'4px 12px', marginBottom:12 }}>
                <Leaf size={12} color={BRAND.white} />
                <span style={{ color:BRAND.white, fontSize:12, fontWeight:600 }}>국내산 프리미엄</span>
              </div>
              <h1 className="hero-title" style={{ color:BRAND.white, fontWeight:800, margin:'0 0 8px', letterSpacing:-1, lineHeight:1.2, fontSize:32 }}>
                태평농산<br/>신선한 쌀
              </h1>
              <p className="hero-sub" style={{ color:'rgba(255,255,255,0.9)', fontSize:15, margin:'0 0 20px', fontWeight:400 }}>
                직접 도정한 신선한 쌀을 빠르게 배송해드립니다
              </p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[{icon:<Zap size={12}/>, text:'당일배송'},{icon:<Shield size={12}/>, text:'국내산 보증'},{icon:<Award size={12}/>, text:'직접 도정'}].map((b,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(255,255,255,0.2)', borderRadius:16, padding:'6px 12px' }}>
                    <span style={{ color:BRAND.goldLight }}>{b.icon}</span>
                    <span style={{ color:BRAND.white, fontSize:12, fontWeight:600 }}>{b.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 상품 그리드 */}
          <h2 style={{ fontSize:18, fontWeight:700, color:BRAND.dark, margin:'0 0 14px', display:'flex', alignItems:'center', gap:8 }}>
            <ShoppingBag size={20} color={BRAND.green} /> 상품 목록
          </h2>

          {products.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 20px', background:BRAND.white, borderRadius:20, boxShadow:'0 4px 20px rgba(0,0,0,0.06)' }}>
              <Package size={48} color={BRAND.grayLight} style={{ marginBottom:16 }} />
              <p style={{ color:BRAND.gray, fontSize:16, fontWeight:500 }}>등록된 상품이 없습니다</p>
              <p style={{ color:BRAND.gray, fontSize:13 }}>관리자가 상품을 등록하면 이곳에 표시됩니다</p>
            </div>
          ) : (
            <div className="pc-grid" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
              {products.map(p => {
                const inCart = cart.find(c => c.productId === p.id);
                return (
                  <div
                    key={p.id}
                    className="product-card"
                    style={{ background:BRAND.white, borderRadius:20, overflow:'hidden', boxShadow:'0 4px 20px rgba(26,92,42,0.08)', cursor:'pointer', border:`1px solid ${BRAND.grayLight}` }}
                    onClick={() => { setSelectedProduct(p); setSelectQty(1); }}
                  >
                    {/* 상품 이미지 */}
                    <div style={{ position:'relative', paddingTop:'70%', background:`linear-gradient(135deg,${BRAND.greenPale},${BRAND.goldPale})`, overflow:'hidden' }}>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGES.default; }} />
                      ) : (
                        <img src={DEFAULT_PRODUCT_IMAGES.default} alt={p.name} style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
                      )}
                      {/* 배지 */}
                      <div style={{ position:'absolute', top:10, left:10, background:`linear-gradient(135deg,${BRAND.green},${BRAND.greenLight})`, color:BRAND.white, borderRadius:8, padding:'3px 8px', fontSize:10, fontWeight:700 }}>
                        국내산
                      </div>
                      {inCart && (
                        <div style={{ position:'absolute', top:10, right:10, background:BRAND.orange, color:BRAND.white, borderRadius:8, padding:'3px 8px', fontSize:10, fontWeight:700 }}>
                          담김 {inCart.quantity}{p.unit}
                        </div>
                      )}
                    </div>
                    {/* 상품 정보 */}
                    <div style={{ padding:'14px 14px 16px' }}>
                      <h3 style={{ fontSize:14, fontWeight:700, color:BRAND.dark, margin:'0 0 4px', lineHeight:1.4 }}>{p.name}</h3>
                      {p.description && <p style={{ fontSize:12, color:BRAND.gray, margin:'0 0 10px', lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.description}</p>}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div>
                          <span style={{ fontSize:18, fontWeight:800, color:BRAND.green }}>{formatKRW(p.price)}</span>
                          <span style={{ fontSize:11, color:BRAND.gray, marginLeft:3 }}>/{p.unit}</span>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedProduct(p); setSelectQty(1); }}
                          style={{ background:`linear-gradient(135deg,${BRAND.green},${BRAND.greenLight})`, color:BRAND.white, border:'none', borderRadius:10, padding:'8px 14px', fontWeight:700, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
                        >
                          <Plus size={14} /> 담기
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          STEP 2: 장바구니
      ════════════════════════════════════════════════════════ */}
      {step === 'cart' && (
        <div style={{ maxWidth:680, margin:'0 auto', padding:'16px 16px 120px' }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:BRAND.dark, margin:'0 0 16px', display:'flex', alignItems:'center', gap:8 }}>
            <ShoppingCart size={22} color={BRAND.green} /> 장바구니
          </h2>
          {cart.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 20px', background:BRAND.white, borderRadius:20 }}>
              <ShoppingCart size={48} color={BRAND.grayLight} style={{ marginBottom:12 }} />
              <p style={{ color:BRAND.gray }}>장바구니가 비었습니다</p>
              <button onClick={() => setStep('products')} style={{ marginTop:16, background:BRAND.green, color:BRAND.white, border:'none', borderRadius:12, padding:'12px 24px', fontWeight:700, cursor:'pointer' }}>상품 담기</button>
            </div>
          ) : (
            <>
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>
                {cart.map(item => (
                  <div key={item.productId} style={{ background:BRAND.white, borderRadius:16, padding:'16px', display:'flex', alignItems:'center', gap:14, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                    <div style={{ width:52, height:52, borderRadius:12, background:`linear-gradient(135deg,${BRAND.greenPale},${BRAND.goldPale})`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                      <img src={DEFAULT_PRODUCT_IMAGES.default} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontWeight:700, fontSize:14, color:BRAND.dark, margin:'0 0 4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.productName}</p>
                      <p style={{ fontSize:13, color:BRAND.green, fontWeight:600, margin:0 }}>{formatKRW(item.totalPrice)}</p>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                      <button onClick={() => updateCartQty(item.productId, -1)} style={{ width:30, height:30, borderRadius:'50%', border:`1.5px solid ${BRAND.green}`, background:BRAND.white, color:BRAND.green, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Minus size={14}/></button>
                      <span style={{ minWidth:24, textAlign:'center', fontWeight:700, fontSize:15 }}>{item.quantity}</span>
                      <button onClick={() => updateCartQty(item.productId, 1)} style={{ width:30, height:30, borderRadius:'50%', border:'none', background:BRAND.green, color:BRAND.white, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Plus size={14}/></button>
                      <button onClick={() => removeFromCart(item.productId)} style={{ width:30, height:30, borderRadius:'50%', border:`1.5px solid #fecaca`, background:'#fff5f5', color:'#ef4444', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', marginLeft:4 }}><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
              {/* 합계 */}
              <div style={{ background:`linear-gradient(135deg,${BRAND.greenPale},${BRAND.goldPale})`, borderRadius:16, padding:'20px', marginBottom:20, border:`1px solid ${BRAND.green}20` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ color:BRAND.gray, fontSize:14 }}>상품 합계</span>
                  <span style={{ color:BRAND.dark, fontWeight:600 }}>{formatKRW(cartTotal)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ color:BRAND.gray, fontSize:14 }}>배송비</span>
                  <span style={{ color:BRAND.green, fontWeight:600 }}>무료</span>
                </div>
                <div style={{ height:1, background:`${BRAND.green}20`, margin:'12px 0' }} />
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:BRAND.dark, fontWeight:700, fontSize:16 }}>총 결제금액</span>
                  <span style={{ color:BRAND.green, fontWeight:800, fontSize:20 }}>{formatKRW(cartTotal)}</span>
                </div>
              </div>
              <button
                className="btn-primary"
                onClick={() => setStep('info')}
                style={{ width:'100%', padding:'18px', borderRadius:16, background:`linear-gradient(135deg,${BRAND.green},${BRAND.greenLight})`, color:BRAND.white, fontWeight:700, fontSize:17, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}
              >
                주문 정보 입력 <ArrowRight size={20} />
              </button>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          STEP 3: 주문 정보 입력
      ════════════════════════════════════════════════════════ */}
      {step === 'info' && (
        <div style={{ maxWidth:680, margin:'0 auto', padding:'16px 16px 120px' }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:BRAND.dark, margin:'0 0 20px', display:'flex', alignItems:'center', gap:8 }}>
            <User size={22} color={BRAND.green} /> 주문자 정보
          </h2>

          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* 이름 */}
            <div>
              <label style={{ display:'block', fontWeight:600, fontSize:14, color:BRAND.dark, marginBottom:8 }}>
                <User size={14} style={{ verticalAlign:'middle', marginRight:6 }} />이름 <span style={{ color:'#ef4444' }}>*</span>
              </label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="홍길동"
                style={{ width:'100%', padding:'14px 16px', borderRadius:12, border:`1.5px solid ${name ? BRAND.green : '#e5e7eb'}`, fontSize:15, outline:'none', background:BRAND.white, transition:'border-color 0.2s' }} />
            </div>
            {/* 연락처 */}
            <div>
              <label style={{ display:'block', fontWeight:600, fontSize:14, color:BRAND.dark, marginBottom:8 }}>
                <Phone size={14} style={{ verticalAlign:'middle', marginRight:6 }} />연락처 <span style={{ color:'#ef4444' }}>*</span>
              </label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" type="tel"
                style={{ width:'100%', padding:'14px 16px', borderRadius:12, border:`1.5px solid ${phone ? BRAND.green : '#e5e7eb'}`, fontSize:15, outline:'none', background:BRAND.white, transition:'border-color 0.2s' }} />
            </div>
            {/* 주소 */}
            <div>
              <label style={{ display:'block', fontWeight:600, fontSize:14, color:BRAND.dark, marginBottom:8 }}>
                <MapPin size={14} style={{ verticalAlign:'middle', marginRight:6 }} />배송 주소 <span style={{ color:'#ef4444' }}>*</span>
              </label>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="서울시 강남구 테헤란로 123"
                style={{ width:'100%', padding:'14px 16px', borderRadius:12, border:`1.5px solid ${address ? BRAND.green : '#e5e7eb'}`, fontSize:15, outline:'none', background:BRAND.white, transition:'border-color 0.2s' }} />
            </div>
            {/* 배송일 */}
            <div>
              <label style={{ display:'block', fontWeight:600, fontSize:14, color:BRAND.dark, marginBottom:8 }}>
                <Calendar size={14} style={{ verticalAlign:'middle', marginRight:6 }} />희망 배송일 <span style={{ color:'#ef4444' }}>*</span>
              </label>
              <input value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} type="date" min={minDate}
                style={{ width:'100%', padding:'14px 16px', borderRadius:12, border:`1.5px solid ${deliveryDate ? BRAND.green : '#e5e7eb'}`, fontSize:15, outline:'none', background:BRAND.white, transition:'border-color 0.2s' }} />
              <p style={{ fontSize:12, color:BRAND.orange, marginTop:6, display:'flex', alignItems:'center', gap:4 }}>
                <Zap size={11} /> 오전 11시 이전 주문 시 오늘 배송 가능!
              </p>
            </div>
            {/* 메모 */}
            <div>
              <label style={{ display:'block', fontWeight:600, fontSize:14, color:BRAND.dark, marginBottom:8 }}>
                <MessageSquare size={14} style={{ verticalAlign:'middle', marginRight:6 }} />요청사항 <span style={{ color:BRAND.gray, fontWeight:400, fontSize:12 }}>(선택)</span>
              </label>
              <textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="배송 시 요청사항을 입력해 주세요" rows={3}
                style={{ width:'100%', padding:'14px 16px', borderRadius:12, border:'1.5px solid #e5e7eb', fontSize:15, outline:'none', background:BRAND.white, resize:'none', lineHeight:1.6 }} />
            </div>
          </div>

          {/* 주문 요약 */}
          <div style={{ background:BRAND.white, borderRadius:16, padding:'18px', margin:'20px 0', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize:14, fontWeight:700, color:BRAND.dark, margin:'0 0 12px', display:'flex', alignItems:'center', gap:6 }}><ShoppingBag size={16} color={BRAND.green}/> 주문 상품</h3>
            {cart.map(item => (
              <div key={item.productId} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f3f4f6' }}>
                <span style={{ fontSize:13, color:BRAND.dark }}>{item.productName} × {item.quantity}{item.unit}</span>
                <span style={{ fontSize:13, fontWeight:600, color:BRAND.green }}>{formatKRW(item.totalPrice)}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', paddingTop:10, marginTop:4 }}>
              <span style={{ fontWeight:700, fontSize:15, color:BRAND.dark }}>총 결제금액</span>
              <span style={{ fontWeight:800, fontSize:18, color:BRAND.green }}>{formatKRW(cartTotal)}</span>
            </div>
          </div>

          {error && (
            <div style={{ background:'#fff5f5', border:'1.5px solid #fecaca', borderRadius:12, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:8, color:'#ef4444', fontSize:14 }}>
              <X size={16} /> {error}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
            style={{ width:'100%', padding:'18px', borderRadius:16, background: submitting ? BRAND.gray : `linear-gradient(135deg,${BRAND.green},${BRAND.greenLight})`, color:BRAND.white, fontWeight:700, fontSize:17, border:'none', cursor: submitting ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}
          >
            {submitting ? <><Loader2 size={20} style={{ animation:'spin 1s linear infinite' }} /> 주문 처리 중...</> : <><CheckCircle size={20} /> 주문 완료하기</>}
          </button>
        </div>
      )}

      {/* ── 하단 고정: 장바구니 버튼 (상품 목록에서) ── */}
      {step === 'products' && cart.length > 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:200, padding:'12px 16px 20px', background:'linear-gradient(transparent,rgba(250,250,245,0.98))', animation:'slideUp 0.3s ease' }}>
          <div style={{ maxWidth:680, margin:'0 auto' }}>
            <button
              className="btn-primary"
              onClick={() => setStep('cart')}
              style={{ width:'100%', padding:'18px', borderRadius:18, background:`linear-gradient(135deg,${BRAND.green},${BRAND.greenLight})`, color:BRAND.white, fontWeight:700, fontSize:17, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:12, boxShadow:`0 8px 32px ${BRAND.green}50` }}
            >
              <ShoppingCart size={22} />
              <span>장바구니 보기</span>
              <span style={{ background:'rgba(255,255,255,0.25)', borderRadius:10, padding:'3px 10px', fontWeight:700 }}>{formatKRW(cartTotal)}</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* ── 하단 당일배송 배너 (항상 표시) ── */}
      {step === 'products' && cart.length === 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:200, animation:'slideUp 0.4s ease' }}>
          <div style={{ background:`linear-gradient(90deg,${BRAND.orange},${BRAND.orangeLight})`, padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Truck size={20} color={BRAND.white} />
            </div>
            <div>
              <p style={{ color:BRAND.white, fontWeight:800, fontSize:15, margin:'0 0 1px' }}>⚡ 오늘 주문 오늘 배송!</p>
              <p style={{ color:'rgba(255,255,255,0.9)', fontSize:12, margin:0 }}>오전 11시 이전 주문 → 당일 배송 완료</p>
            </div>
            <div style={{ background:'rgba(255,255,255,0.2)', borderRadius:10, padding:'4px 12px' }}>
              <span style={{ color:BRAND.white, fontSize:12, fontWeight:700 }}>무료배송</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 상품 선택 모달 ── */}
      {selectedProduct && (
        <div style={{ position:'fixed', inset:0, zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.5)' }} onClick={() => setSelectedProduct(null)} />
          <div style={{ position:'relative', background:BRAND.white, borderRadius:'24px 24px 0 0', width:'100%', maxWidth:680, padding:'28px 24px 40px', animation:'slideUp 0.3s ease', maxHeight:'85vh', overflowY:'auto' }}>
            <div style={{ width:40, height:4, background:'#e5e7eb', borderRadius:2, margin:'0 auto 20px' }} />
            <button onClick={() => setSelectedProduct(null)} style={{ position:'absolute', top:20, right:20, width:32, height:32, borderRadius:'50%', background:BRAND.grayLight, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><X size={16}/></button>

            {/* 상품 이미지 */}
            <div style={{ borderRadius:16, overflow:'hidden', marginBottom:20, height:200, background:`linear-gradient(135deg,${BRAND.greenPale},${BRAND.goldPale})` }}>
              <img src={selectedProduct.image_url || DEFAULT_PRODUCT_IMAGES.default} alt={selectedProduct.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).src=DEFAULT_PRODUCT_IMAGES.default; }} />
            </div>

            <div style={{ marginBottom:4, display:'flex', gap:8 }}>
              <span style={{ background:BRAND.greenPale, color:BRAND.green, borderRadius:8, padding:'3px 10px', fontSize:12, fontWeight:600 }}>국내산</span>
              <span style={{ background:BRAND.goldPale, color:BRAND.gold, borderRadius:8, padding:'3px 10px', fontSize:12, fontWeight:600 }}>프리미엄</span>
            </div>
            <h3 style={{ fontSize:20, fontWeight:700, color:BRAND.dark, margin:'10px 0 6px' }}>{selectedProduct.name}</h3>
            {selectedProduct.description && <p style={{ color:BRAND.gray, fontSize:14, lineHeight:1.6, margin:'0 0 16px' }}>{selectedProduct.description}</p>}

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
              <div>
                <span style={{ fontSize:26, fontWeight:800, color:BRAND.green }}>{formatKRW(selectedProduct.price)}</span>
                <span style={{ fontSize:13, color:BRAND.gray, marginLeft:4 }}>/{selectedProduct.unit}</span>
              </div>
              <span style={{ color:BRAND.orange, fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                <Zap size={14}/> 당일배송 가능
              </span>
            </div>

            {/* 빠른 수량 */}
            <p style={{ fontSize:13, fontWeight:600, color:BRAND.gray, marginBottom:10 }}>빠른 수량 선택</p>
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              {QUICK_QTY.map(q => (
                <button key={q} onClick={() => setSelectQty(q)}
                  style={{ padding:'8px 16px', borderRadius:10, border:`1.5px solid ${selectQty===q ? BRAND.green : '#e5e7eb'}`, background: selectQty===q ? BRAND.green : BRAND.white, color: selectQty===q ? BRAND.white : BRAND.dark, fontWeight:700, fontSize:14, cursor:'pointer', transition:'all 0.2s' }}>
                  {q}{selectedProduct.unit}
                </button>
              ))}
            </div>

            {/* 수동 수량 조절 */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:20, marginBottom:24, background:BRAND.grayLight, borderRadius:16, padding:'14px' }}>
              <button onClick={() => setSelectQty(Math.max(1, selectQty-1))}
                style={{ width:44, height:44, borderRadius:'50%', border:`2px solid ${BRAND.green}`, background:BRAND.white, color:BRAND.green, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>
                <Minus size={20}/>
              </button>
              <div style={{ textAlign:'center' }}>
                <span style={{ fontSize:28, fontWeight:800, color:BRAND.dark }}>{selectQty}</span>
                <span style={{ fontSize:14, color:BRAND.gray, marginLeft:4 }}>{selectedProduct.unit}</span>
              </div>
              <button onClick={() => setSelectQty(selectQty+1)}
                style={{ width:44, height:44, borderRadius:'50%', border:'none', background:BRAND.green, color:BRAND.white, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Plus size={20}/>
              </button>
            </div>

            {/* 소계 */}
            <div style={{ background:BRAND.greenPale, borderRadius:12, padding:'12px 16px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:14, color:BRAND.dark, fontWeight:600 }}>소계</span>
              <span style={{ fontSize:20, fontWeight:800, color:BRAND.green }}>{formatKRW(selectedProduct.price * selectQty)}</span>
            </div>

            <button
              onClick={() => addToCart(selectedProduct, selectQty)}
              style={{ width:'100%', padding:'18px', borderRadius:16, background:`linear-gradient(135deg,${BRAND.green},${BRAND.greenLight})`, color:BRAND.white, fontWeight:700, fontSize:17, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}
            >
              <ShoppingCart size={20}/> 장바구니에 담기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
