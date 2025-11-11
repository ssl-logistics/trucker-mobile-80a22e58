import { toast } from "@/hooks/use-toast";

export interface ApiRequestConfig {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private config: ApiRequestConfig;

  constructor(config: ApiRequestConfig = {}) {
    this.config = {
      timeout: 30000, // 30 seconds default
      ...config,
    };
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('Request timeout', 408);
      }
      throw error;
    }
  }

  private getFullUrl(endpoint: string): string {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    const baseURL = this.config.baseURL || '';
    return `${baseURL}${endpoint}`;
  }

  private getHeaders(customHeaders?: Record<string, string>): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...customHeaders,
    };
  }

  async request<T = any>(
    method: string,
    endpoint: string,
    data?: any,
    options: {
      headers?: Record<string, string>;
      showErrorToast?: boolean;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { headers: customHeaders, showErrorToast = true } = options;

    try {
      const url = this.getFullUrl(endpoint);
      const headers = this.getHeaders(customHeaders);

      const requestOptions: RequestInit = {
        method,
        headers,
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        requestOptions.body = JSON.stringify(data);
      }

      const response = await this.fetchWithTimeout(url, requestOptions);

      let responseData: any;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        throw new ApiError(
          responseData.message || `HTTP Error: ${response.status}`,
          response.status,
          responseData
        );
      }

      return {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      if (showErrorToast) {
        if (error instanceof ApiError) {
          toast({
            title: "API Error",
            description: error.message,
            variant: "destructive",
          });
        } else if (error instanceof Error) {
          toast({
            title: "Network Error",
            description: error.message,
            variant: "destructive",
          });
        }
      }
      throw error;
    }
  }

  async get<T = any>(
    endpoint: string,
    options?: { headers?: Record<string, string>; showErrorToast?: boolean }
  ): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  async post<T = any>(
    endpoint: string,
    data?: any,
    options?: { headers?: Record<string, string>; showErrorToast?: boolean }
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, data, options);
  }

  async put<T = any>(
    endpoint: string,
    data?: any,
    options?: { headers?: Record<string, string>; showErrorToast?: boolean }
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, data, options);
  }

  async patch<T = any>(
    endpoint: string,
    data?: any,
    options?: { headers?: Record<string, string>; showErrorToast?: boolean }
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, data, options);
  }

  async delete<T = any>(
    endpoint: string,
    options?: { headers?: Record<string, string>; showErrorToast?: boolean }
  ): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }

  // Method to update config
  setConfig(config: Partial<ApiRequestConfig>) {
    this.config = { ...this.config, ...config };
  }
}

// Create a default instance
export const api = new ApiClient();

// Export factory function to create custom instances
export const createApiClient = (config: ApiRequestConfig) => {
  return new ApiClient(config);
};

// Example usage:
// 
// import { api, createApiClient } from '@/lib/api';
//
// // Using default instance
// const response = await api.get('/users');
// 
// // Creating custom instance for specific API
// const externalApi = createApiClient({
//   baseURL: 'https://api.example.com',
//   headers: {
//     'Authorization': 'Bearer token123',
//   },
//   timeout: 10000,
// });
// 
// const data = await externalApi.post('/endpoint', { key: 'value' });
