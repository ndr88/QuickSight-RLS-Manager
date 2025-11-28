import type { Schema } from "../../data/resource"
import { env } from '$amplify/env/createQSDataSource';
import { v4 as uuidv4 } from 'uuid';
import { CreateDataSourceCommand, DescribeDataSourceCommand } from "@aws-sdk/client-quicksight";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getQuickSightClient } from '../_shared/clients/quicksight';

const FUNCTION_NAME = 'createQSDataSource';

export const handler: Schema["createQSDataSource"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');

    const accountId = env.ACCOUNT_ID;
    const region = event.arguments.region;
    const uuid = uuidv4();
    const dataSourceName = env.RESOURCE_PREFIX + uuid;

    logger.info('Creating QuickSight DataSource', { region, dataSourceName });

    const createDataSourceCommand = new CreateDataSourceCommand({
      AwsAccountId: accountId,
      DataSourceId: dataSourceName,
      Name: 'QS Managed Data Source from Athena',
      Type: 'ATHENA',
      DataSourceParameters: {
        AthenaParameters: {
          WorkGroup: 'primary'
        }
      }
    });

    const quicksightClient = getQuickSightClient(region);
    const createResponse = await quicksightClient.send(createDataSourceCommand);

    if (createResponse.$metadata.httpStatusCode === 202) {
      logger.info('QuickSight DataSource creation in progress');

      let creationInProgress = true;

      do {
        const describeCommand = new DescribeDataSourceCommand({
          AwsAccountId: accountId,
          DataSourceId: dataSourceName
        });

        const describeResponse = await quicksightClient.send(describeCommand);
        logger.debug('DataSource status', { status: describeResponse.DataSource?.Status });

        if (describeResponse && describeResponse.Status === 200) {
          if (describeResponse.DataSource?.Status === "CREATION_IN_PROGRESS") {
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else if (describeResponse.DataSource?.Status === "CREATION_SUCCESSFUL") {
            creationInProgress = false;
            logger.info('QuickSight DataSource created successfully');
          } else {
            throw new Error('QuickSight DataSource creation failed');
          }
        }
      } while (creationInProgress);

      return {
        statusCode: 200,
        message: `QuickSight DataSource ${dataSourceName} created in Region ${region}.`,
        qsDataSourceName: dataSourceName
      };
    } else {
      throw new Error('Failed to initiate QuickSight DataSource creation');
    }

  } catch (error) {
    logger.error('Failed to create QuickSight DataSource', error);
    return {
      statusCode: 500,
      message: 'Failed to create QuickSight DataSource',
      qsDataSourceName: '',
      errorName: error instanceof Error ? error.name : 'UnknownError'
    };
  }
}