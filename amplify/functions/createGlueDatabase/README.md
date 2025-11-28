# createGlueDatabase

Lambda function that creates an AWS Glue Database in a specified region for RLS data management.

## Overview

This function creates a new AWS Glue Database with a unique name in the specified region. The database is used to store metadata for Glue tables that back QuickSight RLS (Row-Level Security) datasets.

## Function Details

- **Name**: `createGlueDatabase`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the Glue Database will be created (e.g., `us-east-1`, `eu-west-1`) |

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

## Database Properties

The created Glue Database has the following properties:

```typescript
{
  Name: "qs-managed-rls-<uuid>",
  Description: "Database created by QuickSight Managed RLS Tool"
}
```

## IAM Permissions Required

The Lambda execution role needs the following Glue permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "glue:CreateDatabase",
        "glue:GetDatabase"
      ],
      "Resource": [
        "arn:aws:glue:*:*:catalog",
        "arn:aws:glue:*:*:database/qs-managed-rls-*"
      ]
    }
  ]
}
```

## AWS CLI Equivalent

```bash
aws glue create-database \
  --region eu-west-1 \
  --database-input '{
    "Name": "qs-managed-rls-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "Description": "Database created by QuickSight Managed RLS Tool"
  }'
```

## Logging

The function logs the following events:
- Region where database is being created
- Generated database name
- CreateDatabase command details
- Success or failure status

## Related Functions

- `publishRLS02Glue` - Creates Glue tables within this database
- `deleteDataSetGlueTable` - Deletes tables from this database
- `createQSDataSource` - Creates QuickSight DataSource that uses this database

## Notes

- **One database per region**: Each managed region should have its own Glue Database
- **UUID ensures uniqueness**: Multiple deployments won't conflict
- **Database is persistent**: Not automatically deleted when sandbox is destroyed
- **Used for RLS datasets**: Stores metadata for Athena-backed QuickSight datasets
- **Catalog**: Database is created in the default AWS Glue Data Catalog

## Workflow Integration

This function is typically called during region initialization:

1. User selects a new region to manage
2. `createS3Bucket` creates S3 bucket for RLS data
3. **`createGlueDatabase` creates Glue Database** ← You are here
4. `createQSDataSource` creates QuickSight DataSource
5. Region is ready for RLS dataset management

## Troubleshooting

### Error: "Failed to create the Glue Database"
- Check that AWS Glue is available in the specified region
- Verify the Lambda execution role has `glue:CreateDatabase` permission
- Ensure the account has not hit Glue database limits (default: 10,000 per region)

### Database name conflicts
- This should not happen due to UUID generation
- If it does, check for manual database creation with same name pattern

### Database created but not visible
- Check you're looking in the correct region
- Verify you're using the correct AWS account
- Use AWS CLI to list databases: `aws glue get-databases --region eu-west-1`

### Permission errors
- Ensure the Lambda role has access to the Glue catalog
- Check for any SCP (Service Control Policies) that might block Glue access

## Cleanup

To delete a Glue Database created by this function:

```bash
# List databases
aws glue get-databases --region eu-west-1 \
  --query 'DatabaseList[?contains(Name, `qs-managed-rls`)].Name'

# Delete database (must delete all tables first)
aws glue delete-database \
  --region eu-west-1 \
  --name qs-managed-rls-<uuid>
```

## Version History

- **v1.0** - Initial implementation with UUID-based naming
- **v1.1** - Added database description
- **v1.2** - Improved error handling and logging
