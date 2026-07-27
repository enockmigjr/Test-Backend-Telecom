export interface NormalizedPagination {
  page: number;
  limit: number;
}

export function normalizePagination(
  page: number | string | undefined = 1,
  limit: number | string | undefined = 20,
): NormalizedPagination {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);
  const normalizedPage = Number.isFinite(parsedPage) ? Math.max(1, Math.trunc(parsedPage)) : 1;
  const normalizedLimit = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, Math.trunc(parsedLimit))) : 20;
  return { page: normalizedPage, limit: normalizedLimit };
}
