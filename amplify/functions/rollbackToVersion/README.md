# rollbackToVersion

**Utility Function** - Rolls back an RLS DataSet's CSV file to a previous version by copying it as the latest version.

## Overview

This function rolls back an RLS DataSet's CSV file to a previous version by copying the specified version as the new latest version in S3. This creates a new version that is identical to the old one, preserving the complete version history. This is used to recover from incorrect RLS configurations or revert unwanted changes.

## Function Details

- **Name**: `rollbackToVersion`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the S3 bucket is located |
| `dataSetId` | string | Yes | ID of the DataSet to rollback |
| `s3BucketName` | string | Yes | Name of the S3 bucket containing RLS datasets |
| `versionId` | string | Yes | S3 version ID to rollback to |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Output

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "Successfully rolled back to previous version",
  "newVersionId": "xyz789new",
  "csvContent": "UserName,GroupName,Region\njohn@example.com,Sales,US\n..."
}
```

### Error Response (500)

```json
{
  "statusCode": 500,
  "message": "Failed to rollback version",
  "newVersionId": null,
  "csvContent": null,
  "errorType": "ErrorType"
}
```

## Rollback Process

The function performs the following steps:

### 1. Verify Version Exists

**Method**: AWS SDK [S3 GetObjectCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/GetObjectCommand/)

**What it does**:
- Retrieves the specified version
- Verifies it exists and is accessible
- Reads the CSV content

### 2. Copy as New Latest Version

**Method**: AWS SDK [S3 CopyObjectCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/CopyObjectCommand/)

**What it does**:
- Copies the old version as a new object
- Creates a new version ID
- Makes it the latest version
- Preserves complete version history

### 3. Return Results

**Returns**:
- New version ID (the rollback version)
- CSV content of the rolled-back version
- Success message

## Important Notes

- **Creates New Version**: Rollback creates a new version, doesn't delete the current one
- **Preserves History**: All versions remain in S3 (nothing is deleted)
- **Reversible**: You can rollback the rollback if needed
- **Immediate Effect**: The rolled-back version becomes the latest immediately

## Usage Examples

### GraphQL Mutation

```graphql
mutation RollbackVersion {
  rollbackToVersion(
    region: "eu-west-1"
    dataSetId: "dataset-123"
    s3BucketName: "qs-managed-rls-abc123"
    versionId: "abc123old"
  ) {
    statusCode
    message
    newVersionId
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

// Rollback to previous version
const response = await client.mutations.rollbackToVersion({
  region: 'eu-west-1',
  dataSetId: 'dataset-123',
  s3BucketName: 'qs-managed-rls-abc123',
  versionId: 'abc123old'
});

if (response.data?.statusCode === 200) {
  console.log('✓ Rollback successful');
  console.log(`New version ID: ${response.data.newVersionId}`);
  console.log(`Content size: ${response.data.csvContent?.length} characters`);
} else {
  console.error('✗ Rollback failed:', response.data?.message);
}
```

### Complete Rollback Workflow

```typescript
async function performRollback(
  region: string,
  dataSetId: string,
  s3BucketName: string
) {
  try {
    // Step 1: List available versions
    console.log('Fetching version history...');
    const historyResponse = await client.queries.listPublishHistory({
      region,
      dataSetId,
      s3BucketName
    });

    if (historyResponse.data?.statusCode !== 200) {
      throw new Error('Failed to fetch version history');
    }

    const versions = JSON.parse(historyResponse.data.versions);
    
    if (versions.length < 2) {
      console.log('No previous versions available for rollback');
      return;
    }

    // Display versions (skip first one as it's current)
    console.log('Available versions to rollback to:');
    versions.slice(1).forEach((v, i) => {
      const date = new Date(v.lastModified);
      console.log(`${i + 1}. ${date.toLocaleString()} (${v.versionId})`);
    });

    // Step 2: Select version (example: rollback to previous version)
    const targetVersion = versions[1]; // Previous version
    console.log(`\nSelected version: ${targetVersion.versionId}`);

    // Step 3: Preview version content
    console.log('Previewing version content...');
    const contentResponse = await client.queries.getVersionContent({
      region,
      dataSetId,
      s3BucketName,
      versionId: targetVersion.versionId
    });

    if (contentResponse.data?.statusCode === 200) {
      const lines = contentResponse.data.csvContent?.split('\n') || [];
      console.log(`Rows: ${lines.length - 1}`);
      console.log(`Header: ${lines[0]}`);
    }

    // Step 4: Perform rollback
    console.log('\nPerforming rollback...');
    const rollbackResponse = await client.mutations.rollbackToVersion({
      region,
      dataSetId,
      s3BucketName,
      versionId: targetVersion.versionId
    });

    if (rollbackResponse.data?.statusCode === 200) {
      console.log('✓ Rollback successful!');
      console.log(`New version ID: ${rollbackResponse.data.newVersionId}`);
      
      // Step 5: Republish to Glue and QuickSight
      console.log('\nNote: You may need to republish to Glue and QuickSight');
      console.log('Run the RLS publishing workflow to apply changes');
      
      return rollbackResponse.data.newVersionId;
    }

    throw new Error('Rollback failed');

  } catch (error) {
    console.error('Rollback workflow failed:', error);
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
        "s3:GetObjectVersion",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::qs-managed-rls-*/RLS-Datasets/*"
    }
  ]
}
```

### Detailed Permissions Breakdown

**Why needed**:
- `s3:GetObjectVersion` - Required to retrieve the old version
- `s3:PutObject` - Required to copy it as the new latest version

## AWS CLI Equivalent

```bash
# Copy old version as new latest version
aws s3api copy-object \
  --bucket qs-managed-rls-abc123 \
  --copy-source "qs-managed-rls-abc123/RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv?versionId=abc123old" \
  --key RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv \
  --content-type text/csv \
  --region eu-west-1
```

## Logging

The function logs:
- Start of rollback operation
- S3 bucket, key, and version ID
- Retrieved version content size
- Copy operation success
- Old and new version IDs
- Errors with error type and message

Example log output:
```
INFO: Rolling back to version { bucket: 'qs-managed-rls-abc123', key: 'RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv', versionId: 'abc123old' }
INFO: Retrieved version content { size: 2048, versionId: 'abc123old' }
INFO: Rollback successful { oldVersionId: 'abc123old', newVersionId: 'xyz789new' }
```

## Related Functions

### Version Management
- [`listPublishHistory`](../listPublishHistory/README.md) - Lists available versions to rollback to
- [`getVersionContent`](../getVersionContent/README.md) - Previews version content before rollback

### RLS Publishing
- [`publishRLS01S3`](../publishRLS01S3/README.md) - Creates new versions
- [`publishRLS02Glue`](../publishRLS02Glue/README.md) - May need to run after rollback
- [`publishRLS03QsRLSDataSet`](../publishRLS03QsRLSDataSet/README.md) - May need to run after rollback

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

### Error: "Failed to copy version"

**Cause**: S3 copy operation failed

**Solution**:
1. Verify Lambda role has `s3:PutObject` permission
2. Check bucket policies allow writes
3. Ensure sufficient S3 storage quota
4. Verify the source version is accessible

### Rollback Successful But Changes Not Visible

**Cause**: Glue and QuickSight still reference old data

**Solution**:
1. The rollback only updates S3
2. Run the RLS publishing workflow to update Glue and QuickSight:
   - `publishRLS02Glue` - Update Glue table
   - `publishRLS03QsRLSDataSet` - Update RLS DataSet
   - `publishRLS04QsUpdateMainDataSetRLS` - Apply to main DataSet
3. Wait for SPICE ingestion to complete

### Need to Rollback the Rollback

**Cause**: Rolled back to wrong version

**Solution**:
1. Use `listPublishHistory` to see all versions (including the rollback)
2. The version before the rollback is still available
3. Rollback to the correct version
4. All versions are preserved - nothing is lost

## Best Practices

1. **Preview first**: Always use `getVersionContent` to preview before rolling back
2. **Document reason**: Keep notes on why rollback was performed
3. **Test in non-prod**: Test rollback procedures in non-production first
4. **Complete workflow**: Remember to republish to Glue and QuickSight after rollback
5. **Verify results**: Check that RLS rules work as expected after rollback
6. **Monitor versions**: Regularly review version history
7. **Backup strategy**: Rollback is your backup - ensure versioning is enabled

## Notes

- Rollback creates a new version (doesn't delete current version)
- All versions are preserved in S3
- The operation is reversible
- Rollback only affects S3 - Glue and QuickSight need separate updates
- New version ID is returned for tracking
- CSV content is returned for verification
- The function is idempotent - can be called multiple times safely
- Version history grows with each rollback

## Version History

- **v1.0** - Initial implementation

---

**Related Documentation**:
- [S3 Versioning Guide](/Guide/s3-versioning.md)
- [Version Management](/Guide/version-management.md)
- [Rollback Procedures](/Guide/rollback.md)
- [RLS Publishing Workflow](/Guide/hooks/publishQSRLSPermissions.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
