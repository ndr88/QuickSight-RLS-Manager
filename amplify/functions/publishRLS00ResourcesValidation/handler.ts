import type { Schema } from "../../data/resource"
import { env } from '$amplify/env/publishRLS00ResourcesValidation';
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { GetDatabaseCommand } from "@aws-sdk/client-glue";
import { DescribeDataSourceCommand } from "@aws-sdk/client-quicksight";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getS3Client } from '../_shared/clients/s3';
import { getGlueClient } from '../_shared/clients/glue';
import { getQuickSightClient } from '../_shared/clients/quicksight';

const FUNCTION_NAME = 'publishRLS00ResourcesValidation';

export const handler: Schema["publishRLS00ResourcesValidation"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');
    validateRequired(event.arguments.s3BucketName, 's3BucketName');
    validateRequired(event.arguments.glueDatabaseName, 'glueDatabaseName');
    validateRequired(event.arguments.qsDataSourceName, 'qsDataSourceName');

    const accountId = env.ACCOUNT_ID;
    const region = event.arguments.region;
    const s3BucketName = event.arguments.s3BucketName;
    const glueDatabaseName = event.arguments.glueDatabaseName;
    const qsDataSourceName = event.arguments.qsDataSourceName;

    logger.info('Validating RLS Tool Resources', { region, s3BucketName, glueDatabaseName, qsDataSourceName });

    // Validate S3 Bucket
    logger.debug('Checking S3 Bucket', { bucket: s3BucketName });
    const s3Client = getS3Client(region);
    const headCommand = new HeadBucketCommand({ Bucket: s3BucketName });
    const headResponse = await s3Client.send(headCommand);

    if (headResponse.$metadata.httpStatusCode !== 200) {
      throw new Error(`S3 Bucket ${s3BucketName} validation failed`);
    }
    logger.info('S3 Bucket validated', { bucket: s3BucketName });

    // Validate Glue Database
    logger.debug('Checking Glue Database', { database: glueDatabaseName });
    const glueClient = getGlueClient(region);
    const glueGetDbCommand = new GetDatabaseCommand({ Name: glueDatabaseName });
    const getDatabaseResponse = await glueClient.send(glueGetDbCommand);

    if (getDatabaseResponse.$metadata.httpStatusCode !== 200) {
      throw new Error(`Glue Database ${glueDatabaseName} validation failed`);
    }
    logger.info('Glue Database validated', { database: glueDatabaseName });

    // Validate QuickSight DataSource
    logger.debug('Checking QuickSight DataSource', { dataSource: qsDataSourceName });
    const quicksightClient = getQuickSightClient(region);
    const describeDataSourceCommand = new DescribeDataSourceCommand({
      AwsAccountId: accountId,
      DataSourceId: qsDataSourceName
    });
    const describeDataSourceResponse = await quicksightClient.send(describeDataSourceCommand);

    if (describeDataSourceResponse.$metadata.httpStatusCode !== 200) {
      throw new Error(`QuickSight DataSource ${qsDataSourceName} validation failed`);
    }
    logger.info('QuickSight DataSource validated', { dataSource: qsDataSourceName });

    logger.info('All RLS Tool Resources validated successfully');

    return {
      statusCode: 200,
      message: "RLS Tool Resources correctly validated.",
    };

  } catch (error) {
    logger.error('Resource validation failed', error);
    return {
      statusCode: 500,
      message: 'Failed to validate RLS Tool Resources',
      errorType: error instanceof Error ? error.name : 'UnknownError'
    };
  }
};
