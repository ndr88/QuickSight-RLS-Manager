# getVersionContent

**Utility Function** - Retrieves the CSV content of a specific version of an RLS DataSet file from S3.

## Overview

This function retrieves the content of a specific version of an RLS DataSet's CSV file from S3 without modifying it. This is a read-only operation used to preview historical versions before rolling back or to audit past RLS configurations.

## Function Details

- **Name**: `getVersionContent`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the S3 bucket is located |
| `dataSetId` | string | Yes | ID of the DataSet |
| `s3BucketName` | string | Yes | Name of the S3 bucket containing RLS datasets |
| `versionId` | string | Yes | S3 version ID to retrieve |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Output

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "Version content retrieved successfully",
  "csvContent": "UserName,GroupName,Region\njohn@example.com,Sales,US\n..."
}
```

### Error Response (500)

```json
{
  "statusCode": 500,
  "message": "Failed to get version content",
  "csvContent": null,
  "errorType": "ErrorType"
}
```

## Version Content Retrieval Process

The function performs the following steps:

### 1. Retrieve Specific Version

**Method**: AWS SDK [S3 GetObjectCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/GetObjectCommand/)

**Parameters**:
- `Bucket`: S3 bucket name
- `Key`: `RLS-Datasets/{dataSetId}/QS_RLS_Managed_{dataSetId}.csv`
- `VersionId`: Specific version to retrieve

**What it does**:
- Retrieves the exact version specified
- Does NOT create a new version
- Read-only operation

### 2. Read CSV Content

**Process**:
- Streams the S3 object body
- Converts to string format
- Returns complete CSV content

## Usage Examples

### GraphQL Query

```graphql
query GetVersion {
  getVersionContent(
    region: "eu-west-1"
    dataSetId: "dataset-123"
    s3BucketName: "qs-managed-rls-abc123"
    versionId: "abc123xyz"
  ) {
    statusCode
    message
    csvContent
    errorType
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Get version content
const response = await client.queries.getVersionContent({
  region: 'eu-west-1',
  dataSetId: 'dataset-123',
  s3BucketName: 'qs-managed-rls-abc123',
  versionId: 'abc123xyz'
});

if (response.data?.statusCode === 200) {
  const csvContent = response.data.csvContent;
  
  console.log('✓ Version content retrieved');
  console.log(`Size: ${csvContent?.length} characters`);
  
  // Parse CSV
  const lines = csvContent?.split('\n') || [];
  console.log(`Rows: ${lines.length - 1} (excluding header)`);
  console.log(`Header: ${lines[0]}`);
} else {
  console.error('✗ Failed:', response.data?.message);
}
```

### Preview Before Rollback

```typescript
async function previewAndRollback(
  region: string,
  dataSetId: string,
  s3BucketName: string,
  versionId: string
) {
  try {
    // Step 1: Get version content to preview
    console.log('Fetching version content...');
    const contentResponse = await client.queries.getVersionContent({
      region,
      dataSetId,
      s3BucketName,
      versionId
    });

    if (contentResponse.data?.statusCode !== 200) {
      throw new Error('Failed to fetch version content');
    }

    const csvContent = contentResponse.data.csvContent;
    const lines = csvContent?.split('\n') || [];
    
    console.log('Version Preview:');
    console.log('================');
    console.log(`Total rows: ${lines.length - 1}`);
    console.log(`Header: ${lines[0]}`);
    console.log(`First 3 rows:`);
    lines.slice(1, 4).forEach((line, i) => {
      console.log(`  ${i + 1}. ${line}`);
    });

    // Step 2: Confirm rollback
    const confirmed = confirm('Proceed with rollback?');
    
    if (confirmed) {
      console.log('Rolling back...');
      const rollbackResponse = await client.mutations.rollbackToVersion({
        region,
        dataSetId,
        s3BucketName,
        versionId
      });

      if (rollbackResponse.data?.statusCode === 200) {
        console.log('✓ Rollback successful');
        return true;
      }
    }

    return false;

  } catch (error) {
    console.error('Operation failed:', error);
    throw error;
  }
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
        "s3:GetObjectVersion"
      ],
      "Resource": "arn:aws:s3:::qs-managed-rls-*/RLS-Datasets/*"
    }
  ]
}
```

### Detailed Permissions Breakdown

**Why needed**:
- `s3:GetObjectVersion` - Required to retrieve specific versions of S3 objects

## AWS CLI Equivalent

```bash
# Get specific version content
aws s3api get-object \
  --bucket qs-managed-rls-abc123 \
  --key RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv \
  --version-id abc123xyz \
  output.csv \
  --region eu-west-1

# View the content
cat output.csv
```

## Logging

The function logs:
- Start of version retrieval (READ-ONLY)
- S3 bucket, key, and version ID
- Content size retrieved
- Errors with error type and message

Example log output:
```
INFO: Getting version content (READ-ONLY) { bucket: 'qs-managed-rls-abc123', key: 'RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv', versionId: 'abc123xyz' }
INFO: Version content retrieved successfully { size: 2048, versionId: 'abc123xyz' }
```

## Related Functions

### Version Management
- [`listPublishHistory`](../listPublishHistory/README.md) - Lists all available versions
- [`rollbackToVersion`](../rollbackToVersion/README.md) - Rolls back to a previous version

### RLS Publishing
- [`publishRLS01S3`](../publishRLS01S3/README.md) - Creates new versions

## Troubleshooting

### Error: "Missing tool Resource: versionId"

**Cause**: Required parameter not provided

**Solution**:
- Ensure the `versionId` parameter is provided
- Use `listPublishHistory` to get valid version IDs
- Verify the version ID format is correct

### Error: "Version not found or empty"

**Cause**: Invalid version ID or version doesn't exist

**Solution**:
1. Verify the version ID is correct
2. Use `listPublishHistory` to list available versions
3. Check that the version wasn't deleted
4. Ensure the DataSet ID and bucket name are correct

### Error: "NoSuchBucket" (404)

**Cause**: S3 bucket doesn't exist

**Solution**:
1. Verify the S3 bucket name is correct
2. Check that the bucket exists in the specified region
3. Run `createS3Bucket` if needed

### Error: "AccessDenied" (403)

**Cause**: Insufficient S3 permissions

**Solution**:
1. Verify Lambda role has `s3:GetObjectVersion` permission
2. Check bucket policies allow access
3. Ensure the IAM role has trust relationship with Lambda service

## Best Practices

1. **Preview before rollback**: Always preview version content before rolling back
2. **Validate content**: Check that the version contains expected data
3. **Document versions**: Keep notes on what each version contains
4. **Read-only operation**: This function doesn't modify anything - safe to use
5. **Compare versions**: Use this to compare different versions

## Notes

- This is a READ-ONLY operation - does not create new versions
- Does not modify S3 in any way
- Safe to call multiple times
- Returns complete CSV content as string
- Version IDs are immutable and unique
- The function retrieves the exact version specified
- Content is returned as-is (no parsing or modification)

## Version History

- **v1.0** - Initial implementation

---

**Related Documentation**:
- [S3 Versioning Guide](/Guide/s3-versioning.md)
- [Version Management](/Guide/version-management.md)
- [Rollback Procedures](/Guide/rollback.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
