# setAccount

Lambda function that initializes or updates the account configuration in the RLS Manager database.

## Overview

This function stores the QuickSight Management Region and resource counts in the DynamoDB AccountDetails table. It's called during initial setup and whenever account information needs to be updated. The function handles both creation (first-time setup) and updates (subsequent calls).

## Function Details

- **Name**: `setAccount`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `qsManagementRegion` | string | Yes | QuickSight Management Region (e.g., `us-east-1`) |
| `namespacesCount` | integer | Yes | Number of QuickSight namespaces |
| `groupsCount` | integer | Yes | Number of QuickSight groups |
| `usersCount` | integer | Yes | Number of QuickSight users |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Response

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "Successfully initiated the QS RLS Managed Tool"
}
```

### Error Response (500)

```json
{
  "statusCode": 500,
  "message": "Failed to Init the Account",
  "errorMessage": "Detailed error message",
  "errorName": "ErrorType"
}
```

## Database Operation

The function performs an **upsert** operation:

1. **Check** if AccountDetails record exists for the account ID
2. **Update** if exists (updates all fields)
3. **Create** if doesn't exist (first-time setup)

### Stored Data

```typescript
{
  accountId: "995997919788",
  qsManagementRegion: "us-east-1",
  namespacesCount: 1,
  groupsCount: 5,
  usersCount: 10,
  createdAt: "2025-11-27T10:00:00Z",
  updatedAt: "2025-11-27T10:00:00Z"
}
```

## Usage Example

### GraphQL Mutation

```graphql
mutation SetAccount {
  setAccount(
    qsManagementRegion: "us-east-1"
    namespacesCount: 1
    groupsCount: 5
    usersCount: 10
  ) {
    statusCode
    message
    errorMessage
    errorName
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Initialize account
const response = await client.mutations.setAccount({
  qsManagementRegion: 'us-east-1',
  namespacesCount: 1,
  groupsCount: 5,
  usersCount: 10
});

if (response.data?.statusCode === 200) {
  console.log('✅ Account initialized successfully');
} else {
  console.error('❌ Failed:', response.data?.errorMessage);
}
```

## IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/AccountDetails-*"
    }
  ]
}
```

## Logging

The function logs:
- Attempt to add/update account details
- Whether record exists (update) or not (create)
- Success or failure status
- Error details with stack trace

## Related Functions

- `checkQSManagementRegionAccess` - Validates the management region before calling this
- `fetchNamespacesFromQS` - Fetches namespace count
- `fetchGroupsFromQS` - Fetches group count
- `fetchUsersFromQS` - Fetches user count

## Notes

- **Single record per account**: Only one AccountDetails record exists per AWS account
- **Idempotent**: Can be called multiple times safely
- **Updates counts**: Resource counts can be updated as they change
- **Management region**: Once set, typically doesn't change
- **Timestamps**: DynamoDB automatically manages createdAt/updatedAt

## Workflow Integration

This function is called during initial setup:

1. User validates management region with `checkQSManagementRegionAccess`
2. User fetches resource counts (namespaces, groups, users)
3. **`setAccount` stores configuration** ← You are here
4. Application is initialized and ready to use

## Troubleshooting

### Error: "Missing environment variables"
- Verify ACCOUNT_ID is set in Lambda environment
- Check Amplify backend configuration

### Error: "Missing qsManagementRegion variable"
- Ensure qsManagementRegion parameter is provided
- Verify the region string is valid

### DynamoDB errors
- Check Lambda execution role has DynamoDB permissions
- Verify AccountDetails table exists
- Ensure table is in the correct region

### Update not reflecting
- Check that you're querying the correct account ID
- Verify DynamoDB table is accessible
- Check for any DynamoDB throttling

## Version History

- **v1.0** - Initial implementation with create/update logic
- **v1.1** - Added comprehensive error handling
- **v1.2** - Improved logging and validation
