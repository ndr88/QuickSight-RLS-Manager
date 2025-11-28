# publishRLS99QsCheckIngestion

Lambda function that checks the status of a QuickSight DataSet SPICE ingestion operation.

## Overview

This function monitors the progress of SPICE ingestion operations triggered by DataSet creation or updates. It's used to poll for completion when async operations return status 201, ensuring that RLS configurations are fully applied before proceeding.

## Function Details

- **Name**: `publishRLS99QsCheckIngestion`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `datasetRegion` | string | Yes | AWS region where the QuickSight DataSet is located |
| `dataSetId` | string | Yes | ID of the QuickSight DataSet being ingested |
| `ingestionId` | string | Yes | ID of the ingestion operation to check |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Response

### Completed Response (200)

```json
{
  "statusCode": 200,
  "message": "RLS DataSet Correctly Created / Updated."
}
```

### In Progress Response (201)

```json
{
  "statusCode": 201,
  "message": "Still creating dataset..."
}
```

### Failed Response (500)

```json
{
  "statusCode": 500,
  "message": "Error: {error message}",
  "errorType": "QuickSightIngestion_{status}_{errorType}"
}
```

**Error Type Format**: `QuickSightIngestion_FAILED_ErrorType` or `QuickSightIngestion_CANCELLED_ErrorType`

### Generic Error Response

```json
{
  "statusCode": 500,
  "message": "Error creating or Updating QuickSight DataSet. {error message}",
  "errorType": "ErrorName"
}
```

## Ingestion Status Values

The function handles the following QuickSight ingestion statuses:

| Status | Response Code | Description |
|--------|---------------|-------------|
| `COMPLETED` | 200 | Ingestion completed successfully |
| `QUEUED` | 201 | Ingestion is queued and waiting to start |
| `INITIALIZED` | 201 | Ingestion has been initialized |
| `RUNNING` | 201 | Ingestion is currently running |
| `FAILED` | 500 | Ingestion failed with an error |
| `CANCELLED` | 500 | Ingestion was cancelled |

## Usage Example

### GraphQL Query

```graphql
query CheckIngestion {
  publishRLS99QsCheckIngestion(
    datasetRegion: "eu-west-1"
    dataSetId: "RLS-abc-123"
    ingestionId: "ingestion-uuid-here"
  ) {
    statusCode
    message
    errorType
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Check ingestion status
const response = await client.queries.publishRLS99QsCheckIngestion({
  datasetRegion: 'eu-west-1',
  dataSetId: 'RLS-abc-123',
  ingestionId: 'ingestion-uuid-here'
});

if (response.data?.statusCode === 200) {
  console.log('Ingestion completed successfully');
} else if (response.data?.statusCode === 201) {
  console.log('Ingestion still in progress');
} else {
  console.error('Ingestion failed:', response.data?.message);
}
```

### Polling for Completion

```typescript
async function waitForIngestion(
  datasetRegion: string,
  dataSetId: string,
  ingestionId: string,
  maxAttempts: number = 60,
  intervalMs: number = 5000
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await client.queries.publishRLS99QsCheckIngestion({
      datasetRegion,
      dataSetId,
      ingestionId
    });

    if (response.data?.statusCode === 200) {
      console.log('Ingestion completed successfully');
      return true;
    } else if (response.data?.statusCode === 500) {
      console.error('Ingestion failed:', response.data.message);
      return false;
    }

    // Status 201 - still in progress
    console.log(`Attempt ${attempt + 1}/${maxAttempts}: Still in progress...`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Ingestion timeout: exceeded maximum attempts');
}

// Usage
try {
  const success = await waitForIngestion('eu-west-1', 'RLS-abc-123', 'ingestion-id');
  if (success) {
    console.log('Ready to proceed');
  }
} catch (error) {
  console.error('Ingestion monitoring failed:', error);
}
```

### With Exponential Backoff

```typescript
async function waitForIngestionWithBackoff(
  datasetRegion: string,
  dataSetId: string,
  ingestionId: string
): Promise<boolean> {
  let attempt = 0;
  let delay = 2000; // Start with 2 seconds
  const maxDelay = 30000; // Max 30 seconds between checks
  const maxAttempts = 40;

  while (attempt < maxAttempts) {
    const response = await client.queries.publishRLS99QsCheckIngestion({
      datasetRegion,
      dataSetId,
      ingestionId
    });

    if (response.data?.statusCode === 200) {
      return true;
    } else if (response.data?.statusCode === 500) {
      throw new Error(`Ingestion failed: ${response.data.message}`);
    }

    // Exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, maxDelay);
    attempt++;
  }

  throw new Error('Ingestion timeout');
}
```

## Ingestion Error Information

When an ingestion fails (status 500), the error message includes:
- **Error Message**: Description from `IngestionErrorInfo.Message`
- **Error Type**: Type from `IngestionErrorInfo.Type`
- **Status**: Either `FAILED` or `CANCELLED`

Common error types:
- `SOURCE_NOT_FOUND`: Data source or table not found
- `DATA_SET_NOT_SPICE`: DataSet is not configured for SPICE
- `SPICE_CAPACITY_EXCEEDED`: Insufficient SPICE capacity
- `PERMISSION_DENIED`: Insufficient permissions to access data
- `INVALID_DATA`: Data format or schema issues

## IAM Permissions Required

The Lambda execution role needs the following QuickSight permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "quicksight:DescribeIngestion"
      ],
      "Resource": "arn:aws:quicksight:*:*:dataset/*/ingestion/*"
    }
  ]
}
```

## AWS CLI Equivalent

```bash
aws quicksight describe-ingestion \
  --aws-account-id 123456789012 \
  --data-set-id RLS-abc-123 \
  --ingestion-id ingestion-uuid-here \
  --region eu-west-1
```

## Logging

The function logs the following events:
- Start of ingestion check
- Current ingestion status
- Completion or failure details
- Errors with error type and message

## Related Functions

- `publishRLS03QsRLSDataSet` - Creates/updates RLS DataSet (may trigger ingestion)
- `publishRLS04QsUpdateMainDataSetRLS` - Applies RLS to DataSet (may trigger ingestion)
- `removeRLSDataSet` - Removes RLS configuration (may trigger ingestion)

## Notes

- This function should be called in a polling loop for status 201 responses
- Typical ingestion times range from a few seconds to several minutes
- Large datasets may take longer to ingest
- The function uses AWS SDK v3 for QuickSight operations
- Maximum timeout is 120 seconds per call
- Recommended polling interval: 5-10 seconds

## Ingestion Timing

Typical ingestion durations:
- **Small datasets** (< 1MB): 5-15 seconds
- **Medium datasets** (1-100MB): 15-60 seconds
- **Large datasets** (> 100MB): 1-10 minutes

## Troubleshooting

### Error: "Missing environment variables"
- Ensure `ACCOUNT_ID` is set in the Lambda environment
- Check Amplify backend configuration

### Status Stuck at 201
- Ingestion may be queued behind other operations
- Check SPICE capacity in QuickSight console
- Verify data source connectivity
- Check for concurrent ingestion operations

### Error: "SOURCE_NOT_FOUND"
- Glue table doesn't exist or is misconfigured
- S3 data is not accessible
- DataSource connection is broken
- Verify Glue table location and schema

### Error: "SPICE_CAPACITY_EXCEEDED"
- QuickSight SPICE capacity is full
- Delete unused SPICE datasets
- Purchase additional SPICE capacity
- Check capacity in QuickSight console

### Error: "PERMISSION_DENIED"
- QuickSight doesn't have permission to access data source
- Check IAM roles and policies
- Verify S3 bucket permissions
- Check Glue database permissions

### Error: "INVALID_DATA"
- CSV format is incorrect
- Schema mismatch between Glue table and S3 data
- Data contains invalid characters
- Check S3 file and Glue table configuration

## Best Practices

1. **Polling Interval**: Use 5-10 second intervals to balance responsiveness and API usage
2. **Timeout**: Set a maximum number of attempts (e.g., 60 attempts = 5 minutes)
3. **Exponential Backoff**: Increase delay between checks for long-running ingestions
4. **Error Handling**: Always handle status 500 responses and log error details
5. **User Feedback**: Provide progress updates to users during long ingestions

## SPICE Ingestion Limits

- **Enterprise Edition**: 32 refreshes per 24 hours per DataSet
- **Standard Edition**: 8 refreshes per 24 hours per DataSet
- Each 24-hour period is measured from the current time

## Version History

- **v1.0** - Initial implementation with ingestion status checking
- **v1.1** - Enhanced error reporting with detailed error types
