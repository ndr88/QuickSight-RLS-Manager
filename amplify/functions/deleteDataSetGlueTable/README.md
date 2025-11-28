# deleteDataSetGlueTable

Lambda function that deletes an AWS Glue table associated with an RLS DataSet.

## Overview

This function deletes a Glue table that was created to support QuickSight RLS DataSets. The table metadata is removed from the Glue Data Catalog, but the underlying S3 data files are not affected.

## Function Details

- **Name**: `deleteDataSetGlueTable`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the Glue table is located |
| `glueDatabaseName` | string | Yes | Name of the Glue Database containing the table |
| `glueKey` | string | Yes | Unique identifier for the Glue table (used to construct table name) |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Response

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "Glue Table 'qs-rls-<glueKey>' deleted successfully."
}
```

### Error Response

```json
{
  "statusCode": 400|500,
  "errorType": "ErrorType",
  "message": "[ErrorName] Failed deleting Glue Table qs-rls-<glueKey>: error details"
}
```

## Table Naming Convention

The Glue table name is constructed as:
```
qs-rls-<glueKey>
```

Example: `qs-rls-abc123-def456`

## Error Handling

The function maps Glue errors to appropriate HTTP status codes:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `EntityNotFoundException` | 400 | Table not found (logged as warning, not error) |
| `FederationSourceException` | 400 | Federation source error |
| `InvalidInputException` | 400 | Invalid input parameters |
| `OperationTimeoutException` | 400 | Operation timed out |
| `ResourceNotReadyException` | 400 | Resource not ready |
| `FederationSourceRetryableException` | 400 | Retryable federation error |
| `GlueEncryptionException` | 500 | Encryption error |
| `InternalServiceException` | 500 | Internal Glue service error |

## Usage Example

### GraphQL Mutation

```graphql
mutation DeleteGlueTable {
  deleteDataSetGlueTable(
    region: "eu-west-1"
    glueDatabaseName: "qs-managed-rls-abc123"
    glueKey: "dataset-xyz789"
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

// Delete Glue table
const response = await client.mutations.deleteDataSetGlueTable({
  region: 'eu-west-1',
  glueDatabaseName: 'qs-managed-rls-abc123',
  glueKey: 'dataset-xyz789'
});

if (response.data?.statusCode === 200) {
  console.log('✅ Glue table deleted successfully');
} else {
  console.error('❌ Failed:', response.data?.message);
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
        "glue:DeleteTable",
        "glue:GetTable"
      ],
      "Resource": [
        "arn:aws:glue:*:*:catalog",
        "arn:aws:glue:*:*:database/qs-managed-rls-*",
        "arn:aws:glue:*:*:table/qs-managed-rls-*/qs-rls-*"
      ]
    }
  ]
}
```

## AWS CLI Equivalent

```bash
aws glue delete-table \
  --database-name qs-managed-rls-abc123 \
  --name qs-rls-dataset-xyz789 \
  --region eu-west-1
```

## Logging

The function logs:
- Validation errors
- Table deletion attempt
- Success or failure status
- EntityNotFoundException as warning (not error)

## Related Functions

- `publishRLS02Glue` - Creates Glue tables
- `deleteDataSetFromQS` - Deletes QuickSight DataSet
- `deleteDataSetS3Objects` - Deletes S3 data files

## Notes

- **Metadata only**: Deletes table metadata, not S3 data files
- **EntityNotFoundException**: Treated as warning, not error (table already gone)
- **Database not deleted**: Only the table is deleted, database remains
- **Permanent**: Deletion cannot be undone

## Workflow Integration

Typical deletion workflow:

1. Remove RLS configuration with `removeRLSDataSet`
2. Delete QuickSight DataSet with `deleteDataSetFromQS`
3. **Delete Glue table** ← You are here
4. Delete S3 objects with `deleteDataSetS3Objects`

## Troubleshooting

### Error: "Missing 'glueKey' argument"
- Ensure glueKey parameter is provided
- Verify the glueKey matches the table name

### Error: "Entity not found"
- Table may have already been deleted
- Check table name is correct
- Verify database name is correct

### Error: "Invalid input"
- Check that database name and table name are valid
- Ensure names follow Glue naming conventions
- Verify region is correct

### Table deleted but still visible in console
- Glue console may cache the list
- Refresh the page
- Wait for eventual consistency

## Cleanup

If you need to list and delete all RLS tables:

```bash
# List tables in database
aws glue get-tables \
  --database-name qs-managed-rls-abc123 \
  --region eu-west-1 \
  --query 'TableList[?starts_with(Name, `qs-rls-`)].Name'

# Delete each table
aws glue delete-table \
  --database-name qs-managed-rls-abc123 \
  --name qs-rls-<glueKey> \
  --region eu-west-1
```

## Version History

- **v1.0** - Initial implementation
- **v1.1** - Added comprehensive error handling
- **v1.2** - Improved validation and logging
