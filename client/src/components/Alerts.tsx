import React from 'react';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  type: AlertType;
  title: string;
  message?: string;
  onClose?: () => void;
}

const alertStyles = {
  success: 'bg-green-500/20 border-green-500/50 text-green-400',
  error: 'bg-red-500/20 border-red-500/50 text-red-400',
  warning: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
  info: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
};

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: AlertCircle,
};

export const Alert: React.FC<AlertProps> = ({ type, title, message, onClose }) => {
  const Icon = icons[type];
  const style = alertStyles[type];

  return (
    <div className={`card border ${style} p-4 flex items-start gap-4`}>
      <Icon size={20} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <h4 className="font-semibold">{title}</h4>
        {message && <p className="text-sm opacity-90 mt-1">{message}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-lg opacity-50 hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      )}
    </div>
  );
};

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
}

const badgeVariants = {
  default: 'bg-surface text-white',
  success: 'bg-green-500/20 text-green-400',
  warning: 'bg-yellow-500/20 text-yellow-400',
  danger: 'bg-red-500/20 text-red-400',
  info: 'bg-blue-500/20 text-blue-400',
};

const badgeSizes = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'default', size = 'md' }) => (
  <span className={`rounded-full font-medium ${badgeVariants[variant]} ${badgeSizes[size]}`}>
    {label}
  </span>
);
