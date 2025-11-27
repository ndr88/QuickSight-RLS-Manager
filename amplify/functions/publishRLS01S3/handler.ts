import type { Schema } from "../../data/resource"
import { env } from '$amplify/env/publishRLS01S3';
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired, validateArray, ValidationError } from '../_shared/utils/validation';
import { getS3Client } from '../_shared/clients/s3';

const FUNCTION_NAME = 'publishRLS01S3';

/**
 * Publish data to QuickSight with new DataSet Creation
 */
export const handler: Schema["publishRLS01S3"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    // Validate required variables
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');
    validateRequired(event.arguments.s3BucketName, 's3BucketName');
    validateRequired(event.arguments.csvContent, 'csvContent');
    validateRequired(event.arguments.dataSetId, 'dataSetId');
    validateArray(event.arguments.csvHeaders, 'csvHeaders');

    const region = event.arguments.region;
    const s3BucketName = event.arguments.s3BucketName;
    const csvHeaders = event.arguments.csvHeaders;
    const csvContent = event.arguments.csvContent;
    const dataSetId = event.arguments.dataSetId;

    const csvFileName = `QS_RLS_Managed_${dataSetId}.csv`;
    const s3Key = `RLS-Datasets/${dataSetId}/${csvFileName}`;

    // Get valid columns
    const validColumns = csvHeaders.filter((columnName): columnName is string => 
      columnName !== null && 
      columnName !== undefined && 
      columnName.trim() !== ''
    );

    const uniqueColumns = [...new Set(validColumns)];

    if (uniqueColumns.length === 0) {
      throw new ValidationError('No valid CSV Headers found');
    }

    logger.info('Uploading CSV file to S3', { 
      bucket: s3BucketName, 
      key: s3Key,
      columns: uniqueColumns.length 
    });

    const s3Client = getS3Client(region);
    
    const putCommand = new PutObjectCommand({
      Bucket: s3BucketName,
      Key: s3Key,
      Body: csvContent,
      ContentType: 'text/csv'
    });

    const putResponse = await s3Client.send(putCommand);

    if (putResponse.$metadata.httpStatusCode !== 200) {
      throw new Error('Failed to upload CSV file to S3');
    }

    logger.info('CSV file uploaded successfully', { key: `${s3BucketName}/${s3Key}` });

    return {
      statusCode: 200,
      message: 'CSV file uploaded successfully.',
      csvColumns: uniqueColumns
    };

  } catch (error) {
    logger.error('Failed to upload CSV file to S3', error);
    return {
      statusCode: 500,
      message: 'Failed to upload CSV file to S3',
      csvColumns: [],
      errorType: error instanceof Error ? error.name : 'UnknownError'
    };
  }
}