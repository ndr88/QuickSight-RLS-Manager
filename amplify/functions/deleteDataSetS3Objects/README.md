# deleteDataSetS3Objects

**Data Deletion Function** - Deletes all S3 objects and folders associated with a specific RLS DataSet.

## Overview

This function removes all objects stored in the S3 bucket under the RLS-Datasets path for a given DataSet. It lists all objects with the specified prefix and deletes them, including the containing folder structure. This is part of the RLS DataSet cleanup process.

## Function Details

- **Name**: `deleteDataSetS3Objects`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the S3 bucket is located |
| `s3BucketName` | string | Yes | Name of the S3 bucket containing RLS datasets |
| `s3Key` | string | Yes | Key/prefix for the DataSet folder to delete (e.g., DataSet ID) |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Output

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "S3 folder 'RLS-Datasets/{s3Key}' deleted successfully."
}
```

### Not Found Response (404)

```json
{
  "statusCode": 404,
  "message": "S3 folder 'RLS-Datasets/{s3Key}' not found."
}
```

### Error Response

```json
{
  "statusCode": 400|500,
  "message": "Error description",
  "errorType": "ErrorType"
}
```

## Error Handling

The function handles the following error types:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `ReferenceError` | 400 | Missing required parameters or environment variables |
| `FederationSourceException` | 400 | Federation source error |
| `InvalidInputException` | 400 | Invalid input parameters |
| `OperationTimeoutException` | 400 | Operation timed out |
| `ResourceNotReadyException` | 400 | Resource not ready |
| `GlueEncryptionException` | 500 | Encryption error |
| `InternalServiceException` | 500 | Internal service error |
| Generic Error | 500 | Unexpected error occurred |

## Usage Example

### GraphQL Mutation

```graphql
mutation DeleteDataSetS3Objects {
  deleteDataSetS3Objects(
    region: "eu-west-1"
    s3BucketName: "my-rls-bucket"
    s3Key: "dataset-123"
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

// Delete S3 objects for a DataSet
const response = await client.mutations.deleteDataSetS3Objects({
  region: 'eu-west-1',
  s3BucketName: 'my-rls-bucket',
  s3Key: 'dataset-123'
});

if (response.data?.statusCode === 200) {
  console.log('S3 objects deleted successfully');
} else if (response.data?.statusCode === 404) {
  console.log('S3 folder not found');
} else {
  console.error('Error:', response.data?.message);
}
```

## S3 Path Structure

The function deletes objects from the following path:
```
s3://{s3BucketName}/RLS-Datasets/{s3Key}/
```

For example, if `s3Key` is `dataset-123`, it will delete:
```
s3://my-rls-bucket/RLS-Datasets/dataset-123/
```

## Deletion Process

1. Lists all objects with the prefix `RLS-Datasets/{s3Key}`
2. Deletes all objects found in the listing
3. Deletes all common prefixes (subfolders)
4. Returns success if objects were deleted, or 404 if no objects were found

## IAM Permissions Required

The Lambda execution role needs the following S3 permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::bucket-name",
        "arn:aws:s3:::bucket-name/*"
      ]
    }
  ]
}
```

## AWS CLI Equivalent

```bash
# List objects
aws s3 ls s3://my-rls-bucket/RLS-Datasets/dataset-123/ --recursive

# Delete objects
aws s3 rm s3://my-rls-bucket/RLS-Datasets/dataset-123/ --recursive
```

## Logging

The function logs the following events:
- Start of deletion operation
- List of objects to be deleted
- Deletion progress
- Errors with error type and message
- End of operation

## Related Functions

- `publishRLS01S3` - Uploads CSV files to S3 for RLS datasets
- `deleteDataSetGlueTable` - Deletes the corresponding Glue table
- `deleteDataSetFromQS` - Deletes the QuickSight DataSet
- `removeRLSDataSet` - Removes RLS configuration from a DataSet

## Notes

- The function deletes all objects recursively under the specified path
- Both files and folders are removed
- If no objects are found, returns 404 status
- The function uses AWS SDK v3 for S3 operations
- Deletion is permanent and cannot be undone

## Troubleshooting

### Error: "Missing 's3Key'"
- Ensure the `s3Key` parameter is provided
- The s3Key should be the DataSet ID or folder name

### Error: "S3 folder not found"
- The specified path doesn't contain any objects
- Verify the s3Key is correct
- Check that the bucket name is correct

### Error: "Access Denied"
- Verify the Lambda execution role has s3:ListBucket and s3:DeleteObject permissions
- Check bucket policies and ACLs
- Ensure the bucket exists in the specified region

## Version History

- **v1.0** - Initial implementation with recursive deletion support
