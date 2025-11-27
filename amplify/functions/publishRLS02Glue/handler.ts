import type { Schema } from "../../data/resource"
import { env } from '$amplify/env/publishRLS02Glue';
import { CreateTableCommand, GetTableCommand, UpdateTableCommand } from "@aws-sdk/client-glue";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired, validateArray } from '../_shared/utils/validation';
import { successResponse } from '../_shared/utils/response';
import { handleError } from '../_shared/errors/error-handler';
import { getGlueClient } from '../_shared/clients/glue';

const FUNCTION_NAME = 'publishRLS02Glue';

/**
 * Publish data to QuickSight with new DataSet Creation
 */
export const handler: Schema["publishRLS02Glue"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    // Validate required variables
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');
    validateRequired(event.arguments.dataSetId, 'dataSetId');
    validateRequired(event.arguments.s3BucketName, 's3BucketName');
    validateRequired(event.arguments.glueDatabaseName, 'glueDatabaseName');
    validateArray(event.arguments.csvColumns, 'csvColumns');

    const accountId = env.ACCOUNT_ID;
    const region = event.arguments.region;
    const s3BucketName = event.arguments.s3BucketName;
    const glueDatabaseName = event.arguments.glueDatabaseName;
    const dataSetId = event.arguments.dataSetId;
    const csvColumns = event.arguments.csvColumns;

    const glueTableName = `qs-rls-${dataSetId}`;
    const glueTableLocation = `s3://${s3BucketName}/RLS-Datasets/${dataSetId}/`;
    const glueTableDescription = `QS-RLS Table created for DataSetId: ${dataSetId}`;

    logger.info('Checking if Glue Table exists', { glueTableName, glueDatabaseName });

    const glueClient = getGlueClient(region);
    let glueTableExists = false;

    // Check if Glue Table already exists
    try {
      const getTableCommand = new GetTableCommand({
        DatabaseName: glueDatabaseName,
        Name: glueTableName
      });

      const checkTableResponse = await glueClient.send(getTableCommand);

      if (checkTableResponse.$metadata.httpStatusCode === 200) {
        glueTableExists = true;
        logger.info('Glue Table exists, will update', { glueTableName });
      }
    } catch (e: any) {
      if (e?.name === 'EntityNotFoundException') {
        logger.info('Glue Table not found, will create', { glueTableName });
        glueTableExists = false;
      } else {
        throw e; // Re-throw other errors to be handled by outer catch
      }
    }

    // Create table input configuration
    const tableInput = {
      CatalogId: accountId,
      DatabaseName: glueDatabaseName,
      TableInput: {
        Name: glueTableName,
        Description: glueTableDescription,
        StorageDescriptor: {
          Columns: csvColumns
            .filter((columnName): columnName is string => columnName !== null)
            .map(columnName => ({
              Name: columnName,
              Type: 'STRING'
            })),
          Location: glueTableLocation,
          InputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
          OutputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
          SerdeInfo: {
            SerializationLibrary: 'org.apache.hadoop.hive.serde2.OpenCSVSerde',
            Parameters: {
              'separatorChar': ',',
              'quoteChar': '"',
              'skip.header.line.count': '1',
            }
          }
        },
      }
    };

    // Create or Update the Glue Table
    if (glueTableExists) {
      logger.info('Updating Glue Table', { glueTableName });
      const updateTableCommand = new UpdateTableCommand(tableInput);
      const updateResponse = await glueClient.send(updateTableCommand);
      
      if (updateResponse.$metadata.httpStatusCode !== 200) {
        throw new Error('Error updating the Glue Table');
      }
    } else {
      logger.info('Creating Glue Table', { glueTableName });
      const createTableCommand = new CreateTableCommand(tableInput);
      const createResponse = await glueClient.send(createTableCommand);
      
      if (createResponse.$metadata.httpStatusCode !== 200) {
        throw new Error('Error creating Glue Table');
      }
    }

    const action = glueTableExists ? 'updated' : 'created';
    logger.info(`Glue Table ${action} successfully`, { glueTableName });

    return successResponse(
      `Glue Table '${glueTableName}' ${action} successfully.`
    );

  } catch (error) {
    return handleError(error, FUNCTION_NAME, 'Failed to create/update Glue Table');
  }
}