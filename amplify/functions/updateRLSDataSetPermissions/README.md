# updateRLSDataSetPermissions

**Utility Function** - Updates permissions on an RLS DataSet by granting or revoking access to users and groups.

## Overview

This function updates the permissions on an RLS DataSet by comparing desired permissions with current permissions, then granting new access and revoking removed access. It supports two permission levels: OWNER (full access) and VIEWER (read-only access). This is used to control who can access and manage RLS DataSets.

## Function Details

- **Name**: `updateRLSDataSetPermissions`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the RLS DataSet is located |
| `rlsDataSetId` | string | Yes | ID of the RLS DataSet to update permissions for |
| `permissions` | string | Yes | JSON string containing array of permission objects |

### Permission Object Structure

```typescript
{
  userGroupArn: string;      // ARN of user or group
  permissionLevel: string;   // "OWNER" or "VIEWER"
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Output

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "RLS DataSet permissions updated successfully."
}
```

### Error Response (500)

```json
{
  "statusCode": 500,
  "message": "Failed to update RLS DataSet permissions",
  "errorType": "ErrorType"
}
```

## Permission Levels

### OWNER

Full access to the DataSet including:
- `quicksight:DeleteDataSet`
- `quicksight:UpdateDataSetPermissions`
- `quicksight:PutDataSetRefreshProperties`
- `quicksight:CreateRefreshSchedule`
- `quicksight:CancelIngestion`
- `quicksight:PassDataSet`
- `quicksight:ListRefreshSchedules`
- `quicksight:UpdateRefreshSchedule`
- `quicksight:DeleteRefreshSchedule`
- `quicksight:DescribeDataSetRefreshProperties`
- `quicksight:DescribeDataSet`
- `quicksight:CreateIngestion`
- `quicksight:DescribeRefreshSchedule`
- `quicksight:ListIngestions`
- `quicksight:DescribeDataSetPermissions`
- `quicksight:UpdateDataSet`
- `quicksight:DeleteDataSetRefreshProperties`
- `quicksight:DescribeIngestion`

### VIEWER

Read-only access to the DataSet:
- `quicksight:DescribeRefreshSchedule`
- `quicksight:ListIngestions`
- `quicksight:DescribeDataSetPermissions`
- `quicksight:PassDataSet`
- `quicksight:ListRefreshSchedules`
- `quicksight:DescribeDataSet`
- `quicksight:DescribeIngestion`

## Permission Update Process

The function performs the following steps:

### 1. Retrieve Current Permissions

**Method**: AWS SDK [QuickSight DescribeDataSetPermissionsCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/quicksight/command/DescribeDataSetPermissionsCommand/)

**What it retrieves**:
- Current list of principals with access
- Actions each principal can perform

### 2. Calculate Changes

**Grant Permissions**:
- New principals in the desired list
- Existing principals with changed permission levels

**Revoke Permissions**:
- Principals removed from the desired list
- Automatically calculated by comparing current vs desired

### 3. Update Permissions

**Method**: AWS SDK [QuickSight UpdateDataSetPermissionsCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/quicksight/command/UpdateDataSetPermissionsCommand/)

**What it does**:
- Grants new permissions
- Revokes removed permissions
- Updates existing permissions

## Usage Examples

### GraphQL Mutation

```graphql
mutation UpdateRLSPermissions {
  updateRLSDataSetPermissions(
    region: "eu-west-1"
    rlsDataSetId: "RLS-abc-123"
    permissions: "[{\"userGroupArn\":\"arn:aws:quicksight:eu-west-1:123456789012:group/default/Admins\",\"permissionLevel\":\"OWNER\"},{\"userGroupArn\":\"arn:aws:quicksight:eu-west-1:123456789012:group/default/Viewers\",\"permissionLevel\":\"VIEWER\"}]"
  ) {
    statusCode
    message
    errorType
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Define permissions
const permissions = [
  {
    userGroupArn: 'arn:aws:quicksight:eu-west-1:123456789012:group/default/Admins',
    permissionLevel: 'OWNER'
  },
  {
    userGroupArn: 'arn:aws:quicksight:eu-west-1:123456789012:group/default/Viewers',
    permissionLevel: 'VIEWER'
  }
];

// Update RLS DataSet permissions
const response = await client.mutations.updateRLSDataSetPermissions({
  region: 'eu-west-1',
  rlsDataSetId: 'RLS-abc-123',
  permissions: JSON.stringify(permissions)
});

if (response.data?.statusCode === 200) {
  console.log('✓ Permissions updated successfully');
} else {
  console.error('✗ Failed:', response.data?.message);
}
```

### Complete Permission Management Workflow

```typescript
async function manageRLSPermissions(
  region: string,
  rlsDataSetId: string,
  newPermissions: Array<{userGroupArn: string, permissionLevel: 'OWNER' | 'VIEWER'}>
) {
  try {
    // Step 1: Fetch current permissions
    console.log('Fetching current permissions...');
    const currentPerms = await client.queries.fetchRLSDataSetPermissions({
      region,
      rlsDataSetId
    });

    if (currentPerms.data?.statusCode === 200) {
      const current = JSON.parse(currentPerms.data.permissions);
      console.log(`Current permissions: ${current.length} entries`);
    }

    // Step 2: Update permissions
    console.log('Updating permissions...');
    const updateResponse = await client.mutations.updateRLSDataSetPermissions({
      region,
      rlsDataSetId,
      permissions: JSON.stringify(newPermissions)
    });

    if (updateResponse.data?.statusCode === 200) {
      console.log('✓ Permissions updated successfully');
      return true;
    } else {
      throw new Error(updateResponse.data?.message || 'Update failed');
    }

  } catch (error) {
    console.error('Permission management failed:', error);
    throw error;
  }
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
        "quicksight:DescribeDataSetPermissions",
        "quicksight:UpdateDataSetPermissions"
      ],
      "Resource": "arn:aws:quicksight:*:[ACCOUNT_ID]:dataset/*"
    }
  ]
}
```

> **Note**: Replace `[ACCOUNT_ID]` with your AWS Account ID.

### Detailed Permissions Breakdown

**Why needed**:
- `quicksight:DescribeDataSetPermissions` - Required to retrieve current permissions before updating
- `quicksight:UpdateDataSetPermissions` - Required to grant and revoke permissions

## AWS CLI Equivalent

```bash
# Update DataSet permissions
aws quicksight update-data-set-permissions \
  --aws-account-id 123456789012 \
  --data-set-id RLS-abc-123 \
  --grant-permissions '[{"Principal":"arn:aws:quicksight:eu-west-1:123456789012:group/default/Admins","Actions":["quicksight:DescribeDataSet","quicksight:UpdateDataSet"]}]' \
  --revoke-permissions '[{"Principal":"arn:aws:quicksight:eu-west-1:123456789012:user/default/old-user","Actions":["quicksight:DescribeDataSet"]}]' \
  --region eu-west-1
```

## Logging

The function logs:
- Start of permission update operation
- RLS DataSet ID being updated
- Current permissions count
- Number of grants and revokes
- Update success or failure
- Errors with error type and message

Example log output:
```
INFO: Updating RLS DataSet permissions { rlsDataSetId: 'RLS-abc-123' }
INFO: Current permissions retrieved { count: 2 }
INFO: Permissions to update { grants: 3, revokes: 1 }
INFO: Permissions updated successfully
```

## Related Functions

### Permission Management
- [`fetchRLSDataSetPermissions`](../fetchRLSDataSetPermissions/README.md) - Fetches current permissions

### RLS DataSet Management
- [`publishRLS03QsRLSDataSet`](../publishRLS03QsRLSDataSet/README.md) - Creates/updates RLS DataSets
- [`removeRLSDataSet`](../removeRLSDataSet/README.md) - Removes RLS configuration

### User/Group Management
- [`fetchGroupsFromQS`](../fetchGroupsFromQS/README.md) - Lists QuickSight groups
- [`fetchUsersFromQS`](../fetchUsersFromQS/README.md) - Lists QuickSight users

## Troubleshooting

### Error: "Missing tool Resource: permissions"

**Cause**: Required parameter not provided

**Solution**:
- Ensure the `permissions` parameter is provided
- Verify it's a valid JSON string
- Check the array contains valid permission objects

### Error: "Invalid JSON in permissions parameter"

**Cause**: Malformed JSON string

**Solution**:
1. Validate JSON syntax before passing
2. Ensure proper escaping of quotes
3. Use `JSON.stringify()` to create the string:
   ```typescript
   const perms = JSON.stringify([{userGroupArn: '...', permissionLevel: 'OWNER'}]);
   ```

### Error: "ResourceNotFoundException" (404)

**Cause**: RLS DataSet doesn't exist

**Solution**:
1. Verify the RLS DataSet ID is correct
2. Check that the DataSet exists in the specified region
3. Use `fetchDataSetsFromQS` to list available DataSets

### Error: "AccessDeniedException" (403)

**Cause**: Insufficient permissions

**Solution**:
1. Verify Lambda role has required permissions (see IAM Permissions section)
2. Check that you have permission to update DataSet permissions
3. Ensure QuickSight is enabled in the account
4. Verify the IAM role has trust relationship with Lambda service

### Error: "InvalidParameterValueException" (400)

**Cause**: Invalid principal ARN or permission level

**Solution**:
1. Verify principal ARNs are correctly formatted:
   ```
   arn:aws:quicksight:region:account-id:user/namespace/username
   arn:aws:quicksight:region:account-id:group/namespace/groupname
   ```
2. Ensure permissionLevel is either "OWNER" or "VIEWER"
3. Verify users/groups exist in QuickSight
4. Check that the namespace is correct (usually "default")

### Permissions Not Taking Effect

**Cause**: Cache or propagation delay

**Solution**:
1. Wait a few seconds for permissions to propagate
2. Verify permissions were updated using `fetchRLSDataSetPermissions`
3. Check QuickSight console for permission status
4. Ensure users are in the correct namespace

## Best Practices

1. **Fetch before update**: Always fetch current permissions before updating
2. **Least privilege**: Grant only necessary permissions (prefer VIEWER over OWNER)
3. **Use groups**: Assign permissions to groups rather than individual users
4. **Validate principals**: Ensure users/groups exist before granting access
5. **Audit regularly**: Periodically review and update permissions
6. **Document changes**: Keep track of permission changes for compliance
7. **Test permissions**: Verify permissions work as expected after updates

## Notes

- The function automatically calculates which permissions to grant and revoke
- Existing permissions not in the new list are automatically revoked
- Permission levels (OWNER/VIEWER) have predefined action sets
- The function is idempotent - running it multiple times with same input is safe
- Permissions apply immediately after update
- Empty permissions array will revoke all permissions

## Version History

- **v1.0** - Initial implementation with OWNER and VIEWER permission levels

---

**Related Documentation**:
- [QuickSight Permissions Guide](/Guide/quicksight-permissions.md)
- [RLS DataSet Management](/Guide/rls-datasets.md)
- [User and Group Management](/Guide/user-management.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
