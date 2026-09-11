import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, Video, Wallet, User } from 'lucide-react';
import useAuthStore from '../stores/authStore';

const navigationItems = [
  { label: 'Home', icon: Home, path: '/' },
  { label: 'Discover', icon: Compass, path: '/discover' },
  { label: 'Shorts', icon: Video, path: '/shorts' },
  { label: 'Rewards', icon: Wallet, path: '/rewards' },
  { label: 'Profile', icon: User, path: '/profile' },
];

export const BottomNav: React.FC = () => {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-dark border-t border-border md:hidden z-40">
      <div className="flex items-center justify-around">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center py-3 px-4 flex-1 transition-colors ${
                isActive ? 'text-primary' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={24} />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export const TopNav: React.FC = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const isAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname);
  const isHomePage = location.pathname === '/';

  if (isAuthPage) return null;

  return (
    <header className="fixed top-0 left-0 right-0 bg-dark/95 backdrop-blur border-b border-border z-40">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-primary">▶</span>
          <span>WatchEarn AI</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          <Link to="/discover" className="text-gray-400 hover:text-white transition-colors">
            Discover
          </Link>
          <Link to="/creators" className="text-gray-400 hover:text-white transition-colors">
            Creators
          </Link>
          <Link to="/rewards" className="text-gray-400 hover:text-white transition-colors">
            Rewards
          </Link>
        </div>

        {user ? (
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {user.name}
            </Link>
            <button
              onClick={() => logout()}
              className="text-sm text-gray-400 hover:text-red-400 transition-colors"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-gray-400 hover:text-white transition-colors">
              Login
            </Link>
            <Link to="/register" className="btn-primary">
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
