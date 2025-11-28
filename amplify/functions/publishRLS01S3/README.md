# publishRLS01S3

Lambda function that uploads RLS permission CSV files to S3 for QuickSight Row-Level Security configurations.

## Overview

This function validates CSV headers, creates a properly formatted CSV file, and uploads it to S3 in the designated RLS-Datasets folder structure. It's the first data-handling step in the RLS publishing workflow after resource validation.

## Function Details

- **Name**: `publishRLS01S3`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

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

## Response

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "CSV file uploaded successfully.",
  "csvColumns": ["column1", "column2", "column3"]
}
```

**Fields**:
- `statusCode`: HTTP status code (200 for success)
- `message`: Success message
- `csvColumns`: Array of validated, unique column names

### Error Response

```json
{
  "statusCode": 400|413|500,
  "message": "Error description",
  "errorType": "ErrorType",
  "csvColumns": []
}
```

## Error Handling

The function handles the following error types:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `ReferenceError` | 400 | Missing required parameters or environment variables |
| `NoValidCSVHeaders` | 500 | No valid column names found after filtering |
| `EncryptionTypeMismatch` | 400 | S3 encryption type mismatch |
| `InvalidRequest` | 400 | Invalid S3 request |
| `InvalidWriteOffset` | 400 | Invalid write offset for multipart upload |
| `TooManyParts` | 413 | Too many parts in multipart upload |
| Generic Error | 500 | Unexpected error occurred |

## Usage Example

### GraphQL Mutation

```graphql
mutation UploadRLSToS3 {
  publishRLS01S3(
    region: "eu-west-1"
    s3BucketName: "my-rls-bucket"
    dataSetId: "dataset-123"
    csvHeaders: ["UserName", "GroupName", "Region"]
    csvContent: "UserName,GroupName,Region\njohn@example.com,Sales,US\njane@example.com,Marketing,EU"
  ) {
    statusCode
    message
    csvColumns
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
  s3BucketName: 'my-rls-bucket',
  dataSetId: 'dataset-123',
  csvHeaders: csvHeaders,
  csvContent: csvContent
});

if (response.data?.statusCode === 200) {
  console.log('CSV uploaded successfully');
  console.log('Columns:', response.data.csvColumns);
  // Proceed to next step: publishRLS02Glue
} else {
  console.error('Upload failed:', response.data?.message);
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

## CSV Validation Process

The function performs the following validation on CSV headers:

1. **Filter Invalid Values**
   - Removes null values
   - Removes undefined values
   - Removes empty strings (after trimming)

2. **Remove Duplicates**
   - Creates a unique set of column names
   - Preserves order of first occurrence

3. **Validate Result**
   - Ensures at least one valid column exists
   - Returns error if no valid columns found

## S3 Path Structure

Files are uploaded to the following path:
```
s3://{s3BucketName}/RLS-Datasets/{dataSetId}/QS_RLS_Managed_{dataSetId}.csv
```

For example:
```
s3://my-rls-bucket/RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv
```

## IAM Permissions Required

The Lambda execution role needs the following S3 permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::bucket-name/RLS-Datasets/*"
    }
  ]
}
```

## AWS CLI Equivalent

```bash
# Upload CSV file
aws s3 cp local-file.csv \
  s3://my-rls-bucket/RLS-Datasets/dataset-123/QS_RLS_Managed_dataset-123.csv \
  --content-type text/csv \
  --region eu-west-1
```

## Logging

The function logs the following events:
- Start of CSV upload operation
- CSV file name and S3 key
- Validation of CSV headers
- Upload success or failure
- Errors with error type and message

## Related Functions

- `publishRLS00ResourcesValidation` - Previous step: Validate resources
- `publishRLS02Glue` - Next step: Create/update Glue table
- `deleteDataSetS3Objects` - Deletes S3 objects for a DataSet
- `createS3Bucket` - Creates the S3 bucket if needed

## Notes

- The function automatically handles CSV header validation
- Duplicate column names are removed
- Empty or null column names are filtered out
- The CSV content should include headers as the first row
- Content-Type is set to 'text/csv' for proper handling
- The function uses AWS SDK v3 for S3 operations
- Maximum timeout is 120 seconds

## CSV Format Requirements

- First row must contain column headers
- Columns should be comma-separated
- Values containing commas should be quoted
- Values containing quotes should escape quotes with double quotes
- Line endings can be \n or \r\n

Example:
```csv
UserName,GroupName,Region
john@example.com,Sales,US
jane@example.com,"Marketing, Digital",EU
bob@example.com,"Sales ""West""",US
```

## Troubleshooting

### Error: "Missing CSV Headers"
- Ensure the `csvHeaders` parameter is provided and not empty
- Verify headers array contains valid strings

### Error: "No valid CSV Headers found"
- Check that headers contain at least one non-empty string
- Remove null, undefined, or empty string values from headers

### Error: "Missing CSV Content"
- Ensure the `csvContent` parameter is provided
- Verify content includes both headers and data rows

### Error: "Access Denied"
- Verify the Lambda execution role has s3:PutObject permission
- Check bucket policies and ACLs
- Ensure the bucket exists in the specified region

### Error: "TooManyParts"
- The CSV file is too large for a single upload
- Consider splitting the data into multiple files
- Check if multipart upload configuration is needed

## Version History

- **v1.0** - Initial implementation with CSV validation and S3 upload
- **v1.1** - Added duplicate column name removal
- **v1.2** - Enhanced error handling for S3 operations
