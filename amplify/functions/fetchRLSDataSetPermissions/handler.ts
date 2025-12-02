import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/fetchRLSDataSetPermissions';
import { DescribeDataSetPermissionsCommand } from "@aws-sdk/client-quicksight";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getQuickSightClient } from '../_shared/clients/quicksight';

const FUNCTION_NAME = 'fetchRLSDataSetPermissions';

export const handler: Schema["fetchRLSDataSetPermissions"]["functionHandler"] = async (event) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');
    validateRequired(event.arguments.rlsDataSetId, 'rlsDataSetId');

    const accountId = env.ACCOUNT_ID;
    const region = event.arguments.region;
    const rlsDataSetId = event.arguments.rlsDataSetId;

    logger.info('Fetching RLS DataSet permissions', { rlsDataSetId });

    const quicksightClient = getQuickSightClient(region);

    const command = new DescribeDataSetPermissionsCommand({
      AwsAccountId: accountId,
      DataSetId: rlsDataSetId
    });

    const response = await quicksightClient.send(command);

    if (response.$metadata.httpStatusCode === 200) {
      const permissions = response.Permissions || [];
      
      logger.info('Permissions fetched successfully', { count: permissions.length });
      
      return {
        statusCode: 200,
        message: "RLS DataSet permissions fetched successfully.",
        permissions: JSON.stringify(permissions)
      };
    }

    throw new Error("Unexpected response from DescribeDataSetPermissions");

  } catch (error) {
    logger.error('Failed to fetch RLS DataSet permissions', error);
    return {
      statusCode: 500,
      message: 'Failed to fetch RLS DataSet permissions',
      permissions: "[]",
      errorType: error instanceof Error ? error.name : 'UnknownError'
    };
  }
};
