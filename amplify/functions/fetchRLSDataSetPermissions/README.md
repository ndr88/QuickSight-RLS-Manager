# fetchRLSDataSetPermissions

**Data Fetching Function** - Retrieves permissions configured on an RLS DataSet.

## Overview

This function calls the QuickSight `DescribeDataSetPermissions` API to fetch the permissions (principals and actions) configured on an RLS DataSet. This is used to display who has access to the RLS DataSet and what actions they can perform.

## Function Details

- **Name**: `fetchRLSDataSetPermissions`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the RLS DataSet is located |
| `rlsDataSetId` | string | Yes | ID of the RLS DataSet to fetch permissions for |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Output

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "RLS DataSet permissions fetched successfully.",
  "permissions": "[{\"Principal\":\"arn:aws:quicksight:...\",\"Actions\":[...]}]"
}
```

### Error Response (500)

```json
{
  "statusCode": 500,
  "message": "Failed to fetch RLS DataSet permissions",
  "permissions": "[]",
  "errorType": "ErrorType"
}
```

## Permission Object Structure

Each permission in the `permissions` array contains:

```typescript
{
  Principal: string;        // ARN of the principal (user, group, or role)
  Actions: string[];        // Array of allowed actions
}
```

### Common Actions

- `quicksight:DescribeDataSet`
- `quicksight:DescribeDataSetPermissions`
- `quicksight:PassDataSet`
- `quicksight:DescribeIngestion`
- `quicksight:ListIngestions`
- `quicksight:UpdateDataSet`
- `quicksight:DeleteDataSet`
- `quicksight:CreateIngestion`
- `quicksight:CancelIngestion`
- `quicksight:UpdateDataSetPermissions`

## DataSet Permissions Fetching Process

The function performs the following steps:

### 1. Query DataSet Permissions

**Method**: AWS SDK [QuickSight DescribeDataSetPermissionsCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/quicksight/command/DescribeDataSetPermissionsCommand/)

**What it retrieves**:
- List of principals with access
- Actions each principal can perform
- Permission configuration

## Usage Examples

### GraphQL Query

```graphql
query FetchRLSPermissions {
  fetchRLSDataSetPermissions(
    region: "eu-west-1"
    rlsDataSetId: "RLS-abc-123"
  ) {
    statusCode
    message
    permissions
    errorType
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Fetch RLS DataSet permissions
const response = await client.queries.fetchRLSDataSetPermissions({
  region: 'eu-west-1',
  rlsDataSetId: 'RLS-abc-123'
});

if (response.data?.statusCode === 200) {
  const permissions = JSON.parse(response.data.permissions);
  
  console.log(`Found ${permissions.length} permission entries`);
  
  permissions.forEach(perm => {
    console.log(`Principal: ${perm.Principal}`);
    console.log(`Actions: ${perm.Actions.join(', ')}`);
  });
} else {
  console.error('✗ Failed:', response.data?.message);
}
```

## IAM Permissions Required

### Ready-to-Use Policy (Recommended)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "quicksight:DescribeDataSetPermissions"
      ],
      "Resource": "arn:aws:quicksight:*:[ACCOUNT_ID]:dataset/*"
    }
  ]
}
```

> **Note**: Replace `[ACCOUNT_ID]` with your AWS Account ID.

### Detailed Permissions Breakdown

**Why needed**:
- `quicksight:DescribeDataSetPermissions` - Required to retrieve DataSet permission configuration

## AWS CLI Equivalent

```bash
# Describe DataSet permissions
aws quicksight describe-data-set-permissions \
  --aws-account-id 123456789012 \
  --data-set-id RLS-abc-123 \
  --region eu-west-1
```

## Logging

The function logs:
- Start of permission fetch operation
- RLS DataSet ID being queried
- Number of permissions found
- Errors with error type and message

Example log output:
```
INFO: Fetching RLS DataSet permissions { rlsDataSetId: 'RLS-abc-123' }
INFO: Permissions fetched successfully { count: 3 }
```

## Related Functions

### RLS Management Functions
- [`publishRLS03QsRLSDataSet`](../publishRLS03QsRLSDataSet/README.md) - Creates/updates RLS DataSets
- [`updateRLSDataSetPermissions`](../updateRLSDataSetPermissions/README.md) - Updates DataSet permissions

### Other Data Fetching Functions
- [`fetchDataSetsFromQS`](../fetchDataSetsFromQS/README.md) - Lists all DataSets
- [`fetchDataSetFieldsFromQS`](../fetchDataSetFieldsFromQS/README.md) - Gets DataSet fields

## Troubleshooting

### Error: "Missing tool Resource: rlsDataSetId"

**Cause**: Required parameter not provided

**Solution**:
- Ensure the `rlsDataSetId` parameter is provided
- Verify the DataSet ID is correct
- Check that the parameter is correctly passed in the function call

### Error: "ResourceNotFoundException" (404)

**Cause**: RLS DataSet doesn't exist

**Solution**:
1. Verify the RLS DataSet ID is correct
2. Check that the DataSet exists in the specified region
3. Use `fetchDataSetsFromQS` to list available DataSets
4. Ensure the DataSet wasn't deleted

### Error: "AccessDeniedException" (403)

**Cause**: Insufficient permissions

**Solution**:
1. Verify Lambda role has `quicksight:DescribeDataSetPermissions` permission
2. Check that the DataSet exists in the specified region
3. Ensure QuickSight is enabled in the account
4. Verify the IAM role has trust relationship with Lambda service

### Empty Permissions List

**Cause**: No permissions configured on the DataSet

**Solution**:
1. This is normal for newly created DataSets
2. Permissions may need to be explicitly set
3. Check QuickSight console for DataSet permissions
4. Use `updateRLSDataSetPermissions` to add permissions if needed

## Best Practices

1. **Check permissions before updates**: Fetch current permissions before modifying
2. **Validate principals**: Ensure principals (users/groups) exist before granting access
3. **Least privilege**: Grant only necessary actions
4. **Regular audits**: Periodically review DataSet permissions
5. **Document changes**: Keep track of permission changes for audit purposes

## Notes

- The function returns permissions as a JSON string
- Empty permissions array is valid (no explicit permissions set)
- Permissions are inherited from QuickSight namespace if not explicitly set
- The function is read-only and doesn't modify any resources
- Default QuickSight permissions may apply even if list is empty

## Version History

- **v1.0** - Initial implementation

---

**Related Documentation**:
- [QuickSight Permissions Guide](/Guide/quicksight-permissions.md)
- [RLS DataSet Management](/Guide/rls-datasets.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
