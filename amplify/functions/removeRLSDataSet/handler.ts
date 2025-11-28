import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/removeRLSDataSet';
import { DescribeDataSetCommand, UpdateDataSetCommand } from "@aws-sdk/client-quicksight";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getQuickSightClient } from '../_shared/clients/quicksight';

const FUNCTION_NAME = 'removeRLSDataSet';

export const handler: Schema["removeRLSDataSet"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');
    validateRequired(event.arguments.dataSetId, 'dataSetId');

    const accountId = env.ACCOUNT_ID;
    const region = event.arguments.region;
    const dataSetId = event.arguments.dataSetId;

    logger.info('Removing RLS from DataSet', { dataSetId });

    const quicksightClient = getQuickSightClient(region);

    const command = new DescribeDataSetCommand({
      AwsAccountId: accountId,
      DataSetId: dataSetId
    });

    const response = await quicksightClient.send(command);
    logger.debug('Processing response', { status: response.Status });

    if (response.DataSet && response.Status === 200) {
      const dataSetDetails = response.DataSet;
      
      const updateDataSetCommand = new UpdateDataSetCommand({
        AwsAccountId: accountId,
        DataSetId: dataSetId,
        Name: dataSetDetails.Name,
        PhysicalTableMap: dataSetDetails.PhysicalTableMap,
        LogicalTableMap: dataSetDetails.LogicalTableMap,
        ImportMode: dataSetDetails.ImportMode,
        // RowLevelPermissionDataSet: REMOVED
        ...(dataSetDetails.RowLevelPermissionTagConfiguration && {
          RowLevelPermissionTagConfiguration: dataSetDetails.RowLevelPermissionTagConfiguration
        }),
        ...(dataSetDetails.PerformanceConfiguration && {
          PerformanceConfiguration: dataSetDetails.PerformanceConfiguration
        }),
        ...(dataSetDetails.FieldFolders && {
          FieldFolders: dataSetDetails.FieldFolders
        }),
        ...(dataSetDetails.DataSetUsageConfiguration && {
          DataSetUsageConfiguration: dataSetDetails.DataSetUsageConfiguration
        }),
        ...(dataSetDetails.DatasetParameters && {
          DatasetParameters: dataSetDetails.DatasetParameters
        }),
        ...(dataSetDetails.ColumnLevelPermissionRules && {
          ColumnLevelPermissionRules: dataSetDetails.ColumnLevelPermissionRules
        }),
        ...(dataSetDetails.ColumnGroups && {
          ColumnGroups: dataSetDetails.ColumnGroups
        }),
      });

      const updateDataSetResponse = await quicksightClient.send(updateDataSetCommand);

      if (updateDataSetResponse.$metadata.httpStatusCode === 200) {
        logger.info('RLS removed from DataSet successfully');
        return {
          statusCode: 200,
          message: "QuickSight DataSet updated successfully.",
        };
      } else if (updateDataSetResponse.$metadata.httpStatusCode === 201) {
        const ingestionId = updateDataSetResponse.IngestionId;
        if (!ingestionId) {
          throw new Error("No IngestionId found");
        }
        logger.info('DataSet update in progress', { ingestionId });
        return {
          statusCode: 201,
          message: "QuickSight DataSet updating in progress.",
          ingestionId: ingestionId
        };
      } else {
        throw new Error("Error updating QuickSight DataSet");
      }
    }

    throw new Error("Failed to describe DataSet");

  } catch (error: any) {
    logger.error('Failed to remove RLS from DataSet', error);
    
    if (error?.message === "The data set type is not supported through API yet") {
      return {
        statusCode: 999,
        message: error.message,
        errorType: "NotManageable"
      };
    }
    
    return {
      statusCode: 500,
      message: 'Error removing RLS from DataSet',
      errorType: error instanceof Error ? error.name : 'GenericError'
    };
  }
};
