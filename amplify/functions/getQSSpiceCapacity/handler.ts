import { 
  CloudWatch, 
  GetMetricDataCommand,
  StandardUnit 
} from '@aws-sdk/client-cloudwatch';
import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/getQSSpiceCapacity';

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';

const FUNCTION_NAME = 'getQSSpiceCapacity';

export const handler: Schema["getQSSpiceCapacity"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');

    const accountId = env.ACCOUNT_ID;
    const region = event.arguments.region;

    logger.info('Fetching QuickSight SPICE Capacity', { region });

    const cloudwatchClient = new CloudWatch({ region });
    
    const endtime = new Date();
    const starttime = new Date(endtime.getTime() - (1000 * 24 * 60 * 60 * 1000)); // 10 days

    // Get SPICE Capacity Limit
    const inputLimit = {
      MetricDataQueries: [
        {
          Id: "cloudwatch",
          MetricStat: {
            Metric: {
              Namespace: 'AWS/QuickSight',
              MetricName: "SPICECapacityLimitInMB",
            },
            Period: 3600,
            Stat: 'Maximum',
            Unit: StandardUnit.Megabytes,
          },
          Label: "cloudwatch",
          ReturnData: true,
          AccountId: accountId,
        },
      ],
      StartTime: starttime,
      EndTime: endtime,
    };

    const getLimitCommand = new GetMetricDataCommand(inputLimit);
    const responseLimit = await cloudwatchClient.send(getLimitCommand);

    if (!responseLimit.MetricDataResults?.[0]?.Values?.[0]) {
      throw new Error('No SPICE limit data available');
    }
    
    const qsLimitInMB = responseLimit.MetricDataResults[0].Values[0];

    // Get SPICE Capacity Used
    const inputUsed = {
      MetricDataQueries: [
        {
          Id: "cloudwatch",
          MetricStat: {
            Metric: {
              Namespace: 'AWS/QuickSight',
              MetricName: "SPICECapacityConsumedInMB",
            },
            Period: 3600,
            Stat: 'Maximum',
            Unit: StandardUnit.Megabytes,
          },
          Label: "cloudwatch",
          ReturnData: true,
          AccountId: accountId,
        },
      ],
      StartTime: starttime,
      EndTime: endtime,
    };

    const getUsedCommand = new GetMetricDataCommand(inputUsed);
    const responseUsed = await cloudwatchClient.send(getUsedCommand);

    if (!responseUsed.MetricDataResults?.[0]?.Values?.[0]) {
      throw new Error('No SPICE usage data available');
    }
    
    const qsUsedInMB = responseUsed.MetricDataResults[0].Values[0];

    logger.info('SPICE Capacity retrieved successfully', { 
      limitMB: qsLimitInMB, 
      usedMB: qsUsedInMB 
    });

    return {
      statusCode: 200,
      message: "QuickSight SPICE Capacity successfully retrieved.",
      availableCapacityInGB: Number((qsLimitInMB / 1024).toFixed(2)),
      usedCapacityInGB: Number((qsUsedInMB / 1024).toFixed(2)),
    };

  } catch (error) {
    logger.error('Failed to fetch SPICE Capacity', error);
    return {
      statusCode: 500,
      message: "Error fetching QuickSight SPICE Capacity.",
      availableCapacityInGB: 0,
      usedCapacityInGB: 0,
      errorName: error instanceof Error ? error.name : 'QSSPICE'
    };
  }
};
