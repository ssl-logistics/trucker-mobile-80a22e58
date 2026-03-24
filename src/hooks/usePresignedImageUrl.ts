import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Global cache to store presigned URLs
const urlCache = new Map<string, { presignedUrl: string; expiresAt: Date }>();

// Clean up expired URLs from cache
const cleanupExpiredUrls = () => {
  const now = new Date();
  for (const [key, value] of urlCache.entries()) {
    if (value.expiresAt <= now) {
      urlCache.delete(key);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredUrls, 5 * 60 * 1000);

interface PresignedUrlResult {
  url: string | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

interface PresignedUrlsResult {
  urls: (string | null)[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to get a presigned URL for an S3 image with auto-refresh
 * @param originalUrl - The original S3 URL
 * @param expiresIn - Expiration time in seconds (default: 7 days)
 * @param refreshBuffer - Time before expiration to refresh (default: 1 hour)
 */
export function usePresignedImageUrl(
  originalUrl: string | null | undefined,
  expiresIn: number = 604800, // 7 days
  refreshBuffer: number = 3600 // 1 hour
): PresignedUrlResult {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPresignedUrl = useCallback(async () => {
    if (!originalUrl) {
      setUrl(null);
      setIsLoading(false);
      return;
    }

    // Check if it's an S3 URL that needs presigning
    const isS3Url = originalUrl.includes('s3.') || 
                    originalUrl.includes('amazonaws.com') ||
                    originalUrl.startsWith('mobile/');
    
    if (!isS3Url) {
      // Not an S3 URL, use as-is
      setUrl(originalUrl);
      setIsLoading(false);
      return;
    }

    // Check cache first
    const cached = urlCache.get(originalUrl);
    const now = new Date();
    const bufferTime = new Date(now.getTime() + refreshBuffer * 1000);

    if (cached && cached.expiresAt > bufferTime) {
      setUrl(cached.presignedUrl);
      setIsLoading(false);
      
      // Schedule refresh before expiration
      const timeUntilRefresh = cached.expiresAt.getTime() - bufferTime.getTime();
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        fetchPresignedUrl();
      }, timeUntilRefresh);
      
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-image-url', {
        body: { url: originalUrl, expiresIn }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to get presigned URL');
      }

      if (data?.presignedUrl) {
        const expiresAt = new Date(data.expiresAt);
        
        // Store in cache
        urlCache.set(originalUrl, {
          presignedUrl: data.presignedUrl,
          expiresAt
        });

        setUrl(data.presignedUrl);
        
        // Schedule refresh before expiration
        const timeUntilRefresh = expiresAt.getTime() - bufferTime.getTime();
        if (timeUntilRefresh > 0) {
          if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
          }
          refreshTimeoutRef.current = setTimeout(() => {
            fetchPresignedUrl();
          }, timeUntilRefresh);
        }
      } else {
        // Fallback to original URL if presigning fails
        setUrl(originalUrl);
      }
    } catch (err) {
      console.error('Error fetching presigned URL:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // Fallback to original URL
      setUrl(originalUrl);
    } finally {
      setIsLoading(false);
    }
  }, [originalUrl, expiresIn, refreshBuffer]);

  useEffect(() => {
    fetchPresignedUrl();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchPresignedUrl]);

  const refresh = useCallback(async () => {
    // Clear cache for this URL
    if (originalUrl) {
      urlCache.delete(originalUrl);
    }
    await fetchPresignedUrl();
  }, [originalUrl, fetchPresignedUrl]);

  return { url, isLoading, error, refresh };
}

/**
 * Hook to get presigned URLs for multiple S3 images
 * @param originalUrls - Array of original S3 URLs
 * @param expiresIn - Expiration time in seconds (default: 7 days)
 * @param refreshBuffer - Time before expiration to refresh (default: 1 hour)
 */
export function usePresignedImageUrls(
  originalUrls: (string | null | undefined)[],
  expiresIn: number = 604800,
  refreshBuffer: number = 3600
): PresignedUrlsResult {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Stabilize the array reference to prevent infinite re-renders
  const urlsKey = JSON.stringify(originalUrls);

  const fetchAllUrls = useCallback(async () => {
    const parsedUrls: (string | null | undefined)[] = JSON.parse(urlsKey);
    if (!parsedUrls || parsedUrls.length === 0) {
      setUrls([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        parsedUrls.map(async (originalUrl) => {
          if (!originalUrl) return null;

          // Check if it's an S3 URL
          const isS3Url = originalUrl.includes('s3.') || 
                          originalUrl.includes('amazonaws.com') ||
                          originalUrl.startsWith('mobile/');
          
          if (!isS3Url) return originalUrl;

          // Check cache
          const cached = urlCache.get(originalUrl);
          const now = new Date();
          const bufferTime = new Date(now.getTime() + refreshBuffer * 1000);

          if (cached && cached.expiresAt > bufferTime) {
            return cached.presignedUrl;
          }

          // Fetch new presigned URL
          try {
            const { data, error: fnError } = await supabase.functions.invoke('get-image-url', {
              body: { url: originalUrl, expiresIn }
            });

            if (fnError || !data?.presignedUrl) {
              return originalUrl;
            }

            // Store in cache
            urlCache.set(originalUrl, {
              presignedUrl: data.presignedUrl,
              expiresAt: new Date(data.expiresAt)
            });

            return data.presignedUrl;
          } catch {
            return originalUrl;
          }
        })
      );

      setUrls(results);
    } catch (err) {
      console.error('Error fetching presigned URLs:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      const parsedFallback: (string | null | undefined)[] = JSON.parse(urlsKey);
      setUrls(parsedFallback.map(u => u || null));
    } finally {
      setIsLoading(false);
    }
  }, [urlsKey, expiresIn, refreshBuffer]);

  useEffect(() => {
    fetchAllUrls();
  }, [fetchAllUrls]);

  const refresh = useCallback(async () => {
    // Clear cache for all URLs
    originalUrls.forEach(url => {
      if (url) urlCache.delete(url);
    });
    await fetchAllUrls();
  }, [originalUrls, fetchAllUrls]);

  return { urls, isLoading, error, refresh };
}

/**
 * Utility function to clear the URL cache
 */
export function clearPresignedUrlCache(): void {
  urlCache.clear();
}

/**
 * Utility function to get a presigned URL without the hook
 */
export async function getPresignedUrl(
  originalUrl: string,
  expiresIn: number = 604800
): Promise<string> {
  // Check cache first
  const cached = urlCache.get(originalUrl);
  const now = new Date();
  const bufferTime = new Date(now.getTime() + 3600 * 1000); // 1 hour buffer

  if (cached && cached.expiresAt > bufferTime) {
    return cached.presignedUrl;
  }

  try {
    const { data, error } = await supabase.functions.invoke('get-image-url', {
      body: { url: originalUrl, expiresIn }
    });

    if (error || !data?.presignedUrl) {
      return originalUrl;
    }

    // Store in cache
    urlCache.set(originalUrl, {
      presignedUrl: data.presignedUrl,
      expiresAt: new Date(data.expiresAt)
    });

    return data.presignedUrl;
  } catch {
    return originalUrl;
  }
}
