import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message, className = '' }: LoadingStateProps) {
  const { t } = useLanguage();
  
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
      <p className="text-sm text-muted-foreground">
        {message || t('common.loading')}
      </p>
    </div>
  );
}

interface EmptyStateProps {
  message?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({ message, icon, className = '' }: EmptyStateProps) {
  const { t } = useLanguage();
  
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <p className="text-sm text-muted-foreground">
        {message || t('common.noData')}
      </p>
    </div>
  );
}
