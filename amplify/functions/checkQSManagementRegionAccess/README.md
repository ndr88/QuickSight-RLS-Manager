# checkQSManagementRegionAccess

Lambda function that validates access to QuickSight Management Region by attempting to list users.

## Overview

This function verifies that the application has proper access to the specified QuickSight Management Region by making a test API call to list users. This is typically used during initial setup to validate IAM permissions and region configuration.

## Function Details

- **Name**: `checkQSManagementRegionAccess`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `qsManagementRegion` | string | Yes | QuickSight Management Region to validate (e.g., `us-east-1`, `eu-west-1`) |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |
| `API_MAX_RESULTS` | Maximum number of results for test query | `50` |

## Response

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "QuickSight Management Region: VERIFIED."
}
```

### Error Response

```json
{
  "statusCode": 403|404|500,
  "message": "Fail to validate QuickSight Management Region",
  "errorMessage": "Detailed error message",
  "errorName": "ErrorType"
}
```

## Error Handling

Common errors and their meanings:

| Status Code | Description |
|-------------|-------------|
| 403 | Access denied - IAM permissions insufficient or QuickSight not enabled |
| 404 | Region not found or QuickSight not available in region |
| 500 | Internal error or network issue |

## Usage Example

### GraphQL Query

```graphql
query CheckManagementRegion {
  checkQSManagementRegionAccess(qsManagementRegion: "us-east-1") {
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

// Validate management region
const response = await client.queries.checkQSManagementRegionAccess({
  qsManagementRegion: 'us-east-1'
});

if (response.data?.statusCode === 200) {
  console.log('✅ Management region validated successfully');
} else {
  console.error('❌ Validation failed:', response.data?.errorMessage);
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

The function logs the following events:
- Start of validation check
- Response processing details
- Validation success or failure
- Error details with stack trace

## Related Functions

- `setAccount` - Saves the validated management region to the database
- `fetchUsersFromQS` - Fetches complete user list from QuickSight
- `fetchNamespacesFromQS` - Fetches QuickSight namespaces

## Notes

- This function performs a **read-only** operation (ListUsers)
- It only fetches a small number of users (max 50) for validation
- The actual user data is not returned, only validation status
- This should be called during initial application setup
- QuickSight Management Region is where user/group management occurs

## Troubleshooting

### Error: "Access denied"
- Verify QuickSight is enabled in your AWS account
- Check that the Lambda execution role has `quicksight:ListUsers` permission
- Ensure you're using the correct AWS account ID

### Error: "Region not found"
- Verify QuickSight is available in the specified region
- Check that the region string is correct (e.g., `us-east-1`, not `us-east-1a`)
- Some regions don't support QuickSight

### Validation succeeds but users can't be managed
- The validated region must be your QuickSight Management Region
- Check QuickSight console to confirm which region is your management region
- User/group management only works in the management region

## Version History

- **v1.0** - Initial implementation
- **v1.1** - Added comprehensive error handling
- **v1.2** - Improved logging and error messages
