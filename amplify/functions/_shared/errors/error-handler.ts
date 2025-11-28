/**
 * Centralized error handling for Lambda functions
 */

import { mapErrorToStatusCode } from './error-mapper';
import { errorResponse } from '../utils/response';
import { createLogger } from '../utils/logger';

export function handleError(
  error: Error | any,
  functionName: string,
  customMessage?: string
) {
  const logger = createLogger(functionName);
  const mapping = mapErrorToStatusCode(error);
  
  const message = customMessage || mapping.message || 'An error occurred';
  
  logger.error(message, error);
  
  return errorResponse(message, mapping.statusCode, error);
}

export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  functionName: string,
  errorMessage?: string
): Promise<T | ReturnType<typeof errorResponse>> {
  try {
    return await fn();
  } catch (error) {
    return handleError(error, functionName, errorMessage);
  }
}
