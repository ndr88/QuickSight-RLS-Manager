# publishRLS00ResourcesValidation

Lambda function that validates the existence and accessibility of required AWS resources before publishing RLS configurations.

## Overview

This function performs pre-flight checks to ensure all necessary resources (S3 bucket, Glue database, and QuickSight DataSource) exist and are accessible before attempting to publish RLS configurations. It's the first step in the RLS publishing workflow.

## Function Details

- **Name**: `publishRLS00ResourcesValidation`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where resources are located |
| `s3BucketName` | string | Yes | Name of the S3 bucket for RLS datasets |
| `glueDatabaseName` | string | Yes | Name of the Glue database for RLS tables |
| `qsDataSourceName` | string | Yes | ID of the QuickSight DataSource |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Response

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
  "errorType": "ErrorType",
  "csvColumns": []
}
```

## Error Handling

The function validates three resources and handles specific errors for each:

### S3 Bucket Errors

| Error | Status Code | Description |
|-------|-------------|-------------|
| `Forbidden` | 403 | No permission to access the bucket |
| `NotFound` | 404 | Bucket does not exist |
| Generic Error | 500 | Unexpected S3 error |

### Glue Database Errors

| Error | Status Code | Description |
|-------|-------------|-------------|
| `InvalidInputException` | 400 | Invalid database name or parameters |
| `EntityNotFoundException` | 404 | Database does not exist |
| `OperationTimeoutException` | 504 | Operation timed out |
| `InternalServiceException` | 500 | Internal Glue service error |
| Generic Error | 500 | Unexpected Glue error |

### QuickSight DataSource Errors

| Error | Status Code | Description |
|-------|-------------|-------------|
| `InvalidParameterValueException` | 400 | Invalid DataSource ID or parameters |
| `AccessDeniedException` | 403 | No permission to access QuickSight |
| `ResourceNotFoundException` | 404 | DataSource does not exist |
| `ThrottlingException` | 429 | API rate limit exceeded |
| `InternalFailureException` | 500 | Internal QuickSight error |
| Generic Error | 500 | Unexpected QuickSight error |

## Usage Example

### GraphQL Query

```graphql
query ValidateResources {
  publishRLS00ResourcesValidation(
    region: "eu-west-1"
    s3BucketName: "my-rls-bucket"
    glueDatabaseName: "rls_database"
    qsDataSourceName: "my-datasource-id"
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
  s3BucketName: 'my-rls-bucket',
  glueDatabaseName: 'rls_database',
  qsDataSourceName: 'my-datasource-id'
});

if (response.data?.statusCode === 200) {
  console.log('All resources validated successfully');
  // Proceed with RLS publishing workflow
} else {
  console.error('Validation failed:', response.data?.message);
  // Handle specific error based on statusCode
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
  // Step 0: Validate resources
  const validation = await client.queries.publishRLS00ResourcesValidation({
    region: config.region,
    s3BucketName: config.s3BucketName,
    glueDatabaseName: config.glueDatabaseName,
    qsDataSourceName: config.qsDataSourceName
  });

  if (validation.data?.statusCode !== 200) {
    throw new Error(`Resource validation failed: ${validation.data?.message}`);
  }

  // Step 1: Upload to S3
  const s3Response = await client.mutations.publishRLS01S3({
    region: config.region,
    s3BucketName: config.s3BucketName,
    dataSetId: config.dataSetId,
    csvHeaders: config.csvHeaders,
    csvContent: config.csvContent
  });

  // Continue with remaining steps...
}
```

## Validation Process

The function performs checks in the following order:

1. **S3 Bucket Validation**
   - Uses `HeadBucket` command to verify bucket exists
   - Checks access permissions
   - Validates bucket is in the specified region

2. **Glue Database Validation**
   - Uses `GetDatabase` command to verify database exists
   - Checks database accessibility
   - Validates database configuration

3. **QuickSight DataSource Validation**
   - Uses `DescribeDataSource` command to verify DataSource exists
   - Checks DataSource accessibility
   - Validates DataSource is properly configured

If any validation fails, the function returns immediately with an appropriate error.

## IAM Permissions Required

The Lambda execution role needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::bucket-name"
    },
    {
      "Effect": "Allow",
      "Action": [
        "glue:GetDatabase"
      ],
      "Resource": [
        "arn:aws:glue:*:*:catalog",
        "arn:aws:glue:*:*:database/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "quicksight:DescribeDataSource"
      ],
      "Resource": "arn:aws:quicksight:*:*:datasource/*"
    }
  ]
}
```

## AWS CLI Equivalent

```bash
# Check S3 bucket
aws s3api head-bucket --bucket my-rls-bucket --region eu-west-1

# Check Glue database
aws glue get-database \
  --name rls_database \
  --region eu-west-1

# Check QuickSight DataSource
aws quicksight describe-data-source \
  --aws-account-id 123456789012 \
  --data-source-id my-datasource-id \
  --region eu-west-1
```

## Logging

The function logs the following events:
- Start of validation for each resource
- Successful validation of each resource
- Errors with error type and message
- Overall validation result

## Related Functions

- `publishRLS01S3` - Next step: Upload CSV to S3
- `publishRLS02Glue` - Create/update Glue table
- `publishRLS03QsRLSDataSet` - Create/update RLS DataSet
- `createS3Bucket` - Creates the S3 bucket if it doesn't exist
- `createGlueDatabase` - Creates the Glue database if it doesn't exist
- `createQSDataSource` - Creates the QuickSight DataSource if it doesn't exist

## Notes

- This function should always be called first in the RLS publishing workflow
- It performs read-only operations and doesn't modify any resources
- All three resources must exist and be accessible for validation to succeed
- The function uses AWS SDK v3 for all service operations
- Maximum timeout is 120 seconds

## Troubleshooting

### Error: "Missing tool Resource: s3BucketName"
- Ensure all required parameters are provided
- Check that resource names are correctly configured

### Error: "Bucket does not exist"
- Create the S3 bucket using `createS3Bucket` function
- Verify the bucket name is correct
- Check that the bucket is in the specified region

### Error: "Database does not exist"
- Create the Glue database using `createGlueDatabase` function
- Verify the database name is correct
- Check Glue Data Catalog in the AWS console

### Error: "DataSource does not exist"
- Create the QuickSight DataSource using `createQSDataSource` function
- Verify the DataSource ID is correct
- Check QuickSight console for DataSource configuration

### Error: "Access Denied"
- Verify the Lambda execution role has the required permissions
- Check resource policies and ACLs
- Ensure QuickSight is enabled in the account

## Version History

- **v1.0** - Initial implementation with three-resource validation
