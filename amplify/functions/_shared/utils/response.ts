/**
 * Standardized response builder for Lambda functions
 */

interface SuccessResponse {
  statusCode: number;
  message: string;
  [key: string]: any;
}

interface ErrorResponse {
  statusCode: number;
  message: string;
  errorType?: string;
  errorMessage?: string;
  errorName?: string;
}

export function successResponse(
  message: string, 
  statusCode: number = 200, 
  additionalData?: Record<string, any>
): SuccessResponse {
  return {
    statusCode,
    message,
    ...additionalData
  };
}

export function errorResponse(
  message: string,
  statusCode: number = 500,
  error?: Error | any
): ErrorResponse {
  const response: ErrorResponse = {
    statusCode,
    message
  };

  if (error instanceof Error) {
    response.errorName = error.name;
    response.errorMessage = error.message;
    response.errorType = error.name;
  } else if (error) {
    response.errorType = typeof error === 'string' ? error : 'UnknownError';
  }

  return response;
}
