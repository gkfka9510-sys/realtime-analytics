// 상품 관리 탭 - 관리자가 쇼핑몰에 표시할 상품을 등록/수정/삭제
import React, { useState, useCallback } from 'react';
import { useRice } from '@/contexts/RiceContext';
import { ShopProduct } from '@/types/rice';
import {
  Package, Plus, Edit2, Trash2, Save, X, Eye, EyeOff,
  ChevronUp, ChevronDown, Image, Tag, DollarSign, Link,
  ExternalLink, Copy, CheckCircle, Info, AlertCircle, Star
} from 'lucide-react';

const formatKRW = (v: number) => `₩${v.toLocaleString('ko-KR')}`;

const UNITS = ['kg', '포대', '박스', '개', '10kg', '20kg', '30kg'];

const EMPTY_PRODUCT: Omit<ShopProduct, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  unit: 'kg',
  unitOptions: [],
  price: 0,
  imageUrl: '',
  isAvailable: true,
  sortOrder: 0,
};

export default function ShopProductPage() {
  const { shopProducts, addShopProduct, updateShopProduct, deleteShopProduct } = useRice();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<ShopProduct, 'id' | 'createdAt' | 'updatedAt'>>(EMPTY_PRODUCT);
  const [showForm, setShowForm] = useState(false);
  const [unitOptionInput, setUnitOptionInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // 공개 주문 URL
  const orderUrl = `${window.location.origin}/order`;

  const copyUrl = () => {
    navigator.clipboard.writeText(orderUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const openForm = useCallback((product?: ShopProduct) => {
    if (product) {
      setEditingId(product.id);
      setForm({
        name: product.name,
        description: product.description,
        unit: product.unit,
        unitOptions: product.unitOptions || [],
        price: product.price,
        imageUrl: product.imageUrl,
        isAvailable: product.isAvailable,
        sortOrder: product.sortOrder,
      });
    } else {
      setEditingId(null);
      setForm({ ...EMPTY_PRODUCT, sortOrder: shopProducts.length });
    }
    setUnitOptionInput('');
    setShowForm(true);
  }, [shopProducts.length]);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_PRODUCT);
    setUnitOptionInput('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert('상품명을 입력해주세요.'); return; }
    if (form.price < 0) { alert('가격을 올바르게 입력해주세요.'); return; }
    try {
      if (editingId) {
        await updateShopProduct(editingId, form);
      } else {
        await addShopProduct(form);
      }
      closeForm();
    } catch (e) {
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    await deleteShopProduct(id);
    setDeleteConfirm(null);
  };

  const handleToggleAvailable = async (product: ShopProduct) => {
    await updateShopProduct(product.id, { isAvailable: !product.isAvailable });
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const sorted = [...shopProducts].sort((a, b) => a.sortOrder - b.sortOrder);
    const target = sorted[index];
    const swap = sorted[direction === 'up' ? index - 1 : index + 1];
    if (!swap) return;
    await updateShopProduct(target.id, { sortOrder: swap.sortOrder });
    await updateShopProduct(swap.id, { sortOrder: target.sortOrder });
  };

  const addUnitOption = () => {
    const v = unitOptionInput.trim();
    if (v && !form.unitOptions.includes(v)) {
      setForm(f => ({ ...f, unitOptions: [...(f.unitOptions || []), v] }));
    }
    setUnitOptionInput('');
  };

  const removeUnitOption = (opt: string) => {
    setForm(f => ({ ...f, unitOptions: (f.unitOptions || []).filter(o => o !== opt) }));
  };

  const sortedProducts = [...shopProducts].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Package size={20} className="text-[#22c55e]" />
            상품 관리
          </h2>
          <p className="text-gray-400 text-sm mt-0.5">고객 주문 페이지에 표시할 상품을 관리합니다.</p>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 bg-[#22c55e] text-[#0f1117] font-bold px-4 py-2.5 rounded-xl hover:bg-[#22c55e]/90 transition-colors text-sm flex-shrink-0"
        >
          <Plus size={16} />
          상품 추가
        </button>
      </div>

      {/* 주문 URL 공유 */}
      <div className="bg-gradient-to-r from-[#7c3aed]/20 to-[#22c55e]/20 border border-[#7c3aed]/40 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-[#7c3aed]/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <Link size={15} className="text-[#a78bfa]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm mb-1">고객 주문 페이지 URL</p>
            <p className="text-gray-400 text-xs mb-3">이 URL을 고객에게 공유하면 바로 주문할 수 있습니다.</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#0f1117] border border-[#2e3147] rounded-lg px-3 py-2 text-[#22c55e] text-xs font-mono truncate">
                {orderUrl}
              </div>
              <button
                onClick={copyUrl}
                className="flex items-center gap-1.5 bg-[#2e3147] hover:bg-[#4d5382] text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
              >
                {copied ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                {copied ? '복사됨!' : '복사'}
              </button>
              <a
                href="/order"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-[#22c55e]/20 hover:bg-[#22c55e]/30 text-[#22c55e] px-3 py-2 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
              >
                <ExternalLink size={12} />
                미리보기
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 상품 목록 */}
      {sortedProducts.length === 0 ? (
        <div className="bg-[#1c1f2e] border border-[#2e3147] rounded-xl p-12 text-center">
          <Package size={48} className="text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium mb-1">등록된 상품이 없습니다.</p>
          <p className="text-gray-500 text-sm mb-4">상품을 추가하면 고객 주문 페이지에 표시됩니다.</p>
          <button
            onClick={() => openForm()}
            className="inline-flex items-center gap-2 bg-[#22c55e] text-[#0f1117] font-bold px-4 py-2.5 rounded-xl text-sm hover:bg-[#22c55e]/90 transition-colors"
          >
            <Plus size={15} />
            첫 번째 상품 추가
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedProducts.map((product, idx) => (
            <div
              key={product.id}
              className={`bg-[#1c1f2e] border rounded-xl overflow-hidden transition-all ${product.isAvailable ? 'border-[#2e3147]' : 'border-[#2e3147]/40 opacity-60'}`}
            >
              <div className="flex items-start gap-3 p-4">
                {/* 이미지 */}
                {product.imageUrl ? (
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[#0f1117]">
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl flex-shrink-0 bg-[#0f1117] flex items-center justify-center">
                    <Package size={24} className="text-gray-600" />
                  </div>
                )}

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-white font-semibold text-sm">{product.name}</h3>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${product.isAvailable ? 'bg-green-400/10 text-green-400 border-green-400/30' : 'bg-gray-500/10 text-gray-500 border-gray-500/30'}`}>
                      {product.isAvailable ? '판매중' : '숨김'}
                    </span>
                  </div>
                  {product.description && (
                    <p className="text-gray-400 text-xs mt-0.5 leading-relaxed line-clamp-2">{product.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[#22c55e] font-bold text-base">{formatKRW(product.price)}</span>
                    <span className="text-gray-500 text-xs">/ {product.unit}</span>
                    {product.unitOptions && product.unitOptions.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {product.unitOptions.map(opt => (
                          <span key={opt} className="text-xs text-gray-500 bg-[#0f1117] px-1.5 py-0.5 rounded">{opt}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 액션 */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMoveOrder(idx, 'up')}
                      disabled={idx === 0}
                      className="w-6 h-5 rounded flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-20 transition-colors"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      onClick={() => handleMoveOrder(idx, 'down')}
                      disabled={idx === sortedProducts.length - 1}
                      className="w-6 h-5 rounded flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-20 transition-colors"
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>
                  <button
                    onClick={() => handleToggleAvailable(product)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${product.isAvailable ? 'text-green-400 hover:bg-green-400/10' : 'text-gray-500 hover:bg-gray-500/10'}`}
                    title={product.isAvailable ? '숨기기' : '표시하기'}
                  >
                    {product.isAvailable ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button
                    onClick={() => openForm(product)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#2a2d3e] transition-colors"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(product.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
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
                <h3 className="text-white font-bold">상품 삭제</h3>
                <p className="text-gray-400 text-sm">이 작업은 되돌릴 수 없습니다.</p>
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

      {/* 상품 추가/수정 폼 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeForm} />
          <div className="relative w-full sm:max-w-lg bg-[#1c1f2e] border border-[#2e3147] rounded-t-3xl sm:rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2e3147]">
              <h3 className="text-white font-bold text-base">
                {editingId ? '상품 수정' : '새 상품 추가'}
              </h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[75vh] p-5 space-y-4">
              {/* 상품명 */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1.5">
                  상품명 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="예: 신동진 쌀 20kg"
                  className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22c55e] transition-colors placeholder-gray-600"
                />
              </div>

              {/* 설명 */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1.5">상품 설명</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="상품에 대한 간단한 설명 (맛, 원산지, 특징 등)"
                  rows={2}
                  className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22c55e] transition-colors placeholder-gray-600 resize-none"
                />
              </div>

              {/* 가격 / 단위 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1.5">
                    가격 (원) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.price || ''}
                    onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                    placeholder="0"
                    min="0"
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
                  />
                  {form.price > 0 && (
                    <p className="text-[#22c55e] text-xs mt-1">{formatKRW(form.price)}</p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-1.5">단위</label>
                  <select
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* 단위 옵션 */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <Tag size={12} className="text-gray-500" />
                  추가 단위 옵션 <span className="text-gray-500 font-normal text-xs">(예: 10kg, 20kg - 표시용)</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={unitOptionInput}
                    onChange={e => setUnitOptionInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addUnitOption()}
                    placeholder="단위 입력 후 Enter"
                    className="flex-1 bg-[#0f1117] border border-[#2e3147] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
                  />
                  <button onClick={addUnitOption} className="bg-[#2e3147] hover:bg-[#4d5382] text-white px-3 py-2 rounded-xl text-sm transition-colors">추가</button>
                </div>
                {form.unitOptions && form.unitOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.unitOptions.map(opt => (
                      <span key={opt} className="flex items-center gap-1 text-sm bg-[#0f1117] border border-[#2e3147] text-gray-300 px-2.5 py-1 rounded-lg">
                        {opt}
                        <button onClick={() => removeUnitOption(opt)} className="text-gray-500 hover:text-red-400 transition-colors ml-0.5">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 이미지 URL */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1.5 flex items-center gap-1.5">
                  <Image size={12} className="text-gray-500" />
                  상품 이미지 URL <span className="text-gray-500 font-normal text-xs">(선택)</span>
                </label>
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                  className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#22c55e] transition-colors placeholder-gray-600"
                />
                {form.imageUrl && (
                  <div className="mt-2 w-20 h-20 rounded-xl overflow-hidden bg-[#0f1117] border border-[#2e3147]">
                    <img src={form.imageUrl} alt="미리보기" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>

              {/* 노출 여부 */}
              <div className="flex items-center justify-between p-3 bg-[#0f1117] rounded-xl border border-[#2e3147]">
                <div className="flex items-center gap-2">
                  <Eye size={15} className="text-gray-400" />
                  <span className="text-gray-300 text-sm">주문 페이지에 표시</span>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, isAvailable: !f.isAvailable }))}
                  className={`w-12 h-6 rounded-full transition-all relative ${form.isAvailable ? 'bg-[#22c55e]' : 'bg-[#2e3147]'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.isAvailable ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-[#2e3147] flex gap-3">
              <button onClick={closeForm} className="flex-1 py-3 bg-[#2e3147] text-gray-300 rounded-xl font-medium text-sm hover:bg-[#4d5382] transition-colors">
                취소
              </button>
              <button onClick={handleSave} className="flex-1 py-3 bg-[#22c55e] text-[#0f1117] rounded-xl font-bold text-sm hover:bg-[#22c55e]/90 transition-colors flex items-center justify-center gap-2">
                <Save size={14} />
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
