/**
 * Shared utilities index
 * Import everything you need from this single file
 */

// Utils
export { createLogger, LogLevel } from './utils/logger';
export { initializeAmplify } from './utils/amplify-config';
export { validateRequired, validateArray, validateEnvironmentVariables, ValidationError } from './utils/validation';
export { successResponse, errorResponse } from './utils/response';

// Error handling
export { handleError, withErrorHandling } from './errors/error-handler';
export { mapErrorToStatusCode } from './errors/error-mapper';

// AWS Clients
export { getQuickSightClient } from './clients/quicksight';
export { getS3Client } from './clients/s3';
export { getGlueClient } from './clients/glue';
