import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/getVersionContent';
import { GetObjectCommand } from "@aws-sdk/client-s3";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getS3Client } from '../_shared/clients/s3';

const FUNCTION_NAME = 'getVersionContent';

/**
 * Get content of a specific S3 version WITHOUT creating a new version
 * This is READ-ONLY - does not modify S3
 */
export const handler: Schema["getVersionContent"]["functionHandler"] = async (event) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(event.arguments.region, 'region');
    validateRequired(event.arguments.dataSetId, 'dataSetId');
    validateRequired(event.arguments.s3BucketName, 's3BucketName');
    validateRequired(event.arguments.versionId, 'versionId');

    const region = event.arguments.region;
    const dataSetId = event.arguments.dataSetId;
    const s3BucketName = event.arguments.s3BucketName;
    const versionId = event.arguments.versionId;
    
    const csvFileName = `QS_RLS_Managed_${dataSetId}.csv`;
    const s3Key = `RLS-Datasets/${dataSetId}/${csvFileName}`;

    logger.info('Getting version content (READ-ONLY)', { 
      bucket: s3BucketName, 
      key: s3Key,
      versionId 
    });

    const s3Client = getS3Client(region);
    
    // Get the specific version - READ ONLY, does not create new version
    const getCommand = new GetObjectCommand({
      Bucket: s3BucketName,
      Key: s3Key,
      VersionId: versionId
    });

    const getResponse = await s3Client.send(getCommand);
    
    if (!getResponse.Body) {
      throw new Error('Version not found or empty');
    }

    // Read the CSV content
    const csvContent = await getResponse.Body.transformToString();
    
    logger.info('Version content retrieved successfully', { 
      size: csvContent.length,
      versionId 
    });

    return {
      statusCode: 200,
      message: 'Version content retrieved successfully',
      csvContent: csvContent
    };

  } catch (error) {
    logger.error('Failed to get version content', error);
    return {
      statusCode: 500,
      message: 'Failed to get version content',
      csvContent: undefined,
      errorType: error instanceof Error ? error.name : 'UnknownError'
    };
  }
};
