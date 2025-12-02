import type { Schema } from "../../data/resource"
import { DescribeDataSetCommand, UpdateDataSetCommand } from "@aws-sdk/client-quicksight";
import { env } from '$amplify/env/publishRLS04QsUpdateMainDataSetRLS';

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getQuickSightClient } from '../_shared/clients/quicksight';

const FUNCTION_NAME = 'publishRLS04QsUpdateMainDataSetRLS';

export const handler: Schema["publishRLS04QsUpdateMainDataSetRLS"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');
    validateRequired(event.arguments.dataSetId, 'dataSetId');
    validateRequired(event.arguments.rlsDataSetArn, 'rlsDataSetArn');

    const accountId = env.ACCOUNT_ID;
    const dataSetId = event.arguments.dataSetId;
    const region = event.arguments.region;
    const rlsDataSetArn = event.arguments.rlsDataSetArn;

    logger.info('Updating RLS of DataSet', { dataSetId, rlsDataSetArn });

    const quicksightClient = getQuickSightClient(region);

    // Get the dataset to be modified
    const getDataSetInfoCommand = new DescribeDataSetCommand({
      AwsAccountId: accountId,
      DataSetId: dataSetId,
    });

    const dataSetInfoResponse = await quicksightClient.send(getDataSetInfoCommand);

    if (dataSetInfoResponse && dataSetInfoResponse.Status === 200 && dataSetInfoResponse.DataSet) {
      const dataSetToSecure = dataSetInfoResponse.DataSet;

      // Check if RLS is already configured (check both legacy and new data prep locations)
      let existingRlsArn: string | undefined;
      
      // Check legacy location (top level)
      if (dataSetInfoResponse.DataSet.RowLevelPermissionDataSet?.Arn) {
        existingRlsArn = dataSetInfoResponse.DataSet.RowLevelPermissionDataSet.Arn;
      }
      
      // Check new data prep location (inside SemanticModelConfiguration)
      if (!existingRlsArn && dataSetInfoResponse.DataSet.SemanticModelConfiguration?.TableMap) {
        const tableMap = dataSetInfoResponse.DataSet.SemanticModelConfiguration.TableMap;
        const firstTableKey = Object.keys(tableMap)[0];
        if (firstTableKey) {
          const rlsConfig = tableMap[firstTableKey].RowLevelPermissionConfiguration?.RowLevelPermissionDataSet;
          if (rlsConfig?.Arn && rlsConfig?.Status === "ENABLED") {
            existingRlsArn = rlsConfig.Arn;
          }
        }
      }
      
      if (existingRlsArn === rlsDataSetArn) {
        logger.info('DataSet RLS already set to target ARN, verifying RLS DataSet exists');
        
        const rlsDataSetIdExtracted = rlsDataSetArn.split("/").pop();

        try {
          const getRLSDataSetInfoCommand = new DescribeDataSetCommand({
            AwsAccountId: accountId,
            DataSetId: rlsDataSetIdExtracted
          });

          const rlsDataSetInfoResponse = await quicksightClient.send(getRLSDataSetInfoCommand);

          if (rlsDataSetInfoResponse.Status === 200) {
            logger.info('RLS DataSet verified, already configured');
            return {
              statusCode: 200,
              message: "DataSet RLS already set. RLS Already configured.",
              ingestionId: ""
            };
          }
        } catch (e: any) {
          if (e?.name !== "ResourceNotFoundException") {
            throw e;
          }
          logger.info('RLS DataSet not found, will update');
        }
      }

      logger.info('Updating DataSet with RLS configuration');

      // Determine if dataset uses new data prep experience
      const isNewDataPrep = !!dataSetToSecure.DataPrepConfiguration;
      
      logger.info('Dataset data prep mode', { 
        isNewDataPrep, 
        hasDataPrepConfig: !!dataSetToSecure.DataPrepConfiguration,
        hasSemanticModel: !!dataSetToSecure.SemanticModelConfiguration 
      });

      // Build update command with conditional fields based on data prep experience
      const updateParams: any = {
        AwsAccountId: accountId,
        DataSetId: dataSetToSecure.DataSetId,
        Name: dataSetToSecure.Name,
        PhysicalTableMap: dataSetToSecure.PhysicalTableMap,
        ImportMode: dataSetToSecure.ImportMode,
      };

      if (isNewDataPrep) {
        // NEW DATA PREP: RLS goes inside SemanticModelConfiguration
        logger.info('Using new data prep RLS configuration');
        
        updateParams.DataPrepConfiguration = dataSetToSecure.DataPrepConfiguration;
        
        // Clone SemanticModelConfiguration and add RLS to each table
        const semanticModelConfig = JSON.parse(JSON.stringify(dataSetToSecure.SemanticModelConfiguration || {}));
        
        if (semanticModelConfig.TableMap) {
          Object.keys(semanticModelConfig.TableMap).forEach(tableKey => {
            // Correct structure for new data prep
            semanticModelConfig.TableMap[tableKey].RowLevelPermissionConfiguration = {
              RowLevelPermissionDataSet: {
                Arn: rlsDataSetArn,
                PermissionPolicy: "GRANT_ACCESS",
                FormatVersion: "VERSION_2",
                Status: "ENABLED",
              }
            };
          });
        }
        
        updateParams.SemanticModelConfiguration = semanticModelConfig;
      } else {
        // LEGACY DATA PREP: RLS at top level
        logger.info('Using legacy data prep RLS configuration');
        
        if (dataSetToSecure.LogicalTableMap) {
          updateParams.LogicalTableMap = dataSetToSecure.LogicalTableMap;
        }
        
        updateParams.RowLevelPermissionDataSet = {
          Arn: rlsDataSetArn,
          PermissionPolicy: "GRANT_ACCESS",
          Status: "ENABLED",
          FormatVersion: "VERSION_2",
        };
      }

      // Include RowLevelPermissionTagConfiguration if present
      if (dataSetToSecure.RowLevelPermissionTagConfiguration) {
        updateParams.RowLevelPermissionTagConfiguration = dataSetToSecure.RowLevelPermissionTagConfiguration;
      }

      const updateDataSetCommand = new UpdateDataSetCommand(updateParams);

      const updateDataSetResponse = await quicksightClient.send(updateDataSetCommand);

      if (updateDataSetResponse.$metadata.httpStatusCode === 200) {
        logger.info('DataSet updated successfully');
        return {
          statusCode: 200,
          message: "QuickSight DataSet to be Secured updated successfully.",
        };
      } else if (updateDataSetResponse.$metadata.httpStatusCode === 201) {
        const ingestionId = updateDataSetResponse.IngestionId;
        if (!ingestionId) {
          throw new Error("No IngestionId found");
        }
        logger.info('DataSet update in progress', { ingestionId });
        return {
          statusCode: 201,
          message: "QuickSight DataSet to be Secured updating in progress.",
          ingestionId: ingestionId
        };
      }

      throw new Error("Error updating QuickSight DataSet");
    } else {
      throw new Error("Error getting DataSet to be Secured Info");
    }

  } catch (error) {
    logger.error('Failed to update DataSet RLS', error);
    return {
      statusCode: 500,
      message: 'Failed to update DataSet RLS',
      errorType: error instanceof Error ? error.name : 'UnknownError'
    };
  }
};
