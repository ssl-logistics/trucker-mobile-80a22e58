import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  /** Maximum width behavior */
  maxWidth?: 'mobile' | 'tablet' | 'desktop' | 'full' | 'none';
  /** Add horizontal padding */
  padded?: boolean;
  /** Center the container */
  centered?: boolean;
}

/**
 * Responsive container that adapts to different screen sizes
 * Provides consistent max-width and padding across the app
 * 
 * Screen size reference:
 * - xs: 375px (Mobile small)
 * - sm: 640px (Mobile large)
 * - md: 768px (Tablet)
 * - lg: 1024px (Tablet landscape / Small laptop)
 * - xl: 1280px (Small monitor 17-19")
 * - 2xl: 1536px (Standard monitor 21.5-24")
 * - 3xl: 1920px (Large monitor 27-32"+)
 */
export function ResponsiveContainer({
  children,
  className,
  maxWidth = 'desktop',
  padded = true,
  centered = true,
}: ResponsiveContainerProps) {
  const maxWidthClasses = {
    mobile: 'max-w-md', // 448px - mobile only
    tablet: 'max-w-2xl', // 672px - tablet friendly
    desktop: 'max-w-7xl', // 1280px - desktop friendly
    full: 'max-w-full', // 100%
    none: '', // no max-width
  };

  return (
    <div
      className={cn(
        // Base responsive behavior
        'w-full',
        // Max width
        maxWidthClasses[maxWidth],
        // Centering
        centered && 'mx-auto',
        // Responsive padding
        padded && 'px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Responsive page wrapper with consistent layout
 * Handles safe areas and bottom navigation spacing
 */
interface ResponsivePageProps {
  children: ReactNode;
  className?: string;
  /** Include bottom padding for navigation */
  hasBottomNav?: boolean;
  /** Background style */
  background?: 'default' | 'gradient' | 'muted';
}

export function ResponsivePage({
  children,
  className,
  hasBottomNav = true,
  background = 'default',
}: ResponsivePageProps) {
  const bgClasses = {
    default: 'bg-background',
    gradient: 'bg-gradient-to-b from-blue-50 to-white',
    muted: 'bg-muted/30',
  };

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col w-full',
        bgClasses[background],
        hasBottomNav && 'pb-24 lg:pb-6',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Responsive grid for job cards and similar content
 * Automatically adjusts columns based on screen size
 */
interface ResponsiveGridProps {
  children: ReactNode;
  className?: string;
  /** Number of columns at different breakpoints */
  columns?: {
    mobile?: 1 | 2;
    tablet?: 1 | 2 | 3;
    desktop?: 1 | 2 | 3 | 4;
  };
  /** Gap between items */
  gap?: 'sm' | 'md' | 'lg';
}

export function ResponsiveGrid({
  children,
  className,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 'md',
}: ResponsiveGridProps) {
  const gapClasses = {
    sm: 'gap-2 sm:gap-3',
    md: 'gap-4 sm:gap-5 lg:gap-6',
    lg: 'gap-6 sm:gap-8 lg:gap-10',
  };

  const getColClass = () => {
    const mobile = columns.mobile || 1;
    const tablet = columns.tablet || 2;
    const desktop = columns.desktop || 3;

    return cn(
      mobile === 1 ? 'grid-cols-1' : 'grid-cols-2',
      tablet === 1 ? 'md:grid-cols-1' : tablet === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3',
      desktop === 1 ? 'xl:grid-cols-1' : desktop === 2 ? 'xl:grid-cols-2' : desktop === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'
    );
  };

  return (
    <div className={cn('grid', getColClass(), gapClasses[gap], className)}>
      {children}
    </div>
  );
}

/**
 * Hook to detect current breakpoint
 */
export function useResponsive() {
  // This is a simple implementation - for SSR compatibility you might want to use a more robust solution
  if (typeof window === 'undefined') {
    return {
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isLargeDesktop: false,
      breakpoint: 'xs' as const,
    };
  }

  const width = window.innerWidth;

  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024 && width < 1920,
    isLargeDesktop: width >= 1920,
    breakpoint: 
      width < 375 ? 'xs' as const :
      width < 640 ? 'sm' as const :
      width < 768 ? 'md' as const :
      width < 1024 ? 'lg' as const :
      width < 1280 ? 'xl' as const :
      width < 1536 ? '2xl' as const : '3xl' as const,
  };
}
