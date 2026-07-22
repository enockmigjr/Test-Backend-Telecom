export interface NormalizedPagination {
  page: number;
  limit: number;
}

export function normalizePagination(page = 1, limit = 20): NormalizedPagination {
  const normalizedPage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  const normalizedLimit = Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.trunc(limit))) : 20;
  return { page: normalizedPage, limit: normalizedLimit };
}
