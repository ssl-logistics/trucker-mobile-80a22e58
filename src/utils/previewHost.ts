// Shared preview-host detection for intro/onboarding cards.
// Preview hosts (Lovable preview/published/shared links, localhost) always show
// intro cards; real custom domains stay in production behavior (ack once per account).
export const isPreviewHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.includes('id-preview--') || host.endsWith('.lovable.app') || host === 'localhost';
};
