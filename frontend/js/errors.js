// Errors follow the shape of the future REST API:
// { status, message, errors: [{ field, message }] }
export class ApiError extends Error {
  constructor(status, message, errors = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
  toJSON() {
    return { status: this.status, message: this.message, errors: this.errors };
  }
}
export const badRequest = (errors, message = 'Validation failed') => new ApiError(400, message, errors);
export const notFound = (message) => new ApiError(404, message, []);
export const conflict = (message, errors = []) => new ApiError(409, message, errors);
