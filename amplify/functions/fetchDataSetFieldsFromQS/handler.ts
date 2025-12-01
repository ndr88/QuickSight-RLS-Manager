import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/fetchDataSetFieldsFromQS';
import { DescribeDataSetCommand } from "@aws-sdk/client-quicksight";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getQuickSightClient } from '../_shared/clients/quicksight';

const FUNCTION_NAME = 'fetchDataSetFieldsFromQS';

export const handler: Schema["fetchDataSetFieldsFromQS"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.dataSetId, 'dataSetId');
    validateRequired(event.arguments.region, 'region');

    const accountId = env.ACCOUNT_ID;
    const dataSetId = event.arguments.dataSetId;
    const region = event.arguments.region;

    logger.info('Fetching Dataset Fields', { dataSetId, region });

    const quicksightClient = getQuickSightClient(region);

    const command = new DescribeDataSetCommand({
      AwsAccountId: accountId,
      DataSetId: dataSetId
    });

    const response = await quicksightClient.send(command);
    logger.debug('Processing response', { status: response.Status });

    if (response.DataSet && response.Status === 200 && response.DataSet?.OutputColumns) {
      const outputFields = response.DataSet.OutputColumns.map((column: any) => column.Name);
      const hasNewDataPrep = response.DataSet.DataPrepConfiguration !== undefined;
      
      logger.info('Dataset Fields fetched successfully', { 
        fieldsCount: outputFields.length,
        newDataPrep: hasNewDataPrep 
      });
      
      return {
        statusCode: 200,
        message: 'QuickSight Dataset Fields fetched successfully',
        datasetsFields: JSON.stringify(outputFields),
        spiceCapacityInBytes: response.DataSet.ConsumedSpiceCapacityInBytes || 0,
        newDataPrep: hasNewDataPrep
      };
    } else {
      throw new Error('Error processing response');
    }

  } catch (error: any) {
    logger.error('Failed to fetch Dataset Fields', error);
    
    if (error?.message === "The data set type is not supported through API yet") {
      return {
        statusCode: 999,
        message: error.message,
        datasetsFields: "",
        spiceCapacityInBytes: 0
      };
    }
    
    return {
      statusCode: 500,
      message: 'Error fetching QuickSight Dataset Fields',
      datasetsFields: "",
      spiceCapacityInBytes: 0,
      errorName: error instanceof Error ? error.name : 'GenericError'
    };
  }
};
