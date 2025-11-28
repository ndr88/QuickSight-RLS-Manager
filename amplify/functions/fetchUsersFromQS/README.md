# fetchUsersFromQS

Lambda function that retrieves a list of QuickSight users from the Management Region.

## Overview

This function calls the QuickSight `ListUsers` API to fetch all users in a specified namespace. It supports pagination to handle large numbers of users and returns the results as a JSON string.

## Function Details

- **Name**: `fetchUsersFromQS`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `qsManagementRegion` | string | Yes | QuickSight Management Region (e.g., `us-east-1`) |
| `namespace` | string | Yes | QuickSight namespace (typically `default`) |
| `nextToken` | string | No | Pagination token for fetching additional results |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |
| `API_MAX_RESULTS` | Maximum number of results per API call | `50` |

## Response

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "QuickSight Users fetched successfully",
  "usersList": "[{...user objects...}]",
  "nextToken": "optional-pagination-token"
}
```

### Error Response (500)

```json
{
  "statusCode": 500,
  "message": "Error message",
  "errorName": "ErrorType",
  "usersList": ""
}
```

## User Object Structure

Each user in the `usersList` array contains:

```typescript
{
  Arn: string;              // User ARN
  UserName: string;         // Username (email)
  Email: string;            // User email address
  Role: string;             // ADMIN, AUTHOR, or READER
  IdentityType: string;     // IAM or QUICKSIGHT
  Active: boolean;          // Whether user is active
  PrincipalId: string;      // Unique principal identifier
}
```

## Usage Example

### GraphQL Query

```graphql
query FetchUsers {
  fetchUsersFromQS(
    qsManagementRegion: "us-east-1"
    namespace: "default"
  ) {
    statusCode
    message
    usersList
    nextToken
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Fetch users
const response = await client.queries.fetchUsersFromQS({
  qsManagementRegion: 'us-east-1',
  namespace: 'default'
});

if (response.data?.statusCode === 200) {
  const users = JSON.parse(response.data.usersList);
  console.log(`Found ${users.length} users`);
  
  // Handle pagination
  if (response.data.nextToken) {
    const nextPage = await client.queries.fetchUsersFromQS({
      qsManagementRegion: 'us-east-1',
      namespace: 'default',
      nextToken: response.data.nextToken
    });
  }
}
```

## Pagination

The function returns up to 50 users per call. If more users exist:

1. The response includes a `nextToken` field
2. Pass this token in the next request to fetch the next page
3. Continue until `nextToken` is `null` or `undefined`

## IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "quicksight:ListUsers"
      ],
      "Resource": "*"
    }
  ]
}
```

## AWS CLI Equivalent

```bash
aws quicksight list-users \
  --aws-account-id 995997919788 \
  --namespace default \
  --region us-east-1 \
  --max-results 50
```

## Logging

The function logs:
- Start of user fetch operation
- Pagination status (first call vs. subsequent calls)
- Response processing
- Errors with details

## Related Functions

- `fetchGroupsFromQS` - Fetches QuickSight groups
- `fetchNamespacesFromQS` - Fetches QuickSight namespaces
- `setAccount` - Stores user count in database

## Notes

- **Management Region only**: Users can only be listed from the Management Region
- **Namespace-specific**: Users are scoped to a namespace
- **Results as JSON string**: Avoids GraphQL schema complexity
- **Pagination supported**: Handles large user lists

## Troubleshooting

### Error: "Access Denied"
- Verify Lambda role has `quicksight:ListUsers` permission
- Check QuickSight is enabled in the account
- Ensure you're querying the Management Region

### Empty user list
- Verify users exist in the specified namespace
- Check that the namespace name is correct (case-sensitive)
- Ensure you're using the correct Management Region

### Pagination not working
- Verify nextToken is being passed correctly
- Check that the token hasn't expired
- Ensure you're using the same region and namespace

## Version History

- **v1.0** - Initial implementation with pagination support
- **v1.1** - Added comprehensive error handling
- **v1.2** - Improved logging
