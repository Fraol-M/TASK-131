export interface HealthStatus {
  status: 'ok' | 'degraded' | 'unhealthy';
  service: boolean;
  database: boolean;
  tls: boolean;
  checkpointRecoveryPending: boolean;
  version: string;
  checkedAt: Date;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
