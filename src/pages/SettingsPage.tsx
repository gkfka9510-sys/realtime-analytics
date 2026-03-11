// 스토리지 및 계정 설정 페이지
import React, { useState, useEffect } from 'react';
import { storageApi, authApi, tokenManager } from '@/lib/api';
import { HardDrive, Trash2, AlertTriangle, CheckCircle, Shield, Key, LogOut, RefreshCw, Clock, FileText } from 'lucide-react';

interface StorageStats {
  sales: { count: number; max: number; pct: number };
  taxInvoices: { count: number; max: number; pct: number };
  inventoryTransactions: { count: number; max: number; pct: number };
  products: { count: number };
  dbSizeMB: number;
  warnings: string[];
}

interface DeleteLog {
  id: number;
  table_name: string;
  deleted_count: number;
  reason: string;
  deleted_at: string;
}

interface Props {
  onLogout: () => void;
  username: string;
  displayName: string;
}

export default function SettingsPage({ onLogout, username, displayName }: Props) {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [logs, setLogs] = useState<DeleteLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'storage' | 'account'>('storage');

  // 비밀번호 변경
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState({ text: '', type: '' });
  const [pwLoading, setPwLoading] = useState(false);

  // 삭제 모달
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean; type: 'sales' | 'invTx'; months: number;
  } | null>(null);
  const [deleteMsg, setDeleteMsg] = useState('');

  const loadStats = async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([storageApi.getStats(), storageApi.getDeleteLogs()]);
      setStats(s);
      setLogs(l);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadStats(); }, []);

  const handleOldDelete = async () => {
    if (!deleteModal) return;
    try {
      const res = deleteModal.type === 'sales'
        ? await storageApi.deleteOldSales(deleteModal.months)
        : await storageApi.deleteOldInvTx(deleteModal.months);
      setDeleteMsg(`✅ ${res.message}`);
      setDeleteModal(null);
      loadStats();
    } catch (e: unknown) {
      setDeleteMsg(`❌ ${e instanceof Error ? e.message : '오류'}`);
    }
    setTimeout(() => setDeleteMsg(''), 5000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { setPwMsg({ text: '새 비밀번호가 일치하지 않습니다.', type: 'error' }); return; }
    if (pwForm.next.length < 6) { setPwMsg({ text: '비밀번호는 6자 이상이어야 합니다.', type: 'error' }); return; }
    setPwLoading(true);
    try {
      await authApi.changePassword(pwForm.current, pwForm.next);
      setPwMsg({ text: '비밀번호가 변경되었습니다.', type: 'success' });
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (e: unknown) {
      setPwMsg({ text: e instanceof Error ? e.message : '오류', type: 'error' });
    }
    setPwLoading(false);
    setTimeout(() => setPwMsg({ text: '', type: '' }), 4000);
  };

  const handleLogout = () => {
    tokenManager.clear();
    onLogout();
  };

  const ProgressBar = ({ pct, count, max }: { pct: number; count: number; max: number }) => (
    <div>
      <div className="w-full bg-[#1a1d29] rounded-full h-2.5 mb-1">
        <div
          className={`h-2.5 rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-[#00d9ff]'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{count.toLocaleString()}건</span>
        <span>{pct}% / {max.toLocaleString()}건</span>
      </div>
    </div>
  );

  const tableLabel: Record<string, string> = {
    sales_records: '매출 데이터',
    tax_invoices: '세금계산서',
    inventory_transactions: '재고 이력',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Shield className="text-[#00d9ff]" size={28} />
        설정 및 스토리지 관리
      </h2>

      {/* 섹션 탭 */}
      <div className="flex bg-[#2d3142] rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveSection('storage')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'storage' ? 'bg-[#00d9ff] text-[#1a1d29]' : 'text-gray-400 hover:text-white'}`}
        >
          <HardDrive size={15} />
          스토리지 관리
        </button>
        <button
          onClick={() => setActiveSection('account')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'account' ? 'bg-[#7c3aed] text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Key size={15} />
          계정 설정
        </button>
      </div>

      {/* ── 스토리지 섹션 ── */}
      {activeSection === 'storage' && (
        <>
          {deleteMsg && (
            <div className={`p-3 rounded-xl text-sm ${deleteMsg.startsWith('✅') ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
              {deleteMsg}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <RefreshCw className="animate-spin mr-2" size={20} />
              불러오는 중...
            </div>
          ) : stats ? (
            <>
              {/* 경고 */}
              {stats.warnings.length > 0 && (
                <div className="space-y-2">
                  {stats.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 p-3 bg-yellow-500/15 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm">
                      <AlertTriangle size={16} />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* 전체 DB 크기 */}
              <div className="bg-[#2d3142] rounded-xl p-5 border border-[#3d4362]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <HardDrive size={18} className="text-[#00d9ff]" />
                    스토리지 현황
                  </h3>
                  <button onClick={loadStats} className="text-gray-400 hover:text-white transition-colors">
                    <RefreshCw size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-[#1a1d29] rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-[#00d9ff]">{stats.dbSizeMB}</div>
                    <div className="text-gray-400 text-xs mt-1">MB 사용</div>
                  </div>
                  <div className="bg-[#1a1d29] rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-white">{stats.sales.count.toLocaleString()}</div>
                    <div className="text-gray-400 text-xs mt-1">매출 건수</div>
                  </div>
                  <div className="bg-[#1a1d29] rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-white">{stats.taxInvoices.count.toLocaleString()}</div>
                    <div className="text-gray-400 text-xs mt-1">세금계산서</div>
                  </div>
                  <div className="bg-[#1a1d29] rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-white">{stats.inventoryTransactions.count.toLocaleString()}</div>
                    <div className="text-gray-400 text-xs mt-1">재고 이력</div>
                  </div>
                </div>

                <div className="space-y-5">
                  {/* 매출 */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-300 text-sm font-medium">매출 데이터</span>
                      <span className={`text-xs ${stats.sales.pct >= 80 ? 'text-red-400' : 'text-gray-400'}`}>{stats.sales.pct}% 사용</span>
                    </div>
                    <ProgressBar {...stats.sales} />
                  </div>
                  {/* 세금계산서 */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-300 text-sm font-medium">세금계산서</span>
                      <span className={`text-xs ${stats.taxInvoices.pct >= 80 ? 'text-red-400' : 'text-gray-400'}`}>{stats.taxInvoices.pct}% 사용</span>
                    </div>
                    <ProgressBar {...stats.taxInvoices} />
                  </div>
                  {/* 재고 이력 */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-300 text-sm font-medium">재고 변동 이력</span>
                      <span className={`text-xs ${stats.inventoryTransactions.pct >= 80 ? 'text-red-400' : 'text-gray-400'}`}>{stats.inventoryTransactions.pct}% 사용</span>
                    </div>
                    <ProgressBar {...stats.inventoryTransactions} />
                  </div>
                </div>
              </div>

              {/* 데이터 정리 */}
              <div className="bg-[#2d3142] rounded-xl p-5 border border-[#3d4362]">
                <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                  <Trash2 size={18} className="text-yellow-400" />
                  오래된 데이터 정리
                </h3>
                <p className="text-gray-400 text-xs mb-5">지정한 기간 이전 데이터를 삭제하여 스토리지를 확보합니다. <br/>현재 재고 수량은 영향받지 않습니다.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { type: 'sales' as const, label: '매출 데이터 정리', icon: '📊', desc: '오래된 매출 내역 삭제', minMonths: 6 },
                    { type: 'invTx' as const, label: '재고 이력 정리', icon: '📦', desc: '오래된 입출고 이력 삭제', minMonths: 3 },
                  ].map(item => (
                    <div key={item.type} className="bg-[#1a1d29] rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{item.icon}</span>
                        <span className="text-white text-sm font-medium">{item.label}</span>
                      </div>
                      <p className="text-gray-500 text-xs mb-4">{item.desc}</p>
                      <div className="flex flex-wrap gap-2">
                        {[6, 12, 18, 24].filter(m => m >= item.minMonths).map(months => (
                          <button
                            key={months}
                            onClick={() => setDeleteModal({ open: true, type: item.type, months })}
                            className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-lg text-xs font-medium transition-colors border border-red-500/20"
                          >
                            {months}개월 이전 삭제
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 삭제 이력 */}
              {logs.length > 0 && (
                <div className="bg-[#2d3142] rounded-xl border border-[#3d4362] overflow-hidden">
                  <div className="p-4 border-b border-[#3d4362] flex items-center gap-2">
                    <Clock size={16} className="text-gray-400" />
                    <h3 className="text-white font-semibold text-sm">데이터 정리 이력</h3>
                  </div>
                  <div className="divide-y divide-[#3d4362]">
                    {logs.map(log => (
                      <div key={log.id} className="flex items-center justify-between px-4 py-3 hover:bg-[#3d4362]/20">
                        <div className="flex items-center gap-3">
                          <FileText size={14} className="text-gray-400" />
                          <div>
                            <p className="text-gray-300 text-xs">{tableLabel[log.table_name] || log.table_name} · {log.deleted_count.toLocaleString()}건 삭제</p>
                            <p className="text-gray-500 text-xs">{log.reason}</p>
                          </div>
                        </div>
                        <span className="text-gray-500 text-xs">{new Date(log.deleted_at).toLocaleDateString('ko-KR')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500 py-8">스토리지 정보를 불러올 수 없습니다.</div>
          )}
        </>
      )}

      {/* ── 계정 설정 섹션 ── */}
      {activeSection === 'account' && (
        <div className="space-y-4">
          {/* 계정 정보 */}
          <div className="bg-[#2d3142] rounded-xl p-5 border border-[#3d4362]">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Shield size={18} className="text-[#00d9ff]" />
              계정 정보
            </h3>
            <div className="flex items-center gap-4 p-4 bg-[#1a1d29] rounded-xl">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00d9ff] to-[#7c3aed] flex items-center justify-center text-2xl">
                🌾
              </div>
              <div>
                <p className="text-white font-bold">{displayName}</p>
                <p className="text-gray-400 text-sm">@{username}</p>
              </div>
            </div>
          </div>

          {/* 비밀번호 변경 */}
          <div className="bg-[#2d3142] rounded-xl p-5 border border-[#3d4362]">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Key size={18} className="text-yellow-400" />
              비밀번호 변경
            </h3>
            <form onSubmit={handlePasswordChange} className="space-y-3">
              {[
                { label: '현재 비밀번호', key: 'current', placeholder: '현재 비밀번호' },
                { label: '새 비밀번호', key: 'next', placeholder: '6자 이상' },
                { label: '새 비밀번호 확인', key: 'confirm', placeholder: '새 비밀번호 재입력' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-gray-400 text-xs mb-1">{f.label}</label>
                  <input
                    type="password"
                    placeholder={f.placeholder}
                    value={pwForm[f.key as keyof typeof pwForm]}
                    onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full bg-[#1a1d29] border border-[#3d4362] text-white rounded-xl px-4 py-2.5 text-sm focus:border-[#00d9ff] focus:outline-none"
                  />
                </div>
              ))}
              {pwMsg.text && (
                <div className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${pwMsg.type === 'success' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                  {pwMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                  {pwMsg.text}
                </div>
              )}
              <button
                type="submit"
                disabled={pwLoading}
                className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {pwLoading ? '처리 중...' : '비밀번호 변경'}
              </button>
            </form>
          </div>

          {/* 로그아웃 */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-xl font-medium text-sm transition-colors"
          >
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteModal?.open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2d3142] rounded-2xl p-6 w-full max-w-sm border border-red-500/40">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <h3 className="text-white font-bold">데이터 삭제 확인</h3>
            </div>
            <p className="text-gray-400 text-sm mb-2">
              <strong className="text-white">{deleteModal.months}개월</strong> 이전의{' '}
              <strong className="text-white">{deleteModal.type === 'sales' ? '매출 데이터' : '재고 이력'}</strong>를{' '}
              삭제합니다.
            </p>
            <p className="text-red-400 text-xs mb-5">⚠️ 삭제된 데이터는 복구할 수 없습니다.</p>
            <div className="flex gap-3">
              <button
                onClick={handleOldDelete}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                삭제 확인
              </button>
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 py-2.5 bg-[#3d4362] hover:bg-[#4d5382] text-gray-300 rounded-xl text-sm transition-colors"
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
