import { useState, useCallback, useRef } from 'react';

/**
 * Hook for preventing double-clicks and duplicate submissions
 * Provides a processing state and a guard function that prevents concurrent execution
 */
export function useProcessingGuard() {
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);

  /**
   * Execute an async function with double-click protection
   * If already processing, the function will not be called
   */
  const withGuard = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    options?: {
      onError?: (error: unknown) => void;
      minDuration?: number; // Minimum duration to show loading state (ms)
    }
  ): Promise<T | undefined> => {
    // Prevent concurrent execution
    if (processingRef.current) {
      console.log('[ProcessingGuard] Blocked duplicate execution');
      return undefined;
    }

    processingRef.current = true;
    setIsProcessing(true);

    const startTime = Date.now();
    const minDuration = options?.minDuration || 300;

    try {
      const result = await asyncFn();
      
      // Ensure minimum loading duration for better UX
      const elapsed = Date.now() - startTime;
      if (elapsed < minDuration) {
        await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
      }
      
      return result;
    } catch (error) {
      console.error('[ProcessingGuard] Error during execution:', error);
      options?.onError?.(error);
      return undefined;
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, []);

  /**
   * Reset processing state (useful for cleanup)
   */
  const reset = useCallback(() => {
    processingRef.current = false;
    setIsProcessing(false);
  }, []);

  return {
    isProcessing,
    withGuard,
    reset
  };
}

/**
 * Hook for tracking multiple processing states by key
 * Useful when you have multiple items that can be processed independently
 */
export function useMultiProcessingGuard() {
  const [processingKeys, setProcessingKeys] = useState<Set<string>>(new Set());
  const processingRefs = useRef<Set<string>>(new Set());

  const isProcessingKey = useCallback((key: string) => {
    return processingKeys.has(key);
  }, [processingKeys]);

  const isAnyProcessing = processingKeys.size > 0;

  const withGuard = useCallback(async <T>(
    key: string,
    asyncFn: () => Promise<T>,
    options?: {
      onError?: (error: unknown) => void;
      minDuration?: number;
    }
  ): Promise<T | undefined> => {
    // Prevent concurrent execution for same key
    if (processingRefs.current.has(key)) {
      console.log(`[MultiProcessingGuard] Blocked duplicate execution for key: ${key}`);
      return undefined;
    }

    processingRefs.current.add(key);
    setProcessingKeys(prev => new Set([...prev, key]));

    const startTime = Date.now();
    const minDuration = options?.minDuration || 300;

    try {
      const result = await asyncFn();
      
      const elapsed = Date.now() - startTime;
      if (elapsed < minDuration) {
        await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
      }
      
      return result;
    } catch (error) {
      console.error(`[MultiProcessingGuard] Error for key ${key}:`, error);
      options?.onError?.(error);
      return undefined;
    } finally {
      processingRefs.current.delete(key);
      setProcessingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const reset = useCallback(() => {
    processingRefs.current.clear();
    setProcessingKeys(new Set());
  }, []);

  return {
    isProcessingKey,
    isAnyProcessing,
    withGuard,
    reset
  };
}
