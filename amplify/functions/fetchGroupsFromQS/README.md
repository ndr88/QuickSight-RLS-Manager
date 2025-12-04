# fetchGroupsFromQS

**Data Fetching Function** - Retrieves a list of QuickSight groups from the Management Region.

## Overview

This function calls the QuickSight `ListGroups` API to fetch all groups in a specified namespace. It supports pagination to handle large numbers of groups and returns the results as a JSON string. This is used for RLS configuration and user management.

## Function Details

- **Name**: `fetchGroupsFromQS`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

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
  "message": "QuickSight Groups fetched successfully",
  "groupsList": "[{...group objects...}]",
  "nextToken": "optional-pagination-token"
}
```

### Error Response (500)

```json
{
  "statusCode": 500,
  "message": "Error message",
  "errorName": "ErrorType",
  "groupsList": ""
}
```

## Group Object Structure

Each group in the `groupsList` array contains:

```typescript
{
  Arn: string;              // Group ARN
  GroupName: string;        // Group name
  Description: string;      // Group description
  PrincipalId: string;      // Unique principal identifier
}
```

## Usage Example

### GraphQL Query

```graphql
query FetchGroups {
  fetchGroupsFromQS(
    qsManagementRegion: "us-east-1"
    namespace: "default"
  ) {
    statusCode
    message
    groupsList
    nextToken
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Fetch groups
const response = await client.queries.fetchGroupsFromQS({
  qsManagementRegion: 'us-east-1',
  namespace: 'default'
});

if (response.data?.statusCode === 200) {
  const groups = JSON.parse(response.data.groupsList);
  console.log(`Found ${groups.length} groups`);
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
        "quicksight:ListGroups"
      ],
      "Resource": "*"
    }
  ]
}
```

## AWS CLI Equivalent

```bash
aws quicksight list-groups \
  --aws-account-id 995997919788 \
  --namespace default \
  --region us-east-1 \
  --max-results 50
```

## Logging

The function logs:
- Start of group fetch operation
- Pagination status
- Response processing
- Errors with details

## Related Functions

- `fetchUsersFromQS` - Fetches QuickSight users
- `fetchNamespacesFromQS` - Fetches QuickSight namespaces
- `setAccount` - Stores group count in database

## Notes

- **Management Region only**: Groups can only be listed from the Management Region
- **Namespace-specific**: Groups are scoped to a namespace
- **Used for RLS**: Groups are used to assign row-level security permissions

## Troubleshooting

### Error: "Access Denied"
- Verify Lambda role has `quicksight:ListGroups` permission
- Ensure you're querying the Management Region

### Empty group list
- Verify groups exist in the specified namespace
- Check namespace name is correct

## Version History

- **v1.0** - Initial implementation with pagination support
