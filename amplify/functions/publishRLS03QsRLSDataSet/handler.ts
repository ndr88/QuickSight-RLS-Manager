import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/publishRLS03QsRLSDataSet';
import { 
  CreateDataSetCommand, 
  CreateDataSetCommandInput, 
  DescribeDataSetCommand, 
  UpdateDataSetCommand 
} from "@aws-sdk/client-quicksight";
import { v4 as uuidv4 } from 'uuid';

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired, validateArray, ValidationError } from '../_shared/utils/validation';
import { getQuickSightClient } from '../_shared/clients/quicksight';

const FUNCTION_NAME = 'publishRLS03QsRLSDataSet';

/**
 * Create or update QuickSight RLS DataSet
 */
export const handler: Schema["publishRLS03QsRLSDataSet"]["functionHandler"] = async (event) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    // Validate required variables
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');
    validateRequired(event.arguments.glueDatabaseName, 'glueDatabaseName');
    validateRequired(event.arguments.qsDataSourceName, 'qsDataSourceName');
    validateRequired(event.arguments.dataSetId, 'dataSetId');
    validateArray(event.arguments.csvColumns, 'csvColumns');

    const accountId = env.ACCOUNT_ID;
    const region = event.arguments.region;
    const glueDatabaseName = event.arguments.glueDatabaseName;
    const qsDataSourceName = event.arguments.qsDataSourceName;
    const dataSetId = event.arguments.dataSetId;
    const csvColumns = event.arguments.csvColumns;
    const rlsDataSetArn = event.arguments.rlsDataSetArn;
    const rlsToolManaged = event.arguments.rlsToolManaged || false;

    const qsDataSetName = `Managed-RLS for DataSetId: ${dataSetId}`;
    const quicksightClient = getQuickSightClient(region);

    const newDataSetuuid = uuidv4();

    const dataSetParams = {
      AwsAccountId: accountId,
      DataSetId: `RLS-${newDataSetuuid}`,
      Name: qsDataSetName,
      ImportMode: 'SPICE',
      PhysicalTableMap: {
        [newDataSetuuid]: {
          RelationalTable: {
            DataSourceArn: `arn:aws:quicksight:${region}:${accountId}:datasource/${qsDataSourceName}`,
            Name: `qs-rls-${dataSetId}`,
            Catalog: "AwsDataCatalog",
            Schema: glueDatabaseName,
            InputColumns: csvColumns.map(columnName => ({
              Name: columnName,
              Type: 'STRING'
            }))
          }
        }
      },
      Tags: [{
        Key: "RLS-Manager",
        Value: "True"
      }],
      UseAs: "RLS_RULES"
    };

    let create = true;

    // Check if we should update existing RLS DataSet
    if (rlsToolManaged) {
      if (!rlsDataSetArn || rlsDataSetArn === "") {
        throw new ValidationError("Trying to update the RLS DataSet, but missing 'rlsDataSetArn' argument");
      }

      try {
        logger.info('Checking if RLS DataSet exists', { rlsDataSetArn });
        
        const rlsDataSetIdSplit = rlsDataSetArn.split("/");
        const rlsDataSetIdExtracted = rlsDataSetIdSplit[rlsDataSetIdSplit.length - 1];

        const getRLSDataSetInfoCommand = new DescribeDataSetCommand({
          AwsAccountId: accountId,
          DataSetId: rlsDataSetIdExtracted
        });

        const rlsDataSetInfoResponse = await quicksightClient.send(getRLSDataSetInfoCommand);

        if (rlsDataSetInfoResponse.Status === 200) {
          logger.info('RLS DataSet exists, will update', { rlsDataSetArn });
          create = false;
        } else {
          throw new Error("Failed to check RLS DataSet");
        }
      } catch (e) {
        if (e instanceof Error && e.name === "ResourceNotFoundException") {
          logger.info('RLS DataSet not found, will create new one', { rlsDataSetArn });
          create = true;
        } else {
          throw e;
        }
      }
    }

    // Update existing RLS DataSet
    if (!create) {
      if (!rlsDataSetArn || rlsDataSetArn === "") {
        throw new ValidationError("Missing 'rlsDataSetArn' for update operation");
      }

      logger.info('Updating RLS DataSet', { rlsDataSetArn });

      const rlsDataSetIdSplit = rlsDataSetArn.split("/");
      const rlsDataSetIdExtracted = rlsDataSetIdSplit[rlsDataSetIdSplit.length - 1];

      dataSetParams.DataSetId = rlsDataSetIdExtracted;

      const updateRLSDataSetCommand = new UpdateDataSetCommand(dataSetParams as CreateDataSetCommandInput);
      const updateRLSDataSetResponse = await quicksightClient.send(updateRLSDataSetCommand);

      if (updateRLSDataSetResponse.$metadata.httpStatusCode === 200) {
        if (!updateRLSDataSetResponse.Arn) {
          throw new Error("No ARN returned from update operation");
        }
        logger.info('RLS DataSet updated successfully');
        return {
          statusCode: 200,
          message: "QuickSight RLS DataSet updated successfully.",
          rlsDataSetArn: updateRLSDataSetResponse.Arn
        };
      } else if (updateRLSDataSetResponse.$metadata.httpStatusCode === 201) {
        if (!updateRLSDataSetResponse.IngestionId || !updateRLSDataSetResponse.Arn) {
          throw new Error("Missing IngestionId or ARN from update operation");
        }
        logger.info('RLS DataSet update in progress', { 
          ingestionId: updateRLSDataSetResponse.IngestionId 
        });
        return {
          statusCode: 201,
          message: "QuickSight RLS DataSet updating in progress.",
          rlsDataSetArn: updateRLSDataSetResponse.Arn,
          ingestionId: updateRLSDataSetResponse.IngestionId
        };
      } else {
        throw new Error("Unexpected response from update operation");
      }
    }

    // Create new RLS DataSet
    logger.info('Creating new RLS DataSet');

    const createDataSetCommand = new CreateDataSetCommand(dataSetParams as CreateDataSetCommandInput);
    const createDataSetResponse = await quicksightClient.send(createDataSetCommand);

    if (createDataSetResponse.$metadata.httpStatusCode === 200) {
      if (!createDataSetResponse.DataSetId || !createDataSetResponse.Arn) {
        throw new Error("Missing DataSetId or ARN from create operation");
      }
      logger.info('RLS DataSet created successfully');
      return {
        statusCode: 200,
        message: "QuickSight RLS DataSet created successfully.",
        rlsDataSetArn: createDataSetResponse.Arn
      };
    } else if (createDataSetResponse.$metadata.httpStatusCode === 201) {
      if (!createDataSetResponse.DataSetId || !createDataSetResponse.Arn || !createDataSetResponse.IngestionId) {
        throw new Error("Missing DataSetId, ARN, or IngestionId from create operation");
      }
      logger.info('RLS DataSet creation in progress', { 
        ingestionId: createDataSetResponse.IngestionId 
      });
      return {
        statusCode: 201,
        message: "QuickSight RLS DataSet creation in progress.",
        rlsDataSetArn: createDataSetResponse.Arn,
        ingestionId: createDataSetResponse.IngestionId
      };
    } else {
      throw new Error("Unexpected response from create operation");
    }

  } catch (error) {
    logger.error('Failed to create/update RLS DataSet', error);
    
    let statusCode = 500;
    let errorType = 'UnknownError';

    if (error instanceof Error) {
      errorType = error.name;
      
      switch (error.name) {
        case "InvalidParameterValueException":
          statusCode = 400;
          break;
        case "AccessDeniedException":
          statusCode = 401;
          break;
        case "UnsupportedUserEditionException":
          statusCode = 403;
          break;
        case "ResourceNotFoundException":
          statusCode = 404;
          break;
        case "ConflictException":
        case "LimitExceededException":
        case "ResourceExistsException":
          statusCode = 409;
          break;
        case "ThrottlingException":
          statusCode = 429;
          break;
        case "InternalFailureException":
          statusCode = 500;
          break;
      }
    }

    return {
      statusCode,
      errorType,
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
};
