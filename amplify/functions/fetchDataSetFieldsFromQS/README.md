# fetchDataSetFieldsFromQS

**Data Fetching Function** - Retrieves field names and SPICE capacity information for a specific QuickSight DataSet.

## Overview

This function calls the QuickSight `DescribeDataSet` API to fetch detailed information about a DataSet, including its output columns (fields) and SPICE capacity consumption. This is used to display available fields for RLS configuration and monitor SPICE usage.

## Function Details

- **Name**: `fetchDataSetFieldsFromQS`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the DataSet is located |
| `dataSetId` | string | Yes | Unique identifier of the QuickSight DataSet |

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Output

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "QuickSight Dataset Fields fetched successfully",
  "datasetsFields": "[\"field1\",\"field2\",\"field3\"]",
  "spiceCapacityInBytes": 1048576
}
```

### Unsupported DataSet Type (999)

```json
{
  "statusCode": 999,
  "message": "The data set type is not supported through API yet",
  "datasetsFields": "",
  "spiceCapacityInBytes": 0
}
```

### Error Response (500)

```json
{
  "statusCode": 500,
  "message": "Error fetching QuickSight Dataset Fields: ...",
  "datasetsFields": "",
  "spiceCapacityInBytes": 0,
  "errorName": "GenericError"
}
```

## Usage Example

### GraphQL Query

```graphql
query FetchDataSetFields {
  fetchDataSetFieldsFromQS(
    region: "eu-west-1"
    dataSetId: "abc123-def456-ghi789"
  ) {
    statusCode
    message
    datasetsFields
    spiceCapacityInBytes
    errorName
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Fetch DataSet fields
const response = await client.queries.fetchDataSetFieldsFromQS({
  region: 'eu-west-1',
  dataSetId: 'abc123-def456-ghi789'
});

if (response.data?.statusCode === 200) {
  const fields = JSON.parse(response.data.datasetsFields);
  const spiceBytes = response.data.spiceCapacityInBytes;
  
  console.log('Available fields:', fields);
  console.log('SPICE usage:', (spiceBytes / 1024 / 1024).toFixed(2), 'MB');
  
  // Use fields for RLS configuration
  fields.forEach(field => {
    console.log(`- ${field}`);
  });
} else if (response.data?.statusCode === 999) {
  console.warn('DataSet type not supported via API');
} else {
  console.error('Failed to fetch fields');
}
```

## DataSet Field Fetching Process

The function performs the following steps:

### 1. Query DataSet Details

**Method**: AWS SDK [QuickSight DescribeDataSetCommand](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/quicksight/command/DescribeDataSetCommand/)

**What it retrieves**:
- Output column names (fields)
- SPICE capacity consumption
- DataSet configuration
- Import mode (SPICE or Direct Query)

### 2. Extract Field Names

**Field Sources**:
- `OutputColumns`: Final output schema after transformations
- Returns array of field names as JSON string

**Example Output**:
```json
[
  "customer_id",
  "customer_name",
  "region",
  "sales_amount",
  "order_date"
]
```

### 3. Calculate SPICE Usage

**SPICE Capacity**:
- **0 bytes**: DataSet uses Direct Query (no SPICE)
- **> 0 bytes**: DataSet uses SPICE, value shows consumption

**Example**: 1048576 bytes = 1 MB

## IAM Permissions Required

### Ready-to-Use Policy (Recommended)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "quicksight:DescribeDataSet"
      ],
      "Resource": "arn:aws:quicksight:*:[ACCOUNT_ID]:dataset/*"
    }
  ]
}
```

> **Note**: Replace `[ACCOUNT_ID]` with your AWS Account ID.

### Detailed Permissions Breakdown

**Why needed**:
- `quicksight:DescribeDataSet` - Required to retrieve DataSet details including fields and SPICE usage

## AWS CLI Equivalent

```bash
# Describe DataSet
aws quicksight describe-data-set \
  --aws-account-id 123456789012 \
  --data-set-id abc123-def456-ghi789 \
  --region eu-west-1

# Extract just field names
aws quicksight describe-data-set \
  --aws-account-id 123456789012 \
  --data-set-id abc123-def456-ghi789 \
  --region eu-west-1 \
  --query 'DataSet.OutputColumns[].Name'
```

## Logging

The function logs:
- Start of field fetch operation
- DataSet ID being queried
- Response processing
- Number of fields found
- SPICE capacity
- Errors with details

Example log output:
```
INFO: Fetching DataSet fields { dataSetId: 'abc123-def456-ghi789' }
INFO: DataSet fields fetched successfully { fieldCount: 5, spiceBytes: 1048576 }
```

## Related Functions

### Data Fetching Functions
- [`fetchDataSetsFromQS`](../fetchDataSetsFromQS/README.md) - Lists all DataSets
- [`fetchGroupsFromQS`](../fetchGroupsFromQS/README.md) - Fetches QuickSight groups
- [`fetchUsersFromQS`](../fetchUsersFromQS/README.md) - Fetches QuickSight users

### RLS Configuration Functions
- [`publishRLS04QsUpdateMainDataSetRLS`](../publishRLS04QsUpdateMainDataSetRLS/README.md) - Uses field names to configure RLS

### Capacity Management
- [`getQSSpiceCapacity`](../getQSSpiceCapacity/README.md) - Gets overall SPICE capacity for a region

## Field Names Usage

The returned field names are used for:
- **RLS Configuration**: Determining which fields can have RLS rules
- **Data Validation**: Verifying RLS CSV columns match DataSet fields
- **UI Display**: Showing available fields to users
- **Schema Mapping**: Mapping RLS rules to DataSet columns

## SPICE Capacity Details

| Value | Meaning | Action |
|-------|---------|--------|
| 0 bytes | Direct Query mode | No SPICE consumption |
| > 0 bytes | SPICE mode | Shows actual consumption |

**Convert to readable format**:
```typescript
const mb = spiceCapacityInBytes / 1024 / 1024;
const gb = mb / 1024;
```

## Troubleshooting

### Error: "Missing tool Resource: dataSetId"

**Cause**: Required parameter not provided

**Solution**:
- Ensure the `dataSetId` parameter is provided
- Verify the DataSet ID is correct
- Check that the parameter is correctly passed in the function call

### Error: "AccessDeniedException" (403)

**Cause**: Insufficient permissions

**Solution**:
1. Verify Lambda role has `quicksight:DescribeDataSet` permission (see IAM Permissions section)
2. Check that the DataSet exists in the specified region
3. Ensure QuickSight is enabled in the account
4. Verify the IAM role has trust relationship with Lambda service

### Error: "ResourceNotFoundException" (404)

**Cause**: DataSet doesn't exist

**Solution**:
1. Verify the DataSet ID is correct
2. Check that the DataSet exists in the specified region
3. Use `fetchDataSetsFromQS` to list available DataSets
4. Ensure the DataSet wasn't deleted

### Status Code 999 - Unsupported DataSet Type

**Cause**: This DataSet type is not supported through the API

**Solution**:
1. This is expected for certain DataSet types
2. Manual configuration may be required
3. Check QuickSight console for DataSet details
4. Consider recreating the DataSet with a supported type

### Empty Fields List

**Cause**: DataSet has no output columns defined

**Solution**:
1. Verify the DataSet has been successfully created
2. Check that the DataSet has completed its initial data load
3. Ensure the DataSet has defined output columns
4. Check DataSet configuration in QuickSight console
5. Verify the DataSet isn't in an error state

### SPICE Capacity Shows 0 But DataSet Uses SPICE

**Cause**: DataSet hasn't ingested data yet

**Solution**:
1. DataSet may not have ingested data yet
2. Check ingestion status using `publishRLS99QsCheckIngestion`
3. Wait for initial ingestion to complete
4. Verify SPICE capacity is available using `getQSSpiceCapacity`
5. Check QuickSight console for ingestion errors

### Error: "ThrottlingException" (429)

**Cause**: API rate limit exceeded

**Solution**:
1. Implement exponential backoff and retry logic
2. Reduce the frequency of API calls
3. Cache field information when possible
4. Contact AWS support to request higher API limits

## Best Practices

1. **Cache field information**: Field names rarely change, cache them to reduce API calls
2. **Validate RLS columns**: Use field names to validate RLS CSV columns match
3. **Monitor SPICE usage**: Track SPICE capacity consumption across DataSets
4. **Handle unsupported types**: Gracefully handle status code 999
5. **Check ingestion status**: Verify DataSet has completed ingestion before fetching fields

## Notes

- **Output columns**: Returns the final output schema after all transformations
- **SPICE vs Direct Query**: SPICE DataSets show capacity usage, Direct Query shows 0
- **Unsupported types**: Some DataSet types (status code 999) cannot be queried via API
- **Field names**: Used to determine which fields can have RLS rules applied
- **The function is read-only**: Doesn't modify any resources
- **Case sensitive**: Field names are case-sensitive

## Version History

- **v1.0** - Initial implementation
- **v1.1** - Added SPICE capacity information
- **v1.2** - Added special handling for unsupported DataSet types (status 999)
- **v2.0** - Updated documentation and improved error handling

---

**Related Documentation**:
- [QuickSight DataSet Management](/Guide/quicksight-datasets.md)
- [SPICE Capacity Management](/Guide/spice-capacity.md)
- [Troubleshooting Guide](/Guide/troubleshooting.md)
