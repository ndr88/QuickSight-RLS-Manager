# publishRLS04QsUpdateMainDataSetRLS

**Step 4 of RLS Publishing Workflow** - Applies Row-Level Security (RLS) configuration to a QuickSight DataSet by linking it to an RLS DataSet.

## Overview

This function updates a QuickSight DataSet to enable RLS by associating it with an RLS DataSet created in the previous step. It retrieves the target DataSet's configuration, adds the RLS configuration, and updates the DataSet while preserving all other settings. The function handles both legacy and new QuickSight data prep experiences.

## Function Details

- **Name**: `publishRLS04QsUpdateMainDataSetRLS`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Workflow Position

This function is **Step 4** in the [`publishQSRLSPermissions`](/Guide/hooks/publishQSRLSPermissions.md) hook workflow:

```
Step 0: publishRLS00ResourcesValidation
   ↓
Step 1: publishRLS01S3
   ↓
Step 2: publishRLS02Glue
   ↓
Step 3: publishRLS03QsRLSDataSet
   ↓
Step 4: publishRLS04QsUpdateMainDataSetRLS (THIS FUNCTION)
   ↓
Step 99: publishRLS99QsCheckIngestion
```

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where QuickSight resources are located |
| `dataSetId` | string | Yes | ID of the QuickSight DataSet to secure with RLS |
| `rlsDataSetArn` | string | Yes | ARN of the RLS DataSet containing permission rules |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Output

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
  "message": "DataSet RLS already set. RLS Already configured.",
  "ingestionId": ""
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

## RLS Application Process

The function performs the following steps:

### 1. Retrieve DataSet Configuration

**Method**: AWS SDK [QuickSight DescribeDataSetCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/quicksight/command/DescribeDataSetCommand/)

**What it retrieves**:
- DataSet name and ID
- PhysicalTableMap (data source configuration)
- LogicalTableMap (transformations)
- DataPrepConfiguration (new data prep experience)
- SemanticModelConfiguration (new data prep experience)
- ImportMode (SPICE or Direct Query)
- Existing RLS configuration (if any)

### 2. Check Existing RLS Configuration

**Checks two locations**:
- **Legacy location**: Top-level `RowLevelPermissionDataSet`
- **New data prep location**: Inside `SemanticModelConfiguration.TableMap[].RowLevelPermissionConfiguration`

**If RLS already configured**:
- Verifies the RLS DataSet still exists
- Returns success if already configured with the same ARN
- Proceeds with update if RLS DataSet is missing or ARN is different

### 3. Determine Data Prep Experience

**Detection Logic**:
- **New Data Prep**: Has `DataPrepConfiguration` field
- **Legacy Data Prep**: No `DataPrepConfiguration` field

**Configuration Differences**:

| Aspect | Legacy Data Prep | New Data Prep |
|--------|------------------|---------------|
| RLS Location | Top-level `RowLevelPermissionDataSet` | Inside `SemanticModelConfiguration.TableMap` |
| Required Fields | PhysicalTableMap, LogicalTableMap | PhysicalTableMap, DataPrepConfiguration, SemanticModelConfiguration |
| RLS Scope | Dataset-level | Table-level (per table in TableMap) |

### 4. Apply RLS Configuration

**Update Method**: AWS SDK [QuickSight UpdateDataSetCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/quicksight/command/UpdateDataSetCommand/)

**RLS Configuration Applied**:
```json
{
  "Arn": "arn:aws:quicksight:region:account:dataset/RLS-xxx",
  "PermissionPolicy": "GRANT_ACCESS",
  "Status": "ENABLED",
  "FormatVersion": "VERSION_2"
}
```

**Preserved Fields**:
- Name
- ImportMode
- PhysicalTableMap
- LogicalTableMap (legacy only)
- DataPrepConfiguration (new data prep only)
- SemanticModelConfiguration (new data prep only)
- FieldFolders
- DataSetUsageConfiguration
- DatasetParameters
- ColumnLevelPermissionRules
- ColumnGroups
- RowLevelPermissionTagConfiguration

### 5. Handle SPICE Ingestion

**Response Codes**:
- **200**: DataSet updated successfully (no ingestion needed)
- **201**: SPICE ingestion in progress (returns ingestionId)

## Error Handling

The function handles the following QuickSight-specific errors:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `ValidationError` | 500 | Missing required parameters or environment variables |
| `InvalidParameterValueException` | 400 | Invalid input parameters or CSV upload dataset limitation |
| `AccessDeniedException` | 401 | Insufficient permissions |
| `UnsupportedUserEditionException` | 403 | QuickSight edition doesn't support RLS |
| `ResourceNotFoundException` | 404 | DataSet or RLS DataSet not found |
| `ConflictException` | 409 | Resource conflict |
| `LimitExceededException` | 409 | QuickSight resource limit exceeded |
| `ResourceExistsException` | 409 | Resource already exists |
| `ThrottlingException` | 429 | API rate limit exceeded |
| `InternalFailureException` | 500 | Internal QuickSight error |
| Generic Error | 500 | Unexpected error occurred |

## Usage Examples

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
  console.log('✓ RLS applied successfully');
} else if (response.data?.statusCode === 201) {
  console.log('⏳ RLS application in progress');
  // Poll for completion using ingestionId
  await pollIngestion(response.data.ingestionId);
} else {
  console.error('✗ Error:', response.data?.message);
}
```

### Complete RLS Publishing Workflow (Step 4)

```typescript
async function publishRLSStep4(config: {
  region: string;
  s3BucketName: string;
  glueDatabaseName: string;
  qsDataSourceName: string;
  dataSetId: string;
  csvHeaders: string[];
  csvContent: string;
}) {
  try {
    // Steps 0-3: Validate, upload, create Glue table, create RLS DataSet
    // ... (previous steps)

    // Step 4: Apply RLS to main DataSet
    console.log('Step 4: Applying RLS to main DataSet...');
    const applyResponse = await client.mutations.publishRLS04QsUpdateMainDataSetRLS({
      region: config.region,
      dataSetId: config.dataSetId,
      rlsDataSetArn: rlsDataSetArn // from Step 3
    });

    if (applyResponse.data?.statusCode === 201 && applyResponse.data.ingestionId) {
      console.log('⏳ SPICE ingestion in progress...');
      
      // Poll for completion
      let status = 201;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max
      
      while (status === 201 && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const checkResponse = await client.queries.publishRLS99QsCheckIngestion({
          datasetRegion: config.region,
          dataSetId: config.dataSetId,
          ingestionId: applyResponse.data.ingestionId
        });
        
        status = checkResponse.data?.statusCode || 500;
        attempts++;
      }
      
      if (status !== 200) {
        throw new Error('SPICE ingestion failed or timed out');
      }
      console.log('✓ SPICE ingestion completed');
    } else if (applyResponse.data?.statusCode === 200) {
      console.log('✓ RLS applied to main DataSet');
    } else {
      throw new Error(`RLS application failed: ${applyResponse.data?.message}`);
    }

    console.log('✓ RLS publishing workflow completed successfully');

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
        "quicksight:DescribeDataSet",
        "quicksight:UpdateDataSet"
      ],
      "Resource": "arn:aws:quicksight:*:[ACCOUNT_ID]:dataset/*"
    }
  ]
}
```

> **Note**: Replace `[ACCOUNT_ID]` with your AWS Account ID.

### Detailed Permissions Breakdown

Understanding why each permission is needed:

#### QuickSight DataSet Update Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "quicksight:DescribeDataSet",
    "quicksight:UpdateDataSet"
  ],
  "Resource": "arn:aws:quicksight:*:[ACCOUNT_ID]:dataset/*"
}
```

**Why needed**:
- `quicksight:DescribeDataSet` - Required to retrieve current DataSet configuration before updating
- `quicksight:UpdateDataSet` - Required to apply RLS configuration to the DataSet

## AWS CLI Equivalent

For testing or troubleshooting, you can manually apply RLS using AWS CLI:

```bash
# Describe the DataSet
aws quicksight describe-data-set \
  --aws-account-id 123456789012 \
  --data-set-id dataset-123 \
  --region eu-west-1

# Update DataSet with RLS (Legacy Data Prep)
aws quicksight update-data-set \
  --aws-account-id 123456789012 \
  --data-set-id dataset-123 \
  --name "My DataSet" \
  --physical-table-map file://physical-table-map.json \
  --logical-table-map file://logical-table-map.json \
  --import-mode SPICE \
  --row-level-permission-data-set Arn=arn:aws:quicksight:eu-west-1:123456789012:dataset/RLS-abc-123,PermissionPolicy=GRANT_ACCESS,Status=ENABLED,FormatVersion=VERSION_2 \
  --region eu-west-1

# Note: For new data prep experience, RLS configuration goes inside semantic-model-configuration
```

## Logging

The function logs the following events:
- Validation of arguments
- DataSet retrieval and structure analysis
- Data prep experience detection (legacy vs new)
- RLS configuration check (both locations)
- RLS DataSet verification
- DataSet update success
- Ingestion ID (if async operation)
- Errors with error type and message

Example log output:
```
INFO: Updating RLS of DataSet { dataSetId: 'dataset-123', rlsDataSetArn: 'arn:aws:quicksight:eu-west-1:123456789012:dataset/RLS-abc-123' }
INFO: Dataset data prep mode { isNewDataPrep: true, hasDataPrepConfig: true, hasSemanticModel: true }
INFO: Using new data prep RLS configuration
INFO: DataSet updated successfully
```

## Related Functions

### Previous Steps in Workflow
- [`publishRLS00ResourcesValidation`](../publishRLS00ResourcesValidation/README.md) - Validate resources
- [`publishRLS01S3`](../publishRLS01S3/README.md) - Upload CSV to S3
- [`publishRLS02Glue`](../publishRLS02Glue/README.md) - Create/update Glue table
- [`publishRLS03QsRLSDataSet`](../publishRLS03QsRLSDataSet/README.md) - Create/update RLS DataSet

### Next Steps in Workflow
- [`publishRLS99QsCheckIngestion`](../publishRLS99QsCheckIngestion/README.md) - Check ingestion status

### Related Functions
- [`removeRLSDataSet`](../removeRLSDataSet/README.md) - Remove RLS configuration from DataSet
- [`fetchDataSetsFromQS`](../fetchDataSetsFromQS/README.md) - List DataSets and their RLS status

## RLS Configuration Details

### Permission Policy: GRANT_ACCESS

The function uses `GRANT_ACCESS` policy, which means:
- **Users see only rows where they match the RLS rules**
- If no rules match, users see no data
- Alternative is `DENY_ACCESS` (users see all rows except those matching rules)

### Format Version: VERSION_2

- Latest RLS format with enhanced features
- Supports more complex permission rules
- Better performance than VERSION_1

### Data Prep Experience Support

The function automatically detects and handles both:

**Legacy Data Prep**:
- RLS at top-level `RowLevelPermissionDataSet`
- Requires `PhysicalTableMap` and `LogicalTableMap`

**New Data Prep**:
- RLS inside `SemanticModelConfiguration.TableMap[].RowLevelPermissionConfiguration`
- Requires `PhysicalTableMap`, `DataPrepConfiguration`, and `SemanticModelConfiguration`
- RLS applied per table in the TableMap

### CSV Upload Dataset Limitation

**Important**: DataSets created via direct CSV upload (not using a DataSource) may have API update limitations. If you encounter `InvalidParameterValueException` with "Invalid PhysicalTableMap", consider:
- Using a DataSource (S3/Athena/Glue) instead of direct CSV upload
- Recreating the DataSet with a proper DataSource
- This is a QuickSight API limitation, not a function issue

## Troubleshooting

### Error: "Missing tool Resource: rlsDataSetArn"

**Cause**: Required parameter not provided

**Solution**:
- Ensure the `rlsDataSetArn` parameter is provided
- Verify the ARN is correctly formatted:
  ```
  arn:aws:quicksight:region:account-id:dataset/RLS-xxx
  ```
- Check that the RLS DataSet was created successfully in Step 3

### Error: "ResourceNotFoundException" (404) - Main DataSet

**Cause**: The main DataSet doesn't exist

**Solution**:
1. Verify the `dataSetId` is correct
2. Check QuickSight console for DataSet availability
3. Ensure the DataSet exists in the specified region
4. Verify you have permissions to access the DataSet

### Error: "ResourceNotFoundException" (404) - RLS DataSet

**Cause**: The referenced RLS DataSet was deleted or doesn't exist

**Solution**:
1. Create a new RLS DataSet using `publishRLS03QsRLSDataSet`
2. Update the reference to the new RLS DataSet ARN
3. Verify the RLS DataSet exists in QuickSight console

### Error: "InvalidParameterValueException" (400) - Invalid PhysicalTableMap

**Cause**: CSV upload dataset API limitation

**Solution**:
1. **This is a known QuickSight API limitation** for DataSets created via direct CSV upload
2. Recreate the DataSet using a DataSource (S3/Athena/Glue) instead of direct CSV upload
3. The function logs a detailed error message with this suggestion
4. See "CSV Upload Dataset Limitation" section above for more details

### Error: "UnsupportedUserEditionException" (403)

**Cause**: RLS requires QuickSight Enterprise edition

**Solution**:
1. Upgrade your QuickSight subscription to Enterprise edition
2. Check account edition in QuickSight console
3. Contact AWS support for upgrade assistance
4. Note: RLS features are not available in Standard edition

### Error: "AccessDeniedException" (401)

**Cause**: Insufficient permissions

**Solution**:
1. Verify the Lambda execution role has required permissions (see IAM Permissions section)
2. Check that you have permissions to update the DataSet
3. Ensure QuickSight is enabled in the account
4. Verify the IAM role has trust relationship with Lambda service

### Error: "ThrottlingException" (429)

**Cause**: API rate limit exceeded

**Solution**:
1. Implement exponential backoff and retry logic
2. Reduce the frequency of DataSet operations
3. Contact AWS support to request higher API limits
4. Space out RLS publishing operations

### Ingestion Stuck in Progress (Status 201)

**Cause**: SPICE ingestion is taking longer than expected

**Solution**:
1. Use `publishRLS99QsCheckIngestion` to check status:
   ```typescript
   const checkResponse = await client.queries.publishRLS99QsCheckIngestion({
     datasetRegion: 'eu-west-1',
     dataSetId: 'dataset-123',
     ingestionId: 'ingestion-id'
   });
   ```
2. Check QuickSight console for ingestion errors
3. Verify SPICE capacity is available using `getQSSpiceCapacity`
4. Check that the RLS DataSet ingestion completed successfully
5. Wait up to 5 minutes for large datasets

### RLS Not Working as Expected

**Cause**: RLS rules or configuration mismatch

**Solution**:
1. **Verify RLS DataSet contains correct permission rules**:
   - Check column names match between RLS DataSet and main DataSet
   - Verify user names in RLS DataSet match QuickSight user names exactly
   - Ensure email addresses are in the correct format

2. **Check RLS DataSet structure**:
   - Must have a column that matches QuickSight user names (e.g., `UserName`)
   - Permission columns must match columns in the main DataSet
   - Data types should be consistent

3. **Test with different users**:
   - Log in as different QuickSight users
   - Verify each user sees only their permitted rows
   - Check QuickSight audit logs for RLS evaluation

4. **Verify RLS is enabled**:
   - Check DataSet settings in QuickSight console
   - Ensure RLS DataSet status is "ENABLED"
   - Verify PermissionPolicy is "GRANT_ACCESS"

## Best Practices

1. **Always validate first**: Run `publishRLS00ResourcesValidation` before this step
2. **Use DataSources**: Avoid direct CSV upload for DataSets that need RLS
3. **Test RLS rules**: Verify RLS rules work correctly before applying to production
4. **Monitor ingestion**: Always check for status 201 and poll for completion
5. **Handle both data prep experiences**: The function automatically handles both, but be aware of the differences
6. **Preserve DataSet configuration**: The function preserves all settings except RLS
7. **Enterprise edition required**: Ensure QuickSight Enterprise edition is enabled

## Notes

- The function preserves all DataSet properties except RLS configuration
- If RLS is already set to the same ARN, returns success immediately (after verifying RLS DataSet exists)
- Verifies the RLS DataSet exists before applying
- If the main DataSet is SPICE, an ingestion may be triggered (status 201)
- The function automatically detects and handles both legacy and new data prep experiences
- The function uses AWS SDK v3 for QuickSight operations
- Maximum timeout is 120 seconds
- QuickSight Enterprise edition is required for RLS features
- The function is idempotent - running it multiple times is safe

## Version History

- **v1.0** - Initial implementation with RLS application support
- **v1.1** - Added RLS DataSet existence verification
- **v1.2** - Enhanced ingestion tracking for SPICE DataSets
- **v2.0** - Added support for new QuickSight data prep experience
- **v2.1** - Enhanced error handling for CSV upload dataset limitations

---

**Related Documentation**:
- [RLS Publishing Workflow Guide](/Guide/hooks/publishQSRLSPermissions.md)
- [QuickSight RLS Guide](/Guide/quicksight-rls.md)
- [Data Prep Experience Differences](/Guide/quicksight-data-prep.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
