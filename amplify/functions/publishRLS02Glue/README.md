# publishRLS02Glue

**Step 2 of RLS Publishing Workflow** - Creates or updates AWS Glue tables for RLS datasets stored in S3.

## Overview

This function manages Glue Data Catalog tables that define the schema for RLS CSV files in S3. It checks if a table exists and either creates a new one or updates the existing table with the current schema. The Glue table is used by QuickSight to query the RLS data.

## Function Details

- **Name**: `publishRLS02Glue`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Workflow Position

This function is **Step 2** in the [`publishQSRLSPermissions`](/Guide/hooks/publishQSRLSPermissions.md) hook workflow:

```
Step 0: publishRLS00ResourcesValidation
   ↓
Step 1: publishRLS01S3
   ↓
Step 2: publishRLS02Glue (THIS FUNCTION)
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
| `region` | string | Yes | AWS region where Glue resources are located |
| `s3BucketName` | string | Yes | Name of the S3 bucket containing RLS datasets |
| `glueDatabaseName` | string | Yes | Name of the Glue database to create/update table in |
| `dataSetId` | string | Yes | ID of the QuickSight DataSet (used for table naming) |
| `csvColumns` | string[] | Yes | Array of column names from the CSV file |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Output

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "Glue Table 'qs-rls-dataset-123' created successfully."
}
```

or

```json
{
  "statusCode": 200,
  "message": "Glue Table 'qs-rls-dataset-123' updated successfully."
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

## Glue Table Management Process

The function performs the following steps:

### 1. Check Table Existence

**Check Method**: AWS SDK [Glue GetTableCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/glue/command/GetTableCommand/)

**What it checks**:
- Whether the table already exists in the database
- If `EntityNotFoundException` is thrown, table doesn't exist

### 2. Create or Update Table

**Decision Logic**:
- **Create Path**: If table doesn't exist, creates new table
- **Update Path**: If table exists, updates with new schema

**Table Configuration**:
- **Table Name**: `qs-rls-{dataSetId}`
- **Table Location**: `s3://{s3BucketName}/RLS-Datasets/{dataSetId}/`
- **Table Type**: EXTERNAL_TABLE
- **Column Type**: All columns are STRING type

**SerDe Configuration**:
- **SerDe Library**: `org.apache.hadoop.hive.serde2.OpenCSVSerde`
- **Input Format**: `org.apache.hadoop.mapred.TextInputFormat`
- **Output Format**: `org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat`
- **Parameters**:
  - `separatorChar`: `,`
  - `quoteChar`: `"`
  - `escapeChar`: `\`
  - `skip.header.line.count`: `1`

## Error Handling

The function handles the following Glue-specific errors:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `ValidationError` | 500 | Missing required parameters or environment variables |
| `EntityNotFoundException` | - | Table doesn't exist (triggers create operation - not an error) |
| `AlreadyExistsException` | 400 | Table already exists during create (shouldn't occur) |
| `ConcurrentModificationException` | 400 | Table being modified by another process |
| `FederationSourceException` | 400 | Federation source error |
| `InvalidInputException` | 400 | Invalid input parameters |
| `ResourceNotReadyException` | 400 | Resource not ready |
| `ResourceNumberLimitExceededException` | 400 | Too many tables in database |
| `OperationTimeoutException` | 408 | Operation timed out |
| `GlueEncryptionException` | 400 | Encryption error |
| `InternalServiceException` | 500 | Internal Glue service error |
| Generic Error | 500 | Unexpected error occurred |

## Usage Examples

### GraphQL Mutation

```graphql
mutation CreateGlueTable {
  publishRLS02Glue(
    region: "eu-west-1"
    s3BucketName: "qs-managed-rls-abc123"
    glueDatabaseName: "qs-managed-rls-db-abc123"
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
  s3BucketName: 'qs-managed-rls-abc123',
  glueDatabaseName: 'qs-managed-rls-db-abc123',
  dataSetId: 'dataset-123',
  csvColumns: ['UserName', 'GroupName', 'Region']
});

if (response.data?.statusCode === 200) {
  console.log('✓ Glue table created/updated:', response.data.message);
  // Proceed to next step: publishRLS03QsRLSDataSet
} else {
  console.error('✗ Error:', response.data?.message);
}
```

### Complete RLS Publishing Workflow (Step 2)

```typescript
async function publishRLSStep2(config: {
  region: string;
  s3BucketName: string;
  glueDatabaseName: string;
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

    // Step 2: Create/update Glue table
    console.log('Step 2: Creating/updating Glue table...');
    const glueResponse = await client.mutations.publishRLS02Glue({
      region: config.region,
      s3BucketName: config.s3BucketName,
      glueDatabaseName: config.glueDatabaseName,
      dataSetId: config.dataSetId,
      csvColumns: s3Response.data.csvColumns || []
    });

    if (glueResponse.data?.statusCode !== 200) {
      throw new Error(`Glue table creation failed: ${glueResponse.data?.message}`);
    }
    console.log('✓ Glue table created/updated');

    // Continue with Step 3: publishRLS03QsRLSDataSet
    // ...

  } catch (error) {
    console.error('RLS publishing failed:', error);
    throw error;
  }
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
        "glue:GetTable",
        "glue:CreateTable",
        "glue:UpdateTable"
      ],
      "Resource": [
        "arn:aws:glue:*:[ACCOUNT_ID]:catalog",
        "arn:aws:glue:*:[ACCOUNT_ID]:database/qs-managed-rls-*",
        "arn:aws:glue:*:[ACCOUNT_ID]:table/qs-managed-rls-*/qs-rls-*"
      ]
    }
  ]
}
```

> **Note**: Replace `[ACCOUNT_ID]` with your AWS Account ID.

### Detailed Permissions Breakdown

Understanding why each permission is needed:

#### Glue Table Management Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "glue:GetTable",
    "glue:CreateTable",
    "glue:UpdateTable"
  ],
  "Resource": [
    "arn:aws:glue:*:[ACCOUNT_ID]:catalog",
    "arn:aws:glue:*:[ACCOUNT_ID]:database/qs-managed-rls-*",
    "arn:aws:glue:*:[ACCOUNT_ID]:table/qs-managed-rls-*/qs-rls-*"
  ]
}
```

**Why needed**:
- `glue:GetTable` - Required to check if table exists before creating/updating
- `glue:CreateTable` - Required to create new Glue tables
- `glue:UpdateTable` - Required to update existing table schemas
- Catalog resource - Glue operations require access to the Data Catalog
- Database resource - Access to RLS-specific databases
- Table resource - Access to RLS-specific tables within those databases

## AWS CLI Equivalent

For testing or troubleshooting, you can manually manage Glue tables using AWS CLI:

```bash
# Check if table exists
aws glue get-table \
  --database-name qs-managed-rls-db-abc123 \
  --name qs-rls-dataset-123 \
  --region eu-west-1

# Create table
aws glue create-table \
  --database-name qs-managed-rls-db-abc123 \
  --table-input file://table-input.json \
  --region eu-west-1

# Update table
aws glue update-table \
  --database-name qs-managed-rls-db-abc123 \
  --table-input file://table-input.json \
  --region eu-west-1

# List tables in database
aws glue get-tables \
  --database-name qs-managed-rls-db-abc123 \
  --region eu-west-1
```

### Example table-input.json

```json
{
  "Name": "qs-rls-dataset-123",
  "Description": "QS-RLS Table created for DataSetId: dataset-123",
  "StorageDescriptor": {
    "Columns": [
      {"Name": "UserName", "Type": "string"},
      {"Name": "GroupName", "Type": "string"},
      {"Name": "Region", "Type": "string"}
    ],
    "Location": "s3://qs-managed-rls-abc123/RLS-Datasets/dataset-123/",
    "InputFormat": "org.apache.hadoop.mapred.TextInputFormat",
    "OutputFormat": "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
    "SerdeInfo": {
      "SerializationLibrary": "org.apache.hadoop.hive.serde2.OpenCSVSerde",
      "Parameters": {
        "separatorChar": ",",
        "quoteChar": "\"",
        "escapeChar": "\\",
        "serialization.format": "1",
        "skip.header.line.count": "1"
      }
    }
  },
  "TableType": "EXTERNAL_TABLE",
  "Parameters": {
    "skip.header.line.count": "1",
    "has_encrypted_data": "false",
    "EXTERNAL": "TRUE"
  }
}
```

## Logging

The function logs the following events:
- Check for existing table
- Decision to create or update
- Table creation/update success
- Errors with error type and message

Example log output:
```
INFO: Checking if Glue Table exists { glueTableName: 'qs-rls-dataset-123', glueDatabaseName: 'qs-managed-rls-db-abc123' }
INFO: Glue Table not found, will create { glueTableName: 'qs-rls-dataset-123' }
INFO: Creating Glue Table { glueTableName: 'qs-rls-dataset-123' }
INFO: Glue Table created successfully { glueTableName: 'qs-rls-dataset-123' }
```

## Related Functions

### Previous Steps in Workflow
- [`publishRLS00ResourcesValidation`](../publishRLS00ResourcesValidation/README.md) - Validate resources
- [`publishRLS01S3`](../publishRLS01S3/README.md) - Upload CSV to S3

### Next Steps in Workflow
- [`publishRLS03QsRLSDataSet`](../publishRLS03QsRLSDataSet/README.md) - Create/update QuickSight RLS DataSet
- [`publishRLS04QsUpdateMainDataSetRLS`](../publishRLS04QsUpdateMainDataSetRLS/README.md) - Apply RLS to main DataSet
- [`publishRLS99QsCheckIngestion`](../publishRLS99QsCheckIngestion/README.md) - Verify SPICE ingestion

### Related Functions
- [`createGlueDatabase`](../createGlueDatabase/README.md) - Creates the Glue database if needed
- [`deleteDataSetGlueTable`](../deleteDataSetGlueTable/README.md) - Deletes the Glue table

## Glue Table Configuration Details

### Table Naming Convention
- **Format**: `qs-rls-{dataSetId}`
- **Example**: `qs-rls-dataset-123`

### Table Location
- **S3 Path**: `s3://{s3BucketName}/RLS-Datasets/{dataSetId}/`
- **Example**: `s3://qs-managed-rls-abc123/RLS-Datasets/dataset-123/`

### Schema Definition
- **Column Type**: All columns are defined as `string` type for maximum compatibility
- **Column Names**: Taken from the `csvColumns` parameter
- **Null Handling**: Null column names are filtered out

### SerDe Configuration
The OpenCSVSerde configuration handles:
- CSV parsing including quoted values
- Comma-separated values
- Quote character escaping
- Header row skipping (first row is skipped during queries)

## Troubleshooting

### Error: "Missing tool Resource: csvColumns"

**Cause**: Required parameter not provided

**Solution**:
- Ensure the `csvColumns` parameter is provided and not empty
- Verify columns array contains valid strings
- Check that the parameter is correctly passed from Step 1 (publishRLS01S3)

### Error: "EntityNotFoundException" - Database does not exist

**Cause**: Glue database has not been created

**Solution**:
1. Run initial setup to create the database:
   ```typescript
   await client.mutations.createGlueDatabase({
     region: 'eu-west-1',
     databaseName: 'qs-managed-rls-db-abc123'
   });
   ```
2. Verify the database name is correct
3. Check that the database exists in the correct region
4. Run `publishRLS00ResourcesValidation` to verify all resources

### Error: "ConcurrentModificationException" (400)

**Cause**: Another process is modifying the table simultaneously

**Solution**:
1. Wait a moment and retry the operation
2. Check for concurrent RLS publishing operations
3. Implement retry logic with exponential backoff
4. Ensure only one publishing process runs at a time per DataSet

### Error: "ResourceNumberLimitExceededException" (400)

**Cause**: The database has reached the maximum number of tables

**Solution**:
1. Delete unused tables or request a limit increase from AWS
2. Consider consolidating tables if possible
3. Review and clean up old RLS tables
4. Check AWS Glue service quotas for your account

### Error: "OperationTimeoutException" (408)

**Cause**: The Glue operation took too long

**Solution**:
1. Retry the operation
2. Check AWS Glue service health dashboard
3. Verify network connectivity
4. Check if Glue service is experiencing issues in your region

### Error: "InvalidInputException" (400)

**Cause**: Invalid table configuration or parameters

**Solution**:
1. Verify all column names are valid (no special characters except underscore)
2. Check that the S3 location is valid and accessible
3. Ensure the database name follows Glue naming conventions
4. Verify the table name doesn't contain invalid characters

### Error: "AlreadyExistsException" (400)

**Cause**: Table already exists during create operation (rare)

**Solution**:
1. This shouldn't occur as the function checks existence first
2. If it does occur, retry the operation (it will update instead)
3. Check for race conditions if multiple processes are running

## Best Practices

1. **Always validate first**: Run `publishRLS00ResourcesValidation` before this step
2. **Use consistent naming**: Follow the `qs-rls-{dataSetId}` naming convention
3. **Handle updates gracefully**: The function automatically handles both create and update
4. **Monitor table count**: Keep track of the number of tables in your database
5. **Clean up old tables**: Regularly remove unused RLS tables
6. **Use string types**: All columns are STRING type for maximum compatibility

## Notes

- The function automatically handles both create and update scenarios
- All columns are defined as `string` type for maximum compatibility
- The OpenCSVSerde handles CSV parsing including quoted values
- Header row is automatically skipped during queries (skip.header.line.count = 1)
- The function uses AWS SDK v3 for Glue operations
- Maximum timeout is 120 seconds
- Table description includes the DataSet ID for reference
- The function is idempotent - running it multiple times is safe
- Table type is EXTERNAL_TABLE (data stored in S3, not in Glue)

## Version History

- **v1.0** - Initial implementation with create/update support
- **v1.1** - Added OpenCSVSerde configuration for better CSV handling
- **v1.2** - Enhanced error handling for concurrent modifications
- **v2.0** - Updated documentation and improved error messages

---

**Related Documentation**:
- [RLS Publishing Workflow Guide](/Guide/hooks/publishQSRLSPermissions.md)
- [AWS Glue Table Guide](/Guide/glue-tables.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
