# createQSDataSource

Lambda function that creates an Amazon QuickSight Athena DataSource in a specified region.

## Overview

This function creates a new QuickSight DataSource configured to use Amazon Athena. The DataSource is used to query Glue tables that contain RLS (Row-Level Security) data. The function polls the DataSource status until creation is complete.

## Function Details

- **Name**: `createQSDataSource`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the QuickSight DataSource will be created |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |
| `RESOURCE_PREFIX` | Prefix for resource names | `qs-managed-rls-` |

## Response

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "QuickSight DataSource qs-managed-rls-<uuid> created in Region eu-west-1.",
  "qsDataSourceName": "qs-managed-rls-<uuid>"
}
```

### Error Response (500)

```json
{
  "statusCode": 500,
  "message": "Failed to create the QuickSight DataSource in Region eu-west-1",
  "qsDataSourceName": "",
  "errorName": "QsDataSourceError"
}
```

## DataSource Configuration

The created DataSource has the following properties:

```typescript
{
  DataSourceId: "qs-managed-rls-<uuid>",
  Name: "QS Managed Data Source from Athena",
  Type: "ATHENA",
  DataSourceParameters: {
    AthenaParameters: {
      WorkGroup: "primary"
    }
  }
}
```

## Usage Example

### GraphQL Mutation

```graphql
mutation CreateDataSource {
  createQSDataSource(region: "eu-west-1") {
    statusCode
    message
    qsDataSourceName
    errorName
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Create QuickSight DataSource
const response = await client.mutations.createQSDataSource({
  region: 'eu-west-1'
});

if (response.data?.statusCode === 200) {
  const dataSourceName = response.data.qsDataSourceName;
  console.log('✅ DataSource created:', dataSourceName);
} else {
  console.error('❌ Failed:', response.data?.message);
}
```

## Creation Process

The function follows this workflow:

1. **Generate unique name** using UUID
2. **Send CreateDataSource command** to QuickSight
3. **Poll status** every 1 second using DescribeDataSource
4. **Wait for completion**:
   - `CREATION_IN_PROGRESS` → Continue polling
   - `CREATION_SUCCESSFUL` → Return success
   - Other status → Return error

## IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "quicksight:CreateDataSource",
        "quicksight:DescribeDataSource"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "athena:GetWorkGroup"
      ],
      "Resource": "arn:aws:athena:*:*:workgroup/primary"
    }
  ]
}
```

## AWS CLI Equivalent

```bash
aws quicksight create-data-source \
  --aws-account-id 995997919788 \
  --data-source-id qs-managed-rls-<uuid> \
  --name "QS Managed Data Source from Athena" \
  --type ATHENA \
  --data-source-parameters '{"AthenaParameters":{"WorkGroup":"primary"}}' \
  --region eu-west-1
```

## Logging

The function logs:
- Region where DataSource is being created
- Generated DataSource name
- Creation progress status
- Polling responses
- Final success or failure

## Related Functions

- `createGlueDatabase` - Creates the Glue Database used by this DataSource
- `publishRLS03QsRLSDataSet` - Creates datasets using this DataSource
- `fetchDataSetsFromQS` - Lists datasets including those using this DataSource

## Notes

- **Athena WorkGroup**: Uses the `primary` workgroup by default
- **Polling**: Function waits for creation to complete (can take 10-30 seconds)
- **Timeout**: 120-second timeout allows for creation delays
- **One per region**: Each managed region should have its own DataSource
- **Persistent**: Not automatically deleted when sandbox is destroyed

## Workflow Integration

This function is called during region initialization:

1. `createS3Bucket` creates S3 bucket
2. `createGlueDatabase` creates Glue Database
3. **`createQSDataSource` creates QuickSight DataSource** ← You are here
4. Region is ready for RLS dataset creation

## Troubleshooting

### Error: "Failed to create the QuickSight DataSource"
- Verify QuickSight is enabled in your account
- Check that Athena is available in the region
- Ensure the `primary` workgroup exists in Athena

### DataSource creation times out
- Increase Lambda timeout if needed
- Check QuickSight service status
- Verify network connectivity

### Permission errors
- Ensure Lambda role has `quicksight:CreateDataSource` permission
- Verify access to Athena workgroup
- Check QuickSight subscription is active

## Cleanup

```bash
# Delete DataSource
aws quicksight delete-data-source \
  --aws-account-id 995997919788 \
  --data-source-id qs-managed-rls-<uuid> \
  --region eu-west-1
```

## Version History

- **v1.0** - Initial implementation with status polling
- **v1.1** - Added error handling for creation failures
- **v1.2** - Improved logging and timeout handling
