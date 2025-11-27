import type { Schema } from "../../data/resource"
import { DescribeIngestionCommand } from "@aws-sdk/client-quicksight";
import { env } from '$amplify/env/publishRLS99QsCheckIngestion';

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getQuickSightClient } from '../_shared/clients/quicksight';

const FUNCTION_NAME = 'publishRLS99QsCheckIngestion';

export const handler: Schema["publishRLS99QsCheckIngestion"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.dataSetId, 'dataSetId');
    validateRequired(event.arguments.datasetRegion, 'datasetRegion');
    validateRequired(event.arguments.ingestionId, 'ingestionId');

    const accountId = env.ACCOUNT_ID;
    const dataSetId = event.arguments.dataSetId;
    const region = event.arguments.datasetRegion;
    const ingestionId = event.arguments.ingestionId;

    logger.info('Checking ingestion status', { dataSetId, ingestionId });

    const quicksightClient = getQuickSightClient(region);

    const ingestionCommand = new DescribeIngestionCommand({
      AwsAccountId: accountId,
      DataSetId: dataSetId,
      IngestionId: ingestionId
    });
  
    const ingestionResponse = await quicksightClient.send(ingestionCommand);
    const ingestionStatus = ingestionResponse.Ingestion?.IngestionStatus;

    logger.debug('Ingestion status', { status: ingestionStatus });

    if (ingestionStatus === "COMPLETED") {
      logger.info('RLS DataSet ingestion completed successfully');
      return {
        statusCode: 200,
        message: "RLS DataSet Correctly Created / Updated.",
      };
    } else if (ingestionStatus === "FAILED" || ingestionStatus === "CANCELLED") {
      logger.error('Ingestion failed', { 
        status: ingestionStatus,
        errorInfo: ingestionResponse.Ingestion?.ErrorInfo 
      });
      return {
        statusCode: 500,
        message: "Error: " + ingestionResponse.Ingestion?.ErrorInfo?.Message,
        errorType: `QuickSightIngestion_${ingestionStatus}_${ingestionResponse.Ingestion?.ErrorInfo?.Type}`,
      };
    } else if (ingestionStatus === "QUEUED" || ingestionStatus === "INITIALIZED" || ingestionStatus === "RUNNING") { 
      logger.debug('Ingestion still in progress', { status: ingestionStatus });
      return {
        statusCode: 201,
        message: "Still creating dataset...",
      };
    } else {
      throw new Error("Unknown ingestion status");
    }

  } catch (error) {
    logger.error('Failed to check ingestion status', error);
    return {
      statusCode: 500,
      message: "Error checking QuickSight DataSet ingestion",
      errorType: error instanceof Error ? error.name : 'UnknownError'
    };
  }
};
