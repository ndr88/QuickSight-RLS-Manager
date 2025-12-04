import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/fetchNamespacesFromQS';
import { ListNamespacesCommand } from "@aws-sdk/client-quicksight";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getQuickSightClient } from '../_shared/clients/quicksight';

const FUNCTION_NAME = 'fetchNamespacesFromQS';

export const handler: Schema["fetchNamespacesFromQS"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.qsManagementRegion, 'qsManagementRegion');

    const accountId = env.ACCOUNT_ID;
    const region = event.arguments.qsManagementRegion;
    const nextToken = event.arguments.nextToken;

    if (nextToken) {
      logger.info('Fetching Namespaces (paginated)', { nextToken });
    } else {
      logger.info('Fetching Namespaces (first call)');
    }

    const quicksightClient = getQuickSightClient(region);

    const command = new ListNamespacesCommand({
      AwsAccountId: accountId,
      MaxResults: parseInt(env.API_MAX_RESULTS),
      ...(nextToken && { NextToken: nextToken })
    });

    const response = await quicksightClient.send(command);
    logger.debug('Processing response', { status: response.Status });

    if (response.Namespaces && response.Status === 200) {
      const namespacesList = response.Namespaces.map((namespace: any) => ({
        arn: namespace.Arn,
        name: namespace.Name,
        capacityRegion: namespace.CapacityRegion
      }));

      logger.info('Namespaces fetched successfully', { count: namespacesList.length });
      
      return {
        statusCode: 200,
        message: 'QuickSight Namespaces fetched successfully',
        namespacesList: JSON.stringify(namespacesList),
        nextToken: response.NextToken
      };
    } else {
      throw new Error('Error processing response');
    }

  } catch (error) {
    logger.error('Failed to fetch Namespaces', error);
    return {
      statusCode: 500,
      message: 'Failed to fetch QuickSight Namespaces',
      errorName: error instanceof Error ? error.name : 'UnknownError',
      namespacesList: ""
    };
  }
};
