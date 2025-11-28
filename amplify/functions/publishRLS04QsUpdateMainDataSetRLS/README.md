# publishRLS04QsUpdateMainDataSetRLS

Lambda function that applies Row-Level Security (RLS) configuration to a QuickSight DataSet by linking it to an RLS DataSet.

## Overview

This function updates a QuickSight DataSet to enable RLS by associating it with an RLS DataSet created in the previous step. It retrieves the target DataSet's configuration, adds the RLS configuration, and updates the DataSet while preserving all other settings.

## Function Details

- **Name**: `publishRLS04QsUpdateMainDataSetRLS`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where QuickSight resources are located |
| `dataSetId` | string | Yes | ID of the QuickSight DataSet to secure with RLS |
| `rlsDataSetArn` | string | Yes | ARN of the RLS DataSet containing permission rules |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Response

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "QuickSight DataSet to be Secured updated successfully."
}
```

or (if RLS already configured)

```json
{
  "statusCode": 200,
  "message": "DataSet RLS is already set to {rlsDataSetArn}. RLS Already set."
}
```

### Ingestion In Progress Response (201)

```json
{
  "statusCode": 201,
  "message": "QuickSight DataSet to be Secured updating in progress.",
  "ingestionId": "ingestion-uuid"
}
```

**Fields**:
- `statusCode`: HTTP status code (201 indicates async SPICE ingestion)
- `message`: Status message
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
| `UnsupportedUserEditionException` | 403 | QuickSight edition doesn't support RLS |
| `ResourceNotFoundException` | 404 | DataSet or RLS DataSet not found |
| `ConflictException` | 409 | Resource conflict |
| `LimitExceededException` | 409 | QuickSight resource limit exceeded |
| `ResourceExistsException` | 409 | Resource already exists |
| `ThrottlingException` | 429 | API rate limit exceeded |
| `InternalFailureException` | 500 | Internal QuickSight error |
| Generic Error | 500 | Unexpected error occurred |

## Usage Example

### GraphQL Mutation

```graphql
mutation ApplyRLSToDataSet {
  publishRLS04QsUpdateMainDataSetRLS(
    region: "eu-west-1"
    dataSetId: "dataset-123"
    rlsDataSetArn: "arn:aws:quicksight:eu-west-1:123456789012:dataset/RLS-abc-123"
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

// Apply RLS to a DataSet
const response = await client.mutations.publishRLS04QsUpdateMainDataSetRLS({
  region: 'eu-west-1',
  dataSetId: 'dataset-123',
  rlsDataSetArn: 'arn:aws:quicksight:eu-west-1:123456789012:dataset/RLS-abc-123'
});

if (response.data?.statusCode === 200) {
  console.log('RLS applied successfully');
} else if (response.data?.statusCode === 201) {
  console.log('RLS application in progress');
  // Poll for completion using ingestionId
  await pollIngestion(response.data.ingestionId);
} else {
  console.error('Error:', response.data?.message);
}
```

### Complete RLS Publishing Workflow

```typescript
async function publishCompleteRLS(config: {
  region: string;
  s3BucketName: string;
  glueDatabaseName: string;
  qsDataSourceName: string;
  dataSetId: string;
  csvHeaders: string[];
  csvContent: string;
}) {
  // Step 0: Validate resources
  await client.queries.publishRLS00ResourcesValidation({...});

  // Step 1: Upload to S3
  const s3Response = await client.mutations.publishRLS01S3({...});

  // Step 2: Create/update Glue table
  await client.mutations.publishRLS02Glue({...});

  // Step 3: Create/update RLS DataSet
  const rlsResponse = await client.mutations.publishRLS03QsRLSDataSet({...});

  // Step 4: Apply RLS to main DataSet
  const applyResponse = await client.mutations.publishRLS04QsUpdateMainDataSetRLS({
    region: config.region,
    dataSetId: config.dataSetId,
    rlsDataSetArn: rlsResponse.data!.rlsDataSetArn!
  });

  // Step 5: Check ingestion if needed
  if (applyResponse.data?.statusCode === 201) {
    await pollIngestion(applyResponse.data.ingestionId!);
  }

  return applyResponse;
}
```

## RLS Configuration Applied

The function adds the following RLS configuration to the DataSet:

```typescript
{
  RowLevelPermissionDataSet: {
    Arn: rlsDataSetArn,
    PermissionPolicy: "GRANT_ACCESS",
    Status: "ENABLED",
    FormatVersion: "VERSION_2"
  }
}
```

### Configuration Details

- **Arn**: ARN of the RLS DataSet containing permission rules
- **PermissionPolicy**: `GRANT_ACCESS` (users see only rows they have access to)
- **Status**: `ENABLED` (RLS is active)
- **FormatVersion**: `VERSION_2` (latest RLS format)

## Update Process

1. **Retrieve DataSet**: Uses `DescribeDataSet` to get current configuration
2. **Check Existing RLS**: Verifies if RLS is already configured with the same ARN
3. **Verify RLS DataSet**: Confirms the RLS DataSet exists
4. **Update DataSet**: Applies RLS configuration while preserving:
   - Name
   - PhysicalTableMap
   - LogicalTableMap
   - ImportMode
5. **Handle Ingestion**: Returns ingestion ID if SPICE refresh is triggered

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

# Update DataSet with RLS
aws quicksight update-data-set \
  --aws-account-id 123456789012 \
  --data-set-id dataset-123 \
  --name "My DataSet" \
  --physical-table-map file://physical-table-map.json \
  --logical-table-map file://logical-table-map.json \
  --import-mode SPICE \
  --row-level-permission-data-set Arn=arn:aws:quicksight:eu-west-1:123456789012:dataset/RLS-abc-123,PermissionPolicy=GRANT_ACCESS,Status=ENABLED,FormatVersion=VERSION_2 \
  --region eu-west-1
```

## Logging

The function logs the following events:
- Validation of arguments
- DataSet retrieval
- RLS configuration check
- RLS DataSet verification
- DataSet update success
- Ingestion ID (if async operation)
- Errors with error type and message

## Related Functions

- `publishRLS03QsRLSDataSet` - Previous step: Create/update RLS DataSet
- `publishRLS99QsCheckIngestion` - Check ingestion status
- `removeRLSDataSet` - Remove RLS configuration from DataSet
- `fetchDataSetsFromQS` - List DataSets and their RLS status

## Notes

- The function preserves all DataSet properties except RLS configuration
- If RLS is already set to the same ARN, returns success immediately
- Verifies the RLS DataSet exists before applying
- If the main DataSet is SPICE, an ingestion may be triggered (status 201)
- The function uses AWS SDK v3 for QuickSight operations
- Maximum timeout is 120 seconds
- QuickSight Enterprise edition is required for RLS features

## RLS Permission Policy

The function uses `GRANT_ACCESS` policy, which means:
- Users see only rows where they match the RLS rules
- If no rules match, users see no data
- Alternative is `DENY_ACCESS` (users see all rows except those matching rules)

## Troubleshooting

### Error: "Missing 'rlsDataSetArn' argument"
- Ensure the `rlsDataSetArn` parameter is provided
- Verify the ARN is correctly formatted
- Check that the RLS DataSet was created successfully

### Error: "DataSet RLS is set to {arn}, but this RLS DataSet does not exist"
- The referenced RLS DataSet was deleted
- Create a new RLS DataSet using `publishRLS03QsRLSDataSet`
- Update the reference to the new RLS DataSet

### Error: "UnsupportedUserEditionException"
- RLS requires QuickSight Enterprise edition
- Upgrade your QuickSight subscription
- Check account edition in QuickSight console

### Error: "ResourceNotFoundException"
- The main DataSet doesn't exist
- Verify the `dataSetId` is correct
- Check QuickSight console for DataSet availability

### Ingestion Stuck in Progress
- Use `publishRLS99QsCheckIngestion` to check status
- Check QuickSight console for ingestion errors
- Verify SPICE capacity is available
- Check that the RLS DataSet ingestion completed successfully

### RLS Not Working as Expected
- Verify the RLS DataSet contains correct permission rules
- Check that user names in RLS DataSet match QuickSight user names
- Ensure the RLS DataSet columns match the main DataSet columns
- Test with different users to verify row filtering

## Version History

- **v1.0** - Initial implementation with RLS application support
- **v1.1** - Added RLS DataSet existence verification
- **v1.2** - Enhanced ingestion tracking for SPICE DataSets
