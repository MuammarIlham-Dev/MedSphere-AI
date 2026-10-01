export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface PostgrestLike<T> { data: T | null; error: { code?: string; message: string; details?: unknown } | null }

export async function unwrap<T>(query: PromiseLike<PostgrestLike<T>>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new ApiError(error.code ?? 'DB_ERROR', error.message, error.details);
  return data as T;
}
