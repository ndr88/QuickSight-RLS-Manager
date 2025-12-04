# publishRLS99QsCheckIngestion

**Step 99 of RLS Publishing Workflow** - Checks the status of a QuickSight DataSet SPICE ingestion operation.

## Overview

This function monitors the progress of SPICE ingestion operations triggered by DataSet creation or updates. It's used to poll for completion when async operations return status 201, ensuring that RLS configurations are fully applied before proceeding.

## Function Details

- **Name**: `publishRLS99QsCheckIngestion`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Workflow Position

This function is **Step 99** (final verification step) in the [`publishQSRLSPermissions`](/Guide/hooks/publishQSRLSPermissions.md) hook workflow:

```
Step 0: publishRLS00ResourcesValidation
   ↓
Step 1: publishRLS01S3
   ↓
Step 2: publishRLS02Glue
   ↓
Step 3: publishRLS03QsRLSDataSet
   ↓
Step 4: publishRLS04QsUpdateMainDataSetRLS
   ↓
Step 99: publishRLS99QsCheckIngestion (THIS FUNCTION)
```

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `datasetRegion` | string | Yes | AWS region where the QuickSight DataSet is located |
| `dataSetId` | string | Yes | ID of the QuickSight DataSet being ingested |
| `ingestionId` | string | Yes | ID of the ingestion operation to check |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Output

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

## Ingestion Monitoring Process

The function performs the following steps:

### 1. Query Ingestion Status

**Method**: AWS SDK [QuickSight DescribeIngestionCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/quicksight/command/DescribeIngestionCommand/)

**What it retrieves**:
- Ingestion status (COMPLETED, RUNNING, QUEUED, etc.)
- Error information (if failed)
- Ingestion metadata

### 2. Evaluate Status

The function handles the following QuickSight ingestion statuses:

| Status | Response Code | Description |
|--------|---------------|-------------|
| `COMPLETED` | 200 | Ingestion completed successfully |
| `QUEUED` | 201 | Ingestion is queued and waiting to start |
| `INITIALIZED` | 201 | Ingestion has been initialized |
| `RUNNING` | 201 | Ingestion is currently running |
| `FAILED` | 500 | Ingestion failed with an error |
| `CANCELLED` | 500 | Ingestion was cancelled |

## Usage Examples

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
  console.log('✓ Ingestion completed successfully');
} else if (response.data?.statusCode === 201) {
  console.log('⏳ Ingestion still in progress');
} else {
  console.error('✗ Ingestion failed:', response.data?.message);
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

### Common Error Types

| Error Type | Description | Solution |
|------------|-------------|----------|
| `SOURCE_NOT_FOUND` | Data source or table not found | Verify Glue table and S3 data exist |
| `DATA_SET_NOT_SPICE` | DataSet is not configured for SPICE | Check DataSet ImportMode is SPICE |
| `SPICE_CAPACITY_EXCEEDED` | Insufficient SPICE capacity | Free up or purchase more SPICE capacity |
| `PERMISSION_DENIED` | Insufficient permissions to access data | Check IAM roles and S3/Glue permissions |
| `INVALID_DATA` | Data format or schema issues | Verify CSV format and Glue schema match |

## IAM Permissions Required

### Ready-to-Use Policy (Recommended)

This policy grants all necessary permissions for the function to work:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "quicksight:DescribeIngestion"
      ],
      "Resource": "arn:aws:quicksight:*:[ACCOUNT_ID]:dataset/*/ingestion/*"
    }
  ]
}
```

> **Note**: Replace `[ACCOUNT_ID]` with your AWS Account ID.

### Detailed Permissions Breakdown

Understanding why each permission is needed:

#### QuickSight Ingestion Monitoring Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "quicksight:DescribeIngestion"
  ],
  "Resource": "arn:aws:quicksight:*:[ACCOUNT_ID]:dataset/*/ingestion/*"
}
```

**Why needed**:
- `quicksight:DescribeIngestion` - Required to query the status of SPICE ingestion operations
- Wildcard pattern allows monitoring ingestions across all DataSets

## AWS CLI Equivalent

For testing or troubleshooting, you can manually check ingestion status using AWS CLI:

```bash
# Check ingestion status
aws quicksight describe-ingestion \
  --aws-account-id 123456789012 \
  --data-set-id RLS-abc-123 \
  --ingestion-id ingestion-uuid-here \
  --region eu-west-1

# List all ingestions for a DataSet
aws quicksight list-ingestions \
  --aws-account-id 123456789012 \
  --data-set-id RLS-abc-123 \
  --region eu-west-1
```

## Logging

The function logs the following events:
- Start of ingestion check
- Current ingestion status
- Completion or failure details
- Error information (if failed)
- Errors with error type and message

Example log output:
```
INFO: Checking ingestion status { dataSetId: 'RLS-abc-123', ingestionId: 'abc-123-xyz' }
DEBUG: Ingestion status { status: 'RUNNING' }
INFO: RLS DataSet ingestion completed successfully
```

## Related Functions

### Previous Steps in Workflow
- [`publishRLS00ResourcesValidation`](../publishRLS00ResourcesValidation/README.md) - Validate resources
- [`publishRLS01S3`](../publishRLS01S3/README.md) - Upload CSV to S3
- [`publishRLS02Glue`](../publishRLS02Glue/README.md) - Create/update Glue table
- [`publishRLS03QsRLSDataSet`](../publishRLS03QsRLSDataSet/README.md) - Create/update RLS DataSet (may trigger ingestion)
- [`publishRLS04QsUpdateMainDataSetRLS`](../publishRLS04QsUpdateMainDataSetRLS/README.md) - Apply RLS to DataSet (may trigger ingestion)

### Related Functions
- [`removeRLSDataSet`](../removeRLSDataSet/README.md) - Remove RLS configuration (may trigger ingestion)
- [`getQSSpiceCapacity`](../getQSSpiceCapacity/README.md) - Check available SPICE capacity

## Ingestion Timing Guidelines

Typical ingestion durations by dataset size:

| Dataset Size | Expected Duration | Recommended Max Attempts |
|--------------|-------------------|--------------------------|
| Small (< 1MB) | 5-15 seconds | 12 attempts (1 minute) |
| Medium (1-100MB) | 15-60 seconds | 24 attempts (2 minutes) |
| Large (> 100MB) | 1-10 minutes | 60 attempts (5 minutes) |

**Factors affecting ingestion time**:
- Dataset size and complexity
- Number of rows and columns
- SPICE capacity availability
- Concurrent ingestion operations
- Data source performance (S3/Glue)

## Troubleshooting

### Error: "Missing tool Resource: ingestionId"

**Cause**: Required parameter not provided

**Solution**:
- Ensure the `ingestionId` parameter is provided
- Verify the ingestionId was returned from Step 3 or Step 4
- Check that the parameter is correctly passed from the previous step

### Status Stuck at 201 (In Progress)

**Cause**: Ingestion is taking longer than expected or is queued

**Solution**:
1. **Check SPICE capacity**:
   ```typescript
   const capacity = await client.queries.getQSSpiceCapacity({
     region: 'eu-west-1'
   });
   ```
2. Verify data source connectivity (S3/Glue)
3. Check for concurrent ingestion operations in QuickSight console
4. Ingestion may be queued behind other operations - wait longer
5. Large datasets naturally take more time - increase max attempts

### Error: "SOURCE_NOT_FOUND" (500)

**Cause**: Data source or Glue table not found

**Solution**:
1. Verify the Glue table exists:
   ```bash
   aws glue get-table --database-name db-name --name table-name
   ```
2. Check that S3 data is accessible
3. Verify DataSource connection in QuickSight console
4. Ensure Glue table location matches S3 bucket/key
5. Run `publishRLS00ResourcesValidation` to verify all resources

### Error: "SPICE_CAPACITY_EXCEEDED" (500)

**Cause**: QuickSight SPICE capacity is full

**Solution**:
1. Check current SPICE usage:
   ```typescript
   const capacity = await client.queries.getQSSpiceCapacity({
     region: 'eu-west-1'
   });
   ```
2. Delete unused SPICE DataSets to free up capacity
3. Purchase additional SPICE capacity from AWS
4. Check capacity in QuickSight console under "Manage SPICE capacity"

### Error: "PERMISSION_DENIED" (500)

**Cause**: QuickSight doesn't have permission to access data source

**Solution**:
1. Check IAM roles and policies for QuickSight
2. Verify S3 bucket permissions allow QuickSight access
3. Check Glue database permissions
4. Ensure the DataSource has correct permissions
5. Review QuickSight service role in IAM console

### Error: "INVALID_DATA" (500)

**Cause**: Data format or schema issues

**Solution**:
1. Verify CSV format is correct:
   - Proper comma separation
   - Quoted values for commas/quotes
   - Consistent column count
2. Check schema match between Glue table and S3 data
3. Verify data doesn't contain invalid characters
4. Check S3 file exists and is readable
5. Review Glue table schema matches CSV columns

### Error: "DATA_SET_NOT_SPICE" (500)

**Cause**: DataSet is not configured for SPICE mode

**Solution**:
1. Verify DataSet ImportMode is set to SPICE
2. Check DataSet configuration in QuickSight console
3. Recreate DataSet with SPICE mode if necessary
4. This shouldn't occur with RLS DataSets created by the tool

### Ingestion Timeout

**Cause**: Exceeded maximum polling attempts

**Solution**:
1. Increase `maxAttempts` in polling loop
2. Check QuickSight console for ingestion status
3. Verify the ingestion didn't fail silently
4. Check AWS service health dashboard
5. For very large datasets, consider increasing timeout to 10+ minutes

## Best Practices

1. **Polling Interval**: Use 5-10 second intervals to balance responsiveness and API usage
2. **Timeout**: Set a maximum number of attempts based on dataset size:
   - Small datasets: 12 attempts (1 minute)
   - Medium datasets: 24 attempts (2 minutes)
   - Large datasets: 60 attempts (5 minutes)
3. **Exponential Backoff**: Increase delay between checks for long-running ingestions
4. **Error Handling**: Always handle status 500 responses and log error details
5. **User Feedback**: Provide progress updates to users during long ingestions
6. **Monitor SPICE Capacity**: Check capacity before starting ingestions
7. **Retry Logic**: Implement retry for transient failures

## SPICE Ingestion Limits

- **Enterprise Edition**: 32 refreshes per 24 hours per DataSet
- **Standard Edition**: 8 refreshes per 24 hours per DataSet
- Each 24-hour period is measured from the current time
- Limit applies per DataSet, not per account

## Notes

- This function should be called in a polling loop for status 201 responses
- Typical ingestion times range from a few seconds to several minutes
- Large datasets may take longer to ingest
- The function uses AWS SDK v3 for QuickSight operations
- Maximum timeout is 120 seconds per call (not per ingestion)
- Recommended polling interval: 5-10 seconds
- The function is read-only and doesn't modify any resources
- Safe to call multiple times for the same ingestion

## Version History

- **v1.0** - Initial implementation with ingestion status checking
- **v1.1** - Enhanced error reporting with detailed error types
- **v2.0** - Updated documentation and improved error handling

---

**Related Documentation**:
- [RLS Publishing Workflow Guide](/Guide/hooks/publishQSRLSPermissions.md)
- [SPICE Capacity Management](/Guide/spice-capacity.md)
- [QuickSight Ingestion Guide](/Guide/quicksight-ingestion.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
