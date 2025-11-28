# fetchDataSetFieldsFromQS

Lambda function that retrieves field names and SPICE capacity information for a specific QuickSight DataSet.

## Overview

This function calls the QuickSight `DescribeDataSet` API to fetch detailed information about a DataSet, including its output columns (fields) and SPICE capacity consumption. This is used to display available fields for RLS configuration.

## Function Details

- **Name**: `fetchDataSetFieldsFromQS`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: `handler.ts`

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region where the DataSet is located |
| `dataSetId` | string | Yes | Unique identifier of the QuickSight DataSet |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Response

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

## Field Names

The `datasetsFields` response contains an array of column names from the DataSet's output schema:

```json
[
  "customer_id",
  "customer_name",
  "region",
  "sales_amount",
  "order_date"
]
```

These field names can be used to configure row-level security rules.

## SPICE Capacity

The `spiceCapacityInBytes` field shows how much SPICE capacity this DataSet consumes:

- **0**: DataSet uses Direct Query (no SPICE)
- **> 0**: DataSet uses SPICE, value in bytes

## IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "quicksight:DescribeDataSet"
      ],
      "Resource": "*"
    }
  ]
}
```

## AWS CLI Equivalent

```bash
aws quicksight describe-data-set \
  --aws-account-id 995997919788 \
  --data-set-id abc123-def456-ghi789 \
  --region eu-west-1
```

## Logging

The function logs:
- Start of field fetch operation
- DataSet ID being queried
- Response processing
- Errors with details

## Related Functions

- `fetchDataSetsFromQS` - Lists all DataSets
- `publishRLS04QsUpdateMainDataSetRLS` - Uses field names to configure RLS
- `getQSSpiceCapacity` - Gets overall SPICE capacity for a region

## Notes

- **Output columns**: Returns the final output schema after all transformations
- **SPICE vs Direct Query**: SPICE DataSets show capacity usage, Direct Query shows 0
- **Unsupported types**: Some DataSet types (status code 999) cannot be queried via API
- **Field names**: Used to determine which fields can have RLS rules applied

## Troubleshooting

### Error: "Access Denied"
- Verify Lambda role has `quicksight:DescribeDataSet` permission
- Check that the DataSet exists in the specified region

### Status code 999
- This DataSet type is not supported through the API
- Manual configuration may be required
- Check QuickSight console for DataSet details

### Empty fields list
- Verify the DataSet has been successfully created
- Check that the DataSet has completed its initial data load
- Ensure the DataSet has defined output columns

### SPICE capacity shows 0 but DataSet uses SPICE
- DataSet may not have ingested data yet
- Check ingestion status in QuickSight console
- Wait for initial ingestion to complete

## Version History

- **v1.0** - Initial implementation
- **v1.1** - Added SPICE capacity information
- **v1.2** - Added special handling for unsupported DataSet types (status 999)
