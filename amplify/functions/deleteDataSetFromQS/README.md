# deleteDataSetFromQS

**Data Deletion Function** - Deletes a QuickSight DataSet from a specified region.

## Overview

This function calls the QuickSight `DeleteDataSet` API to remove a DataSet. It includes comprehensive error handling for various QuickSight-specific exceptions and treats "ResourceNotFoundException" as a success case (idempotent deletion). This is used to clean up RLS DataSets and other QuickSight DataSets.

## Function Details

- **Name**: `deleteDataSetFromQS`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the DataSet is located |
| `dataSetId` | string | Yes | Unique identifier of the QuickSight DataSet to delete |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Output

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "QuickSight DataSet deleted successfully."
}
```

### Already Deleted (200)

```json
{
  "statusCode": 200,
  "errorType": "ResourceNotFoundException",
  "message": "Resource is already not in present in QuickSight"
}
```

### Error Response

```json
{
  "statusCode": 400|401|403|409|429|500,
  "errorType": "ErrorType",
  "message": "[ErrorName] Deleting RLS DataSet failed: error details"
}
```

## Error Handling

The function maps QuickSight errors to appropriate HTTP status codes:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `InvalidParameterValueException` | 400 | Invalid parameters provided |
| `AccessDeniedException` | 401 | Insufficient permissions |
| `UnsupportedUserEditionException` | 403 | Feature not available in current edition |
| `ResourceNotFoundException` | 200 | Resource already deleted (success) |
| `ConflictException` | 409 | Resource conflict |
| `LimitExceededException` | 409 | Limit exceeded |
| `ResourceExistsException` | 409 | Resource exists |
| `ThrottlingException` | 429 | API rate limit exceeded |
| `InternalFailureException` | 500 | Internal QuickSight error |

## Usage Example

### GraphQL Mutation

```graphql
mutation DeleteDataSet {
  deleteDataSetFromQS(
    region: "eu-west-1"
    dataSetId: "abc123-def456-ghi789"
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

// Delete DataSet
const response = await client.mutations.deleteDataSetFromQS({
  region: 'eu-west-1',
  dataSetId: 'abc123-def456-ghi789'
});

if (response.data?.statusCode === 200) {
  console.log('✅ DataSet deleted successfully');
} else {
  console.error('❌ Failed:', response.data?.message);
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
        "quicksight:DeleteDataSet"
      ],
      "Resource": "*"
    }
  ]
}
```

## AWS CLI Equivalent

```bash
aws quicksight delete-data-set \
  --aws-account-id 995997919788 \
  --data-set-id abc123-def456-ghi789 \
  --region eu-west-1
```

## Logging

The function logs:
- Response processing
- Errors with detailed messages
- Success or failure status

## Related Functions

- `removeRLSDataSet` - Removes RLS configuration from a DataSet
- `deleteDataSetGlueTable` - Deletes associated Glue table
- `deleteDataSetS3Objects` - Deletes associated S3 objects

## Notes

- **Idempotent**: Returns success if DataSet already deleted
- **Permanent**: Deletion cannot be undone
- **Dependencies**: May fail if DataSet is used by analyses or dashboards
- **RLS DataSets**: Should be deleted after removing RLS configuration

## Workflow Integration

Typical deletion workflow:

1. Remove RLS configuration with `removeRLSDataSet`
2. **Delete QuickSight DataSet** ← You are here
3. Delete Glue table with `deleteDataSetGlueTable`
4. Delete S3 objects with `deleteDataSetS3Objects`

## Troubleshooting

### Error: "Access Denied"
- Verify Lambda role has `quicksight:DeleteDataSet` permission
- Check that you have permission to delete DataSets

### Error: "Resource conflict"
- DataSet may be in use by analyses or dashboards
- Delete dependent resources first
- Check QuickSight console for dependencies

### Deletion succeeds but DataSet still visible
- QuickSight console may cache the list
- Refresh the page
- Wait a few seconds for eventual consistency

## Version History

- **v1.0** - Initial implementation
- **v1.1** - Added comprehensive error handling
- **v1.2** - Made idempotent (ResourceNotFoundException returns success)
