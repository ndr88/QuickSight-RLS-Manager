# fetchDataSetsFromQS

Lambda function that retrieves a list of QuickSight DataSets from a specified AWS region.

## Overview

This function calls the QuickSight `ListDataSets` API to fetch all DataSets in a given region. It supports pagination to handle large numbers of DataSets and returns the results as a JSON string.

## Function Details

- **Name**: `fetchDataSetsFromQS`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where QuickSight DataSets are located (e.g., `us-east-1`, `eu-west-1`) |
| `nextToken` | string | No | Pagination token for fetching additional results (returned from previous call) |

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
  "message": "QuickSight Datasets fetched successfully",
  "datasetsList": "[{...dataset objects...}]",
  "nextToken": "optional-pagination-token"
}
```

**Fields**:
- `statusCode`: HTTP status code (200 for success)
- `message`: Success message
- `datasetsList`: JSON string containing array of DataSet summary objects
- `nextToken`: Token for fetching next page of results (only present if more results available)

### Error Response

```json
{
  "statusCode": 400|403|404|429|500,
  "message": "Error description",
  "errorName": "ErrorType",
  "datasetsList": ""
}
```

## Error Handling

The function handles the following QuickSight-specific errors:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `AccessDeniedException` | 403 | Insufficient permissions to access QuickSight resources |
| `ResourceNotFoundException` | 404 | Requested resource not found |
| `ThrottlingException` | 429 | API rate limit exceeded |
| `InvalidParameterValueException` | 400 | Invalid input parameters |
| Generic Error | 500 | Unexpected error occurred |

## Usage Example

### GraphQL Query

```graphql
query FetchDataSets {
  fetchDataSetsFromQS(region: "eu-west-1") {
    statusCode
    message
    datasetsList
    nextToken
  }
}
```

### With Pagination

```graphql
query FetchMoreDataSets {
  fetchDataSetsFromQS(
    region: "eu-west-1"
    nextToken: "previous-token-here"
  ) {
    statusCode
    message
    datasetsList
    nextToken
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Fetch DataSets
const response = await client.queries.fetchDataSetsFromQS({
  region: 'eu-west-1'
});

if (response.data?.statusCode === 200) {
  const datasets = JSON.parse(response.data.datasetsList);
  console.log('DataSets:', datasets);
  
  // Handle pagination if needed
  if (response.data.nextToken) {
    const nextPage = await client.queries.fetchDataSetsFromQS({
      region: 'eu-west-1',
      nextToken: response.data.nextToken
    });
  }
}
```

## DataSet Summary Object

Each DataSet in the `datasetsList` array contains:

```typescript
{
  Arn: string;              // DataSet ARN
  DataSetId: string;        // Unique DataSet identifier
  Name: string;             // DataSet name
  CreatedTime: Date;        // Creation timestamp
  LastUpdatedTime: Date;    // Last update timestamp
  ImportMode: string;       // SPICE or DIRECT_QUERY
  RowLevelPermissionDataSet?: {
    Arn: string;            // RLS DataSet ARN (if RLS enabled)
    PermissionPolicy: string; // GRANT_ACCESS or DENY_ACCESS
  };
  ColumnLevelPermissionRulesApplied?: boolean;
}
```

## Pagination

The function returns up to 50 DataSets per call (configurable via `API_MAX_RESULTS`). If more DataSets exist:

1. The response includes a `nextToken` field
2. Pass this token in the next request to fetch the next page
3. Continue until `nextToken` is `null` or `undefined`

### Example: Fetch All DataSets

```typescript
async function fetchAllDataSets(region: string) {
  const allDataSets = [];
  let nextToken = undefined;
  
  do {
    const response = await client.queries.fetchDataSetsFromQS({
      region,
      nextToken
    });
    
    if (response.data?.statusCode === 200) {
      const datasets = JSON.parse(response.data.datasetsList);
      allDataSets.push(...datasets);
      nextToken = response.data.nextToken;
    } else {
      throw new Error(response.data?.message || 'Failed to fetch DataSets');
    }
  } while (nextToken);
  
  return allDataSets;
}
```

## IAM Permissions Required

The Lambda execution role needs the following QuickSight permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "quicksight:ListDataSets",
        "quicksight:DescribeDataSet"
      ],
      "Resource": "*"
    }
  ]
}
```

## AWS CLI Equivalent

```bash
aws quicksight list-data-sets \
  --aws-account-id 995997919788 \
  --region eu-west-1 \
  --max-results 50
```

## Logging

The function logs the following events:
- Start of DataSet fetch operation
- Pagination status (first call vs. subsequent calls)
- Response processing
- Errors with error type and message
- End of operation

## Related Functions

- `fetchDataSetFieldsFromQS` - Fetches detailed field information for a specific DataSet
- `deleteDataSetFromQS` - Deletes a QuickSight DataSet
- `publishRLS03QsRLSDataSet` - Creates/updates RLS-enabled DataSets

## Notes

- The function uses the QuickSight SDK v3 (`@aws-sdk/client-quicksight`)
- Results are returned as a JSON string to avoid GraphQL schema complexity
- The function is region-aware and can fetch DataSets from any AWS region
- Maximum timeout is 120 seconds to handle large DataSet lists
- Supports both SPICE and Direct Query DataSets

## Troubleshooting

### Error: "Access Denied to QuickSight resources"
- Verify the Lambda execution role has `quicksight:ListDataSets` permission
- Check that the AWS account has QuickSight enabled
- Ensure QuickSight is available in the specified region

### Error: "Request was throttled"
- QuickSight API has rate limits
- Implement exponential backoff and retry logic
- Consider reducing `API_MAX_RESULTS` to make smaller requests

### Empty DataSet List
- Verify DataSets exist in the specified region
- Check that the account ID is correct
- Ensure you're querying the correct region

## Version History

- **v1.0** - Initial implementation with pagination support
- **v1.1** - Added comprehensive error handling
- **v1.2** - Refactored to use shared utilities (logger, error handling, validation)
