import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './lib/config';
import { doc, getDoc } from 'firebase/firestore';
import useAuthStore from './stores/authStore';

// Pages
import { HomePage } from './pages/HomePage';
import { DiscoverPage } from './pages/DiscoverPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { WalletPage } from './pages/WalletPage';

// Components
import { TopNav, BottomNav } from './components/Navigation';
import { LoadingSpinner } from './components/LoadingStates';

const App: React.FC = () => {
  const { setUser, setLoading } = useAuthStore();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser({
              id: firebaseUser.uid,
              ...(userDoc.data() as any),
            });
          }
        } catch (error) {
          console.error('Error loading user:', error);
        }
      } else {
        setUser(null);
      }
      setInitializing(false);
    });

    return unsubscribe;
  }, [setUser]);

  if (initializing) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <BrowserRouter>
      <TopNav />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </BrowserRouter>
  );
};

export default App;
