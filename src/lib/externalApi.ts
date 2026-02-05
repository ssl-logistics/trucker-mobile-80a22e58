// External API Configuration
// Direct calls to external Supabase project

export const EXTERNAL_API_URL = 'https://xyfkwewtexnyskbkgsrq.supabase.co/functions/v1';
export const EXTERNAL_API_KEY = 'fld_sk_2026_xY9kWewT3xNySk8kGsRq_live';

// Helper function for external API calls
export async function callExternalApi<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    params?: Record<string, string>;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<{ data: T | null; error: string | null }> {
  const { method = 'GET', params, body, headers = {} } = options;
  
  try {
    // Build URL with query params
    let url = `${EXTERNAL_API_URL}/${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': EXTERNAL_API_KEY,
        ...headers,
      },
    };
    
    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }
    
    console.log(`[ExternalAPI] ${method} ${endpoint}`, params || body || '');
    
    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ExternalAPI] Error ${response.status}:`, errorText);
      return { data: null, error: `API Error: ${response.status}` };
    }
    
    const data = await response.json();
    console.log(`[ExternalAPI] Success:`, endpoint, data?.data?.length || 'N/A', 'items');
    
    return { data, error: null };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[ExternalAPI] Fetch error:`, errorMessage);
    return { data: null, error: errorMessage };
  }
}

// Specific API functions
export async function getDriverAssignedJobs(driverId: string, driverType: 'internal' | 'external', limit = 50) {
  return callExternalApi<{ data: any[] }>('get-driver-assigned-jobs', {
    params: {
      driver_id: driverId,
      driver_type: driverType,
      limit: String(limit),
    },
  });
}

export async function getFactoryAssignedJobs(freelanceDriverId: string, limit = 50) {
  return callExternalApi<{ data: any[] }>('get-factory-assigned-jobs', {
    params: {
      freelance_driver_id: freelanceDriverId,
      limit: String(limit),
    },
  });
}

export async function getFreelanceAcceptedJobs(freelanceDriverId: string) {
  return callExternalApi<{ data: any[] }>('get-freelance-accepted-jobs', {
    params: {
      freelance_driver_id: freelanceDriverId,
    },
  });
}

export async function getDriverCheckins(
  driverId: string, 
  driverType: 'internal' | 'external' | 'freelance',
  orderNumber = 'all'
) {
  const params: Record<string, string> = { order_number: orderNumber };
  
  if (driverType === 'freelance') {
    params.freelance_driver_id = driverId;
  } else {
    params.driver_id = driverId;
    params.driver_type = driverType;
  }
  
  return callExternalApi<{ data: any[] }>('get-driver-checkins', {
    params,
  });
}

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
  
  return callExternalApi<any[]>('list-tickets', {
    method: 'POST',
    body,
  });
}

export async function driverCheckin(body: {
  order_id?: string;
  order_number?: string;
  driver_id: string;
  driver_type: 'internal' | 'external' | 'freelance';
  checkin_type: string;
  latitude?: number;
  longitude?: number;
  photo_url?: string;
  notes?: string;
  container_number?: string;
  seal_number?: string;
  container_number_2?: string;
  seal_number_2?: string;
}) {
  return callExternalApi<{ success: boolean; data?: any }>('driver-checkin', {
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
