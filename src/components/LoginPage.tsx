// 로그인 / 회원가입 화면
import React, { useState } from 'react';
import { authApi, tokenManager } from '@/lib/api';
import { Eye, EyeOff, User, Lock, LogIn, UserPlus, Sprout } from 'lucide-react';

interface Props {
  onLogin: (username: string, displayName: string) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!username.trim() || !password.trim()) { setError('아이디와 비밀번호를 입력해주세요.'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await authApi.login(username.trim(), password);
        tokenManager.set(res.token);
        onLogin(res.username, res.displayName || res.username);
      } else {
        if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
        const res = await authApi.register(username.trim(), password, displayName.trim() || username.trim());
        tokenManager.set(res.token);
        setSuccess('회원가입 완료! 잠시 후 이동합니다...');
        setTimeout(() => onLogin(res.username, res.displayName || res.username), 1000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      {/* 배경 그라데이션 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#22c55e]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#7c3aed]/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#22c55e] to-[#7c3aed] mb-4 shadow-lg shadow-[#7c3aed]/30">
            <span className="text-4xl">🌾</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">쌀집 대시보드</h1>
          <p className="text-gray-400 text-sm">Rice Business Manager</p>
        </div>

        {/* 카드 */}
        <div className="bg-[#1c1f2e] rounded-2xl p-8 border border-[#2e3147] shadow-xl">
          {/* 탭 */}
          <div className="flex bg-[#0f1117] rounded-xl p-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'login' ? 'bg-[#22c55e] text-[#0f1117] shadow' : 'text-gray-400 hover:text-white'}`}
            >
              <LogIn size={15} />
              로그인
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'register' ? 'bg-[#7c3aed] text-white shadow' : 'text-gray-400 hover:text-white'}`}
            >
              <UserPlus size={15} />
              회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 표시 이름 (회원가입만) */}
            {mode === 'register' && (
              <div>
                <label className="block text-gray-400 text-xs mb-1.5">상호 / 이름</label>
                <div className="relative">
                  <Sprout size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="예: 황금쌀집"
                    className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:border-[#7c3aed] focus:outline-none focus:ring-1 focus:ring-[#7c3aed] transition-colors"
                  />
                </div>
              </div>
            )}

            {/* 아이디 */}
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">아이디</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="아이디 입력"
                  autoComplete="username"
                  className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-1 focus:ring-[#22c55e] transition-colors"
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-gray-400 text-xs mb-1.5">비밀번호</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? '6자 이상 입력' : '비밀번호 입력'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full bg-[#0f1117] border border-[#2e3147] text-white rounded-xl pl-10 pr-12 py-3 text-sm focus:border-[#22c55e] focus:outline-none focus:ring-1 focus:ring-[#22c55e] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 에러 / 성공 메시지 */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-sm">
                <span className="text-base">⚠️</span>
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-500/15 border border-green-500/30 rounded-xl text-green-400 text-sm">
                <span className="text-base">✅</span>
                {success}
              </div>
            )}

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
                loading ? 'opacity-50 cursor-not-allowed' :
                mode === 'login'
                  ? 'bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-[#0f1117] hover:shadow-lg hover:shadow-[#22c55e]/20 hover:scale-[1.01]'
                  : 'bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white hover:shadow-lg hover:shadow-[#7c3aed]/20 hover:scale-[1.01]'
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  처리 중...
                </span>
              ) : mode === 'login' ? (
                <><LogIn size={16} /> 로그인</>
              ) : (
                <><UserPlus size={16} /> 회원가입</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">
          데이터는 서버에 안전하게 암호화 저장됩니다
        </p>
      </div>
    </div>
  );
}
