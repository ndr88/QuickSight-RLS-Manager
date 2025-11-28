import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/fetchGroupsFromQS';
import { ListGroupsCommand } from "@aws-sdk/client-quicksight";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getQuickSightClient } from '../_shared/clients/quicksight';

const FUNCTION_NAME = 'fetchGroupsFromQS';

export const handler: Schema["fetchGroupsFromQS"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.qsManagementRegion, 'qsManagementRegion');
    validateRequired(event.arguments.namespace, 'namespace');

    const accountId = env.ACCOUNT_ID;
    const region = event.arguments.qsManagementRegion;
    const namespace = event.arguments.namespace;
    const nextToken = event.arguments.nextToken;

    if (nextToken) {
      logger.info('Fetching Groups (paginated)', { namespace, nextToken });
    } else {
      logger.info('Fetching Groups (first call)', { namespace });
    }

    const quicksightClient = getQuickSightClient(region);

    const command = new ListGroupsCommand({
      AwsAccountId: accountId,
      MaxResults: parseInt(env.API_MAX_RESULTS),
      Namespace: namespace,
      ...(nextToken && { NextToken: nextToken })
    });

    const response = await quicksightClient.send(command);
    logger.debug('Processing response', { status: response.Status });

    if (response.GroupList && response.Status === 200) {
      logger.info('Groups fetched successfully', { count: response.GroupList.length });
      return {
        statusCode: 200,
        message: 'QuickSight Groups fetched successfully',
        groupsList: JSON.stringify(response.GroupList),
        nextToken: response.NextToken
      };
    } else {
      throw new Error('Error processing response');
    }

  } catch (error) {
    logger.error('Failed to fetch Groups', error);
    return {
      statusCode: 500,
      message: 'Failed to fetch QuickSight Groups',
      errorName: error instanceof Error ? error.name : 'UnknownError',
      groupsList: ""
    };
  }
};
