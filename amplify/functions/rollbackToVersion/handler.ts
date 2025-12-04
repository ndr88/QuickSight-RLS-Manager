import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/rollbackToVersion';
import { GetObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getS3Client } from '../_shared/clients/s3';

const FUNCTION_NAME = 'rollbackToVersion';

/**
 * Rollback to a specific S3 version by copying it as the latest version
 */
export const handler: Schema["rollbackToVersion"]["functionHandler"] = async (event) => {
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

    logger.info('Rolling back to version', { 
      bucket: s3BucketName, 
      key: s3Key,
      versionId 
    });

    const s3Client = getS3Client(region);
    
    // First, verify the version exists by trying to get it
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
    
    logger.info('Retrieved version content', { 
      size: csvContent.length,
      versionId 
    });

    // Copy the old version as the new latest version
    // This creates a new version that is identical to the old one
    const copyCommand = new CopyObjectCommand({
      Bucket: s3BucketName,
      CopySource: `${s3BucketName}/${s3Key}?versionId=${versionId}`,
      Key: s3Key,
      ContentType: 'text/csv'
    });

    const copyResponse = await s3Client.send(copyCommand);

    if (copyResponse.$metadata.httpStatusCode !== 200) {
      throw new Error('Failed to copy version');
    }

    const newVersionId = copyResponse.VersionId;
    
    logger.info('Rollback successful', { 
      oldVersionId: versionId,
      newVersionId 
    });

    return {
      statusCode: 200,
      message: 'Successfully rolled back to previous version',
      newVersionId: newVersionId,
      csvContent: csvContent
    };

  } catch (error) {
    logger.error('Failed to rollback version', error);
    return {
      statusCode: 500,
      message: 'Failed to rollback version',
      newVersionId: undefined,
      csvContent: undefined,
      errorType: error instanceof Error ? error.name : 'UnknownError'
    };
  }
};
