import React, { useState, useEffect } from 'react';
import { RiceProvider } from '@/contexts/RiceContext';
import RiceDashboard from '@/components/RiceDashboard';
import LoginPage from '@/components/LoginPage';
import { authApi, tokenManager } from '@/lib/api';
import { Loader2 } from 'lucide-react';

const Index: React.FC = () => {
  const [authState, setAuthState] = useState<{
    checked: boolean;
    loggedIn: boolean;
    username: string;
    displayName: string;
  }>({ checked: false, loggedIn: false, username: '', displayName: '' });

  // 앱 시작 시 기존 토큰 유효성 검증
  useEffect(() => {
    const token = tokenManager.get();
    if (!token) {
      setAuthState({ checked: true, loggedIn: false, username: '', displayName: '' });
      return;
    }
    authApi.verify()
      .then(res => {
        setAuthState({
          checked: true, loggedIn: true,
          username: res.user.username,
          displayName: res.user.display_name || res.user.username,
        });
      })
      .catch(() => {
        tokenManager.clear();
        setAuthState({ checked: true, loggedIn: false, username: '', displayName: '' });
      });
  }, []);

  const handleLogin = (username: string, displayName: string) => {
    setAuthState({ checked: true, loggedIn: true, username, displayName });
  };

  const handleLogout = () => {
    tokenManager.clear();
    setAuthState({ checked: true, loggedIn: false, username: '', displayName: '' });
  };

  // 초기 로딩
  if (!authState.checked) {
    return (
      <div className="min-h-screen bg-[#1a1d29] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl">🌾</div>
          <Loader2 className="animate-spin text-[#00d9ff]" size={32} />
          <p className="text-gray-400 text-sm">쌀집 대시보드 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!authState.loggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <RiceProvider>
      <RiceDashboard
        username={authState.username}
        displayName={authState.displayName}
        onLogout={handleLogout}
      />
    </RiceProvider>
  );
};

export default Index;
