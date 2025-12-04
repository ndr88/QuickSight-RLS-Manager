# fetchDataSetsFromQS

**Data Fetching Function** - Retrieves a list of QuickSight DataSets from a specified AWS region.

## Overview

This function calls the QuickSight `ListDataSets` API to fetch all DataSets in a given region. It supports pagination to handle large numbers of DataSets and returns the results as a JSON string. This function is used to display available DataSets and identify which ones have RLS configured.

## Function Details

- **Name**: `fetchDataSetsFromQS`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where QuickSight DataSets are located (e.g., `us-east-1`, `eu-west-1`) |
| `nextToken` | string | No | Pagination token for fetching additional results (returned from previous call) |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |
| `API_MAX_RESULTS` | Maximum number of results per API call | `50` |

## Output

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

## DataSet Fetching Process

The function performs the following steps:

### 1. Query QuickSight DataSets

**Method**: AWS SDK [QuickSight ListDataSetsCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/quicksight/command/ListDataSetsCommand/)

**Parameters**:
- `AwsAccountId`: AWS Account ID
- `MaxResults`: Maximum number of results (default: 50)
- `NextToken`: Pagination token (optional)

**What it retrieves**:
- DataSet summaries (not full details)
- Basic metadata (name, ID, creation time)
- RLS configuration status
- Import mode (SPICE or Direct Query)

### 2. Process and Return Results

**Response Format**:
- Returns DataSets as JSON string
- Includes pagination token if more results available
- Filters and formats data for client consumption

## Error Handling

The function handles the following QuickSight-specific errors:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `ValidationError` | 500 | Missing required parameters or environment variables |
| `AccessDeniedException` | 403 | Insufficient permissions to access QuickSight resources |
| `ResourceNotFoundException` | 404 | Requested resource not found |
| `ThrottlingException` | 429 | API rate limit exceeded |
| `InvalidParameterValueException` | 400 | Invalid input parameters |
| Generic Error | 500 | Unexpected error occurred |

## Usage Examples

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

### Ready-to-Use Policy (Recommended)

This policy grants all necessary permissions for the function to work:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "quicksight:ListDataSets"
      ],
      "Resource": "*"
    }
  ]
}
```

### Detailed Permissions Breakdown

Understanding why each permission is needed:

#### QuickSight DataSet Listing Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "quicksight:ListDataSets"
  ],
  "Resource": "*"
}
```

**Why needed**:
- `quicksight:ListDataSets` - Required to retrieve list of DataSets
- Resource `*` is required because ListDataSets is an account-level operation

## AWS CLI Equivalent

For testing or troubleshooting, you can manually list DataSets using AWS CLI:

```bash
# List DataSets (first page)
aws quicksight list-data-sets \
  --aws-account-id 123456789012 \
  --region eu-west-1 \
  --max-results 50

# List DataSets with pagination
aws quicksight list-data-sets \
  --aws-account-id 123456789012 \
  --region eu-west-1 \
  --max-results 50 \
  --next-token "pagination-token-here"

# Count total DataSets
aws quicksight list-data-sets \
  --aws-account-id 123456789012 \
  --region eu-west-1 \
  --query 'length(DataSetSummaries)'
```

## Logging

The function logs the following events:
- Start of DataSet fetch operation
- Pagination status (first call vs. subsequent calls)
- Number of DataSets fetched
- DataSets with UseAs field (RLS DataSets)
- Response processing
- Errors with error type and message

Example log output:
```
INFO: Fetching Datasets (first call)
DEBUG: Processing response { status: 200 }
INFO: Datasets fetched successfully { count: 15 }
INFO: Found datasets with UseAs field { count: 2, examples: [...] }
```

## Related Functions

### RLS Workflow Functions
- [`publishRLS03QsRLSDataSet`](../publishRLS03QsRLSDataSet/README.md) - Creates/updates RLS-enabled DataSets
- [`publishRLS04QsUpdateMainDataSetRLS`](../publishRLS04QsUpdateMainDataSetRLS/README.md) - Applies RLS to DataSets

### Other Data Fetching Functions
- [`fetchDataSetFieldsFromQS`](../fetchDataSetFieldsFromQS/README.md) - Fetches detailed field information for a specific DataSet
- [`fetchGroupsFromQS`](../fetchGroupsFromQS/README.md) - Fetches QuickSight groups
- [`fetchUsersFromQS`](../fetchUsersFromQS/README.md) - Fetches QuickSight users

### DataSet Management Functions
- [`deleteDataSetFromQS`](../deleteDataSetFromQS/README.md) - Deletes a QuickSight DataSet

## DataSet Summary Object Details

Each DataSet in the `datasetsList` contains:

| Field | Type | Description |
|-------|------|-------------|
| `Arn` | string | DataSet ARN |
| `DataSetId` | string | Unique DataSet identifier |
| `Name` | string | DataSet name |
| `CreatedTime` | Date | Creation timestamp |
| `LastUpdatedTime` | Date | Last update timestamp |
| `ImportMode` | string | SPICE or DIRECT_QUERY |
| `RowLevelPermissionDataSet` | object | RLS configuration (if enabled) |
| `ColumnLevelPermissionRulesApplied` | boolean | Whether column-level permissions are applied |
| `UseAs` | string | RLS_RULES (for RLS DataSets) |

## Troubleshooting

### Error: "Missing tool Resource: region"

**Cause**: Required parameter not provided

**Solution**:
- Ensure the `region` parameter is provided
- Verify the region is a valid AWS region (e.g., 'eu-west-1', 'us-east-1')
- Check that the parameter is correctly passed in the function call

### Error: "AccessDeniedException" (403)

**Cause**: Insufficient permissions to access QuickSight resources

**Solution**:
1. Verify the Lambda execution role has `quicksight:ListDataSets` permission (see IAM Permissions section)
2. Check that the AWS account has QuickSight enabled
3. Ensure QuickSight is available in the specified region
4. Verify the IAM role has trust relationship with Lambda service

### Error: "ThrottlingException" (429)

**Cause**: QuickSight API rate limit exceeded

**Solution**:
1. Implement exponential backoff and retry logic
2. Reduce the frequency of API calls
3. Consider reducing `API_MAX_RESULTS` to make smaller requests
4. Contact AWS support to request higher API limits
5. Cache results when possible to reduce API calls

### Error: "InvalidParameterValueException" (400)

**Cause**: Invalid input parameters

**Solution**:
1. Verify the region parameter is valid
2. Check that nextToken (if provided) is valid
3. Ensure API_MAX_RESULTS is within acceptable range (1-100)
4. Verify the account ID is correct

### Empty DataSet List (No Error)

**Cause**: No DataSets exist in the specified region

**Solution**:
1. Verify DataSets exist in the specified region using QuickSight console
2. Check that the account ID is correct
3. Ensure you're querying the correct region
4. Create DataSets if none exist

### Pagination Not Working

**Cause**: nextToken not being passed correctly

**Solution**:
1. Ensure you're passing the exact nextToken from the previous response
2. Don't modify or decode the token
3. Check that the token hasn't expired (tokens are short-lived)
4. Verify the region is the same for all paginated requests

## Best Practices

1. **Use pagination**: Always handle pagination for accounts with many DataSets
2. **Cache results**: Cache DataSet lists to reduce API calls
3. **Filter client-side**: Fetch all DataSets and filter in your application
4. **Handle throttling**: Implement retry logic with exponential backoff
5. **Monitor usage**: Track API call frequency to stay within limits

## Notes

- The function uses the QuickSight SDK v3 (`@aws-sdk/client-quicksight`)
- Results are returned as a JSON string to avoid GraphQL schema complexity
- The function is region-aware and can fetch DataSets from any AWS region
- Maximum timeout is 120 seconds to handle large DataSet lists
- Supports both SPICE and Direct Query DataSets
- The function is read-only and doesn't modify any resources
- Default page size is 50 DataSets (configurable via API_MAX_RESULTS)

## Version History

- **v1.0** - Initial implementation with pagination support
- **v1.1** - Added comprehensive error handling
- **v1.2** - Refactored to use shared utilities (logger, error handling, validation)
- **v2.0** - Updated documentation and improved error handling

---

**Related Documentation**:
- [QuickSight DataSet Management](/Guide/quicksight-datasets.md)
- [Pagination Guide](/Guide/pagination.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
