export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginationResult {
  skip: number
  take: number
  page: number
  limit: number
}

export function parsePagination(params: PaginationParams): PaginationResult {
  const page = Math.max(1, Number(params.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 20))
  return { skip: (page - 1) * limit, take: limit, page, limit }
}

export function buildPaginationMeta(total: number, page: number, limit: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }
}
