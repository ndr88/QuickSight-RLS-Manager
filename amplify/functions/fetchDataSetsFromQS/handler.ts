import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/fetchDataSetsFromQS';
import { ListDataSetsCommand } from "@aws-sdk/client-quicksight";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getQuickSightClient } from '../_shared/clients/quicksight';

const FUNCTION_NAME = 'fetchDataSetsFromQS';

/**
 * This function will perform a ListDataSets call to Quicksight APIs to retrieve datasets list and count
 */
export const handler: Schema["fetchDataSetsFromQS"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    // Validate required variables
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');

    const accountId = env.ACCOUNT_ID;
    const region = event.arguments.region;
    const nextToken = event.arguments.nextToken;

    if (nextToken) {
      logger.info('Fetching Datasets (paginated)', { nextToken });
    } else {
      logger.info('Fetching Datasets (first call)');
    }

    const quicksightClient = getQuickSightClient(region);

    const command = new ListDataSetsCommand({
      AwsAccountId: accountId,
      MaxResults: parseInt(env.API_MAX_RESULTS),
      ...(nextToken && { NextToken: nextToken })
    });

    const response = await quicksightClient.send(command);
    logger.debug('Processing response', { status: response.Status });

    if (response.DataSetSummaries && response.Status === 200) {
      logger.info('Datasets fetched successfully', { count: response.DataSetSummaries.length });
      return {
        statusCode: 200,
        message: 'QuickSight Datasets fetched successfully',
        datasetsList: JSON.stringify(response.DataSetSummaries),
        nextToken: response.NextToken
      };
    } else {
      throw new Error('Error processing response');
    }

  } catch (error) {
    logger.error('Failed to fetch Datasets from QuickSight', error);
    return {
      statusCode: 500,
      message: 'Failed to fetch Datasets from QuickSight',
      datasetsList: '',
      errorName: error instanceof Error ? error.name : 'UnknownError'
    };
  }
};