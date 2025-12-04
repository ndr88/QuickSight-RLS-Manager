# publishRLS03QsRLSDataSet

**Step 3 of RLS Publishing Workflow** - Creates or updates the QuickSight RLS (Row-Level Security) DataSet that contains permission rules.

## Overview

This function manages the QuickSight DataSet that stores RLS permissions. It creates a new RLS DataSet or updates an existing one, connecting it to the Glue table created in the previous step. The RLS DataSet is then used to apply row-level security to other DataSets.

## Function Details

- **Name**: `publishRLS03QsRLSDataSet`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Workflow Position

This function is **Step 3** in the [`publishQSRLSPermissions`](/Guide/hooks/publishQSRLSPermissions.md) hook workflow:

```
Step 0: publishRLS00ResourcesValidation
   ↓
Step 1: publishRLS01S3
   ↓
Step 2: publishRLS02Glue
   ↓
Step 3: publishRLS03QsRLSDataSet (THIS FUNCTION)
   ↓
Step 4: publishRLS04QsUpdateMainDataSetRLS
   ↓
Step 99: publishRLS99QsCheckIngestion
```

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

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Output

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

## RLS DataSet Management Process

The function performs the following steps:

### 1. Determine Create or Update

**Decision Logic**:
- **rlsToolManaged = false**: Always create new DataSet
- **rlsToolManaged = true**: 
  - Checks if `rlsDataSetArn` exists in QuickSight using [DescribeDataSetCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/quicksight/command/DescribeDataSetCommand/)
  - If exists: Updates the DataSet
  - If `ResourceNotFoundException`: Creates new DataSet

### 2. Create or Update DataSet

**Create Method**: AWS SDK [QuickSight CreateDataSetCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/quicksight/command/CreateDataSetCommand/)

**Update Method**: AWS SDK [QuickSight UpdateDataSetCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/quicksight/command/UpdateDataSetCommand/)

**DataSet Configuration**:
- **Name**: `Managed-RLS for DataSetId: {dataSetId}`
- **ID**: `RLS-{uuid}` (generated for new DataSets)
- **ImportMode**: SPICE (always)
- **UseAs**: RLS_RULES (marks this as an RLS DataSet)
- **Tags**: `RLS-Manager: True`

**Data Source Configuration**:
- **Type**: CustomSql (queries Glue table)
- **SQL Query**: `SELECT * FROM "{glueDatabaseName}"."qs-rls-{dataSetId}"`
- **Columns**: All columns as STRING type

### 3. Handle SPICE Ingestion

**Response Codes**:
- **200**: DataSet created/updated successfully (no ingestion needed)
- **201**: SPICE ingestion in progress (returns ingestionId)

**Ingestion Tracking**:
- Use `ingestionId` with `publishRLS99QsCheckIngestion` to monitor progress
- SPICE ingestion is asynchronous and may take several seconds

## Error Handling

The function handles the following QuickSight-specific errors:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `ValidationError` | 500 | Missing required parameters or environment variables |
| `InvalidParameterValueException` | 400 | Invalid input parameters |
| `AccessDeniedException` | 401 | Insufficient permissions |
| `UnsupportedUserEditionException` | 403 | QuickSight edition doesn't support RLS |
| `ResourceNotFoundException` | 404 | Referenced resource not found (DataSource, Glue table) |
| `ConflictException` | 409 | Resource conflict |
| `LimitExceededException` | 409 | QuickSight resource limit exceeded |
| `ResourceExistsException` | 409 | Resource already exists |
| `ThrottlingException` | 429 | API rate limit exceeded |
| `InternalFailureException` | 500 | Internal QuickSight error |
| Generic Error | 500 | Unexpected error occurred |

## Usage Examples

### GraphQL Mutation (Create New)

```graphql
mutation CreateRLSDataSet {
  publishRLS03QsRLSDataSet(
    region: "eu-west-1"
    glueDatabaseName: "qs-managed-rls-db-abc123"
    qsDataSourceName: "qs-managed-rls-data-source-abc123"
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
    glueDatabaseName: "qs-managed-rls-db-abc123"
    qsDataSourceName: "qs-managed-rls-data-source-abc123"
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
  glueDatabaseName: 'qs-managed-rls-db-abc123',
  qsDataSourceName: 'qs-managed-rls-data-source-abc123',
  dataSetId: 'dataset-123',
  csvColumns: ['UserName', 'GroupName', 'Region'],
  rlsToolManaged: false
});

if (response.data?.statusCode === 200) {
  console.log('✓ RLS DataSet created:', response.data.rlsDataSetArn);
  // Proceed to next step
} else if (response.data?.statusCode === 201) {
  console.log('⏳ RLS DataSet creation in progress');
  // Poll for completion using ingestionId
  await pollIngestion(response.data.ingestionId);
} else {
  console.error('✗ Error:', response.data?.message);
}
```

### Complete RLS Publishing Workflow (Step 3)

```typescript
async function publishRLSStep3(config: {
  region: string;
  s3BucketName: string;
  glueDatabaseName: string;
  qsDataSourceName: string;
  dataSetId: string;
  csvHeaders: string[];
  csvContent: string;
}) {
  try {
    // Steps 1-2: Upload to S3 and create Glue table
    // ... (previous steps)

    // Step 3: Create/update RLS DataSet
    console.log('Step 3: Creating/updating RLS DataSet...');
    const rlsResponse = await client.mutations.publishRLS03QsRLSDataSet({
      region: config.region,
      glueDatabaseName: config.glueDatabaseName,
      qsDataSourceName: config.qsDataSourceName,
      dataSetId: config.dataSetId,
      csvColumns: csvColumns, // from Step 1
      rlsToolManaged: false
    });

    if (rlsResponse.data?.statusCode === 201 && rlsResponse.data.ingestionId) {
      console.log('⏳ SPICE ingestion in progress...');
      
      // Poll for completion
      let status = 201;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max
      
      while (status === 201 && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const rlsDataSetId = rlsResponse.data.rlsDataSetArn!.split('/').pop()!;
        const checkResponse = await client.queries.publishRLS99QsCheckIngestion({
          datasetRegion: config.region,
          dataSetId: rlsDataSetId,
          ingestionId: rlsResponse.data.ingestionId
        });
        
        status = checkResponse.data?.statusCode || 500;
        attempts++;
      }
      
      if (status !== 200) {
        throw new Error('SPICE ingestion failed or timed out');
      }
      console.log('✓ SPICE ingestion completed');
    } else if (rlsResponse.data?.statusCode === 200) {
      console.log('✓ RLS DataSet created/updated');
    } else {
      throw new Error(`RLS DataSet creation failed: ${rlsResponse.data?.message}`);
    }

    // Continue with Step 4: publishRLS04QsUpdateMainDataSetRLS
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
        "quicksight:CreateDataSet",
        "quicksight:UpdateDataSet",
        "quicksight:DescribeDataSet",
        "quicksight:TagResource"
      ],
      "Resource": "arn:aws:quicksight:*:[ACCOUNT_ID]:dataset/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "quicksight:DescribeDataSource"
      ],
      "Resource": "arn:aws:quicksight:*:[ACCOUNT_ID]:datasource/*"
    }
  ]
}
```

> **Note**: Replace `[ACCOUNT_ID]` with your AWS Account ID.

### Detailed Permissions Breakdown

Understanding why each permission is needed:

#### QuickSight DataSet Management Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "quicksight:CreateDataSet",
    "quicksight:UpdateDataSet",
    "quicksight:DescribeDataSet",
    "quicksight:TagResource"
  ],
  "Resource": "arn:aws:quicksight:*:[ACCOUNT_ID]:dataset/*"
}
```

**Why needed**:
- `quicksight:CreateDataSet` - Required to create new RLS DataSets
- `quicksight:UpdateDataSet` - Required to update existing RLS DataSets
- `quicksight:DescribeDataSet` - Required to check if DataSet exists before updating
- `quicksight:TagResource` - Required to tag DataSets with `RLS-Manager: True`

#### QuickSight DataSource Access Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "quicksight:DescribeDataSource"
  ],
  "Resource": "arn:aws:quicksight:*:[ACCOUNT_ID]:datasource/*"
}
```

**Why needed**:
- `quicksight:DescribeDataSource` - Required to verify DataSource exists and is accessible when creating DataSet

## AWS CLI Equivalent

For testing or troubleshooting, you can manually manage RLS DataSets using AWS CLI:

```bash
# Describe existing RLS DataSet
aws quicksight describe-data-set \
  --aws-account-id 123456789012 \
  --data-set-id RLS-abc-123 \
  --region eu-west-1

# Create RLS DataSet
aws quicksight create-data-set \
  --aws-account-id 123456789012 \
  --data-set-id RLS-abc-123 \
  --name "Managed-RLS for DataSetId: dataset-123" \
  --import-mode SPICE \
  --physical-table-map file://physical-table-map.json \
  --logical-table-map file://logical-table-map.json \
  --tags Key=RLS-Manager,Value=True \
  --region eu-west-1

# Update RLS DataSet
aws quicksight update-data-set \
  --aws-account-id 123456789012 \
  --data-set-id RLS-abc-123 \
  --name "Managed-RLS for DataSetId: dataset-123" \
  --import-mode SPICE \
  --physical-table-map file://physical-table-map.json \
  --logical-table-map file://logical-table-map.json \
  --region eu-west-1

# List all DataSets
aws quicksight list-data-sets \
  --aws-account-id 123456789012 \
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

Example log output:
```
INFO: Checking if RLS DataSet exists { rlsDataSetArn: 'arn:aws:quicksight:eu-west-1:123456789012:dataset/RLS-abc-123' }
INFO: RLS DataSet not found, will create new one { rlsDataSetArn: 'arn:aws:quicksight:eu-west-1:123456789012:dataset/RLS-abc-123' }
INFO: Creating new RLS DataSet
INFO: RLS DataSet creation in progress { ingestionId: 'abc-123-xyz' }
```

## Related Functions

### Previous Steps in Workflow
- [`publishRLS00ResourcesValidation`](../publishRLS00ResourcesValidation/README.md) - Validate resources
- [`publishRLS01S3`](../publishRLS01S3/README.md) - Upload CSV to S3
- [`publishRLS02Glue`](../publishRLS02Glue/README.md) - Create/update Glue table

### Next Steps in Workflow
- [`publishRLS04QsUpdateMainDataSetRLS`](../publishRLS04QsUpdateMainDataSetRLS/README.md) - Apply RLS to main DataSet
- [`publishRLS99QsCheckIngestion`](../publishRLS99QsCheckIngestion/README.md) - Check ingestion status

### Related Functions
- [`deleteDataSetFromQS`](../deleteDataSetFromQS/README.md) - Delete the RLS DataSet
- [`fetchDataSetsFromQS`](../fetchDataSetsFromQS/README.md) - List all DataSets including RLS DataSets

## DataSet Configuration Details

### DataSet Naming Convention
- **Name Format**: `Managed-RLS for DataSetId: {dataSetId}`
- **ID Format**: `RLS-{uuid}` (generated for new DataSets)
- **Example**: `Managed-RLS for DataSetId: dataset-123`

### DataSet Properties
- **ImportMode**: SPICE (always, for performance)
- **UseAs**: RLS_RULES (marks this as an RLS DataSet)
- **Tags**: `RLS-Manager: True` (for easy identification)

### Data Source Configuration
- **Type**: CustomSql (queries Glue table directly)
- **SQL Query**: `SELECT * FROM "{glueDatabaseName}"."qs-rls-{dataSetId}"`
- **Columns**: All columns as STRING type, matching Glue table schema

### SPICE Ingestion
- **Automatic**: SPICE ingestion starts automatically on create/update
- **Asynchronous**: May return status 201 with ingestionId
- **Monitoring**: Use `publishRLS99QsCheckIngestion` to track progress
- **Limits**: 
  - Enterprise Edition: 32 refreshes per 24 hours per DataSet
  - Standard Edition: 8 refreshes per 24 hours per DataSet

## Troubleshooting

### Error: "Missing tool Resource: csvColumns"

**Cause**: Required parameter not provided

**Solution**:
- Ensure the `csvColumns` parameter is provided and not empty
- Verify columns match those in the Glue table
- Check that the parameter is correctly passed from Step 1 (publishRLS01S3)

### Error: "Trying to update the RLS DataSet, but missing 'rlsDataSetArn' argument" (ValidationError)

**Cause**: When `rlsToolManaged` is true, `rlsDataSetArn` must be provided

**Solution**:
1. Verify the `rlsDataSetArn` parameter is provided
2. Check that the ARN is correctly formatted:
   ```
   arn:aws:quicksight:region:account-id:dataset/dataset-id
   ```
3. If creating a new DataSet, set `rlsToolManaged: false`

### Error: "UnsupportedUserEditionException" (403)

**Cause**: RLS requires QuickSight Enterprise edition

**Solution**:
1. Upgrade your QuickSight subscription to Enterprise edition
2. Check account edition in QuickSight console
3. Contact AWS support for upgrade assistance
4. Note: RLS features are not available in Standard edition

### Error: "ResourceNotFoundException" (404)

**Cause**: Referenced resource not found (DataSource or Glue table)

**Solution**:
1. Verify the QuickSight DataSource exists:
   ```typescript
   await client.queries.publishRLS00ResourcesValidation({...});
   ```
2. Check that the Glue table was created in Step 2
3. Verify the DataSource ID is correct
4. Ensure the Glue database and table exist in the specified region

### Error: "LimitExceededException" (409)

**Cause**: QuickSight resource limits exceeded

**Solution**:
1. Delete unused DataSets to free up quota
2. Request a limit increase from AWS Support
3. Check current DataSet count in QuickSight console
4. Review and clean up old RLS DataSets

### Error: "ThrottlingException" (429)

**Cause**: API rate limit exceeded

**Solution**:
1. Implement exponential backoff and retry logic
2. Reduce the frequency of DataSet operations
3. Contact AWS support to request higher API limits
4. Space out RLS publishing operations

### Error: "InternalFailureException" (500)

**Cause**: Internal QuickSight error

**Solution**:
1. Retry the operation
2. Check AWS QuickSight service health dashboard
3. Verify all input parameters are valid
4. Contact AWS support if the issue persists

### Ingestion Stuck in Progress (Status 201)

**Cause**: SPICE ingestion is taking longer than expected

**Solution**:
1. Use `publishRLS99QsCheckIngestion` to check status:
   ```typescript
   const checkResponse = await client.queries.publishRLS99QsCheckIngestion({
     datasetRegion: 'eu-west-1',
     dataSetId: 'RLS-abc-123',
     ingestionId: 'ingestion-id'
   });
   ```
2. Check QuickSight console for ingestion errors
3. Verify SPICE capacity is available using `getQSSpiceCapacity`
4. Check that Glue table and S3 data are accessible
5. Verify the CSV data is valid and properly formatted
6. Wait up to 5 minutes for large datasets

### Error: "ConflictException" (409)

**Cause**: Resource conflict or concurrent modification

**Solution**:
1. Wait a moment and retry the operation
2. Check for concurrent RLS publishing operations
3. Ensure only one publishing process runs at a time per DataSet
4. Verify the DataSet is not being modified by another process

## Best Practices

1. **Always validate first**: Run `publishRLS00ResourcesValidation` before this step
2. **Handle async ingestion**: Always check for status 201 and poll for completion
3. **Monitor SPICE capacity**: Check available SPICE capacity before creating DataSets
4. **Use consistent naming**: Follow the `Managed-RLS for DataSetId: {dataSetId}` naming convention
5. **Tag DataSets**: The `RLS-Manager: True` tag helps identify managed DataSets
6. **Clean up old DataSets**: Regularly remove unused RLS DataSets to stay within limits
7. **Enterprise edition required**: Ensure QuickSight Enterprise edition is enabled

## Notes

- The RLS DataSet is always SPICE mode for performance
- A UUID is generated for new DataSet IDs
- The function automatically handles SPICE ingestion
- Status 201 indicates async ingestion is in progress
- The RLS DataSet is tagged with `RLS-Manager: True` for easy identification
- Maximum timeout is 120 seconds
- QuickSight Enterprise edition is required for RLS features
- The function is idempotent when `rlsToolManaged: true`
- CustomSql is used to query the Glue table directly

## Version History

- **v1.0** - Initial implementation with create/update support
- **v1.1** - Added ingestion tracking for SPICE DataSets
- **v1.2** - Enhanced RLS DataSet existence checking
- **v2.0** - Updated documentation and improved error handling

---

**Related Documentation**:
- [RLS Publishing Workflow Guide](/Guide/hooks/publishQSRLSPermissions.md)
- [QuickSight RLS Guide](/Guide/quicksight-rls.md)
- [SPICE Capacity Management](/Guide/spice-capacity.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
