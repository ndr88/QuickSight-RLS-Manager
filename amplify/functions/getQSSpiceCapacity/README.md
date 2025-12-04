# getQSSpiceCapacity

**Utility Function** - Retrieves QuickSight SPICE capacity metrics from CloudWatch for a specific region.

## Overview

This function queries CloudWatch metrics to get the total SPICE capacity limit and current usage for QuickSight in a specified region. SPICE (Super-fast, Parallel, In-memory Calculation Engine) is QuickSight's in-memory data store. This is used to monitor capacity and prevent ingestion failures.

## Function Details

- **Name**: `getQSSpiceCapacity`
- **Runtime**: Node.js (AWS Lambda)
- **Timeout**: 120 seconds
- **Handler**: [`handler.ts`](./handler.ts)
- **Resources**: [`resources.ts`](./resources.ts)
- **Schema Definition**: [`amplify/data/resource.ts`](../../data/resource.ts)

## Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | Yes | AWS region to query SPICE capacity for |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ACCOUNT_ID` | AWS Account ID | Set by Amplify backend |

## Response

### Success Response (200)

```json
{
  "statusCode": 200,
  "message": "QuickSight SPICE Capacity successfully retrieved.",
  "availableCapacityInGB": 10.0,
  "usedCapacityInGB": 2.5
}
```

### Error Response (500)

```json
{
  "statusCode": 500,
  "message": "Error fetching QuickSight SPICE Capacity.",
  "availableCapacityInGB": 0,
  "usedCapacityInGB": 0,
  "errorName": "QSSPICE"
}
```

## CloudWatch Metrics

The function queries two CloudWatch metrics:

1. **SPICECapacityLimitInMB**: Total SPICE capacity allocated to the account in the region
2. **SPICECapacityConsumedInMB**: Current SPICE capacity being used

### Metric Query Parameters

- **Namespace**: `AWS/QuickSight`
- **Period**: 3600 seconds (1 hour)
- **Statistic**: Maximum
- **Time Range**: Last 10 days
- **Unit**: Megabytes

## Usage Example

### GraphQL Query

```graphql
query GetSpiceCapacity {
  getQSSpiceCapacity(region: "eu-west-1") {
    statusCode
    message
    availableCapacityInGB
    usedCapacityInGB
    errorName
  }
}
```

### JavaScript/TypeScript

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';

const client = generateClient<Schema>();

// Get SPICE capacity
const response = await client.queries.getQSSpiceCapacity({
  region: 'eu-west-1'
});

if (response.data?.statusCode === 200) {
  const available = response.data.availableCapacityInGB;
  const used = response.data.usedCapacityInGB;
  const free = available - used;
  const percentUsed = (used / available * 100).toFixed(1);
  
  console.log(`SPICE Capacity:`);
  console.log(`  Total: ${available} GB`);
  console.log(`  Used: ${used} GB (${percentUsed}%)`);
  console.log(`  Free: ${free.toFixed(2)} GB`);
}
```

## Capacity Calculation

Values are converted from MB to GB:

```typescript
availableCapacityInGB = (limitInMB / 1024).toFixed(2)
usedCapacityInGB = (consumedInMB / 1024).toFixed(2)
```

## IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricData"
      ],
      "Resource": "*"
    }
  ]
}
```

## AWS CLI Equivalent

```bash
# Get SPICE capacity limit
aws cloudwatch get-metric-data \
  --region eu-west-1 \
  --metric-data-queries '[{
    "Id": "m1",
    "MetricStat": {
      "Metric": {
        "Namespace": "AWS/QuickSight",
        "MetricName": "SPICECapacityLimitInMB"
      },
      "Period": 3600,
      "Stat": "Maximum"
    }
  }]' \
  --start-time 2025-11-17T00:00:00Z \
  --end-time 2025-11-27T00:00:00Z

# Get SPICE capacity consumed
aws cloudwatch get-metric-data \
  --region eu-west-1 \
  --metric-data-queries '[{
    "Id": "m1",
    "MetricStat": {
      "Metric": {
        "Namespace": "AWS/QuickSight",
        "MetricName": "SPICECapacityConsumedInMB"
      },
      "Period": 3600,
      "Stat": "Maximum"
    }
  }]' \
  --start-time 2025-11-17T00:00:00Z \
  --end-time 2025-11-27T00:00:00Z
```

## Logging

The function logs:
- CloudWatch metric queries
- Retrieved capacity values
- Errors with details

## Related Functions

- `fetchDataSetFieldsFromQS` - Shows SPICE usage per DataSet
- `publishRLS03QsRLSDataSet` - Creates DataSets that may use SPICE

## Notes

- **Region-specific**: SPICE capacity is allocated per region
- **10-day lookback**: Queries last 10 days to ensure data availability
- **Maximum statistic**: Uses maximum value to get current capacity
- **GB conversion**: Values are converted from MB to GB for readability
- **Default capacity**: New accounts typically start with 1 GB SPICE capacity

## SPICE Capacity Tiers

QuickSight SPICE capacity varies by edition:

- **Standard Edition**: 1 GB per user (minimum 10 GB)
- **Enterprise Edition**: 10 GB per user (minimum 10 GB)
- **Additional capacity**: Can be purchased separately

## Troubleshooting

### Error: "Error fetching QuickSight SPICE Capacity"
- Verify CloudWatch metrics are available (may take time for new accounts)
- Check Lambda role has `cloudwatch:GetMetricData` permission
- Ensure QuickSight is enabled in the region

### Capacity shows 0
- QuickSight may not be set up in the region
- CloudWatch metrics may not be available yet (wait 24 hours after setup)
- Verify you're querying the correct region

### Metrics incomplete or missing
- CloudWatch metrics are published periodically
- Wait a few hours after QuickSight setup
- Check QuickSight console to verify SPICE capacity is allocated

### Used capacity higher than limit
- This can happen temporarily during data ingestion
- QuickSight may allow brief overages
- Check for failed ingestions that may be retrying

## Version History

- **v1.0** - Initial implementation with CloudWatch metrics
- **v1.1** - Added 10-day lookback period for reliability
- **v1.2** - Improved error handling and validation
