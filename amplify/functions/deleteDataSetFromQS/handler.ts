import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/deleteDataSetFromQS';
import { DeleteDataSetCommand } from "@aws-sdk/client-quicksight";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { successResponse } from '../_shared/utils/response';
import { handleError } from '../_shared/errors/error-handler';
import { getQuickSightClient } from '../_shared/clients/quicksight';

const FUNCTION_NAME = 'deleteDataSetFromQS';

export const handler: Schema["deleteDataSetFromQS"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');
    validateRequired(event.arguments.dataSetId, 'dataSetId');

    const accountId = env.ACCOUNT_ID;
    const region = event.arguments.region;
    const dataSetId = event.arguments.dataSetId;

    logger.info('Deleting QuickSight DataSet', { dataSetId, region });

    const quicksightClient = getQuickSightClient(region);

    const command = new DeleteDataSetCommand({
      AwsAccountId: accountId,
      DataSetId: dataSetId
    });

    const response = await quicksightClient.send(command);
    logger.debug('Delete response received', { status: response.$metadata.httpStatusCode });

    if (response.$metadata.httpStatusCode !== 200) {
      throw new Error('Error deleting QuickSight DataSet');
    }

    logger.info('QuickSight DataSet deleted successfully');
    return successResponse('QuickSight DataSet deleted successfully.');

  } catch (error: any) {
    // Special handling for ResourceNotFoundException - treat as success
    if (error?.name === 'ResourceNotFoundException') {
      logger.info('Resource already deleted or not found');
      return successResponse('Resource is already not present in QuickSight');
    }
    
    return handleError(error, FUNCTION_NAME, 'Failed to delete QuickSight DataSet');
  }
};