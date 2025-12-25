import { useToastStore } from '@zenith-tv/content';
import { Button } from '@zenith-tv/ui/button';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  X,
  type LucideIcon,
} from 'lucide-react';

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  onClose: () => void;
}

interface ToastStyle {
  bg: string;
  icon: LucideIcon;
}

function Toast({ type, message, onClose }: ToastProps) {
  const getStyles = (): ToastStyle => {
    switch (type) {
      case 'success':
        return { bg: 'bg-green-600', icon: CheckCircle };
      case 'error':
        return { bg: 'bg-destructive', icon: XCircle };
      case 'warning':
        return { bg: 'bg-yellow-600', icon: AlertTriangle };
      case 'info':
      default:
        return { bg: 'bg-primary', icon: Info };
    }
  };

  const { bg, icon: Icon } = getStyles();

  return (
    <div
      className={`${bg} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3
                 animate-slide-in-right`}
      role="alert"
    >
      <div className="flex-shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <p className="flex-1 text-sm font-medium">{message}</p>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="flex-shrink-0 h-6 w-6 hover:bg-white/20 text-white"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
