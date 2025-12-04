/**
 * Maps AWS SDK errors to HTTP status codes
 */

interface ErrorMapping {
  statusCode: number;
  message?: string;
}

// QuickSight error mappings
const quicksightErrorMap: Record<string, ErrorMapping> = {
  'AccessDeniedException': { statusCode: 403, message: 'Access denied to QuickSight resources' },
  'ResourceNotFoundException': { statusCode: 404, message: 'Resource not found' },
  'ThrottlingException': { statusCode: 429, message: 'Request was throttled' },
  'InvalidParameterValueException': { statusCode: 400, message: 'Invalid parameters provided' },
  'ConflictException': { statusCode: 409, message: 'Resource conflict' },
  'LimitExceededException': { statusCode: 409, message: 'Limit exceeded' },
  'ResourceExistsException': { statusCode: 409, message: 'Resource already exists' },
  'UnsupportedUserEditionException': { statusCode: 403, message: 'Unsupported user edition' },
  'InternalFailureException': { statusCode: 500, message: 'Internal service failure' }
};

// S3 error mappings
const s3ErrorMap: Record<string, ErrorMapping> = {
  'NoSuchBucket': { statusCode: 404, message: 'Bucket not found' },
  'NoSuchKey': { statusCode: 404, message: 'Object not found' },
  'AccessDenied': { statusCode: 403, message: 'Access denied to S3 resource' },
  'EncryptionTypeMismatch': { statusCode: 400, message: 'Encryption type mismatch' },
  'InvalidRequest': { statusCode: 400, message: 'Invalid S3 request' },
  'InvalidWriteOffset': { statusCode: 400, message: 'Invalid write offset' },
  'TooManyParts': { statusCode: 413, message: 'Too many parts in multipart upload' }
};

// Glue error mappings
const glueErrorMap: Record<string, ErrorMapping> = {
  'EntityNotFoundException': { statusCode: 404, message: 'Glue entity not found' },
  'AlreadyExistsException': { statusCode: 409, message: 'Resource already exists' },
  'InvalidInputException': { statusCode: 400, message: 'Invalid input provided' },
  'OperationTimeoutException': { statusCode: 408, message: 'Operation timed out' },
  'InternalServiceException': { statusCode: 500, message: 'Internal Glue service error' },
  'GlueEncryptionException': { statusCode: 500, message: 'Glue encryption error' },
  'ResourceNumberLimitExceededException': { statusCode: 400, message: 'Resource limit exceeded' },
  'ConcurrentModificationException': { statusCode: 409, message: 'Concurrent modification detected' },
  'FederationSourceException': { statusCode: 400, message: 'Federation source error' },
  'FederationSourceRetryableException': { statusCode: 400, message: 'Retryable federation error' },
  'ResourceNotReadyException': { statusCode: 400, message: 'Resource not ready' }
};

// General validation errors
const validationErrorMap: Record<string, ErrorMapping> = {
  'ValidationError': { statusCode: 400, message: 'Validation error' },
  'ReferenceError': { statusCode: 400, message: 'Reference error' }
};

export function mapErrorToStatusCode(error: Error | any): ErrorMapping {
  const errorName = error?.name || 'UnknownError';
  
  // Check specific service error maps
  const mapping = 
    quicksightErrorMap[errorName] ||
    s3ErrorMap[errorName] ||
    glueErrorMap[errorName] ||
    validationErrorMap[errorName];

  if (mapping) {
    return mapping;
  }

  // Check for HTTP status code in metadata (AWS SDK v3)
  if (error?.$metadata?.httpStatusCode) {
    return {
      statusCode: error.$metadata.httpStatusCode,
      message: error.message || 'AWS service error'
    };
  }

  // Default to 500 for unknown errors
  return {
    statusCode: 500,
    message: error?.message || 'An unexpected error occurred'
  };
}
