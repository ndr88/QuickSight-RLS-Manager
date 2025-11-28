/**
 * Input validation utilities
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateRequired(value: any, fieldName: string): void {
  if (value === null || value === undefined || value === '') {
    throw new ValidationError(`Missing required field: ${fieldName}`);
  }
}

export function validateArray(value: any, fieldName: string, minLength: number = 1): void {
  if (!Array.isArray(value) || value.length < minLength) {
    throw new ValidationError(`${fieldName} must be an array with at least ${minLength} item(s)`);
  }
}

export function validateEnvironmentVariables(vars: Record<string, any>): void {
  const missing: string[] = [];
  
  for (const [key, value] of Object.entries(vars)) {
    if (value === null || value === undefined || value === '') {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    throw new ValidationError(`Missing environment variables: ${missing.join(', ')}`);
  }
}
