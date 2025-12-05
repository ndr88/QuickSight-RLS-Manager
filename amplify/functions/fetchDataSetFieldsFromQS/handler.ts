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
      
      // Build field types object map: { fieldName: fieldType }
      const fieldTypesMap: Record<string, string> = {};
      response.DataSet.OutputColumns.forEach((column: any) => {
        if (column.Name) {
          fieldTypesMap[column.Name] = column.Type || 'STRING';
        }
      });
      
      // Check if this is a direct file upload (not API manageable)
      // Direct uploads do NOT have a DataSourceArn in PhysicalTableMap
      // DataSource-based datasets have DataSourceArn in one of four possible locations:
      // 1. RelationalTable (Athena, Redshift, RDS, etc.)
      // 2. S3Source (S3 Manifest files)
      // 3. CustomSql (Custom SQL queries)
      // 4. SaaSTable (SaaS connectors)
      let isApiManageable = false; // Default to false
      let foundDataSourceArn: string | undefined;
      let foundSourceType: string | undefined;
      const dataSet = response.DataSet;
      
      if (dataSet && dataSet.PhysicalTableMap) {
        const physicalTableKeys = Object.keys(dataSet.PhysicalTableMap);
        
        logger.debug('Checking PhysicalTableMap for DataSourceArn', {
          dataSetId,
          physicalTableKeys,
          physicalTableMapStructure: JSON.stringify(dataSet.PhysicalTableMap)
        });
        
        // Check if any physical table has a DataSourceArn in any of the four possible locations
        for (const key of physicalTableKeys) {
          const table = dataSet.PhysicalTableMap[key];
          
          if (!table) continue;
          
          // Check 1: RelationalTable (Athena, Redshift, RDS, etc.)
          if (table.RelationalTable?.DataSourceArn) {
            isApiManageable = true;
            foundDataSourceArn = table.RelationalTable.DataSourceArn;
            foundSourceType = 'RelationalTable';
            logger.info('DataSourceArn found in RelationalTable - dataset is API manageable', {
              dataSetId,
              dataSourceArn: foundDataSourceArn,
              sourceType: foundSourceType
            });
            break;
          }
          
          // Check 2: S3Source (S3 Manifest files)
          if (table.S3Source?.DataSourceArn) {
            isApiManageable = true;
            foundDataSourceArn = table.S3Source.DataSourceArn;
            foundSourceType = 'S3Source';
            logger.info('DataSourceArn found in S3Source - dataset is API manageable', {
              dataSetId,
              dataSourceArn: foundDataSourceArn,
              sourceType: foundSourceType
            });
            break;
          }
          
          // Check 3: CustomSql (Custom SQL queries)
          if (table.CustomSql?.DataSourceArn) {
            isApiManageable = true;
            foundDataSourceArn = table.CustomSql.DataSourceArn;
            foundSourceType = 'CustomSql';
            logger.info('DataSourceArn found in CustomSql - dataset is API manageable', {
              dataSetId,
              dataSourceArn: foundDataSourceArn,
              sourceType: foundSourceType
            });
            break;
          }
          
          // Check 4: SaaSTable (SaaS connectors)
          if (table.SaaSTable?.DataSourceArn) {
            isApiManageable = true;
            foundDataSourceArn = table.SaaSTable.DataSourceArn;
            foundSourceType = 'SaaSTable';
            logger.info('DataSourceArn found in SaaSTable - dataset is API manageable', {
              dataSetId,
              dataSourceArn: foundDataSourceArn,
              sourceType: foundSourceType
            });
            break;
          }
          
          logger.debug('No DataSourceArn found in physical table', {
            key,
            hasRelationalTable: !!table.RelationalTable,
            hasS3Source: !!table.S3Source,
            hasCustomSql: !!table.CustomSql,
            hasSaaSTable: !!table.SaaSTable
          });
        }
        
        if (!isApiManageable) {
          // No DataSourceArn found in any location = direct file upload
          logger.warn('Dataset has no DataSourceArn - direct file upload detected', {
            dataSetId,
            limitation: 'API updates not supported for direct file uploads'
          });
        }
      } else {
        logger.warn('No PhysicalTableMap found', { dataSetId });
      }
      
      logger.info('Dataset Fields fetched successfully', { 
        fieldsCount: outputFields.length,
        newDataPrep: hasNewDataPrep,
        fieldTypes: Object.keys(fieldTypesMap).length,
        apiManageable: isApiManageable
      });
      
      return {
        statusCode: 200,
        message: 'QuickSight Dataset Fields fetched successfully',
        datasetsFields: JSON.stringify(outputFields),
        fieldTypes: JSON.stringify(fieldTypesMap),
        spiceCapacityInBytes: response.DataSet.ConsumedSpiceCapacityInBytes || 0,
        newDataPrep: hasNewDataPrep,
        apiManageable: isApiManageable
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
        fieldTypes: undefined,
        spiceCapacityInBytes: 0
      };
    }
    
    return {
      statusCode: 500,
      message: 'Error fetching QuickSight Dataset Fields',
      datasetsFields: "",
      fieldTypes: undefined,
      spiceCapacityInBytes: 0,
      errorName: error instanceof Error ? error.name : 'GenericError'
    };
  }
};
