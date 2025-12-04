# createGlueDatabase

**Resource Creation Function** - Creates an AWS Glue Database in a specified region for RLS data management.

## Overview

This function creates a new AWS Glue Database with a unique name in the specified region. The database is used to store metadata for Glue tables that back QuickSight RLS (Row-Level Security) datasets. This is a prerequisite function that must be run after creating the S3 bucket.

## Function Details

- **Name**: `createGlueDatabase`
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
2. createGlueDatabase (THIS FUNCTION)
   ↓
3. createQSDataSource
   ↓
Ready for RLS Publishing Workflow
```

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the Glue Database will be created (e.g., `us-east-1`, `eu-west-1`) |

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
  "message": "Glue Database qs-managed-rls-<uuid> created in Region eu-west-1.",
  "glueDatabaseName": "qs-managed-rls-<uuid>"
}
```

**Fields**:
- `statusCode`: HTTP status code (200 for success)
- `message`: Success message with database name and region
- `glueDatabaseName`: The unique name of the created Glue Database

### Error Response (500)

```json
{
  "statusCode": 500,
  "message": "Failed to create the Glue Database in Region eu-west-1",
  "glueDatabaseName": "",
  "errorName": "GlueDbNotCreated"
}
```

## Database Naming Convention

The database name follows this pattern:
```
qs-managed-rls-<uuid>
```

Example: `qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890`

- **Prefix**: `qs-managed-rls-` (identifies RLS Manager resources)
- **UUID**: Randomly generated UUID v4 for uniqueness

## Usage Example

### GraphQL Mutation

```graphql
mutation CreateGlueDB {
  createGlueDatabase(region: "eu-west-1") {
    statusCode
    message
    glueDatabaseName
    errorName
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Create Glue Database
const response = await client.mutations.createGlueDatabase({
  region: 'eu-west-1'
});

if (response.data?.statusCode === 200) {
  const dbName = response.data.glueDatabaseName;
  console.log('✅ Glue Database created:', dbName);
  
  // Save database name for future use
  // This database will store Glue tables for RLS datasets
} else {
  console.error('❌ Failed to create database:', response.data?.message);
}
```

## Glue Database Creation Process

The function performs the following steps:

### 1. Generate Unique Database Name

**Naming Convention**:
```
qs-managed-rls-<uuid>
```

**Example**: `qs-managed-rls-db-a1b2c3d4-e5f6-7890-abcd-ef1234567890`

**Components**:
- **Prefix**: `qs-managed-rls-` (identifies RLS Manager resources)
- **UUID**: Randomly generated UUID v4 for uniqueness

### 2. Create Glue Database

**Method**: AWS SDK [Glue CreateDatabaseCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/glue/command/CreateDatabaseCommand/)

**Database Properties**:
```json
{
  "Name": "qs-managed-rls-db-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "Description": "Database created by QuickSight Managed RLS Tool"
}
```

**What it creates**:
- Glue Database in the AWS Glue Data Catalog
- Metadata container for Glue tables
- Namespace for RLS table organization

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
        "glue:CreateDatabase"
      ],
      "Resource": [
        "arn:aws:glue:*:[ACCOUNT_ID]:catalog",
        "arn:aws:glue:*:[ACCOUNT_ID]:database/qs-managed-rls-*"
      ]
    }
  ]
}
```

> **Note**: Replace `[ACCOUNT_ID]` with your AWS Account ID.

### Detailed Permissions Breakdown

Understanding why each permission is needed:

#### Glue Database Creation Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "glue:CreateDatabase"
  ],
  "Resource": [
    "arn:aws:glue:*:[ACCOUNT_ID]:catalog",
    "arn:aws:glue:*:[ACCOUNT_ID]:database/qs-managed-rls-*"
  ]
}
```

**Why needed**:
- `glue:CreateDatabase` - Required to create new Glue databases
- Catalog resource - Glue operations require access to the Data Catalog
- Database resource - Limits database creation to RLS-managed databases only

## AWS CLI Equivalent

For testing or troubleshooting, you can manually create databases using AWS CLI:

```bash
# Create Glue Database
aws glue create-database \
  --region eu-west-1 \
  --database-input '{
    "Name": "qs-managed-rls-db-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "Description": "Database created by QuickSight Managed RLS Tool"
  }'

# List all RLS databases
aws glue get-databases --region eu-west-1 \
  --query 'DatabaseList[?contains(Name, `qs-managed-rls`)].Name'

# Get specific database
aws glue get-database \
  --region eu-west-1 \
  --name qs-managed-rls-db-a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

## Logging

The function logs the following events:
- Region where database is being created
- Generated database name
- Database creation success
- Errors with error type and message

Example log output:
```
INFO: Creating Glue Database { region: 'eu-west-1', glueDatabaseName: 'qs-managed-rls-db-a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
INFO: Glue Database created successfully { glueDatabaseName: 'qs-managed-rls-db-a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
```

## Related Functions

### Previous Steps in Setup Workflow
- [`createS3Bucket`](../createS3Bucket/README.md) - Creates S3 bucket for RLS data

### Next Steps in Setup Workflow
- [`createQSDataSource`](../createQSDataSource/README.md) - Creates QuickSight DataSource that uses this database

### Functions That Use This Database
- [`publishRLS02Glue`](../publishRLS02Glue/README.md) - Creates Glue tables within this database
- [`deleteDataSetGlueTable`](../deleteDataSetGlueTable/README.md) - Deletes tables from this database

## Database Configuration Details

### Database Properties
- **Name**: UUID-based for uniqueness
- **Description**: Identifies it as RLS Manager resource
- **Catalog**: AWS Glue Data Catalog (default)
- **Region**: Specified in function call
- **Lifecycle**: Persistent (not auto-deleted)

### Database Usage

The created database stores:
- **Glue Tables**: Metadata for RLS CSV files
- **Table Schema**: Column definitions for RLS data
- **S3 Location**: References to S3 bucket paths
- **QuickSight Access**: DataSource queries tables in this database

### Regional Databases

- **One database per region**: Each managed region has its own database
- **Regional data**: Database references S3 bucket in same region
- **Independent**: Databases are independent of each other
- **Naming**: UUID ensures no conflicts across regions

## Troubleshooting

### Error: "Missing tool Resource: region"

**Cause**: Required parameter not provided

**Solution**:
- Ensure the `region` parameter is provided
- Verify the region is a valid AWS region (e.g., 'eu-west-1', 'us-east-1')
- Check that the parameter is correctly passed in the function call

### Error: "AlreadyExistsException"

**Cause**: Database name already exists (rare due to UUID)

**Solution**:
1. This should not happen due to UUID generation
2. If it does, check for manual database creation with same name pattern
3. Retry the function - it will generate a new UUID
4. Check if you already created a database for this region

### Error: "Failed to create Glue Database" (500)

**Cause**: General Glue creation failure

**Solution**:
1. Check that AWS Glue is available in the specified region
2. Verify Lambda execution role has `glue:CreateDatabase` permission (see IAM Permissions section)
3. Ensure account has not hit Glue database limits:
   - Default: 10,000 databases per region
   - Soft limit: Can be increased via AWS Support
4. Check AWS Service Health Dashboard for Glue issues
5. Verify the region parameter is valid

### Error: "AccessDeniedException"

**Cause**: Missing permissions

**Solution**:
1. Verify Lambda execution role has `glue:CreateDatabase` permission
2. Ensure the Lambda role has access to the Glue catalog
3. Check IAM policy is correctly attached to the role
4. Check for any SCP (Service Control Policies) that might block Glue access

### Database created but not visible in console

**Cause**: Looking in wrong region or account

**Solution**:
1. Check you're looking in the correct region in AWS Console
2. Verify you're using the correct AWS account
3. Use AWS CLI to list databases:
   ```bash
   aws glue get-databases --region eu-west-1 \
     --query 'DatabaseList[?contains(Name, `qs-managed-rls`)].Name'
   ```
4. Check the function response for the exact database name

### Error: "ResourceNumberLimitExceededException"

**Cause**: Account has reached the Glue database limit

**Solution**:
1. Delete unused databases to free up quota
2. Request a limit increase from AWS Support
3. Check current database count:
   ```bash
   aws glue get-databases --region eu-west-1 | jq '.DatabaseList | length'
   ```
4. Review and clean up old RLS databases

## Database Cleanup

To delete a database created by this function:

```bash
# 1. List all tables in the database
aws glue get-tables \
  --region eu-west-1 \
  --database-name qs-managed-rls-db-a1b2c3d4-e5f6-7890-abcd-ef1234567890

# 2. Delete all tables first (required before deleting database)
aws glue delete-table \
  --region eu-west-1 \
  --database-name qs-managed-rls-db-a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  --name table-name

# 3. Delete database
aws glue delete-database \
  --region eu-west-1 \
  --name qs-managed-rls-db-a1b2c3d4-e5f6-7890-abcd-ef1234567890

# Or use the AWS Console:
# 1. Navigate to AWS Glue in the AWS Console
# 2. Select "Databases" in the left menu
# 3. Select the database
# 4. Delete all tables first
# 5. Click "Delete database"
```

**Warning**: Deleting the database will break RLS functionality for that region. Only delete if you're sure you no longer need it.

## Best Practices

1. **One database per region**: Create a separate database for each region you manage
2. **Save database name**: Store the database name in your application configuration
3. **Don't delete manually**: Databases are persistent and should not be deleted unless decommissioning
4. **Regional data**: Keep database in the same region as S3 bucket and QuickSight
5. **Naming convention**: Follow the `qs-managed-rls-` prefix for easy identification

## Notes

- **One database per region**: Each managed region should have its own Glue Database
- **UUID ensures uniqueness**: Multiple deployments won't conflict
- **Database is persistent**: Not automatically deleted when resources are cleaned up
- **Used for RLS datasets**: Stores metadata for Glue tables that back QuickSight datasets
- **Catalog**: Database is created in the default AWS Glue Data Catalog
- **The function is idempotent**: Running it multiple times creates multiple databases (each with unique UUID)

## Version History

- **v1.0** - Initial implementation with UUID-based naming
- **v1.1** - Added database description
- **v1.2** - Improved error handling and logging
- **v2.0** - Updated documentation and improved error handling

---

**Related Documentation**:
- [Initial Setup Guide](/Guide/setup/initial-setup.md)
- [Glue Database Management](/Guide/glue-databases.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
