/**
 * Interface pour les réponses API standardisées.
 * Toutes les réponses HTTP suivent ce format.
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message?: string;
  data: T;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    correlationId: string;
    timestamp: string;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
