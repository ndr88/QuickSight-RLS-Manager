import type { Schema} from "../../data/resource"
import { env } from '$amplify/env/deleteDataSetGlueTable';
import { DeleteTableCommand } from "@aws-sdk/client-glue";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getGlueClient } from '../_shared/clients/glue';

const FUNCTION_NAME = 'deleteDataSetGlueTable';

export const handler: Schema["deleteDataSetGlueTable"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');
    validateRequired(event.arguments.glueKey, 'glueKey');
    validateRequired(event.arguments.glueDatabaseName, 'glueDatabaseName');

    const region = event.arguments.region;
    const glueDatabaseName = event.arguments.glueDatabaseName;
    const glueKey = event.arguments.glueKey;
    const glueTableName = `qs-rls-${glueKey}`;

    logger.info('Deleting Glue Table', { glueTableName, glueDatabaseName });

    const glueClient = getGlueClient(region);
    
    const deleteTableCommand = new DeleteTableCommand({
      DatabaseName: glueDatabaseName,
      Name: glueTableName
    });

    const deleteTableResponse = await glueClient.send(deleteTableCommand);

    if (deleteTableResponse.$metadata.httpStatusCode !== 200) {
      throw new Error(`Error deleting Glue Table '${glueTableName}'`);
    }

    logger.info('Glue Table deleted successfully', { glueTableName });

    return {
      statusCode: 200,
      message: `Glue Table '${glueTableName}' deleted successfully.`,
    };

  } catch (error: any) {
    if (error?.name === 'EntityNotFoundException') {
      logger.info('Glue Table not found, treating as success');
      return {
        statusCode: 200,
        message: 'Glue Table already deleted or not found.',
      };
    }
    
    logger.error('Failed to delete Glue Table', error);
    return {
      statusCode: 500,
      message: 'Failed to delete Glue Table',
      errorType: error instanceof Error ? error.name : 'UnknownError'
    };
  }
}