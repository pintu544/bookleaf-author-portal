export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function errorBody(err: ApiError) {
  return { error: { code: err.code, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) } };
}
