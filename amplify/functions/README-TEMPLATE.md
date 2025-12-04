# [FUNCTION_NAME]

**[Brief one-line description of what this function does]**

## Overview

[Detailed description of the function's purpose, what problem it solves, and when it's used in the application workflow]

## Function Details

- **Name**: `[FUNCTION_NAME]`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: [XX] seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Workflow Position

[If part of a multi-step workflow, show where this function fits]

```
[Optional: Show workflow diagram or list]
Example:
Step 0: functionA
   ↓
Step 1: functionB (THIS FUNCTION)
   ↓
Step 2: functionC
```

## Flow Diagram

![Function Flow](/Guide/images/Lambda_[FUNCTION_NAME].png)

> **Note**: You can update this diagram using the [DrawIO source file](/Guide/images/drawio/lambda-[FUNCTION_NAME].drawio).

## Input Parameters

| Parameter | Type | Required | Source | Description |
|-----------|------|----------|--------|-------------|
| `param1` | string | Yes | Argument | [Description] |
| `param2` | string | No | Argument | [Description] |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |
| `[OTHER_VAR]` | [Description] | [Default value] |

## Output

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "[Success message]",
  "[additionalField]": "[value]"
}
```

### Error Response

```json
{
  "statusCode": 400|403|404|429|500|504,
  "message": "Error description",
  "errorType": "ErrorType",
  "[additionalField]": "[value]"
}
```

## Process Flow

[Describe the step-by-step process the function performs]

### Step 1: [Step Name]

**What it does**: [Description]

**Method**: AWS SDK [ServiceName CommandName](https://docs.aws.amazon.com/...)

**Validation**:
- [Check 1]
- [Check 2]
- [Check 3]

**Possible Errors**:

| Error | Status Code | Description |
|-------|-------------|-------------|
| `ErrorName1` | 400 | [Description] |
| `ErrorName2` | 404 | [Description] |
| Generic Error | 500 | Unexpected error |

### Step 2: [Step Name]

[Repeat for each major step]

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
        "service:Action1",
        "service:Action2"
      ],
      "Resource": [
        "arn:aws:service:*:[ACCOUNT_ID]:resource/*"
      ]
    }
  ]
}
```

> **Note**: Replace `[ACCOUNT_ID]` with your AWS Account ID.

### Detailed Permissions Breakdown

Understanding why each permission is needed:

#### [Service/Resource] Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "service:Action1"
  ],
  "Resource": [
    "arn:aws:service:*:[ACCOUNT_ID]:resource/*"
  ]
}
```

**Why needed**: [Explanation of why this specific permission is required and what it enables]

[Repeat for each service/permission group]

## Usage Examples

### GraphQL Query/Mutation

```graphql
[query|mutation] [OperationName] {
  [FUNCTION_NAME](
    param1: "value1"
    param2: "value2"
  ) {
    statusCode
    message
    [otherFields]
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// [Description of what this example does]
const response = await client.[queries|mutations].[FUNCTION_NAME]({
  param1: 'value1',
  param2: 'value2'
});

if (response.data?.statusCode === 200) {
  console.log('✓ Success:', response.data.message);
  // Handle success
} else {
  console.error('✗ Error:', response.data?.message);
  // Handle error
}
```

### Complete Workflow Example

[If this function is part of a larger workflow, show how to use it in context]

```typescript
async function completeWorkflow() {
  try {
    // Step 1: [Description]
    const result1 = await client.[queries|mutations].[FUNCTION_NAME]({
      // parameters
    });
    
    if (result1.data?.statusCode !== 200) {
      throw new Error(result1.data?.message);
    }
    
    // Step 2: [Next step]
    // ...
    
  } catch (error) {
    console.error('Workflow failed:', error);
    throw error;
  }
}
```

## AWS CLI Equivalent

For testing or troubleshooting, you can perform equivalent operations using AWS CLI:

```bash
# [Description of what this command does]
aws [service] [command] \
  --parameter1 value1 \
  --parameter2 value2 \
  --region [region]

# [Add more commands as needed]
```

## Error Handling

[Describe the error handling strategy]

### Common Errors

#### Error: "[Error Message]" (Status Code)

**Cause**: [What causes this error]

**Solution**: 
1. [Step 1 to resolve]
2. [Step 2 to resolve]
3. [Step 3 to resolve]

[Repeat for each common error]

## Best Practices

1. **[Practice 1]**: [Description and why it's important]
2. **[Practice 2]**: [Description and why it's important]
3. **[Practice 3]**: [Description and why it's important]
4. **[Practice 4]**: [Description and why it's important]
5. **[Practice 5]**: [Description and why it's important]

## Performance Considerations

[If applicable, discuss performance aspects]

- **Execution Time**: Typically [X] seconds
- **API Calls**: Makes [N] API calls to [services]
- **Optimization Tips**: 
  - [Tip 1]
  - [Tip 2]

## Security Considerations

[If applicable, discuss security aspects]

- **Data Handling**: [How sensitive data is handled]
- **Encryption**: [What is encrypted and how]
- **Access Control**: [Who can invoke this function]
- **Audit Trail**: [What is logged for compliance]

## Notes

- [Important note 1]
- [Important note 2]
- [Important note 3]
- [Any other relevant information]

## Version History

- **v1.0** - Initial implementation
- **v1.1** - [Description of changes]
- **v2.0** - [Description of major changes]

---

**Related Documentation**:
- [Related Guide 1](/Guide/path/to/guide.md)
- [Related Guide 2](/Guide/path/to/guide.md)
- [Related Function 1](../relatedFunction/README.md)
- [Related Function 2](../relatedFunction2/README.md)
