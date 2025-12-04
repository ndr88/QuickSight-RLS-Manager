# publishRLS01S3

**Step 1 of RLS Publishing Workflow** - Uploads RLS permission CSV files to S3 for QuickSight Row-Level Security configurations.

## Overview

This function validates CSV headers, creates a properly formatted CSV file, and uploads it to S3 in the designated RLS-Datasets folder structure. It's the first data-handling step in the RLS publishing workflow after resource validation.

## Function Details

- **Name**: `publishRLS01S3`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Workflow Position

This function is **Step 1** in the [`publishQSRLSPermissions`](/Guide/hooks/publishQSRLSPermissions.md) hook workflow:

```
Step 0: publishRLS00ResourcesValidation
   ↓
Step 1: publishRLS01S3 (THIS FUNCTION)
   ↓
Step 2: publishRLS02Glue
   ↓
Step 3: publishRLS03QsRLSDataSet
   ↓
Step 4: publishRLS04QsUpdateMainDataSetRLS
   ↓
Step 99: publishRLS99QsCheckIngestion
```

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the S3 bucket is located |
| `s3BucketName` | string | Yes | Name of the S3 bucket for RLS datasets |
| `dataSetId` | string | Yes | ID of the QuickSight DataSet (used for folder naming) |
| `csvHeaders` | string[] | Yes | Array of column names for the CSV file |
| `csvContent` | string | Yes | Complete CSV content including headers and data rows |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Output

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "CSV file uploaded successfully.",
  "csvColumns": ["column1", "column2", "column3"],
  "s3VersionId": "version-id-string",
  "s3Key": "RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv"
}
```

**Fields**:
- `statusCode`: HTTP status code (200 for success)
- `message`: Success message
- `csvColumns`: Array of validated, unique column names
- `s3VersionId`: S3 version ID of the uploaded file (if versioning enabled)
- `s3Key`: S3 object key where the file was uploaded

### Error Response

```json
{
  "statusCode": 400|413|500,
  "message": "Error description",
  "errorType": "ErrorType",
  "csvColumns": [],
  "s3VersionId": null,
  "s3Key": null
}
```

## CSV Upload Process

The function performs the following steps:

### 1. CSV Header Validation

**Validation Steps**:
1. **Filter Invalid Values** - Removes null, undefined, and empty strings
2. **Remove Duplicates** - Creates a unique set of column names
3. **Validate Result** - Ensures at least one valid column exists

**What it validates**:
- At least one valid column name exists
- Column names are non-empty strings
- No duplicate column names in the final set

### 2. S3 Upload

**Upload Method**: AWS SDK [S3 PutObjectCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/PutObjectCommand/)

**S3 Path Structure**:
```
s3://{s3BucketName}/RLS-Datasets/{dataSetId}/QS_RLS_Managed_{dataSetId}.csv
```

**Example**:
```
s3://my-rls-bucket/RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv
```

**Upload Configuration**:
- Content-Type: `text/csv`
- Body: Complete CSV content (headers + data rows)
- Versioning: Enabled (returns version ID)

## Error Handling

The function handles the following error types:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `ValidationError` | 500 | Missing required parameters or no valid CSV headers |
| `EncryptionTypeMismatch` | 400 | S3 encryption type mismatch |
| `InvalidRequest` | 400 | Invalid S3 request |
| `InvalidWriteOffset` | 400 | Invalid write offset for multipart upload |
| `TooManyParts` | 413 | Too many parts in multipart upload |
| `NoSuchBucket` | 404 | S3 bucket does not exist |
| `AccessDenied` | 403 | No permission to write to S3 bucket |
| Generic Error | 500 | Unexpected error occurred |

## Usage Examples

### GraphQL Mutation

```graphql
mutation UploadRLSToS3 {
  publishRLS01S3(
    region: "eu-west-1"
    s3BucketName: "qs-managed-rls-abc123"
    dataSetId: "dataset-123"
    csvHeaders: ["UserName", "GroupName", "Region"]
    csvContent: "UserName,GroupName,Region\njohn@example.com,Sales,US\njane@example.com,Marketing,EU"
  ) {
    statusCode
    message
    csvColumns
    s3VersionId
    s3Key
    errorType
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Prepare RLS data
const csvHeaders = ['UserName', 'GroupName', 'Region'];
const csvRows = [
  ['john@example.com', 'Sales', 'US'],
  ['jane@example.com', 'Marketing', 'EU']
];

const csvContent = [
  csvHeaders.join(','),
  ...csvRows.map(row => row.join(','))
].join('\n');

// Upload to S3
const response = await client.mutations.publishRLS01S3({
  region: 'eu-west-1',
  s3BucketName: 'qs-managed-rls-abc123',
  dataSetId: 'dataset-123',
  csvHeaders: csvHeaders,
  csvContent: csvContent
});

if (response.data?.statusCode === 200) {
  console.log('✓ CSV uploaded successfully');
  console.log('Columns:', response.data.csvColumns);
  console.log('S3 Key:', response.data.s3Key);
  console.log('Version ID:', response.data.s3VersionId);
  // Proceed to next step: publishRLS02Glue
} else {
  console.error('✗ Upload failed:', response.data?.message);
}
```

### Complete RLS Publishing Workflow (Step 1)

```typescript
async function publishRLSStep1(config: {
  region: string;
  s3BucketName: string;
  dataSetId: string;
  csvHeaders: string[];
  csvContent: string;
}) {
  try {
    // Step 1: Upload to S3
    console.log('Step 1: Uploading CSV to S3...');
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
    console.log(`  Location: ${s3Response.data.s3Key}`);
    console.log(`  Columns: ${s3Response.data.csvColumns?.join(', ')}`);

    // Continue with Step 2: publishRLS02Glue
    // ...

  } catch (error) {
    console.error('Step 1 failed:', error);
    throw error;
  }
}
```

### Building CSV Content from Data

```typescript
function buildCSVContent(headers: string[], rows: string[][]): string {
  const csvLines = [
    headers.join(','),
    ...rows.map(row => 
      row.map(cell => {
        // Escape cells containing commas or quotes
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    )
  ];
  return csvLines.join('\n');
}

// Usage
const headers = ['UserName', 'GroupName', 'Region'];
const data = [
  ['john@example.com', 'Sales', 'US'],
  ['jane@example.com', 'Marketing', 'EU']
];

const csvContent = buildCSVContent(headers, data);
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
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::qs-managed-rls-*/RLS-Datasets/*"
    }
  ]
}
```

> **Note**: Replace `qs-managed-rls-*` with your specific bucket name pattern or exact bucket name.

### Detailed Permissions Breakdown

Understanding why each permission is needed:

#### S3 Upload Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject"
  ],
  "Resource": "arn:aws:s3:::qs-managed-rls-*/RLS-Datasets/*"
}
```

**Why needed**: 
- `s3:PutObject` - Required to upload CSV files to the S3 bucket
- Resource pattern limits access to only the RLS-Datasets folder
- Wildcard pattern allows uploads across all managed RLS buckets

## AWS CLI Equivalent

For testing or troubleshooting, you can manually upload CSV files using AWS CLI:

```bash
# Upload CSV file
aws s3 cp local-file.csv \
  s3://qs-managed-rls-abc123/RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv \
  --content-type text/csv \
  --region eu-west-1

# Verify upload
aws s3 ls s3://qs-managed-rls-abc123/RLS-Datasets/dataset-123/ \
  --region eu-west-1
```

## Logging

The function logs the following events:
- Start of CSV upload operation
- CSV file name and S3 key
- Number of validated columns
- Upload success with version ID
- Errors with error type and message

Example log output:
```
INFO: Uploading CSV file to S3 { bucket: 'qs-managed-rls-abc123', key: 'RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv', columns: 3 }
INFO: CSV file uploaded successfully { key: 'qs-managed-rls-abc123/RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv', versionId: 'abc123xyz' }
```

## Related Functions

### Previous Step in Workflow
- [`publishRLS00ResourcesValidation`](../publishRLS00ResourcesValidation/README.md) - Validate resources before upload

### Next Steps in Workflow
- [`publishRLS02Glue`](../publishRLS02Glue/README.md) - Create/update Glue table
- [`publishRLS03QsRLSDataSet`](../publishRLS03QsRLSDataSet/README.md) - Create/update RLS DataSet
- [`publishRLS04QsUpdateMainDataSetRLS`](../publishRLS04QsUpdateMainDataSetRLS/README.md) - Apply RLS to main DataSet
- [`publishRLS99QsCheckIngestion`](../publishRLS99QsCheckIngestion/README.md) - Verify SPICE ingestion

### Related Functions
- [`createS3Bucket`](../createS3Bucket/README.md) - Creates the S3 bucket if needed
- [`deleteDataSetS3Objects`](../deleteDataSetS3Objects/README.md) - Deletes S3 objects for a DataSet

## CSV Format Requirements

The CSV content must follow these formatting rules:

- **First row**: Must contain column headers
- **Delimiter**: Comma-separated values
- **Quoting**: Values containing commas, quotes, or newlines must be quoted
- **Escaping**: Quotes within values must be escaped with double quotes
- **Line endings**: Can be `\n` or `\r\n`

Example:
```csv
UserName,GroupName,Region
john@example.com,Sales,US
jane@example.com,"Marketing, Digital",EU
bob@example.com,"Sales ""West""",US
```

## Troubleshooting

### Error: "Missing tool Resource: csvHeaders"

**Cause**: Required parameter not provided

**Solution**:
- Ensure the `csvHeaders` parameter is provided and not empty
- Verify headers array contains valid strings
- Check that the parameter is correctly passed in the function call

### Error: "No valid CSV Headers found" (ValidationError)

**Cause**: All CSV headers are null, undefined, or empty strings

**Solution**:
1. Check that headers contain at least one non-empty string
2. Remove null, undefined, or empty string values from headers array
3. Verify the CSV data structure is correct:
   ```typescript
   const csvHeaders = ['UserName', 'GroupName', 'Region']; // ✓ Valid
   const csvHeaders = ['', null, undefined]; // ✗ Invalid
   ```

### Error: "Missing tool Resource: csvContent"

**Cause**: Required parameter not provided

**Solution**:
- Ensure the `csvContent` parameter is provided
- Verify content includes both headers and data rows
- Check that the CSV string is properly formatted

### Error: "NoSuchBucket" (404)

**Cause**: S3 bucket does not exist

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

### Error: "Access Denied" (403)

**Cause**: Lambda execution role lacks required permissions

**Solution**:
1. Verify the Lambda execution role has `s3:PutObject` permission (see IAM Permissions section)
2. Check bucket policies and ACLs
3. Ensure the bucket exists in the specified region
4. Verify the IAM role has trust relationship with Lambda service

### Error: "TooManyParts" (413)

**Cause**: CSV file is too large for a single upload

**Solution**:
1. Consider splitting the data into multiple smaller files
2. Reduce the number of rows in the CSV
3. Check if multipart upload configuration is needed
4. Contact AWS support to request higher limits

### Error: "EncryptionTypeMismatch" (400)

**Cause**: S3 bucket encryption settings conflict with upload request

**Solution**:
1. Check the bucket's encryption configuration
2. Ensure the Lambda role has permissions for the encryption key (if using KMS)
3. Verify the bucket policy allows the encryption type being used

## Best Practices

1. **Validate before upload**: Always run `publishRLS00ResourcesValidation` first
2. **Handle duplicates**: The function automatically removes duplicate column names
3. **Escape special characters**: Use proper CSV escaping for commas, quotes, and newlines
4. **Monitor file size**: Keep CSV files under 5MB for optimal performance
5. **Enable versioning**: S3 versioning helps track changes and enables rollback
6. **Use consistent naming**: Follow the `QS_RLS_Managed_{dataSetId}.csv` naming convention

## Notes

- The function automatically handles CSV header validation
- Duplicate column names are removed automatically
- Empty or null column names are filtered out
- The CSV content should include headers as the first row
- Content-Type is set to `text/csv` for proper handling
- The function uses AWS SDK v3 for S3 operations
- Maximum timeout is 120 seconds
- The function is idempotent - uploading the same file multiple times is safe
- S3 versioning is enabled, allowing you to track file changes

## Version History

- **v1.0** - Initial implementation with CSV validation and S3 upload
- **v1.1** - Added duplicate column name removal
- **v1.2** - Enhanced error handling for S3 operations
- **v2.0** - Added s3VersionId and s3Key to response

---

**Related Documentation**:
- [RLS Publishing Workflow Guide](/Guide/hooks/publishQSRLSPermissions.md)
- [CSV Format Guide](/Guide/csv-format.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
