# Shared Utilities

This folder contains shared utilities, helpers, and common code used across all Lambda functions in the QuickSight RLS Manager application. By centralizing common functionality, we ensure consistency, reduce code duplication, and simplify maintenance.

## 📁 Folder Structure

```
_shared/
├── clients/           # AWS SDK client factories
│   ├── glue.ts       # AWS Glue client
│   ├── quicksight.ts # AWS QuickSight client
│   └── s3.ts         # AWS S3 client
├── errors/           # Error handling utilities
│   ├── error-handler.ts  # Centralized error handling
│   └── error-mapper.ts   # Error to HTTP status code mapping
├── utils/            # General utilities
│   ├── amplify-config.ts # Amplify initialization
│   ├── logger.ts         # Structured logging
│   ├── response.ts       # Response formatting
│   └── validation.ts     # Input validation
├── index.ts          # Main export file (import from here)
└── README.md         # This file
```

## 🚀 Quick Start

Import everything you need from the main index file:

```typescript
import { 
  createLogger,
  initializeAmplify,
  validateRequired,
  getS3Client,
  handleError
} from '../_shared';
```

## 📦 Components

### 1. AWS Client Factories (`clients/`)

Provides singleton AWS SDK clients with connection pooling and regional support.

#### S3 Client (`clients/s3.ts`)

```typescript
import { getS3Client } from '../_shared/clients/s3';

const s3Client = getS3Client('eu-west-1');
const response = await s3Client.send(new PutObjectCommand({...}));
```

**Features**:
- Regional client caching
- Automatic connection pooling
- Reuses clients across invocations

#### Glue Client (`clients/glue.ts`)

```typescript
import { getGlueClient } from '../_shared/clients/glue';

const glueClient = getGlueClient('us-east-1');
const response = await glueClient.send(new GetDatabaseCommand({...}));
```

#### QuickSight Client (`clients/quicksight.ts`)

```typescript
import { getQuickSightClient } from '../_shared/clients/quicksight';

const qsClient = getQuickSightClient('us-east-1');
const response = await qsClient.send(new ListDataSetsCommand({...}));
```

### 2. Error Handling (`errors/`)

Centralized error handling and HTTP status code mapping.

#### Error Handler (`errors/error-handler.ts`)

```typescript
import { handleError } from '../_shared/errors/error-handler';

try {
  // Your code
} catch (error) {
  return handleError(error, 'functionName', 'Operation failed');
}
```

**Features**:
- Automatic error logging
- HTTP status code mapping
- Consistent error response format
- Error type detection

#### Error Mapper (`errors/error-mapper.ts`)

Maps AWS SDK errors to appropriate HTTP status codes:

```typescript
import { mapErrorToStatusCode } from '../_shared/errors/error-mapper';

const statusCode = mapErrorToStatusCode(error);
// Returns: 400, 403, 404, 429, 500, etc.
```

**Supported Error Mappings**:
- `ValidationError` → 400
- `AccessDeniedException` → 403
- `ResourceNotFoundException` → 404
- `ThrottlingException` → 429
- `InternalFailureException` → 500
- And many more...

### 3. Utilities (`utils/`)

General-purpose utilities for common tasks.

#### Logger (`utils/logger.ts`)

Structured logging with levels and context:

```typescript
import { createLogger, LogLevel } from '../_shared/utils/logger';

const logger = createLogger('myFunction');

logger.info('Operation started', { userId: '123' });
logger.debug('Debug information', { data: {...} });
logger.warn('Warning message');
logger.error('Error occurred', error);
```

**Features**:
- Structured JSON logging
- Log levels: DEBUG, INFO, WARN, ERROR
- Automatic timestamps
- Context preservation
- Environment-based log level control

**Environment Variables**:
- `LOG_LEVEL`: Set minimum log level (DEBUG, INFO, WARN, ERROR)

#### Validation (`utils/validation.ts`)

Input validation helpers:

```typescript
import { validateRequired, validateArray, ValidationError } from '../_shared/utils/validation';

// Validate required fields
validateRequired(accountId, 'accountId');
validateRequired(region, 'region');

// Validate arrays
validateArray(csvColumns, 'csvColumns', 1);

// Validate environment variables
validateEnvironmentVariables({
  ACCOUNT_ID: env.ACCOUNT_ID,
  API_KEY: env.API_KEY
});
```

**Features**:
- Required field validation
- Array validation with minimum length
- Environment variable validation
- Custom ValidationError type

#### Response Helpers (`utils/response.ts`)

Consistent response formatting:

```typescript
import { successResponse, errorResponse } from '../_shared/utils/response';

// Success response
return successResponse('Operation completed successfully', { data: result });

// Error response
return errorResponse('Operation failed', 500, 'InternalError');
```

#### Amplify Config (`utils/amplify-config.ts`)

Amplify initialization helper:

```typescript
import { initializeAmplify } from '../_shared/utils/amplify-config';

await initializeAmplify(env);
```

**Features**:
- Configures Amplify backend
- Sets up authentication
- Initializes data client

## 🎯 Usage Patterns

### Standard Lambda Function Pattern

```typescript
import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/myFunction';

import { 
  initializeAmplify,
  createLogger,
  validateRequired,
  getS3Client,
  handleError
} from '../_shared';

const FUNCTION_NAME = 'myFunction';

export const handler: Schema["myFunction"]["functionHandler"] = async (event) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    // Initialize Amplify
    await initializeAmplify(env);
    
    // Validate inputs
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');
    
    const region = event.arguments.region;
    
    logger.info('Starting operation', { region });
    
    // Get AWS client
    const s3Client = getS3Client(region);
    
    // Your business logic here
    const result = await s3Client.send(command);
    
    logger.info('Operation completed successfully');
    
    return {
      statusCode: 200,
      message: 'Success'
    };
    
  } catch (error) {
    return handleError(error, FUNCTION_NAME, 'Operation failed');
  }
};
```

## 🔧 Best Practices

### 1. Always Use Shared Utilities

❌ **Don't**:
```typescript
// Creating clients directly
const s3 = new S3Client({ region: 'us-east-1' });

// Manual error handling
catch (error) {
  console.error(error);
  return { statusCode: 500, message: 'Error' };
}
```

✅ **Do**:
```typescript
// Use shared client factory
const s3Client = getS3Client('us-east-1');

// Use shared error handler
catch (error) {
  return handleError(error, FUNCTION_NAME, 'Operation failed');
}
```

### 2. Use Structured Logging

❌ **Don't**:
```typescript
console.log('User ID:', userId);
console.log('Processing...');
```

✅ **Do**:
```typescript
const logger = createLogger('myFunction');
logger.info('Processing user request', { userId });
```

### 3. Validate All Inputs

❌ **Don't**:
```typescript
const region = event.arguments.region;
// Use region without validation
```

✅ **Do**:
```typescript
validateRequired(event.arguments.region, 'region');
const region = event.arguments.region;
```

### 4. Import from Index

❌ **Don't**:
```typescript
import { createLogger } from '../_shared/utils/logger';
import { getS3Client } from '../_shared/clients/s3';
```

✅ **Do**:
```typescript
import { createLogger, getS3Client } from '../_shared';
```

## 📊 Benefits

### Code Reusability
- Write once, use everywhere
- Consistent behavior across functions
- Easier to maintain and update

### Performance
- Client connection pooling
- Reduced cold start times
- Efficient resource usage

### Maintainability
- Centralized updates
- Single source of truth
- Easier debugging

### Consistency
- Uniform error handling
- Standardized logging
- Consistent response formats

## 🔍 Testing

When testing functions that use shared utilities:

```typescript
import { createLogger, validateRequired } from '../_shared';

describe('myFunction', () => {
  it('should validate required fields', () => {
    expect(() => validateRequired(null, 'field')).toThrow('Missing required field: field');
  });
  
  it('should create logger', () => {
    const logger = createLogger('test');
    expect(logger).toBeDefined();
  });
});
```

## 📝 Adding New Shared Utilities

When adding new shared utilities:

1. **Create the utility file** in the appropriate subfolder
2. **Export from index.ts**:
   ```typescript
   export { myNewUtility } from './utils/my-utility';
   ```
3. **Document in this README**
4. **Add tests** if applicable
5. **Update existing functions** to use the new utility

## 🚫 What NOT to Put Here

- Function-specific business logic
- Hard-coded configuration values
- Large data files or assets
- Function-specific types (put in function folder)

## 📚 Related Documentation

- [Lambda Function Template](/amplify/functions/README-TEMPLATE.md)
- [Error Handling Guide](/Guide/error-handling.md)
- [Logging Best Practices](/Guide/logging.md)
- [AWS SDK Best Practices](/Guide/aws-sdk.md)

## 🔄 Version History

- **v1.0** - Initial shared utilities structure
- **v1.1** - Added error handling utilities
- **v1.2** - Enhanced logging with structured output
- **v2.0** - Refactored to use centralized exports

---

**Note**: This folder is shared across all Lambda functions. Changes here affect all functions, so test thoroughly before deploying.
