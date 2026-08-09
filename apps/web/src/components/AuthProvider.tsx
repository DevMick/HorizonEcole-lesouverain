import { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store';
import { Spin } from 'antd';

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    // Wait for Zustand to rehydrate from localStorage
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      // Check auth consistency
      checkAuth();
      setIsHydrated(true);
    });

    // Fallback: if hydration takes too long, continue anyway
    const timeout = setTimeout(() => {
      if (!isHydrated) {
        checkAuth();
        setIsHydrated(true);
      }
    }, 500);

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [checkAuth, isHydrated]);

  if (!isHydrated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f2f5',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px', color: '#666' }}>Chargement...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

