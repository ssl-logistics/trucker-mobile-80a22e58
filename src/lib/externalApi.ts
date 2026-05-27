import { supabase } from "@/integrations/supabase/client";

// External API Configuration
// Direct calls to external Supabase project

export const EXTERNAL_API_URL = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1';
export const BIDDING_API_URL = 'https://zcahkrlhlydpiwawdlxh.supabase.co/functions/v1';

// API Keys for different endpoints
const API_KEYS = {
  LOGIN_API_KEY: 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
  EXPRESS_RENT_API_KEY: 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
  FREELANCE_DRIVER_API_KEY: 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
  DRIVER_API_KEY: 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live',
};

// Endpoint to API key mapping
const ENDPOINT_API_KEY_MAP: Record<string, keyof typeof API_KEYS> = {
  'login': 'LOGIN_API_KEY',
  'logout': 'LOGIN_API_KEY',
  'driver-checkin': 'EXPRESS_RENT_API_KEY',
  'driver-sop': 'FREELANCE_DRIVER_API_KEY',
  'get-driver-assigned-jobs': 'EXPRESS_RENT_API_KEY',
  'get-driver-checkins': 'DRIVER_API_KEY',
  'get-driver-sop': 'FREELANCE_DRIVER_API_KEY',
  'report-problem': 'EXPRESS_RENT_API_KEY',
  'transport-expenses': 'EXPRESS_RENT_API_KEY',
  'receive-pod': 'DRIVER_API_KEY',
  'update-order-status': 'EXPRESS_RENT_API_KEY',
  'get-freelance-accepted-jobs': 'EXPRESS_RENT_API_KEY',
  'accept-express-rent-job': 'EXPRESS_RENT_API_KEY',
  'get-factory-assigned-jobs': 'EXPRESS_RENT_API_KEY',
  'list-tickets': 'EXPRESS_RENT_API_KEY',
  'get-express-rent-posts': 'EXPRESS_RENT_API_KEY',
  'update-freelance-driver': 'EXPRESS_RENT_API_KEY',
  'get-ocr-container-scans': 'EXPRESS_RENT_API_KEY',
  'save-ocr-scan': 'EXPRESS_RENT_API_KEY',
  'ocr-extra': 'EXPRESS_RENT_API_KEY',
  'update-destination-coordinates': 'EXPRESS_RENT_API_KEY',
  'submit-accident-evidence': 'EXPRESS_RENT_API_KEY',
  'check-driver-phone': 'DRIVER_API_KEY',
  'update-driver-password': 'DRIVER_API_KEY',
  'call-signal': 'DRIVER_API_KEY',
  'zegocloud-token': 'DRIVER_API_KEY',
};

// Endpoints that should use the bidding API URL
const BIDDING_ENDPOINTS = ['list-tickets', 'create-bid', 'submit-price-hint'];

// Bidding API key (same as used for list-tickets)
const BIDDING_API_KEY = 'fld_sk_2026_zCahKRlHLyDpIwAwDlXh_live';

// Get API key for endpoint
function getApiKeyForEndpoint(endpoint: string): string {
  // Bidding endpoints use a different API key
  if (BIDDING_ENDPOINTS.includes(endpoint)) {
    return BIDDING_API_KEY;
  }
  const keyName = ENDPOINT_API_KEY_MAP[endpoint];
  if (keyName) {
    return API_KEYS[keyName];
  }
  return API_KEYS.EXPRESS_RENT_API_KEY;
}

// In-flight GET dedupe + per-endpoint cooldown after 503/429
const inflightGets = new Map<string, Promise<{ data: any; error: string | null }>>();
const cooldownUntil = new Map<string, number>(); // key: endpoint -> epoch ms
// ETag cache for HTTP caching (304 Not Modified)
const etagCache = new Map<string, { etag: string; data: any }>();

function parseRetryAfter(value: string | null): number {
  if (!value) return 0;
  const n = Number(value);
  if (Number.isFinite(n)) return Math.max(0, n * 1000);
  const t = Date.parse(value);
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : 0;
}

// Helper function for external API calls
export async function callExternalApi<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    params?: Record<string, string>;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<{ data: T | null; error: string | null }> {
  const { method = 'GET', params, body, headers = {} } = options;

  // Determine URL
  const baseUrl = BIDDING_ENDPOINTS.includes(endpoint) ? BIDDING_API_URL : EXTERNAL_API_URL;
  let url = `${baseUrl}/${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  // Per-endpoint cooldown — short-circuit while server is degraded
  const cdUntil = cooldownUntil.get(endpoint) || 0;
  if (method === 'GET' && Date.now() < cdUntil) {
    const remaining = Math.round((cdUntil - Date.now()) / 1000);
    console.warn(`[ExternalAPI] ${endpoint} in cooldown (${remaining}s left), skipping`);
    return { data: null, error: `cooldown:${remaining}s` };
  }

  // GET request dedupe
  if (method === 'GET') {
    const existing = inflightGets.get(url);
    if (existing) {
      console.log(`[ExternalAPI] Dedupe in-flight GET ${endpoint}`);
      return existing as Promise<{ data: T | null; error: string | null }>;
    }
  }

  const exec = async (): Promise<{ data: T | null; error: string | null }> => {
    try {
      const apiKey = getApiKeyForEndpoint(endpoint);
      const baseHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        ...headers,
      };
      // Conditional GET via cached ETag
      if (method === 'GET') {
        const cached = etagCache.get(url);
        if (cached?.etag) baseHeaders['If-None-Match'] = cached.etag;
      }

      const fetchOptions: RequestInit = { method, headers: baseHeaders };
      if (body && method !== 'GET') fetchOptions.body = JSON.stringify(body);

      console.log(`[ExternalAPI] ${method} ${endpoint}`, params || body || '');

      const MAX_RETRIES = 3;
      let lastError = '';

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            // Longer exponential backoff for transient errors
            const delay = 1500 * Math.pow(2, attempt - 1); // 1.5s, 3s, 6s
            console.log(`[ExternalAPI] Retry ${attempt}/${MAX_RETRIES} for ${endpoint} after ${delay}ms`);
            await new Promise(r => setTimeout(r, delay));
          }

          const response = await fetch(url, fetchOptions);

          // 304 — cache hit
          if (response.status === 304 && method === 'GET') {
            const cached = etagCache.get(url);
            if (cached) {
              console.log(`[ExternalAPI] 304 cache hit ${endpoint}`);
              return { data: cached.data, error: null };
            }
          }

          if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 503) {
              console.warn(`[ExternalAPI] 503 transient (attempt ${attempt + 1}) on ${endpoint}`);
            } else {
              console.error(`[ExternalAPI] Error ${response.status}:`, errorText);
            }
            let errorMessage = `API Error: ${response.status}`;
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.message) errorMessage = errorJson.message;
              else if (errorJson.error) errorMessage = errorJson.error;
            } catch {}

            // Honor Retry-After: stop retrying and apply cooldown
            const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'));
            if (response.status === 503 || response.status === 429) {
              if (retryAfterMs > 0) {
                // Cap cooldown at 5 minutes to recover sooner if server comes back
                const cd = Math.min(retryAfterMs, 5 * 60 * 1000);
                cooldownUntil.set(endpoint, Date.now() + cd);
                console.warn(`[ExternalAPI] ${endpoint} cooldown for ${Math.round(cd / 1000)}s (Retry-After)`);
                let errorData: any = null;
                try { errorData = JSON.parse(errorText); } catch {}
                return { data: errorData as T, error: errorMessage };
              }
            }

            // Don't retry on 4xx client errors
            if (response.status >= 400 && response.status < 500) {
              let errorData: any = null;
              try { errorData = JSON.parse(errorText); } catch {}
              return { data: errorData as T, error: errorMessage };
            }
            lastError = errorMessage;
            continue;
          }

          const data = await response.json();
          // Cache ETag
          if (method === 'GET') {
            const etag = response.headers.get('ETag');
            if (etag) etagCache.set(url, { etag, data });
          }
          console.log(`[ExternalAPI] Success:`, endpoint, data?.data?.length || 'N/A', 'items');
          return { data, error: null };
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Unknown error';
          console.error(`[ExternalAPI] Fetch error (attempt ${attempt}):`, lastError);
        }
      }

      // All retries failed — apply short cooldown to back off
      if (method === 'GET') {
        cooldownUntil.set(endpoint, Date.now() + 30_000);
      }
      console.error(`[ExternalAPI] All retries exhausted for ${endpoint}`);
      return { data: null, error: lastError };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[ExternalAPI] Fetch error:`, errorMessage);
      return { data: null, error: errorMessage };
    }
  };

  if (method === 'GET') {
    const p = exec().finally(() => inflightGets.delete(url));
    inflightGets.set(url, p);
    return p as Promise<{ data: T | null; error: string | null }>;
  }
  return exec();
}

// ==================== Auth APIs ====================

export async function login(username: string, password: string) {
  return callExternalApi<{ 
    success: boolean; 
    data?: { 
      driver: any; 
      vehicle: any; 
      user_type: string; 
      api_key: string;
    }; 
    error?: string;
  }>('login', {
    method: 'POST',
    body: { username, password },
  });
}

export async function logout(driverId: string) {
  return callExternalApi<{ success: boolean }>('logout', {
    method: 'POST',
    body: { driver_id: driverId },
  });
}

// ==================== Driver Check-in APIs ====================

export async function driverCheckin(body: {
  order_id?: string;
  order_number?: string;
  driver_id: string;
  driver_type: 'internal' | 'external' | 'freelance';
  checkin_type: string;
  latitude?: number;
  longitude?: number;
  photo_url?: string;
  photo_urls?: string[];
  notes?: string;
  container_number?: string;
  seal_number?: string;
  container_number_2?: string;
  seal_number_2?: string;
  destination_sequence_number?: number;
  payment_method?: string;
}) {
  // Map driver_id to the correct field based on driver_type
  const { driver_id, driver_type, container_number, seal_number, container_number_2, seal_number_2, ...restBody } = body;
  
  const requestBody: Record<string, unknown> = {
    ...restBody,
    driver_type,
    // Map to correct column names: container_no / seal_no
    ...(container_number && { container_no: container_number }),
    ...(seal_number && { seal_no: seal_number }),
    ...(container_number_2 && { container_no_2: container_number_2 }),
    ...(seal_number_2 && { seal_no_2: seal_number_2 }),
  };
  
  // Set the appropriate driver ID field based on driver type
  if (driver_type === 'internal') {
    requestBody.internal_driver_id = driver_id;
  } else if (driver_type === 'external') {
    requestBody.external_driver_id = driver_id;
  } else {
    requestBody.freelance_driver_id = driver_id;
  }
  
  return callExternalApi<{ success: boolean; data?: any }>('driver-checkin', {
    method: 'POST',
    body: requestBody,
  });
}

export async function getDriverCheckins(
  driverId: string,
  driverType: 'internal' | 'external' | 'freelance',
  orderNumber = 'all',
  options?: { allDrivers?: boolean; limit?: number }
) {
  const params: Record<string, string> = {
    order_number: orderNumber,
    limit: String(options?.limit ?? 20000),
  };

  // When allDrivers=true, fetch all checkins for this order regardless of driver
  // (needed for job-transfer scenarios where previous drivers' PODs must be visible)
  if (!options?.allDrivers) {
    if (driverType === 'internal') {
      params.internal_driver_id = driverId;
    } else if (driverType === 'external') {
      params.external_driver_id = driverId;
    } else {
      params.freelance_driver_id = driverId;
    }
    params.driver_type = driverType;
  }

  return callExternalApi<{ data: any[] }>('get-driver-checkins', {
    params,
  });
}

// ==================== Driver SOP APIs ====================

export async function driverSop(body: {
  order_number?: string;
  ticket_number?: string;
  driver_id: string;
  driver_type: 'internal' | 'external' | 'freelance';
  sop_type: string;
  product_images: string[];
  document_images: string[];
  notes?: string;
  weight_in?: number;
  weight_out?: number;
  net_weight?: number;
}) {
  // Map driver_id to the correct field based on driver_type
  const { driver_id, driver_type, sop_type, ...restBody } = body;
  
  const requestBody: Record<string, unknown> = {
    ...restBody,
    driver_type,
    // External API requires 'status' field instead of 'sop_type'
    status: sop_type,
  };
  
  // Set the appropriate driver ID field based on driver type
  if (driver_type === 'internal') {
    requestBody.internal_driver_id = driver_id;
  } else if (driver_type === 'external') {
    requestBody.external_driver_id = driver_id;
  } else {
    requestBody.freelance_driver_id = driver_id;
  }
  
  return callExternalApi<{ success: boolean; data?: any }>('driver-sop', {
    method: 'POST',
    body: requestBody,
  });
}

export async function getDriverSop(
  driverId: string,
  driverType: 'internal' | 'external' | 'freelance',
  orderNumber?: string
) {
  const params: Record<string, string> = {};
  
  if (driverType === 'internal') {
    params.internal_driver_id = driverId;
  } else if (driverType === 'external') {
    params.external_driver_id = driverId;
  } else {
    params.freelance_driver_id = driverId;
  }
  
  if (orderNumber) {
    params.order_number = orderNumber;
  }
  
  return callExternalApi<{ data: any[] }>('get-driver-sop', {
    params,
  });
}

// ==================== Job APIs ====================

// ---- Coalesce concurrent get-driver-assigned-jobs calls ----
// Merges concurrent requests for the same driver (within a short window) into a
// single API call with the union of statuses, then filters client-side per caller.
// This avoids 2-3x duplicate calls per polling cycle (e.g. Home + CurrentJobs +
// JobDetail mounting at once with different status filters).
type _AssignedJobsBatch = {
  statuses: Set<string>;
  limit: number;
  promise: Promise<{ data: { data: any[] } | null; error: any }>;
  resolve: (v: { data: { data: any[] } | null; error: any }) => void;
  timer: ReturnType<typeof setTimeout> | null;
};
const _assignedJobsBatches = new Map<string, _AssignedJobsBatch>();
const _ASSIGNED_JOBS_COALESCE_MS = 150; // small window to gather concurrent callers

export async function getDriverAssignedJobs(driverId: string, driverType: 'internal' | 'external', limit = 50, status: string = 'in_progress') {
  const requestedStatuses = String(status || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const key = `${driverType}:${driverId}`;

  const existing = _assignedJobsBatches.get(key);
  const batch: _AssignedJobsBatch = existing ?? (() => {
    let resolveFn!: (v: { data: { data: any[] } | null; error: any }) => void;
    const promise = new Promise<{ data: { data: any[] } | null; error: any }>(res => { resolveFn = res; });
    const b: _AssignedJobsBatch = {
      statuses: new Set(),
      limit,
      promise,
      resolve: resolveFn,
      timer: null,
    };
    _assignedJobsBatches.set(key, b);
    return b;
  })();

  requestedStatuses.forEach(s => batch.statuses.add(s));
  batch.limit = Math.max(batch.limit, limit);

  if (batch.timer) clearTimeout(batch.timer);
  batch.timer = setTimeout(async () => {
    _assignedJobsBatches.delete(key);
    const mergedStatus = Array.from(batch.statuses).join(',') || 'in_progress';
    const result = await callExternalApi<{ data: any[] }>('get-driver-assigned-jobs', {
      params: {
        driver_id: driverId,
        driver_type: driverType,
        status: mergedStatus,
        limit: String(batch.limit),
      },
    });
    batch.resolve(result as any);
  }, _ASSIGNED_JOBS_COALESCE_MS);

  const merged = await batch.promise;
  if (merged.error || !merged.data) return merged as any;

  // Filter to only the statuses this caller asked for
  const all = (merged.data as any)?.data || [];
  const wanted = new Set(requestedStatuses);
  const filtered = wanted.size === 0
    ? all
    : all.filter((j: any) => wanted.has(String(j?.status || '').trim()));

  return { data: { ...(merged.data as any), data: filtered }, error: null } as any;
}

export async function getFactoryAssignedJobs(freelanceDriverId: string, limit = 50) {
  return callExternalApi<{ data: any[] }>('get-factory-assigned-jobs', {
    params: {
      freelance_driver_id: freelanceDriverId,
      limit: String(limit),
    },
  });
}

export async function getFreelanceAcceptedJobs(freelanceDriverId: string, limit = 1000) {
  return callExternalApi<{ data: any[] }>('get-freelance-accepted-jobs', {
    params: {
      freelance_driver_id: freelanceDriverId,
      limit: String(limit),
    },
  });
}

// Accept an express rent job (direct external API call)
export async function acceptExpressRentJob(body: {
  order_number: string;
  post_id: string;
  freelance_driver_id: string;
  freelance_driver_name: string;
  driver_phone: string;
  license_plate: string;
  vehicle_type: string;
  vehicle_brand: string;
}) {
  return callExternalApi<{ success: boolean; data?: any }>('accept-express-rent-job', {
    method: 'POST',
    body,
  });
}

// Legacy function for ticket-based acceptance (if still needed)
export async function acceptExpressRentJobByTicket(body: {
  ticket_id: string;
  freelance_driver_id: string;
  accepted: boolean;
}) {
  return callExternalApi<{ success: boolean }>('accept-express-rent-job', {
    method: 'POST',
    body,
  });
}

export async function updateOrderStatus(body: {
  order_id?: string;
  order_number?: string;
  status: string;
  driver_id: string;
  driver_type: 'internal' | 'external' | 'freelance';
  notes?: string;
}) {
  return callExternalApi<{ success: boolean }>('update-order-status', {
    method: 'POST',
    body,
  });
}

// ==================== Ticket/Bidding APIs ====================

export async function getExpressRentPosts() {
  return callExternalApi<any[]>('get-express-rent-posts', {
    method: 'POST',
    body: {},
  });
}

export async function listTickets(options: {
  freelanceDriverId?: string;
  bidsStatus?: string;
  status?: string;
  createdByRole?: string;
  limit?: number;
} = {}) {
  const body: Record<string, unknown> = {};

  if (options.freelanceDriverId) body.freelance_driver_id = options.freelanceDriverId;
  if (options.bidsStatus) body.bids_status = options.bidsStatus;
  if (options.status) body.status = options.status;
  if (options.createdByRole) body.created_by_role = options.createdByRole;
  if (options.limit) body.limit = options.limit;

  try {
    console.log('[Bidding] invoke list-tickets', body);

    // Call via backend function so the API key stays server-side
    const { data, error } = await supabase.functions.invoke('list-tickets', {
      body,
    });

    if (error) {
      console.error('[Bidding] list-tickets error:', error);
      return { data: null, error: error.message };
    }

    return { data: data as any, error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Bidding] list-tickets exception:', errorMessage);
    return { data: null, error: errorMessage };
  }
}

// Create a bid for a ticket (via internal proxy edge function)
export async function createBid(body: {
  ticket_id: string;
  contractor_id: string;
  bid_price: number;
  payment_transaction_id: string;
  payment_slip_base64: string;
  freelancer_email?: string;
  freelancer_name?: string;
  freelancer_phone?: string;
}) {
  try {
    const { data, error } = await supabase.functions.invoke('create-bid', {
      body,
    });

    if (error) {
      console.error('[createBid] Edge function error:', error);
      return { data: null, error: error.message || 'Failed to create bid' };
    }

    return { data, error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[createBid] Error:', errorMessage);
    return { data: null, error: errorMessage };
  }
}

// ==================== Report Problem APIs ====================

export async function reportProblem(body: {
  order_number: string;
  driver_id: string;
  driver_type: 'internal' | 'external' | 'freelance';
  problem_type: string;
  reason?: string;
  photo_url?: string;
  latitude?: number;
  longitude?: number;
}) {
  return callExternalApi<{ success: boolean }>('report-problem', {
    method: 'POST',
    body,
  });
}

export async function getReportProblems(orderNumber: string) {
  return callExternalApi<{ data: any[] }>('report-problem', {
    params: { order_number: orderNumber },
  });
}

// ==================== Expense APIs ====================

export async function addExpense(body: {
  order_number: string;
  driver_id: string;
  driver_type: 'internal' | 'external' | 'freelance';
  expense_type: string;
  amount: number;
  receipt_photo_url?: string;
  receipt_photo_urls?: string[];
  notes?: string;
  ocr_data?: any;
  expense_id?: string;
}) {
  return callExternalApi<{ success: boolean; data?: any }>('transport-expenses', {
    method: 'POST',
    body,
  });
}

export async function getExpenses(orderNumber: string, driverId: string, driverType?: string) {
  const params: Record<string, string> = {
    order_number: orderNumber,
    driver_id: driverId,
  };
  
  if (driverType) {
    params.driver_type = driverType;
  }
  
  return callExternalApi<any>('transport-expenses', {
    method: 'GET',
    params,
  });
}

export async function deleteExpense(expenseId: string) {
  return callExternalApi<{ success: boolean; data?: any }>('transport-expenses', {
    method: 'DELETE',
    body: { expense_id: expenseId },
  });
}

// ==================== POD APIs ====================

export async function receivePod(body: {
  order_number: string;
  driver_id: string;
  driver_type: 'internal' | 'external' | 'freelance';
  signature_url?: string;
  pod_images?: string[];
  notes?: string;
}) {
  return callExternalApi<{ success: boolean }>('receive-pod', {
    method: 'POST',
    body,
  });
}

// ==================== OCR Container Scans APIs ====================

export async function getOcrContainerScans(containerNo?: string, limit = 10, orderNumber?: string) {
  const params: Record<string, string> = {
    limit: String(limit),
  };
  if (containerNo) params.container_no = containerNo;
  if (orderNumber) params.order_number = orderNumber;
  
  return callExternalApi<{ data: any[] }>('get-ocr-container-scans', {
    params,
  });
}

// Verify container/seal via ocr-extra (read-only check)
export async function verifyOcrContainer(body: {
  container_no: string;
  seal_no: string;
  order_number?: string;
  driver_id?: string;
  driver_type?: 'internal' | 'external' | 'freelance';
}) {
  return callExternalApi<{ success: boolean; data?: any; error?: string }>('ocr-extra', {
    method: 'POST',
    body,
  });
}

// Submit OCR scan result to external system (saves to DB)
export async function submitOcrScan(body: {
  container_no?: string;
  seal_no?: string | null;
  container_image_url?: string;
  seal_image_url?: string;
  eir_photos?: string[];
  container_photos?: string[];
  order_number?: string;
  driver_id?: string;
  driver_type?: 'internal' | 'external' | 'freelance';
  scanned_at?: string;
  return_yard?: string;
  bl_no?: string | null;
  booking_no?: string | null;
}) {
  return callExternalApi<{ success: boolean; data?: any }>('save-ocr-scan', {
    method: 'POST',
    body,
  });
}

// ==================== Driver Update APIs ====================

export async function updateFreelanceDriver(body: {
  driver_id: string;
  driver_type: 'internal' | 'external' | 'freelance';
  first_name?: string;
  last_name?: string;
  phone?: string;
  license_plate?: string;
  car_brand?: string;
  car_model?: string;
  vehicle_type?: string;
  fuel_type?: string;
  manufacturing_year?: number;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  profile_photo_url?: string;
  avatar_url?: string;
}) {
  // Map driver_id based on driver_type
  const { driver_id, driver_type, profile_photo_url, ...restBody } = body;
  
  const requestBody: Record<string, unknown> = {
    ...restBody,
    driver_type,
  };
  
  // Internal drivers use avatar_url column, freelance uses profile_photo_url
  if (profile_photo_url) {
    if (driver_type === 'internal') {
      requestBody.avatar_url = profile_photo_url;
    } else {
      requestBody.profile_photo_url = profile_photo_url;
    }
  }
  
  // Internal uses internal_driver_id, freelance uses driver_id
  if (driver_type === 'internal') {
    requestBody.internal_driver_id = driver_id;
  } else if (driver_type === 'external') {
    requestBody.external_driver_id = driver_id;
  } else {
    requestBody.driver_id = driver_id;
  }
  
  return callExternalApi<{ 
    success: boolean; 
    message?: string;
    data?: { driver: any };
  }>('update-freelance-driver', {
    method: 'PUT',
    body: requestBody,
  });
}

// ==================== Phone Check APIs ====================

export async function checkDriverPhone(phone: string) {
  return callExternalApi<{ success: boolean; exists: boolean; data?: any; error?: string }>('check-driver-phone', {
    method: 'POST',
    body: { phone },
  });
}

// ==================== Password APIs ====================

export async function updateDriverPassword(body: {
  driver_id: string;
  driver_type: string;
  new_password: string;
}) {
  console.log('[updateDriverPassword] Sending:', JSON.stringify(body));
  
  return callExternalApi<{ success: boolean; message?: string; error?: string }>('update-driver-password', {
    method: 'PUT',
    body,
  });
}

// ==================== Destination Coordinate APIs ====================

export async function updateDestinationCoordinates(body: {
  destination_id: string;
  latitude: number;
  longitude: number;
}) {
  return callExternalApi<{ success: boolean; message?: string }>('update-destination-coordinates', {
    method: 'POST',
    body,
  });
}

// ==================== Accident Evidence APIs ====================

export async function submitAccidentEvidence(body: {
  order_id?: string;
  order_number?: string;
  photo_urls: string[];
  notes?: string;
  latitude?: number;
  longitude?: number;
}) {
  return callExternalApi<{
    success: boolean;
    message?: string;
    error?: string;
    code?: 'NO_PHOTOS' | 'EVIDENCE_NOT_REQUIRED';
    data?: { photo_urls: string[]; requires_accident_evidence: boolean };
  }>('submit-accident-evidence', {
    method: 'POST',
    body,
  });
}
