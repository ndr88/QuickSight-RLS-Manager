# createQSDataSource

**Resource Creation Function** - Creates an Amazon QuickSight Athena DataSource in a specified region.

## Overview

This function creates a new QuickSight DataSource configured to use Amazon Athena. The DataSource is used to query Glue tables that contain RLS (Row-Level Security) data. The function polls the DataSource status until creation is complete. This is the final prerequisite function in the initial setup workflow.

## Function Details

- **Name**: `createQSDataSource`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Workflow Position

This function is part of the **initial setup workflow** for each region:

```
1. createS3Bucket
   ↓
2. createGlueDatabase
   ↓
3. createQSDataSource (THIS FUNCTION)
   ↓
✓ Ready for RLS Publishing Workflow
```

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the QuickSight DataSource will be created |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |
| `RESOURCE_PREFIX` | Prefix for resource names | `qs-managed-rls-` |

## Output

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

## QuickSight DataSource Creation Process

The function performs the following steps:

### 1. Generate Unique DataSource Name

**Naming Convention**:
```
qs-managed-rls-<uuid>
```

**Example**: `qs-managed-rls-data-source-a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Components**:
- **Prefix**: `qs-managed-rls-` (identifies RLS Manager resources)
- **UUID**: Randomly generated UUID v4 for uniqueness

### 2. Create QuickSight DataSource

**Method**: AWS SDK [QuickSight CreateDataSourceCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/quicksight/command/CreateDataSourceCommand/)

**DataSource Configuration**:
```json
{
  "DataSourceId": "qs-managed-rls-data-source-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "Name": "QS Managed Data Source from Athena",
  "Type": "ATHENA",
  "DataSourceParameters": {
    "AthenaParameters": {
      "WorkGroup": "primary"
    }
  }
}
```

**What it creates**:
- QuickSight DataSource connected to Athena
- Uses Athena's `primary` workgroup
- Enables querying of Glue tables
- Provides data access for RLS DataSets

### 3. Poll for Creation Completion

**Method**: AWS SDK [QuickSight DescribeDataSourceCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/quicksight/command/DescribeDataSourceCommand/)

**Polling Logic**:
1. Send DescribeDataSource request
2. Check status:
   - `CREATION_IN_PROGRESS` → Wait 1 second, retry
   - `CREATION_SUCCESSFUL` → Return success
   - Other status → Return error
3. Repeat until completion or timeout

**Typical Creation Time**: 10-30 seconds

## Usage Examples

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
  console.log('✓ DataSource created:', dataSourceName);
  console.log('✓ Region setup complete - ready for RLS publishing');
  
  // Save DataSource name for future use
  // This DataSource will be used by RLS DataSets
} else {
  console.error('✗ Failed:', response.data?.message);
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
        "quicksight:CreateDataSource",
        "quicksight:DescribeDataSource"
      ],
      "Resource": "arn:aws:quicksight:*:[ACCOUNT_ID]:datasource/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "athena:GetWorkGroup"
      ],
      "Resource": "arn:aws:athena:*:[ACCOUNT_ID]:workgroup/primary"
    }
  ]
}
```

> **Note**: Replace `[ACCOUNT_ID]` with your AWS Account ID.

### Detailed Permissions Breakdown

Understanding why each permission is needed:

#### QuickSight DataSource Creation Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "quicksight:CreateDataSource",
    "quicksight:DescribeDataSource"
  ],
  "Resource": "arn:aws:quicksight:*:[ACCOUNT_ID]:datasource/*"
}
```

**Why needed**:
- `quicksight:CreateDataSource` - Required to create new QuickSight DataSources
- `quicksight:DescribeDataSource` - Required to poll creation status until complete

#### Athena WorkGroup Access Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "athena:GetWorkGroup"
  ],
  "Resource": "arn:aws:athena:*:[ACCOUNT_ID]:workgroup/primary"
}
```

**Why needed**:
- `athena:GetWorkGroup` - Required to verify the Athena workgroup exists and is accessible
- QuickSight validates workgroup access during DataSource creation

## AWS CLI Equivalent

For testing or troubleshooting, you can manually create DataSources using AWS CLI:

```bash
# Create QuickSight DataSource
aws quicksight create-data-source \
  --aws-account-id 123456789012 \
  --data-source-id qs-managed-rls-data-source-a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  --name "QS Managed Data Source from Athena" \
  --type ATHENA \
  --data-source-parameters '{"AthenaParameters":{"WorkGroup":"primary"}}' \
  --region eu-west-1

# Check DataSource status
aws quicksight describe-data-source \
  --aws-account-id 123456789012 \
  --data-source-id qs-managed-rls-data-source-a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  --region eu-west-1

# List all DataSources
aws quicksight list-data-sources \
  --aws-account-id 123456789012 \
  --region eu-west-1
```

## Logging

The function logs the following events:
- Region where DataSource is being created
- Generated DataSource name
- Creation initiation (status 202)
- Polling status checks
- Creation completion
- Errors with error type and message

Example log output:
```
INFO: Creating QuickSight DataSource { region: 'eu-west-1', dataSourceName: 'qs-managed-rls-data-source-a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
INFO: QuickSight DataSource creation in progress
DEBUG: DataSource status { status: 'CREATION_IN_PROGRESS' }
DEBUG: DataSource status { status: 'CREATION_SUCCESSFUL' }
INFO: QuickSight DataSource created successfully
```

## Related Functions

### Previous Steps in Setup Workflow
- [`createS3Bucket`](../createS3Bucket/README.md) - Creates S3 bucket for RLS data
- [`createGlueDatabase`](../createGlueDatabase/README.md) - Creates Glue Database

### Functions That Use This DataSource
- [`publishRLS03QsRLSDataSet`](../publishRLS03QsRLSDataSet/README.md) - Creates RLS DataSets using this DataSource
- [`fetchDataSetsFromQS`](../fetchDataSetsFromQS/README.md) - Lists DataSets including those using this DataSource

## DataSource Configuration Details

### DataSource Properties
- **Type**: ATHENA (queries data through Athena)
- **WorkGroup**: primary (default Athena workgroup)
- **Name**: "QS Managed Data Source from Athena"
- **Region**: Specified in function call
- **Lifecycle**: Persistent (not auto-deleted)

### DataSource Usage

The created DataSource:
- **Connects QuickSight to Athena**: Enables querying of Glue tables
- **Accesses Glue Database**: Queries tables in the RLS Glue database
- **Reads S3 Data**: Through Athena, accesses CSV files in S3
- **Powers RLS DataSets**: Used by RLS DataSets to load permission data

### Regional DataSources

- **One DataSource per region**: Each managed region has its own DataSource
- **Regional data**: DataSource queries Glue database in same region
- **Independent**: DataSources are independent of each other
- **Naming**: UUID ensures no conflicts across regions

## Troubleshooting

### Error: "Missing tool Resource: region"

**Cause**: Required parameter not provided

**Solution**:
- Ensure the `region` parameter is provided
- Verify the region is a valid AWS region (e.g., 'eu-west-1', 'us-east-1')
- Check that the parameter is correctly passed in the function call

### Error: "ResourceExistsException"

**Cause**: DataSource name already exists (rare due to UUID)

**Solution**:
1. This should not happen due to UUID generation
2. If it does, check for manual DataSource creation with same name pattern
3. Retry the function - it will generate a new UUID
4. Check if you already created a DataSource for this region

### Error: "Failed to create QuickSight DataSource" (500)

**Cause**: General QuickSight creation failure

**Solution**:
1. **Verify QuickSight is enabled** in your account:
   - Go to QuickSight console
   - Complete QuickSight signup if not done
   - Ensure you have an active QuickSight subscription
2. Check that Athena is available in the region
3. Verify Lambda execution role has required permissions (see IAM Permissions section)
4. Check AWS Service Health Dashboard for QuickSight issues
5. Ensure the region parameter is valid

### Error: "AccessDeniedException"

**Cause**: Missing QuickSight or Athena permissions

**Solution**:
1. Verify Lambda execution role has `quicksight:CreateDataSource` permission
2. Verify Lambda execution role has `athena:GetWorkGroup` permission
3. Check IAM policy is correctly attached to the role
4. Ensure QuickSight service role has necessary permissions
5. Verify the account has QuickSight enabled

### Error: "InvalidParameterValueException" - Athena workgroup

**Cause**: The `primary` Athena workgroup doesn't exist or is misconfigured

**Solution**:
1. Verify the `primary` workgroup exists in Athena:
   ```bash
   aws athena get-work-group --work-group primary --region eu-west-1
   ```
2. Create the workgroup if it doesn't exist:
   ```bash
   aws athena create-work-group \
     --name primary \
     --configuration ResultConfigurationUpdates={OutputLocation=s3://your-athena-results-bucket/} \
     --region eu-west-1
   ```
3. Ensure the workgroup is in the correct region
4. Verify QuickSight has permissions to access the workgroup

### DataSource creation times out (Lambda timeout)

**Cause**: Creation taking longer than 120 seconds

**Solution**:
1. Check QuickSight service status in AWS Service Health Dashboard
2. Verify network connectivity between Lambda and QuickSight
3. Retry the operation - may be a transient issue
4. Check QuickSight console for the DataSource status
5. If consistently timing out, contact AWS Support

### DataSource stuck in "CREATION_IN_PROGRESS"

**Cause**: QuickSight creation process is delayed

**Solution**:
1. Wait longer - creation can take up to 60 seconds in some cases
2. Check QuickSight console for more details
3. Verify Athena workgroup is accessible
4. Check QuickSight service role permissions
5. If stuck for > 5 minutes, delete and recreate:
   ```bash
   aws quicksight delete-data-source \
     --aws-account-id 123456789012 \
     --data-source-id datasource-id \
     --region eu-west-1
   ```

### Error: "UnsupportedUserEditionException"

**Cause**: QuickSight edition doesn't support this feature

**Solution**:
1. Verify you have QuickSight Enterprise or Standard edition
2. Some features require Enterprise edition
3. Upgrade your QuickSight subscription if needed
4. Check account edition in QuickSight console

### DataSource created but not visible in console

**Cause**: Looking in wrong region or account

**Solution**:
1. Check you're looking in the correct region in QuickSight console
2. Verify you're using the correct AWS account
3. Use AWS CLI to list DataSources:
   ```bash
   aws quicksight list-data-sources \
     --aws-account-id 123456789012 \
     --region eu-west-1
   ```
4. Check the function response for the exact DataSource ID

## DataSource Cleanup

To delete a DataSource created by this function:

```bash
# Delete DataSource
aws quicksight delete-data-source \
  --aws-account-id 123456789012 \
  --data-source-id qs-managed-rls-data-source-a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  --region eu-west-1

# Or use the QuickSight Console:
# 1. Navigate to QuickSight
# 2. Click on your profile icon → Manage QuickSight
# 3. Select "Data sources" in the left menu
# 4. Find the DataSource
# 5. Click the three dots → Delete
```

**Warning**: Deleting the DataSource will break RLS functionality for that region. Only delete if you're sure you no longer need it.

## Best Practices

1. **One DataSource per region**: Create a separate DataSource for each region you manage
2. **Save DataSource name**: Store the DataSource ID in your application configuration
3. **Don't delete manually**: DataSources are persistent and should not be deleted unless decommissioning
4. **Use primary workgroup**: Stick with the default `primary` Athena workgroup unless you have specific requirements
5. **Regional data**: Keep DataSource in the same region as Glue database and S3 bucket
6. **QuickSight setup**: Ensure QuickSight is properly set up before running this function

## Notes

- **Athena WorkGroup**: Uses the `primary` workgroup by default
- **Polling**: Function waits for creation to complete (typically 10-30 seconds)
- **Timeout**: 120-second Lambda timeout allows for creation delays
- **One per region**: Each managed region should have its own DataSource
- **Persistent**: Not automatically deleted when resources are cleaned up
- **QuickSight required**: Account must have QuickSight enabled
- **The function is idempotent**: Running it multiple times creates multiple DataSources (each with unique UUID)
- **Async creation**: QuickSight creates DataSources asynchronously (status 202)

## Version History

- **v1.0** - Initial implementation with UUID-based naming
- **v1.1** - Added status polling for creation completion
- **v1.2** - Improved error handling and logging
- **v2.0** - Updated documentation and improved error handling

---

**Related Documentation**:
- [Initial Setup Guide](/Guide/setup/initial-setup.md)
- [QuickSight DataSource Management](/Guide/quicksight-datasources.md)
- [Athena Configuration](/Guide/athena-setup.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
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
