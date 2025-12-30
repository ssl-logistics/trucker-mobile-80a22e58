import { useSwipeBack } from '@/hooks/useSwipeBack';

interface SwipeBackProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
}

export function SwipeBackProvider({ children, enabled = true }: SwipeBackProviderProps) {
  useSwipeBack({ enabled });
  return <>{children}</>;
}
