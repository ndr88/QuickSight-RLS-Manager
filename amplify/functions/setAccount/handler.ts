import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/setAccount';
import { generateClient } from 'aws-amplify/data';

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { successResponse } from '../_shared/utils/response';
import { handleError } from '../_shared/errors/error-handler';

const FUNCTION_NAME = 'setAccount';

/**
 * INIT function will be launched only at the first access
 */
export const handler: Schema["setAccount"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    const client = generateClient<Schema>();
    logger.info('Adding backend resources info to AccountDetails schema');

    // Validate required variables
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.qsManagementRegion, 'qsManagementRegion');

    const accountId = env.ACCOUNT_ID;
    const qsManagementRegion = event.arguments.qsManagementRegion;
    const namespacesCount = event.arguments.namespacesCount || 0;
    const groupsCount = event.arguments.groupsCount || 0;
    const usersCount = event.arguments.usersCount || 0;

    const accountParams = {
      accountId,
      qsManagementRegion,
      namespacesCount,
      groupsCount,
      usersCount,
    };

    // Check if account details already exist
    const { data: existingAccount, errors: getErrors } = await client.models.AccountDetails.get({ 
      accountId 
    });

    if (getErrors) {
      const errorMessage = getErrors.map(e => e.message).join(', ');
      throw new Error(errorMessage);
    }

    if (existingAccount) {
      logger.info('Account Details already exist, updating');
      const response = await client.models.AccountDetails.update(accountParams);

      if (response.errors) {
        const errorMessage = response.errors.map(e => e.message).join(', ');
        throw new Error(errorMessage);
      }
    } else {
      logger.info('Creating new Account Details');
      const response = await client.models.AccountDetails.create(accountParams);

      if (response.errors) {
        const errorMessage = response.errors.map(e => e.message).join(', ');
        throw new Error(errorMessage);
      }
    }

    logger.info('Successfully initialized the QS RLS Managed Tool');
    return successResponse('Successfully initiated the QS RLS Managed Tool');

  } catch (error) {
    return handleError(error, FUNCTION_NAME, 'Failed to initialize the Account');
  }
}