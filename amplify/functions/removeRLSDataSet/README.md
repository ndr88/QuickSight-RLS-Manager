# removeRLSDataSet

Lambda function that removes Row-Level Security (RLS) configuration from a QuickSight DataSet.

## Overview

This function retrieves a QuickSight DataSet's configuration and updates it to remove the RLS DataSet association while preserving all other settings. It's used to disable RLS on a DataSet without affecting its other properties.

## Function Details

- **Name**: `removeRLSDataSet`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the QuickSight DataSet is located |
| `dataSetId` | string | Yes | ID of the QuickSight DataSet to remove RLS from |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Response

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "QuickSight DataSet updated successfully."
}
```

### Ingestion In Progress Response (201)

```json
{
  "statusCode": 201,
  "message": "QuickSight DataSet updating in progress.",
  "ingestionId": "ingestion-uuid"
}
```

**Fields**:
- `statusCode`: HTTP status code (201 indicates async operation)
- `message`: Status message
- `ingestionId`: ID to track the ingestion progress (use with `publishRLS99QsCheckIngestion`)

### Error Response

```json
{
  "statusCode": 400|500|999,
  "message": "Error description",
  "errorType": "ErrorType"
}
```

## Error Handling

The function handles the following error types:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `ReferenceError` | 400 | Missing required parameters or environment variables |
| `NotManageable` | 999 | DataSet type not supported through API |
| `GenericError` | 500 | Generic QuickSight error |
| Generic Error | 500 | Unexpected error occurred |

## Usage Example

### GraphQL Mutation

```graphql
mutation RemoveRLS {
  removeRLSDataSet(
    region: "eu-west-1"
    dataSetId: "dataset-123"
  ) {
    statusCode
    message
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

// Remove RLS from a DataSet
const response = await client.mutations.removeRLSDataSet({
  region: 'eu-west-1',
  dataSetId: 'dataset-123'
});

if (response.data?.statusCode === 200) {
  console.log('RLS removed successfully');
} else if (response.data?.statusCode === 201) {
  console.log('RLS removal in progress');
  // Poll for completion using the ingestionId
  const ingestionId = response.data.ingestionId;
  // Use publishRLS99QsCheckIngestion to check status
} else {
  console.error('Error:', response.data?.message);
}
```

### With Ingestion Polling

```typescript
async function removeRLSAndWait(dataSetId: string, region: string) {
  const response = await client.mutations.removeRLSDataSet({
    region,
    dataSetId
  });

  if (response.data?.statusCode === 201 && response.data.ingestionId) {
    // Poll for completion
    let status = 201;
    while (status === 201) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const checkResponse = await client.queries.publishRLS99QsCheckIngestion({
        datasetRegion: region,
        dataSetId: dataSetId,
        ingestionId: response.data.ingestionId
      });
      
      status = checkResponse.data?.statusCode || 500;
    }
    return status === 200;
  }
  
  return response.data?.statusCode === 200;
}
```

## Update Process

1. Retrieves the current DataSet configuration using `DescribeDataSet`
2. Removes the `RowLevelPermissionDataSet` property
3. Preserves all other DataSet properties:
   - Name
   - PhysicalTableMap
   - LogicalTableMap
   - ImportMode
   - RowLevelPermissionTagConfiguration (if present)
   - PerformanceConfiguration (if present)
   - FieldFolders (if present)
   - DataSetUsageConfiguration (if present)
   - DatasetParameters (if present)
   - ColumnLevelPermissionRules (if present)
   - ColumnGroups (if present)
4. Updates the DataSet with the new configuration

## IAM Permissions Required

The Lambda execution role needs the following QuickSight permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "quicksight:DescribeDataSet",
        "quicksight:UpdateDataSet"
      ],
      "Resource": "arn:aws:quicksight:*:*:dataset/*"
    }
  ]
}
```

## AWS CLI Equivalent

```bash
# Describe the DataSet
aws quicksight describe-data-set \
  --aws-account-id 123456789012 \
  --data-set-id dataset-123 \
  --region eu-west-1

# Update the DataSet (remove RLS configuration)
aws quicksight update-data-set \
  --aws-account-id 123456789012 \
  --data-set-id dataset-123 \
  --region eu-west-1 \
  --name "My DataSet" \
  --physical-table-map file://physical-table-map.json \
  --logical-table-map file://logical-table-map.json \
  --import-mode SPICE
```

## Logging

The function logs the following events:
- Start of RLS removal operation
- DataSet retrieval status
- Update command execution
- Ingestion ID (if async operation)
- Errors with error type and message
- End of operation

## Related Functions

- `publishRLS04QsUpdateMainDataSetRLS` - Adds RLS configuration to a DataSet
- `publishRLS99QsCheckIngestion` - Checks ingestion status for async operations
- `deleteDataSetFromQS` - Completely deletes a DataSet
- `fetchDataSetsFromQS` - Lists all DataSets

## Notes

- The function preserves all DataSet properties except RLS configuration
- If the DataSet is SPICE, an ingestion may be triggered (status 201)
- The function uses AWS SDK v3 for QuickSight operations
- Some DataSet types cannot be managed through the API (returns status 999)
- Maximum timeout is 120 seconds

## Troubleshooting

### Error: "Missing 'dataSetId' argument"
- Ensure the `dataSetId` parameter is provided
- Verify the DataSet ID is correct

### Error: "The data set type is not supported through API yet"
- The DataSet type cannot be modified via API
- This typically occurs with certain embedded or federated DataSets
- Manual removal through the QuickSight console may be required

### Error: "Access Denied"
- Verify the Lambda execution role has `quicksight:DescribeDataSet` and `quicksight:UpdateDataSet` permissions
- Check that the AWS account has QuickSight enabled
- Ensure QuickSight is available in the specified region

### Ingestion Stuck in Progress
- Use `publishRLS99QsCheckIngestion` to check the ingestion status
- Check QuickSight console for ingestion errors
- Verify SPICE capacity is available

## Version History

- **v1.0** - Initial implementation with RLS removal support
- **v1.1** - Added ingestion tracking for async operations
