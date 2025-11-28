# publishRLS02Glue

Lambda function that creates or updates AWS Glue tables for RLS datasets stored in S3.

## Overview

This function manages Glue Data Catalog tables that define the schema for RLS CSV files in S3. It checks if a table exists and either creates a new one or updates the existing table with the current schema. The Glue table is used by QuickSight to query the RLS data.

## Function Details

- **Name**: `publishRLS02Glue`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where Glue resources are located |
| `s3BucketName` | string | Yes | Name of the S3 bucket containing RLS datasets |
| `glueDatabaseName` | string | Yes | Name of the Glue database to create/update table in |
| `dataSetId` | string | Yes | ID of the QuickSight DataSet (used for table naming) |
| `csvColumns` | string[] | Yes | Array of column names from the CSV file |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Response

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "Glue Table 'qs-rls-{dataSetId}' created successfully."
}
```

or

```json
{
  "statusCode": 200,
  "message": "Glue Table 'qs-rls-{dataSetId}' updated successfully."
}
```

### Error Response

```json
{
  "statusCode": 400|408|500,
  "message": "Error description",
  "errorType": "ErrorType"
}
```

## Error Handling

The function handles the following Glue-specific errors:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `ReferenceError` | 400 | Missing required parameters or environment variables |
| `EntityNotFoundException` | - | Table doesn't exist (triggers create operation) |
| `AlreadyExistsException` | 400 | Table already exists (shouldn't occur) |
| `ConcurrentModificationException` | 400 | Table being modified by another process |
| `FederationSourceException` | 400 | Federation source error |
| `InvalidInputException` | 400 | Invalid input parameters |
| `ResourceNotReadyException` | 400 | Resource not ready |
| `ResourceNumberLimitExceededException` | 400 | Too many tables in database |
| `OperationTimeoutException` | 408 | Operation timed out |
| `GlueEncryptionException` | 400 | Encryption error |
| `InternalServiceException` | 500 | Internal Glue service error |
| Generic Error | 500 | Unexpected error occurred |

## Usage Example

### GraphQL Mutation

```graphql
mutation CreateGlueTable {
  publishRLS02Glue(
    region: "eu-west-1"
    s3BucketName: "my-rls-bucket"
    glueDatabaseName: "rls_database"
    dataSetId: "dataset-123"
    csvColumns: ["UserName", "GroupName", "Region"]
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

// Create or update Glue table
const response = await client.mutations.publishRLS02Glue({
  region: 'eu-west-1',
  s3BucketName: 'my-rls-bucket',
  glueDatabaseName: 'rls_database',
  dataSetId: 'dataset-123',
  csvColumns: ['UserName', 'GroupName', 'Region']
});

if (response.data?.statusCode === 200) {
  console.log('Glue table created/updated:', response.data.message);
  // Proceed to next step: publishRLS03QsRLSDataSet
} else {
  console.error('Error:', response.data?.message);
}
```

### Complete Workflow Integration

```typescript
async function publishRLSWorkflow(config: {
  region: string;
  s3BucketName: string;
  glueDatabaseName: string;
  dataSetId: string;
  csvHeaders: string[];
  csvContent: string;
}) {
  // Step 1: Upload to S3
  const s3Response = await client.mutations.publishRLS01S3({
    region: config.region,
    s3BucketName: config.s3BucketName,
    dataSetId: config.dataSetId,
    csvHeaders: config.csvHeaders,
    csvContent: config.csvContent
  });

  if (s3Response.data?.statusCode !== 200) {
    throw new Error('S3 upload failed');
  }

  // Step 2: Create/update Glue table
  const glueResponse = await client.mutations.publishRLS02Glue({
    region: config.region,
    s3BucketName: config.s3BucketName,
    glueDatabaseName: config.glueDatabaseName,
    dataSetId: config.dataSetId,
    csvColumns: s3Response.data.csvColumns
  });

  if (glueResponse.data?.statusCode !== 200) {
    throw new Error('Glue table creation failed');
  }

  // Continue with remaining steps...
}
```

## Glue Table Configuration

### Table Naming
- Table name format: `qs-rls-{dataSetId}`
- Example: `qs-rls-dataset-123`

### Table Location
- S3 path: `s3://{s3BucketName}/RLS-Datasets/{dataSetId}/`
- Example: `s3://my-rls-bucket/RLS-Datasets/dataset-123/`

### Schema Definition
- All columns are defined as STRING type
- Column names are taken from the `csvColumns` parameter
- Null column names are filtered out

### SerDe Configuration
- SerDe Library: `org.apache.hadoop.hive.serde2.OpenCSVSerde`
- Input Format: `org.apache.hadoop.mapred.TextInputFormat`
- Output Format: `org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat`
- Parameters:
  - `separatorChar`: `,`
  - `quoteChar`: `"`
  - `skip.header.line.count`: `1`

## Table Creation vs Update

The function automatically determines whether to create or update:

1. **Check Existence**: Uses `GetTable` to check if table exists
2. **Create Path**: If `EntityNotFoundException` is thrown, creates new table
3. **Update Path**: If table exists, updates with new schema

## IAM Permissions Required

The Lambda execution role needs the following Glue permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "glue:GetTable",
        "glue:CreateTable",
        "glue:UpdateTable"
      ],
      "Resource": [
        "arn:aws:glue:*:*:catalog",
        "arn:aws:glue:*:*:database/*",
        "arn:aws:glue:*:*:table/*/*"
      ]
    }
  ]
}
```

## AWS CLI Equivalent

```bash
# Check if table exists
aws glue get-table \
  --database-name rls_database \
  --name qs-rls-dataset-123 \
  --region eu-west-1

# Create table
aws glue create-table \
  --database-name rls_database \
  --table-input file://table-input.json \
  --region eu-west-1

# Update table
aws glue update-table \
  --database-name rls_database \
  --table-input file://table-input.json \
  --region eu-west-1
```

### Example table-input.json

```json
{
  "Name": "qs-rls-dataset-123",
  "Description": "QS-RLS Table created for DataSetId: dataset-123",
  "StorageDescriptor": {
    "Columns": [
      {"Name": "UserName", "Type": "STRING"},
      {"Name": "GroupName", "Type": "STRING"},
      {"Name": "Region", "Type": "STRING"}
    ],
    "Location": "s3://my-rls-bucket/RLS-Datasets/dataset-123/",
    "InputFormat": "org.apache.hadoop.mapred.TextInputFormat",
    "OutputFormat": "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
    "SerdeInfo": {
      "SerializationLibrary": "org.apache.hadoop.hive.serde2.OpenCSVSerde",
      "Parameters": {
        "separatorChar": ",",
        "quoteChar": "\"",
        "skip.header.line.count": "1"
      }
    }
  }
}
```

## Logging

The function logs the following events:
- Check for existing table
- Decision to create or update
- Table creation/update success
- Errors with error type and message

## Related Functions

- `publishRLS01S3` - Previous step: Upload CSV to S3
- `publishRLS03QsRLSDataSet` - Next step: Create/update QuickSight RLS DataSet
- `deleteDataSetGlueTable` - Deletes the Glue table
- `createGlueDatabase` - Creates the Glue database if needed

## Notes

- The function automatically handles both create and update scenarios
- All columns are defined as STRING type for maximum compatibility
- The OpenCSVSerde handles CSV parsing including quoted values
- Header row is automatically skipped during queries
- The function uses AWS SDK v3 for Glue operations
- Maximum timeout is 120 seconds
- Table description includes the DataSet ID for reference

## Troubleshooting

### Error: "Missing CSV Columns"
- Ensure the `csvColumns` parameter is provided and not empty
- Verify columns array contains valid strings

### Error: "Database does not exist"
- Create the Glue database using `createGlueDatabase` function
- Verify the database name is correct

### Error: "ConcurrentModificationException"
- Another process is modifying the table
- Wait a moment and retry the operation
- Check for concurrent RLS publishing operations

### Error: "ResourceNumberLimitExceededException"
- The database has reached the maximum number of tables
- Delete unused tables or request a limit increase
- Consider consolidating tables if possible

### Error: "OperationTimeoutException"
- The Glue operation took too long
- Retry the operation
- Check Glue service status

## Version History

- **v1.0** - Initial implementation with create/update support
- **v1.1** - Added OpenCSVSerde configuration for better CSV handling
- **v1.2** - Enhanced error handling for concurrent modifications
