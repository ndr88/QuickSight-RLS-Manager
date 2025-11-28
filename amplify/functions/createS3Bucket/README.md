# createS3Bucket

Lambda function that creates an Amazon S3 bucket in a specified region for storing RLS data files.

## Overview

This function creates a new S3 bucket with a unique name in the specified region. The bucket is used to store CSV files containing Row-Level Security (RLS) permission data that will be queried by QuickSight through Athena and Glue.

## Function Details

- **Name**: `createS3Bucket`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the S3 bucket will be created |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |
| `RESOURCE_PREFIX` | Prefix for resource names | `qs-managed-rls-` |

## Response

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "Bucket qs-managed-rls-<uuid> created in Region eu-west-1.",
  "s3BucketName": "qs-managed-rls-<uuid>"
}
```

### Error Response (500)

```json
{
  "statusCode": 500,
  "message": "Failed to create the S3 Bucket in Region eu-west-1",
  "s3BucketName": "",
  "errorName": "BucketNotCreated"
}
```

## Bucket Naming Convention

The bucket name follows this pattern:
```
qs-managed-rls-<uuid>
```

Example: `qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890`

- **Prefix**: `qs-managed-rls-` (identifies RLS Manager resources)
- **UUID**: Randomly generated UUID v4 for global uniqueness

## Regional Configuration

The function handles the special case for `us-east-1`:

```typescript
// us-east-1 doesn't require LocationConstraint
if (region === "us-east-1") {
  // Create without LocationConstraint
} else {
  // Create with LocationConstraint set to region
}
```

This is required because S3 in `us-east-1` doesn't accept the `LocationConstraint` parameter.

## Usage Example

### GraphQL Mutation

```graphql
mutation CreateBucket {
  createS3Bucket(region: "eu-west-1") {
    statusCode
    message
    s3BucketName
    errorName
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Create S3 bucket
const response = await client.mutations.createS3Bucket({
  region: 'eu-west-1'
});

if (response.data?.statusCode === 200) {
  const bucketName = response.data.s3BucketName;
  console.log('✅ S3 bucket created:', bucketName);
  
  // Save bucket name for future use
  // This bucket will store RLS CSV files
} else {
  console.error('❌ Failed to create bucket:', response.data?.message);
}
```

## IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:PutBucketPolicy",
        "s3:PutBucketVersioning"
      ],
      "Resource": "arn:aws:s3:::qs-managed-rls-*"
    }
  ]
}
```

## AWS CLI Equivalent

```bash
# For regions other than us-east-1
aws s3api create-bucket \
  --bucket qs-managed-rls-<uuid> \
  --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1

# For us-east-1
aws s3api create-bucket \
  --bucket qs-managed-rls-<uuid> \
  --region us-east-1
```

## Logging

The function logs:
- Region where bucket is being created
- Generated bucket name
- CreateBucket command details
- Success or failure status

## Related Functions

- `publishRLS01S3` - Uploads RLS CSV files to this bucket
- `deleteDataSetS3Objects` - Deletes objects from this bucket
- `createGlueDatabase` - Creates Glue Database that references this bucket

## Notes

- **Globally unique names**: S3 bucket names must be globally unique across all AWS accounts
- **UUID ensures uniqueness**: Prevents naming conflicts
- **Regional buckets**: Each managed region has its own bucket
- **Persistent**: Not automatically deleted when sandbox is destroyed
- **Default settings**: Bucket is created with default settings (no versioning, no encryption)

## Bucket Usage

The created bucket stores:
- **RLS CSV files**: Permission data in CSV format
- **File structure**: `<dataset-id>/<glue-table-id>.csv`
- **Athena queries**: Glue tables point to files in this bucket
- **QuickSight access**: QuickSight reads data through Athena

## Workflow Integration

This function is the first step in region initialization:

1. **`createS3Bucket` creates S3 bucket** ← You are here
2. `createGlueDatabase` creates Glue Database
3. `createQSDataSource` creates QuickSight DataSource
4. Region is ready for RLS dataset management

## Troubleshooting

### Error: "Bucket name already exists"
- This should not happen due to UUID generation
- If it does, another AWS account may have claimed the name
- Function will return error; retry will generate new UUID

### Error: "Failed to create the S3 Bucket"
- Check that S3 is available in the specified region
- Verify Lambda execution role has `s3:CreateBucket` permission
- Ensure account has not hit S3 bucket limits (default: 100 per account)

### Bucket created but not visible
- Check you're looking in the correct region
- Verify you're using the correct AWS account
- Use AWS CLI: `aws s3 ls | grep qs-managed-rls`

### us-east-1 specific issues
- Ensure the function correctly detects `us-east-1` and omits `LocationConstraint`
- Check logs to verify the correct command is being used

## Cleanup

To delete a bucket created by this function:

```bash
# Empty bucket first
aws s3 rm s3://qs-managed-rls-<uuid> --recursive --region eu-west-1

# Delete bucket
aws s3 rb s3://qs-managed-rls-<uuid> --region eu-west-1
```

## Version History

- **v1.0** - Initial implementation with UUID-based naming
- **v1.1** - Added us-east-1 special case handling
- **v1.2** - Improved error handling and logging
