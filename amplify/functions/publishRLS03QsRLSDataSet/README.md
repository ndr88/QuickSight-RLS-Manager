# publishRLS03QsRLSDataSet

Lambda function that creates or updates the QuickSight RLS (Row-Level Security) DataSet that contains permission rules.

## Overview

This function manages the QuickSight DataSet that stores RLS permissions. It creates a new RLS DataSet or updates an existing one, connecting it to the Glue table created in the previous step. The RLS DataSet is then used to apply row-level security to other DataSets.

## Function Details

- **Name**: `publishRLS03QsRLSDataSet`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where QuickSight resources are located |
| `glueDatabaseName` | string | Yes | Name of the Glue database containing the RLS table |
| `qsDataSourceName` | string | Yes | ID of the QuickSight DataSource to use |
| `dataSetId` | string | Yes | ID of the main QuickSight DataSet (used for naming) |
| `csvColumns` | string[] | Yes | Array of column names from the CSV file |
| `rlsDataSetArn` | string | No | ARN of existing RLS DataSet (for updates) |
| `rlsToolManaged` | boolean | No | Whether the RLS DataSet is managed by this tool (default: false) |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Response

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "QuickSight RLS DataSet created successfully.",
  "rlsDataSetArn": "arn:aws:quicksight:region:account:dataset/rls-dataset-id"
}
```

or

```json
{
  "statusCode": 200,
  "message": "QuickSight RLS DataSet updated successfully.",
  "rlsDataSetArn": "arn:aws:quicksight:region:account:dataset/rls-dataset-id"
}
```

### Ingestion In Progress Response (201)

```json
{
  "statusCode": 201,
  "message": "QuickSight RLS DataSet creation in progress.",
  "rlsDataSetArn": "arn:aws:quicksight:region:account:dataset/rls-dataset-id",
  "ingestionId": "ingestion-uuid"
}
```

**Fields**:
- `statusCode`: HTTP status code (201 indicates async SPICE ingestion)
- `message`: Status message
- `rlsDataSetArn`: ARN of the RLS DataSet
- `ingestionId`: ID to track the ingestion progress (use with `publishRLS99QsCheckIngestion`)

### Error Response

```json
{
  "statusCode": 400|401|403|404|409|429|500,
  "message": "Error description",
  "errorType": "ErrorType"
}
```

## Error Handling

The function handles the following QuickSight-specific errors:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `ReferenceError` | 400 | Missing required parameters or environment variables |
| `InvalidParameterValueException` | 400 | Invalid input parameters |
| `AccessDeniedException` | 401 | Insufficient permissions |
| `UnsupportedUserEditionException` | 403 | QuickSight edition doesn't support this feature |
| `ResourceNotFoundException` | 404 | Referenced resource not found |
| `ConflictException` | 409 | Resource conflict |
| `LimitExceededException` | 409 | QuickSight resource limit exceeded |
| `ResourceExistsException` | 409 | Resource already exists |
| `ThrottlingException` | 429 | API rate limit exceeded |
| `InternalFailureException` | 500 | Internal QuickSight error |
| Generic Error | 500 | Unexpected error occurred |

## Usage Example

### GraphQL Mutation (Create New)

```graphql
mutation CreateRLSDataSet {
  publishRLS03QsRLSDataSet(
    region: "eu-west-1"
    glueDatabaseName: "rls_database"
    qsDataSourceName: "my-datasource-id"
    dataSetId: "dataset-123"
    csvColumns: ["UserName", "GroupName", "Region"]
    rlsToolManaged: false
  ) {
    statusCode
    message
    rlsDataSetArn
    ingestionId
    errorType
  }
}
```

### GraphQL Mutation (Update Existing)

```graphql
mutation UpdateRLSDataSet {
  publishRLS03QsRLSDataSet(
    region: "eu-west-1"
    glueDatabaseName: "rls_database"
    qsDataSourceName: "my-datasource-id"
    dataSetId: "dataset-123"
    csvColumns: ["UserName", "GroupName", "Region"]
    rlsDataSetArn: "arn:aws:quicksight:eu-west-1:123456789012:dataset/RLS-abc-123"
    rlsToolManaged: true
  ) {
    statusCode
    message
    rlsDataSetArn
    ingestionId
    errorType
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Create new RLS DataSet
const response = await client.mutations.publishRLS03QsRLSDataSet({
  region: 'eu-west-1',
  glueDatabaseName: 'rls_database',
  qsDataSourceName: 'my-datasource-id',
  dataSetId: 'dataset-123',
  csvColumns: ['UserName', 'GroupName', 'Region'],
  rlsToolManaged: false
});

if (response.data?.statusCode === 200) {
  console.log('RLS DataSet created:', response.data.rlsDataSetArn);
  // Proceed to next step
} else if (response.data?.statusCode === 201) {
  console.log('RLS DataSet creation in progress');
  // Poll for completion using ingestionId
  await pollIngestion(response.data.ingestionId);
} else {
  console.error('Error:', response.data?.message);
}
```

### With Ingestion Polling

```typescript
async function createRLSDataSetAndWait(config: {
  region: string;
  glueDatabaseName: string;
  qsDataSourceName: string;
  dataSetId: string;
  csvColumns: string[];
}) {
  const response = await client.mutations.publishRLS03QsRLSDataSet({
    ...config,
    rlsToolManaged: false
  });

  if (response.data?.statusCode === 201 && response.data.ingestionId) {
    // Poll for completion
    let status = 201;
    while (status === 201) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const checkResponse = await client.queries.publishRLS99QsCheckIngestion({
        datasetRegion: config.region,
        dataSetId: response.data.rlsDataSetArn!.split('/').pop()!,
        ingestionId: response.data.ingestionId
      });
      
      status = checkResponse.data?.statusCode || 500;
    }
    
    if (status === 200) {
      return response.data.rlsDataSetArn;
    }
    throw new Error('Ingestion failed');
  }
  
  return response.data?.rlsDataSetArn;
}
```

## DataSet Configuration

### DataSet Naming
- Name format: `Managed-RLS for DataSetId: {dataSetId}`
- ID format: `RLS-{uuid}` (for new DataSets)

### DataSet Properties
- **ImportMode**: SPICE (always)
- **PhysicalTableMap**: Relational table from Glue
  - DataSource: Specified QuickSight DataSource
  - Catalog: AwsDataCatalog
  - Schema: Specified Glue database
  - Table: `qs-rls-{dataSetId}`
- **Tags**: `RLS-Manager: True`

### Column Schema
All columns are defined as STRING type, matching the Glue table schema.

## Create vs Update Logic

The function determines whether to create or update based on:

1. **rlsToolManaged = false**: Always create new DataSet
2. **rlsToolManaged = true**: 
   - Checks if `rlsDataSetArn` exists in QuickSight
   - If exists: Updates the DataSet
   - If not found: Creates new DataSet

## IAM Permissions Required

The Lambda execution role needs the following QuickSight permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "quicksight:CreateDataSet",
        "quicksight:UpdateDataSet",
        "quicksight:DescribeDataSet",
        "quicksight:TagResource"
      ],
      "Resource": "arn:aws:quicksight:*:*:dataset/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "quicksight:DescribeDataSource"
      ],
      "Resource": "arn:aws:quicksight:*:*:datasource/*"
    }
  ]
}
```

## AWS CLI Equivalent

```bash
# Create RLS DataSet
aws quicksight create-data-set \
  --aws-account-id 123456789012 \
  --data-set-id RLS-abc-123 \
  --name "Managed-RLS for DataSetId: dataset-123" \
  --import-mode SPICE \
  --physical-table-map file://physical-table-map.json \
  --tags Key=RLS-Manager,Value=True \
  --region eu-west-1

# Update RLS DataSet
aws quicksight update-data-set \
  --aws-account-id 123456789012 \
  --data-set-id RLS-abc-123 \
  --name "Managed-RLS for DataSetId: dataset-123" \
  --import-mode SPICE \
  --physical-table-map file://physical-table-map.json \
  --region eu-west-1
```

## Logging

The function logs the following events:
- Validation of arguments
- Decision to create or update
- RLS DataSet ARN verification (for updates)
- DataSet creation/update success
- Ingestion ID (if async operation)
- Errors with error type and message

## Related Functions

- `publishRLS02Glue` - Previous step: Create/update Glue table
- `publishRLS04QsUpdateMainDataSetRLS` - Next step: Apply RLS to main DataSet
- `publishRLS99QsCheckIngestion` - Check ingestion status
- `deleteDataSetFromQS` - Delete the RLS DataSet
- `fetchDataSetsFromQS` - List all DataSets including RLS DataSets

## Notes

- The RLS DataSet is always SPICE mode for performance
- A UUID is generated for new DataSet IDs
- The function automatically handles SPICE ingestion
- Status 201 indicates async ingestion is in progress
- The RLS DataSet is tagged for easy identification
- Maximum timeout is 120 seconds
- QuickSight Enterprise edition is required for RLS features

## Troubleshooting

### Error: "Missing 'csvColumns' argument"
- Ensure the `csvColumns` parameter is provided and not empty
- Verify columns match those in the Glue table

### Error: "Trying to update the RLS DataSet, but missing 'rlsDataSetArn' argument"
- When `rlsToolManaged` is true, `rlsDataSetArn` must be provided
- Check that the ARN is correctly formatted

### Error: "UnsupportedUserEditionException"
- RLS requires QuickSight Enterprise edition
- Upgrade your QuickSight subscription
- Check account edition in QuickSight console

### Error: "LimitExceededException"
- QuickSight resource limits exceeded
- Delete unused DataSets
- Request a limit increase from AWS Support

### Ingestion Stuck in Progress
- Use `publishRLS99QsCheckIngestion` to check status
- Check QuickSight console for ingestion errors
- Verify SPICE capacity is available
- Check Glue table and S3 data are accessible

## SPICE Ingestion Limits

- **Enterprise Edition**: 32 refreshes per 24 hours per DataSet
- **Standard Edition**: 8 refreshes per 24 hours per DataSet
- Each 24-hour period is measured from the current time

## Version History

- **v1.0** - Initial implementation with create/update support
- **v1.1** - Added ingestion tracking for SPICE DataSets
- **v1.2** - Enhanced RLS DataSet existence checking
