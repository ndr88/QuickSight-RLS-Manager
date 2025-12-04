# createS3Bucket

**Resource Creation Function** - Creates an Amazon S3 bucket in a specified region for storing RLS data files.

## Overview

This function creates a new S3 bucket with a unique name in the specified region. The bucket is used to store CSV files containing Row-Level Security (RLS) permission data that will be queried by QuickSight through Glue. This is a prerequisite function that must be run before publishing RLS configurations.

## Function Details

- **Name**: `createS3Bucket`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Workflow Position

This function is part of the **initial setup workflow** for each region:

```
1. createS3Bucket (THIS FUNCTION)
   ↓
2. createGlueDatabase
   ↓
3. createQSDataSource
   ↓
Ready for RLS Publishing Workflow
```

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the S3 bucket will be created |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |
| `RESOURCE_PREFIX` | Prefix for resource names | `qs-managed-rls-` |

## Output

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "Bucket qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890 created in Region eu-west-1 with versioning enabled.",
  "s3BucketName": "qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890"
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

## S3 Bucket Creation Process

The function performs the following steps:

### 1. Generate Unique Bucket Name

**Naming Convention**:
```
qs-managed-rls-<uuid>
```

**Example**: `qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Components**:
- **Prefix**: `qs-managed-rls-` (identifies RLS Manager resources)
- **UUID**: Randomly generated UUID v4 for global uniqueness

**Why UUID?**: S3 bucket names must be globally unique across all AWS accounts. The UUID ensures no naming conflicts.

### 2. Create S3 Bucket

**Method**: AWS SDK [S3 CreateBucketCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/CreateBucketCommand/)

**Regional Configuration**:

The function handles the special case for `us-east-1`:

```typescript
// us-east-1 doesn't require LocationConstraint
if (region === "us-east-1") {
  new CreateBucketCommand({ Bucket: bucketName })
} else {
  new CreateBucketCommand({
    Bucket: bucketName,
    CreateBucketConfiguration: {
      LocationConstraint: region
    }
  })
}
```

**Why?**: S3 in `us-east-1` doesn't accept the `LocationConstraint` parameter (it's the default region).

### 3. Enable Versioning

**Method**: AWS SDK [S3 PutBucketVersioningCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/PutBucketVersioningCommand/)

**Configuration**:
```json
{
  "Status": "Enabled"
}
```

**Why versioning?**: 
- Tracks changes to RLS CSV files
- Enables rollback to previous versions
- Provides audit trail of permission changes
- Required for the `rollbackToVersion` function

## Usage Examples

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
  console.log('✓ S3 bucket created:', bucketName);
  console.log('✓ Versioning enabled');
  
  // Save bucket name for future use
  // This bucket will store RLS CSV files
  
  // Continue with next step: createGlueDatabase
} else {
  console.error('✗ Failed to create bucket:', response.data?.message);
}
```

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
        "s3:CreateBucket",
        "s3:PutBucketVersioning"
      ],
      "Resource": "arn:aws:s3:::qs-managed-rls-*"
    }
  ]
}
```

### Detailed Permissions Breakdown

Understanding why each permission is needed:

#### S3 Bucket Creation Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:CreateBucket",
    "s3:PutBucketVersioning"
  ],
  "Resource": "arn:aws:s3:::qs-managed-rls-*"
}
```

**Why needed**:
- `s3:CreateBucket` - Required to create new S3 buckets
- `s3:PutBucketVersioning` - Required to enable versioning on the bucket
- Wildcard pattern limits bucket creation to RLS-managed buckets only

## AWS CLI Equivalent

For testing or troubleshooting, you can manually create buckets using AWS CLI:

```bash
# For regions other than us-east-1
aws s3api create-bucket \
  --bucket qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  --versioning-configuration Status=Enabled \
  --region eu-west-1

# For us-east-1 (no LocationConstraint)
aws s3api create-bucket \
  --bucket qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  --versioning-configuration Status=Enabled \
  --region us-east-1

# List all RLS buckets
aws s3 ls | grep qs-managed-rls
```

## Logging

The function logs the following events:
- Region where bucket is being created
- Generated bucket name
- Bucket creation success
- Versioning enablement
- Errors with error type and message

Example log output:
```
INFO: Creating S3 bucket { region: 'eu-west-1', bucketName: 'qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
INFO: S3 bucket created successfully { bucketName: 'qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
INFO: Enabling versioning on S3 bucket { bucketName: 'qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
INFO: Versioning enabled successfully { bucketName: 'qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
```

## Related Functions

### Next Steps in Setup Workflow
- [`createGlueDatabase`](../createGlueDatabase/README.md) - Creates Glue Database that references this bucket
- [`createQSDataSource`](../createQSDataSource/README.md) - Creates QuickSight DataSource

### Functions That Use This Bucket
- [`publishRLS01S3`](../publishRLS01S3/README.md) - Uploads RLS CSV files to this bucket
- [`deleteDataSetS3Objects`](../deleteDataSetS3Objects/README.md) - Deletes objects from this bucket
- [`rollbackToVersion`](../rollbackToVersion/README.md) - Uses versioning to rollback changes

## Bucket Configuration Details

### Bucket Properties
- **Versioning**: Enabled (tracks file changes)
- **Encryption**: Default (AWS managed)
- **Public Access**: Blocked (default)
- **Region**: Specified in function call
- **Lifecycle**: Persistent (not auto-deleted)

### Bucket Usage

The created bucket stores:
- **RLS CSV files**: Permission data in CSV format
- **File structure**: `RLS-Datasets/{dataSetId}/QS_RLS_Managed_{dataSetId}.csv`
- **Example path**: `RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv`
- **Glue tables**: Point to files in this bucket
- **QuickSight access**: Reads data through Glue DataSource

### Regional Buckets

- **One bucket per region**: Each managed region has its own bucket
- **Regional data**: Data stays in the specified region
- **Independent**: Buckets are independent of each other
- **Naming**: UUID ensures no conflicts across regions

## Troubleshooting

### Error: "Missing tool Resource: region"

**Cause**: Required parameter not provided

**Solution**:
- Ensure the `region` parameter is provided
- Verify the region is a valid AWS region (e.g., 'eu-west-1', 'us-east-1')
- Check that the parameter is correctly passed in the function call

### Error: "BucketAlreadyExists" or "BucketAlreadyOwnedByYou"

**Cause**: Bucket name already exists (extremely rare due to UUID)

**Solution**:
1. This should not happen due to UUID generation
2. If it does, another AWS account may have claimed the name
3. Retry the function - it will generate a new UUID
4. Check if you already created a bucket for this region

### Error: "Failed to create S3 bucket" (500)

**Cause**: General S3 creation failure

**Solution**:
1. Check that S3 is available in the specified region
2. Verify Lambda execution role has `s3:CreateBucket` permission (see IAM Permissions section)
3. Ensure account has not hit S3 bucket limits:
   - Default: 100 buckets per account
   - Soft limit: Can be increased via AWS Support
4. Check AWS Service Health Dashboard for S3 issues
5. Verify the region parameter is valid

### Error: "AccessDenied" when enabling versioning

**Cause**: Missing `s3:PutBucketVersioning` permission

**Solution**:
1. Verify Lambda execution role has `s3:PutBucketVersioning` permission
2. Check IAM policy is correctly attached to the role
3. Ensure the policy resource pattern matches: `arn:aws:s3:::qs-managed-rls-*`

### Bucket created but not visible in console

**Cause**: Looking in wrong region or account

**Solution**:
1. Check you're looking in the correct region in AWS Console
2. Verify you're using the correct AWS account
3. Use AWS CLI to list buckets:
   ```bash
   aws s3 ls | grep qs-managed-rls
   ```
4. Check the function response for the exact bucket name

### us-east-1 specific issues

**Cause**: LocationConstraint parameter issue

**Solution**:
1. Ensure the function correctly detects `us-east-1` and omits `LocationConstraint`
2. Check logs to verify the correct command is being used
3. The handler code should have special handling for `us-east-1`
4. If manually creating, don't include `--create-bucket-configuration` for us-east-1

### Error: "TooManyBuckets"

**Cause**: Account has reached the S3 bucket limit

**Solution**:
1. Delete unused buckets to free up quota
2. Request a limit increase from AWS Support
3. Check current bucket count:
   ```bash
   aws s3 ls | wc -l
   ```
4. Review and clean up old RLS buckets

## Bucket Cleanup

To delete a bucket created by this function:

```bash
# 1. Empty bucket first (required before deletion)
aws s3 rm s3://qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890 --recursive --region eu-west-1

# 2. Delete bucket
aws s3 rb s3://qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890 --region eu-west-1

# Or use the AWS Console:
# 1. Navigate to S3 in the AWS Console
# 2. Select the bucket
# 3. Click "Empty" to remove all objects
# 4. Click "Delete" to remove the bucket
```

**Warning**: Deleting the bucket will break RLS functionality for that region. Only delete if you're sure you no longer need it.

## Best Practices

1. **One bucket per region**: Create a separate bucket for each region you manage
2. **Save bucket name**: Store the bucket name in your application configuration
3. **Don't delete manually**: Buckets are persistent and should not be deleted unless decommissioning
4. **Monitor usage**: Track S3 storage costs for RLS data
5. **Versioning enabled**: Keep versioning enabled for audit trail and rollback capability
6. **Regional data**: Keep data in the same region as QuickSight for performance

## Notes

- **Globally unique names**: S3 bucket names must be globally unique across all AWS accounts
- **UUID ensures uniqueness**: Prevents naming conflicts
- **Regional buckets**: Each managed region has its own bucket
- **Persistent**: Not automatically deleted when resources are cleaned up
- **Versioning enabled**: Tracks changes to RLS CSV files
- **Default encryption**: Uses AWS managed encryption
- **The function is idempotent**: Running it multiple times creates multiple buckets (each with unique UUID)

## Version History

- **v1.0** - Initial implementation with UUID-based naming
- **v1.1** - Added us-east-1 special case handling
- **v1.2** - Improved error handling and logging
- **v2.0** - Added versioning enablement
- **v2.1** - Updated documentation and improved error handling

---

**Related Documentation**:
- [Initial Setup Guide](/Guide/setup/initial-setup.md)
- [S3 Bucket Management](/Guide/s3-buckets.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
