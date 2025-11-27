import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/checkQSManagementRegionAccess';
import { ListUsersCommand } from "@aws-sdk/client-quicksight";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { successResponse } from '../_shared/utils/response';
import { handleError } from '../_shared/errors/error-handler';
import { getQuickSightClient } from '../_shared/clients/quicksight';

const FUNCTION_NAME = 'checkQSManagementRegionAccess';

export const handler: Schema["checkQSManagementRegionAccess"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    logger.info('Starting QuickSight Management Region access check');

    // Validate required variables
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.qsManagementRegion, 'qsManagementRegion');

    const accountId = env.ACCOUNT_ID;
    const region = event.arguments.qsManagementRegion;

    // Get QuickSight client
    const quicksightClient = getQuickSightClient(region);

    // Create and execute the ListUsers command
    const command = new ListUsersCommand({
      AwsAccountId: accountId,
      MaxResults: parseInt(env.API_MAX_RESULTS),
      Namespace: 'default',
    });

    const response = await quicksightClient.send(command);
    logger.debug('Received response from QuickSight', { status: response.Status });

    if (response.Status === 200) {
      logger.info('QuickSight Management Region verified successfully');
      return successResponse('QuickSight Management Region: VERIFIED.');
    } else {
      logger.error('Unexpected response status', { status: response.Status });
      throw new Error('Error processing response. Try again.');
    }

  } catch (error) {
    return handleError(error, FUNCTION_NAME, 'Failed to validate QuickSight Management Region');
  }
};