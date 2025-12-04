# publishRLS00ResourcesValidation

**Step 0 of RLS Publishing Workflow** - Validates the existence and accessibility of required AWS resources before publishing RLS configurations.

## Overview

This Lambda function performs pre-flight checks to ensure all necessary resources (S3 bucket, Glue database, and QuickSight DataSource) exist and are accessible before attempting to publish RLS configurations. It's the first critical step in the RLS publishing workflow that prevents failures in subsequent steps.

## Function Details

- **Name**: `publishRLS00ResourcesValidation`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Workflow Position

This function is **Step 0** in the [`publishQSRLSPermissions`](/Guide/hooks/publishQSRLSPermissions.md) hook workflow:

```
Step 0: publishRLS00ResourcesValidation (THIS FUNCTION)
   ↓
Step 1: publishRLS01S3
   ↓
Step 2: publishRLS02Glue
   ↓
Step 3: publishRLS03QsRLSDataSet
   ↓
Step 4: publishRLS04QsUpdateMainDataSetRLS
   ↓
Step 99: publishRLS99QsCheckIngestion
```

## Flow Diagram

![Validation Flow](/Guide/images/Lambda_publishRLS00ResourcesValidation.png)

> **Note**: The diagram shows the validation flow for each resource. You can update this diagram using the [DrawIO source file](/Guide/images/drawio/lambda-publishRLS00ResourcesValidation.drawio).

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where resources are located |
| `s3BucketName` | string | Yes | Name of the S3 bucket for RLS datasets |
| `glueDatabaseName` | string | Yes | Name of the Glue database for RLS tables |
| `qsDataSourceName` | string | Yes | ID of the QuickSight DataSource |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Output

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "RLS Tool Resources correctly validated."
}
```

### Error Response

```json
{
  "statusCode": 400|403|404|429|500|504,
  "message": "Error description",
  "errorType": "ErrorType"
}
```

## Validation Process

The function performs checks in the following order. If any validation fails, the function returns immediately with an appropriate error.

### 1. S3 Bucket Validation

An S3 Bucket is created for each Region managed in the RLS Tool to store RLS CSV files.

**Check Method**: AWS SDK [S3 HeadBucketCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/HeadBucketCommand/)

**What it validates**:
- Bucket exists
- Bucket is accessible
- Permissions are correct

**Possible Errors**:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `Forbidden` | 403 | No permission to access the bucket |
| `NotFound` | 404 | Bucket does not exist |
| Generic Error | 500 | Unexpected S3 error |

### 2. Glue Database Validation

A Glue Database is created for each Region managed in the RLS Tool to catalog the RLS data.

**Check Method**: AWS SDK [Glue GetDatabaseCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/glue/command/GetDatabaseCommand/)

**What it validates**:
- Database exists
- Database is accessible
- Database configuration is correct

**Possible Errors**:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `InvalidInputException` | 400 | Invalid database name or parameters |
| `EntityNotFoundException` | 404 | Database does not exist |
| `OperationTimeoutException` | 504 | Operation timed out |
| `InternalServiceException` | 500 | Internal Glue service error |
| Generic Error | 500 | Unexpected Glue error |

### 3. QuickSight DataSource Validation

A QuickSight DataSource is created for each Region managed in the RLS Tool to connect QuickSight to the Glue database.

**Check Method**: AWS SDK [QuickSight DescribeDataSourceCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/quicksight/command/DescribeDataSourceCommand/)

**What it validates**:
- DataSource exists
- DataSource is accessible
- DataSource is properly configured

**Possible Errors**:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `InvalidParameterValueException` | 400 | Invalid DataSource ID or parameters |
| `AccessDeniedException` | 403 | No permission to access QuickSight |
| `ResourceNotFoundException` | 404 | DataSource does not exist |
| `ThrottlingException` | 429 | API rate limit exceeded |
| `InternalFailureException` | 500 | Internal QuickSight error |
| Generic Error | 500 | Unexpected QuickSight error |

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
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::qs-managed-rls-*",
        "arn:aws:s3:::qs-managed-rls-*/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "glue:GetDatabase"
      ],
      "Resource": [
        "arn:aws:glue:*:[ACCOUNT_ID]:catalog",
        "arn:aws:glue:*:[ACCOUNT_ID]:database/qs-managed-rls-*",
        "arn:aws:glue:*:[ACCOUNT_ID]:table/qs-managed-rls-*/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "quicksight:DescribeDataSource"
      ],
      "Resource": "*"
    }
  ]
}
```

> **Note**: Replace `[ACCOUNT_ID]` with your AWS Account ID.

### Detailed Permissions Breakdown

Understanding why each permission is needed:

#### S3 Bucket Check Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:ListBucket"
  ],
  "Resource": [
    "arn:aws:s3:::qs-managed-rls-*",
    "arn:aws:s3:::qs-managed-rls-*/*"
  ]
}
```

**Why needed**: The `HeadBucket` operation requires `s3:ListBucket` permission to verify the bucket exists and is accessible. The wildcard pattern `qs-managed-rls-*` allows the function to validate buckets across all managed regions.

#### Glue Database Check Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "glue:GetDatabase"
  ],
  "Resource": [
    "arn:aws:glue:*:[ACCOUNT_ID]:catalog",
    "arn:aws:glue:*:[ACCOUNT_ID]:database/qs-managed-rls-*",
    "arn:aws:glue:*:[ACCOUNT_ID]:table/qs-managed-rls-*/*"
  ]
}
```

**Why needed**: 
- `glue:GetDatabase` - Required to retrieve database metadata and verify it exists
- Catalog resource - Glue operations require access to the Data Catalog
- Database resource - Specific database access with wildcard for all managed databases
- Table resource - Some Glue operations check table-level permissions even for database queries

#### QuickSight DataSource Check Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "quicksight:DescribeDataSource"
  ],
  "Resource": "*"
}
```

**Why needed**: The `DescribeDataSource` operation requires permission to read DataSource metadata. QuickSight permissions often use `"Resource": "*"` because DataSource ARNs are constructed dynamically and may not be known in advance.

**More restrictive alternative** (if DataSource IDs are known):
```json
{
  "Effect": "Allow",
  "Action": [
    "quicksight:DescribeDataSource"
  ],
  "Resource": "arn:aws:quicksight:*:[ACCOUNT_ID]:datasource/qs-managed-rls-*"
}
```

## Usage Examples

### GraphQL Query

```graphql
query ValidateResources {
  publishRLS00ResourcesValidation(
    region: "eu-west-1"
    s3BucketName: "qs-managed-rls-abc123"
    glueDatabaseName: "qs-managed-rls-db-abc123"
    qsDataSourceName: "qs-managed-rls-data-source-abc123"
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

// Validate resources before publishing RLS
const response = await client.queries.publishRLS00ResourcesValidation({
  region: 'eu-west-1',
  s3BucketName: 'qs-managed-rls-abc123',
  glueDatabaseName: 'qs-managed-rls-db-abc123',
  qsDataSourceName: 'qs-managed-rls-data-source-abc123'
});

if (response.data?.statusCode === 200) {
  console.log('✓ All resources validated successfully');
  // Proceed with RLS publishing workflow
} else {
  console.error('✗ Validation failed:', response.data?.message);
  // Handle specific error based on statusCode
  switch (response.data?.statusCode) {
    case 404:
      console.error('Resource not found - run initial setup');
      break;
    case 403:
      console.error('Access denied - check IAM permissions');
      break;
    default:
      console.error('Unexpected error occurred');
  }
}
```

### Complete RLS Publishing Workflow

```typescript
async function publishRLS(config: {
  region: string;
  s3BucketName: string;
  glueDatabaseName: string;
  qsDataSourceName: string;
  dataSetId: string;
  csvHeaders: string[];
  csvContent: string;
}) {
  try {
    // Step 0: Validate resources
    console.log('Step 0: Validating resources...');
    const validation = await client.queries.publishRLS00ResourcesValidation({
      region: config.region,
      s3BucketName: config.s3BucketName,
      glueDatabaseName: config.glueDatabaseName,
      qsDataSourceName: config.qsDataSourceName
    });

    if (validation.data?.statusCode !== 200) {
      throw new Error(`Resource validation failed: ${validation.data?.message}`);
    }
    console.log('✓ Resources validated');

    // Step 1: Upload to S3
    console.log('Step 1: Uploading to S3...');
    const s3Response = await client.mutations.publishRLS01S3({
      region: config.region,
      s3BucketName: config.s3BucketName,
      dataSetId: config.dataSetId,
      csvHeaders: config.csvHeaders,
      csvContent: config.csvContent
    });
    
    if (s3Response.data?.statusCode !== 200) {
      throw new Error(`S3 upload failed: ${s3Response.data?.message}`);
    }
    console.log('✓ CSV uploaded to S3');

    // Continue with remaining steps...
    // Step 2: publishRLS02Glue
    // Step 3: publishRLS03QsRLSDataSet
    // Step 4: publishRLS04QsUpdateMainDataSetRLS
    // Step 99: publishRLS99QsCheckIngestion

  } catch (error) {
    console.error('RLS publishing failed:', error);
    throw error;
  }
}
```

## AWS CLI Equivalent

For testing or troubleshooting, you can manually validate resources using AWS CLI:

```bash
# Check S3 bucket
aws s3api head-bucket \
  --bucket qs-managed-rls-abc123 \
  --region eu-west-1

# Check Glue database
aws glue get-database \
  --name qs-managed-rls-db-abc123 \
  --region eu-west-1

# Check QuickSight DataSource
aws quicksight describe-data-source \
  --aws-account-id 123456789012 \
  --data-source-id qs-managed-rls-data-source-abc123 \
  --region eu-west-1
```

## Logging

The function logs the following events:
- Start of validation for each resource
- Successful validation of each resource
- Errors with error type and message
- Overall validation result

Example log output:
```
INFO: Starting resource validation for region: eu-west-1
INFO: Validating S3 bucket: qs-managed-rls-abc123
INFO: ✓ S3 bucket validated successfully
INFO: Validating Glue database: qs-managed-rls-db-abc123
INFO: ✓ Glue database validated successfully
INFO: Validating QuickSight DataSource: qs-managed-rls-data-source-abc123
INFO: ✓ QuickSight DataSource validated successfully
INFO: All resources validated successfully
```

## Related Functions

### Prerequisite Functions (Create Resources)
- [`createS3Bucket`](../createS3Bucket/README.md) - Creates the S3 bucket if it doesn't exist
- [`createGlueDatabase`](../createGlueDatabase/README.md) - Creates the Glue database if it doesn't exist
- [`createQSDataSource`](../createQSDataSource/README.md) - Creates the QuickSight DataSource if it doesn't exist

### Next Steps in Workflow
- [`publishRLS01S3`](../publishRLS01S3/README.md) - Upload CSV to S3
- [`publishRLS02Glue`](../publishRLS02Glue/README.md) - Create/update Glue table
- [`publishRLS03QsRLSDataSet`](../publishRLS03QsRLSDataSet/README.md) - Create/update RLS DataSet
- [`publishRLS04QsUpdateMainDataSetRLS`](../publishRLS04QsUpdateMainDataSetRLS/README.md) - Apply RLS to main DataSet
- [`publishRLS99QsCheckIngestion`](../publishRLS99QsCheckIngestion/README.md) - Verify SPICE ingestion

## Troubleshooting

### Error: "Missing tool Resource: s3BucketName"

**Cause**: Required parameter not provided

**Solution**: 
- Ensure all required parameters are provided in the function call
- Check that resource names are correctly configured in your application
- Verify the account setup is complete

### Error: "Bucket does not exist" (404)

**Cause**: S3 bucket has not been created or was deleted

**Solution**:
1. Run initial setup to create the bucket:
   ```typescript
   await client.mutations.createS3Bucket({
     region: 'eu-west-1',
     bucketName: 'qs-managed-rls-abc123'
   });
   ```
2. Verify the bucket name is correct
3. Check that the bucket is in the specified region
4. Verify the bucket wasn't accidentally deleted

### Error: "Database does not exist" (404)

**Cause**: Glue database has not been created or was deleted

**Solution**:
1. Run initial setup to create the database:
   ```typescript
   await client.mutations.createGlueDatabase({
     region: 'eu-west-1',
     databaseName: 'qs-managed-rls-db-abc123'
   });
   ```
2. Verify the database name is correct
3. Check Glue Data Catalog in the AWS console
4. Ensure the database is in the correct region

### Error: "DataSource does not exist" (404)

**Cause**: QuickSight DataSource has not been created or was deleted

**Solution**:
1. Run initial setup to create the DataSource:
   ```typescript
   await client.mutations.createQSDataSource({
     region: 'eu-west-1',
     dataSourceName: 'qs-managed-rls-data-source-abc123',
     glueDatabaseName: 'qs-managed-rls-db-abc123'
   });
   ```
2. Verify the DataSource ID is correct
3. Check QuickSight console for DataSource configuration
4. Ensure QuickSight has permissions to access Glue

### Error: "Access Denied" (403)

**Cause**: Lambda execution role lacks required permissions

**Solution**:
1. Verify the Lambda execution role has the required permissions (see IAM Permissions section)
2. Check resource policies and ACLs
3. Ensure QuickSight is enabled in the account
4. Verify the account has QuickSight Enterprise edition (required for RLS)
5. Check that the IAM role has trust relationship with Lambda service

### Error: "ThrottlingException" (429)

**Cause**: API rate limit exceeded

**Solution**:
1. Implement exponential backoff and retry logic
2. Reduce the frequency of validation calls
3. Contact AWS support to request higher API limits
4. Consider caching validation results for a short period

### Error: "Operation timed out" (504)

**Cause**: Glue operation took too long

**Solution**:
1. Check AWS service health dashboard
2. Retry the operation
3. Verify network connectivity
4. Check if Glue service is experiencing issues in your region

## Best Practices

1. **Always validate first**: Never skip this step in the RLS publishing workflow
2. **Handle errors gracefully**: Provide clear error messages to users
3. **Cache results**: Consider caching validation results for a short period (e.g., 5 minutes) to reduce API calls
4. **Monitor failures**: Track validation failures to identify infrastructure issues early
5. **Automate recovery**: Implement automatic resource creation when validation fails
6. **Test permissions**: Regularly test IAM permissions in non-production environments

## Notes

- This function performs **read-only operations** and doesn't modify any resources
- All three resources must exist and be accessible for validation to succeed
- The function uses AWS SDK v3 for all service operations
- Maximum timeout is 120 seconds (sufficient for all three checks)
- Validation is performed sequentially (S3 → Glue → QuickSight)
- The function is idempotent and can be called multiple times safely

## Version History

- **v1.0** - Initial implementation with three-resource validation
- **v2.0** - Enhanced error handling and detailed error messages

---

**Related Documentation**:
- [RLS Publishing Workflow Guide](/Guide/hooks/publishQSRLSPermissions.md)
- [Initial Setup Guide](/Guide/setup/initial-setup.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
