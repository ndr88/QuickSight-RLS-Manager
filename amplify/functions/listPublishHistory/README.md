# listPublishHistory

**Utility Function** - Lists all published versions of an RLS DataSet's CSV file from S3.

## Overview

This function retrieves the version history of an RLS DataSet's CSV file from S3. It uses S3 versioning to track all changes made to the RLS permissions file, allowing you to see when changes were made and enabling rollback to previous versions. This is essential for audit trails and recovery.

## Function Details

- **Name**: `listPublishHistory`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the S3 bucket is located |
| `dataSetId` | string | Yes | ID of the DataSet to list versions for |
| `s3BucketName` | string | Yes | Name of the S3 bucket containing RLS datasets |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Output

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "Found 5 version(s)",
  "versions": "[{\"versionId\":\"abc123\",\"lastModified\":\"2025-12-04T10:00:00Z\",\"size\":1024,\"isLatest\":true}]"
}
```

### No Versions Found (200)

```json
{
  "statusCode": 200,
  "message": "No versions found",
  "versions": "[]"
}
```

### Error Response (500)

```json
{
  "statusCode": 500,
  "message": "Failed to list versions",
  "versions": "[]",
  "errorType": "ErrorType"
}
```

## Version Object Structure

Each version in the `versions` array contains:

```typescript
{
  versionId: string;        // S3 version ID
  lastModified: string;     // ISO 8601 timestamp
  size: number;             // File size in bytes
  isLatest: boolean;        // Whether this is the current version
}
```

## Version Listing Process

The function performs the following steps:

### 1. List S3 Object Versions

**Method**: AWS SDK [S3 ListObjectVersionsCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/ListObjectVersionsCommand/)

**S3 Path**: `RLS-Datasets/{dataSetId}/QS_RLS_Managed_{dataSetId}.csv`

**What it retrieves**:
- All versions of the CSV file
- Version IDs for each version
- Timestamps and file sizes
- Latest version indicator

### 2. Format and Sort Results

**Sorting**: Newest versions first (descending by lastModified)

**Filtering**: Only exact key matches (no partial matches)

## Usage Examples

### GraphQL Query

```graphql
query ListVersions {
  listPublishHistory(
    region: "eu-west-1"
    dataSetId: "dataset-123"
    s3BucketName: "qs-managed-rls-abc123"
  ) {
    statusCode
    message
    versions
    errorType
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// List publish history
const response = await client.queries.listPublishHistory({
  region: 'eu-west-1',
  dataSetId: 'dataset-123',
  s3BucketName: 'qs-managed-rls-abc123'
});

if (response.data?.statusCode === 200) {
  const versions = JSON.parse(response.data.versions);
  
  console.log(`Found ${versions.length} version(s)`);
  
  versions.forEach((v, index) => {
    const date = new Date(v.lastModified);
    const sizeKB = (v.size / 1024).toFixed(2);
    const latest = v.isLatest ? ' (LATEST)' : '';
    
    console.log(`${index + 1}. ${date.toLocaleString()} - ${sizeKB} KB${latest}`);
    console.log(`   Version ID: ${v.versionId}`);
  });
} else {
  console.error('✗ Failed:', response.data?.message);
}
```

### Display Version History with Rollback Option

```typescript
async function displayVersionHistory(
  region: string,
  dataSetId: string,
  s3BucketName: string
) {
  const response = await client.queries.listPublishHistory({
    region,
    dataSetId,
    s3BucketName
  });

  if (response.data?.statusCode === 200) {
    const versions = JSON.parse(response.data.versions);
    
    if (versions.length === 0) {
      console.log('No version history available');
      return;
    }

    console.log('Version History:');
    console.log('================');
    
    versions.forEach((v, index) => {
      const date = new Date(v.lastModified);
      const status = v.isLatest ? '✓ CURRENT' : '  Available';
      
      console.log(`${status} | ${date.toLocaleString()}`);
      console.log(`         | Version: ${v.versionId}`);
      console.log(`         | Size: ${(v.size / 1024).toFixed(2)} KB`);
      console.log('');
    });

    return versions;
  }

  throw new Error(response.data?.message || 'Failed to list versions');
}
```

## IAM Permissions Required

### Ready-to-Use Policy (Recommended)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucketVersions"
      ],
      "Resource": "arn:aws:s3:::qs-managed-rls-*"
    }
  ]
}
```

### Detailed Permissions Breakdown

**Why needed**:
- `s3:ListBucketVersions` - Required to list all versions of objects in the bucket

## AWS CLI Equivalent

```bash
# List object versions
aws s3api list-object-versions \
  --bucket qs-managed-rls-abc123 \
  --prefix RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv \
  --region eu-west-1

# List versions with formatted output
aws s3api list-object-versions \
  --bucket qs-managed-rls-abc123 \
  --prefix RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv \
  --query 'Versions[].{VersionId:VersionId,LastModified:LastModified,Size:Size,IsLatest:IsLatest}' \
  --region eu-west-1
```

## Logging

The function logs:
- Start of version listing operation
- S3 bucket and key being queried
- Number of versions found
- Errors with error type and message

Example log output:
```
INFO: Listing S3 versions { bucket: 'qs-managed-rls-abc123', key: 'RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv' }
INFO: Versions retrieved { count: 5 }
```

## Related Functions

### Version Management
- [`getVersionContent`](../getVersionContent/README.md) - Retrieves content of a specific version
- [`rollbackToVersion`](../rollbackToVersion/README.md) - Rolls back to a previous version

### RLS Publishing
- [`publishRLS01S3`](../publishRLS01S3/README.md) - Uploads new versions to S3

## Troubleshooting

### Error: "Missing tool Resource: dataSetId"

**Cause**: Required parameter not provided

**Solution**:
- Ensure the `dataSetId` parameter is provided
- Verify the DataSet ID is correct
- Check that the parameter is correctly passed in the function call

### No Versions Found

**Cause**: No CSV file has been published for this DataSet

**Solution**:
1. Verify the DataSet ID is correct
2. Check that RLS has been published at least once
3. Verify the S3 bucket name is correct
4. Use `publishRLS01S3` to create the first version

### Error: "NoSuchBucket" (404)

**Cause**: S3 bucket doesn't exist

**Solution**:
1. Verify the S3 bucket name is correct
2. Check that the bucket exists in the specified region
3. Run `createS3Bucket` if the bucket hasn't been created yet

### Error: "AccessDenied" (403)

**Cause**: Insufficient S3 permissions

**Solution**:
1. Verify Lambda role has `s3:ListBucketVersions` permission
2. Check bucket policies allow access
3. Ensure the IAM role has trust relationship with Lambda service

### Versions Not Showing Up

**Cause**: S3 versioning not enabled

**Solution**:
1. Verify S3 versioning is enabled on the bucket
2. Check that `createS3Bucket` was used (it enables versioning)
3. Enable versioning manually if needed:
   ```bash
   aws s3api put-bucket-versioning \
     --bucket qs-managed-rls-abc123 \
     --versioning-configuration Status=Enabled
   ```

## Best Practices

1. **Regular audits**: Periodically review version history for compliance
2. **Retention policy**: Consider implementing S3 lifecycle policies for old versions
3. **Monitor storage**: Track storage costs for versioned objects
4. **Document changes**: Keep notes on why versions were published
5. **Test rollback**: Verify rollback functionality works before needing it

## Notes

- Versions are sorted newest first (descending by lastModified)
- The function only returns versions for the exact file path
- S3 versioning must be enabled on the bucket (done by `createS3Bucket`)
- Each publish operation creates a new version
- Versions are never deleted automatically (manual cleanup required)
- The function is read-only and doesn't modify any resources
- Version IDs are unique and immutable

## Version History

- **v1.0** - Initial implementation

---

**Related Documentation**:
- [S3 Versioning Guide](/Guide/s3-versioning.md)
- [Version Management](/Guide/version-management.md)
- [Rollback Procedures](/Guide/rollback.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
