import type { Schema } from "../../data/resource"
import { env } from '$amplify/env/createGlueDatabase';
import { v4 as uuidv4 } from 'uuid';
import { CreateDatabaseCommand } from "@aws-sdk/client-glue";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getGlueClient } from '../_shared/clients/glue';

const FUNCTION_NAME = 'createGlueDatabase';

export const handler: Schema["createGlueDatabase"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    // Validate required variables
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');
    
    const region = event.arguments.region;
    const uuid = uuidv4();
    const glueDatabaseName = env.RESOURCE_PREFIX + uuid;

    logger.info('Creating Glue Database', { region, glueDatabaseName });

    const createGlueDatabaseCommand = new CreateDatabaseCommand({
      DatabaseInput: {
        Name: glueDatabaseName,
        Description: "Database created by QuickSight Managed RLS Tool",
      }
    });

    const glueClient = getGlueClient(region);
    const response = await glueClient.send(createGlueDatabaseCommand);

    if (response.$metadata.httpStatusCode === 200) {
      logger.info('Glue Database created successfully', { glueDatabaseName });
      return {
        statusCode: 200,
        message: `Glue Database ${glueDatabaseName} created in Region ${region}.`,
        glueDatabaseName
      };
    } else {
      throw new Error('Failed to create Glue Database');
    }

  } catch (error) {
    logger.error('Failed to create Glue Database', error);
    return {
      statusCode: 500,
      message: 'Failed to create Glue Database',
      glueDatabaseName: '',
      errorName: error instanceof Error ? error.name : 'UnknownError'
    };
  }
}