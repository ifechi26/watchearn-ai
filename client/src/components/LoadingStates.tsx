import React from 'react';
import { Loader } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 40,
  color = '#00D084',
  fullScreen = false,
}) => {
  const content = (
    <div className="flex items-center justify-center">
      <Loader size={size} color={color} className="animate-spin" />
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-dark/80 flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
};

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = '8px',
}) => (
  <div
    style={{
      width,
      height,
      borderRadius,
      background: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)',
      backgroundSize: '200% 100%',
      animation: 'loading 1.5s infinite',
    }}
  />
);

interface ErrorStateProps {
  title: string;
  message: string;
  action?: () => void;
  actionText?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  action,
  actionText = 'Try Again',
}) => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="text-red-500 mb-4">
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0-4a4 4 0 00-4-4h0a4 4 0 00-4 4m0 0a4 4 0 004 4h0a4 4 0 004-4m0 0a4 4 0 104 4h0a4 4 0 00-4-4z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    <p className="text-gray-400 text-center mb-6">{message}</p>
    {action && (
      <button onClick={action} className="btn-primary">
        {actionText}
      </button>
    )}
  </div>
);

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: () => void;
  actionText?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  action,
  actionText = 'Get Started',
}) => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="text-gray-400 mb-4 text-5xl">{icon}</div>
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    <p className="text-gray-400 text-center mb-6 max-w-md">{message}</p>
    {action && (
      <button onClick={action} className="btn-primary">
        {actionText}
      </button>
    )}
  </div>
);
