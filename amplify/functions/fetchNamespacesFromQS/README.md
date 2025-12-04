# fetchNamespacesFromQS

**Data Fetching Function** - Retrieves a list of QuickSight namespaces from the Management Region.

## Overview

This function calls the QuickSight `ListNamespaces` API to fetch all namespaces in the account. It supports pagination and returns a simplified list containing ARN, name, and capacity region for each namespace. This is used for namespace selection and configuration.

## Function Details

- **Name**: `fetchNamespacesFromQS`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `qsManagementRegion` | string | Yes | QuickSight Management Region (e.g., `us-east-1`) |
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
  "message": "QuickSight Namespaces fetched successfully",
  "namespacesList": "[{\"arn\":\"...\",\"name\":\"default\",\"capacityRegion\":\"us-east-1\"}]",
  "nextToken": "optional-pagination-token"
}
```

### Error Response (500)

```json
{
  "statusCode": 500,
  "message": "Error message",
  "errorName": "ErrorType",
  "namespacesList": ""
}
```

## Namespace Object Structure

Each namespace in the `namespacesList` array contains:

```typescript
{
  arn: string;              // Namespace ARN
  name: string;             // Namespace name (e.g., "default")
  capacityRegion: string;   // Region where namespace capacity is allocated
}
```

## Usage Example

### GraphQL Query

```graphql
query FetchNamespaces {
  fetchNamespacesFromQS(qsManagementRegion: "us-east-1") {
    statusCode
    message
    namespacesList
    nextToken
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Fetch namespaces
const response = await client.queries.fetchNamespacesFromQS({
  qsManagementRegion: 'us-east-1'
});

if (response.data?.statusCode === 200) {
  const namespaces = JSON.parse(response.data.namespacesList);
  console.log(`Found ${namespaces.length} namespaces`);
  
  namespaces.forEach(ns => {
    console.log(`${ns.name} (${ns.capacityRegion})`);
  });
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
        "quicksight:ListNamespaces"
      ],
      "Resource": "*"
    }
  ]
}
```

## AWS CLI Equivalent

```bash
aws quicksight list-namespaces \
  --aws-account-id 995997919788 \
  --region us-east-1 \
  --max-results 50
```

## Logging

The function logs:
- Start of namespace fetch operation
- Pagination status
- Response processing
- Errors with details

## Related Functions

- `fetchUsersFromQS` - Fetches users within a namespace
- `fetchGroupsFromQS` - Fetches groups within a namespace
- `setAccount` - Stores namespace count in database

## Notes

- **Management Region only**: Namespaces can only be listed from the Management Region
- **Simplified response**: Only returns essential fields (arn, name, capacityRegion)
- **Default namespace**: Most accounts have a "default" namespace
- **Capacity region**: Shows where SPICE capacity is allocated for the namespace

## Troubleshooting

### Error: "Access Denied"
- Verify Lambda role has `quicksight:ListNamespaces` permission
- Ensure QuickSight is enabled in the account
- Confirm you're querying the Management Region

### Empty namespace list
- Every QuickSight account should have at least the "default" namespace
- Verify QuickSight is properly set up
- Check you're using the correct account ID

### Capacity region mismatch
- Capacity region may differ from Management Region
- This is normal and expected behavior

## Version History

- **v1.0** - Initial implementation with pagination support
- **v1.1** - Simplified response to include only essential fields
