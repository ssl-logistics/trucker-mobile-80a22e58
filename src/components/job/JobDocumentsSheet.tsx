import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FileText, Loader2, ImageIcon, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDriverSop, getDriverCheckins } from '@/lib/externalApi';
import { getPresignedUrl } from '@/hooks/usePresignedImageUrl';

interface JobDocumentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber?: string;
  jobData?: any;
}

interface DocGroup {
  key: string;
  label: string;
  urls: string[];
}

const parseUrlArray = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.filter((url): url is string => typeof url === 'string' && url.trim() !== '');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((url): url is string => typeof url === 'string' && url.trim() !== '')
        : [];
    } catch {
      return raw.trim() !== '' ? [raw] : [];
    }
  }
  return [];
};

const dedupeUrls = (urls: string[]): string[] => Array.from(new Set(urls.filter(Boolean)));

/** Build document groups from SOP + check-in records of the order */
const buildGroups = (
  sopRecords: any[],
  checkinRecords: any[],
  labels: { pickup: string; weightSlips: string; pod: string; signatures: string; tms: string }
): DocGroup[] => {
  const pickupUrls: string[] = [];
  const weightSlipUrls: string[] = [];
  const podUrls: string[] = [];
  const signatureUrls: string[] = [];

  for (const record of sopRecords || []) {
    pickupUrls.push(...parseUrlArray(record?.product_images));
    pickupUrls.push(...parseUrlArray(record?.document_images));
    pickupUrls.push(...parseUrlArray(record?.sop_photo_urls));
    pickupUrls.push(...parseUrlArray(record?.doc_photo_urls));

    const slips = Array.isArray(record?.weight_slips) ? record.weight_slips : [];
    for (const slip of slips) {
      if (slip?.image_url) weightSlipUrls.push(slip.image_url);
    }

    if (record?.signature_url) signatureUrls.push(record.signature_url);
  }

  for (const record of checkinRecords || []) {
    const type = String(record?.checkin_type || '');
    const photos = [
      ...parseUrlArray(record?.photo_urls),
      ...(record?.photo_url ? [record.photo_url] : []),
    ];

    if (type === 'delivery_confirmed') {
      podUrls.push(...photos);
    } else if (type === 'container_pickup_confirmed' || type === 'container_pickup') {
      pickupUrls.push(...photos);
    } else if (type === 'container_return_confirmed' || type === 'container_return') {
      podUrls.push(...photos);
    }

    if (record?.signature_url) signatureUrls.push(record.signature_url);
  }

  return [
    { key: 'pickup', label: labels.pickup, urls: dedupeUrls(pickupUrls) },
    { key: 'weightSlips', label: labels.weightSlips, urls: dedupeUrls(weightSlipUrls) },
    { key: 'pod', label: labels.pod, urls: dedupeUrls(podUrls) },
    { key: 'signatures', label: labels.signatures, urls: dedupeUrls(signatureUrls) },
    { key: 'tms', label: labels.tms, urls: [] },
  ];
};

export default function JobDocumentsSheet({ open, onOpenChange, orderNumber, jobData }: JobDocumentsSheetProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isInternalDriver, isExternalDriver } = useUserRole();

  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [groups, setGroups] = useState<DocGroup[]>([]);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const hasAnyUrl = groups.some((group) => group.urls.length > 0);

  const loadDocuments = async () => {
    if (!orderNumber || !user?.id) return;
    setLoading(true);
    setFailed(false);
    setGroups([]);

    try {
      const driverType = isInternalDriver ? 'internal' : isExternalDriver ? 'external' : 'freelance';

      // allDrivers=true so documents from transferred drivers are also included
      const [sopResult, checkinResult] = await Promise.all([
        getDriverSop(user.id, driverType, orderNumber).catch(() => null),
        getDriverCheckins(user.id, driverType, orderNumber, { allDrivers: true }).catch(() => null),
      ]);

      // callExternalApi wraps the API body in { data, error } — unwrap it first,
      // the API body itself is { success, data: [...], pagination }
      const extractRecords = (r: any): any[] => {
        const body = r?.data ?? r;
        if (Array.isArray(body)) return body;
        return Array.isArray(body?.data) ? body.data : [];
      };
      const sopRecords: any[] = extractRecords(sopResult);
      const checkinRecords: any[] = extractRecords(checkinResult);

      const rawGroups = buildGroups(sopRecords, checkinRecords, {
        pickup: t('docs.groupPickup'),
        weightSlips: t('docs.groupWeightSlips'),
        pod: t('docs.groupPod'),
        signatures: t('docs.groupSignatures'),
        tms: t('docs.groupTms'),
      });

      // Resolve presigned URLs for private S3 objects (falls back to original URL)
      const allUrls = dedupeUrls(rawGroups.flatMap((group) => group.urls));
      const presigned = new Map<string, string>();
      await Promise.all(
        allUrls.map(async (url) => {
          try {
            presigned.set(url, await getPresignedUrl(url));
          } catch {
            presigned.set(url, url);
          }
        })
      );

      setGroups(rawGroups.map((group) => ({ ...group, urls: group.urls.map((u) => presigned.get(u) || u) })));
    } catch (error) {
      console.error('Error loading job documents:', error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  // Fetch when the sheet opens (fresh load per open so newly submitted docs appear)
  useEffect(() => {
    if (open) {
      loadDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orderNumber, user?.id]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[80vh] flex flex-col rounded-t-2xl p-0 max-w-[560px] mx-auto">
          <SheetHeader className="px-4 py-3 border-b space-y-0 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <FileText className="w-5 h-5" />
              {t('docs.title')}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            {loading && (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm">...</span>
              </div>
            )}

            {!loading && failed && (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
                <ImageIcon className="w-8 h-8 opacity-40" />
                <p className="text-sm">{t('docs.loadFailed')}</p>
                <button
                  onClick={loadDocuments}
                  className="flex items-center gap-1 text-sm text-primary font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t('docs.retry')}
                </button>
              </div>
            )}

            {!loading && !failed && groups.map((group) => (
              <div key={group.key} className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                {group.urls.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('docs.empty')}</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {group.urls.map((url, index) => (
                      <button
                        key={`${group.key}-${index}`}
                        className="aspect-square rounded-lg overflow-hidden bg-muted active:opacity-80"
                        onClick={() => setViewerUrl(url)}
                      >
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!viewerUrl} onOpenChange={(value) => !value && setViewerUrl(null)}>
        <DialogContent className="p-0 bg-transparent border-0 max-w-full w-full h-full flex items-center justify-center [&>button]:hidden">
          <img
            src={viewerUrl || ''}
            alt=""
            className="max-h-full max-w-full object-contain"
            onClick={() => setViewerUrl(null)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
