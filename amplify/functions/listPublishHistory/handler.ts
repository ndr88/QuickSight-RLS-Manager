import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/listPublishHistory';
import { ListObjectVersionsCommand } from "@aws-sdk/client-s3";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getS3Client } from '../_shared/clients/s3';

const FUNCTION_NAME = 'listPublishHistory';

export const handler: Schema["listPublishHistory"]["functionHandler"] = async (event) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(event.arguments.region, 'region');
    validateRequired(event.arguments.dataSetId, 'dataSetId');
    validateRequired(event.arguments.s3BucketName, 's3BucketName');

    const region = event.arguments.region;
    const dataSetId = event.arguments.dataSetId;
    const s3BucketName = event.arguments.s3BucketName;
    
    const csvFileName = `QS_RLS_Managed_${dataSetId}.csv`;
    const s3Key = `RLS-Datasets/${dataSetId}/${csvFileName}`;

    logger.info('Listing S3 versions', { bucket: s3BucketName, key: s3Key });

    const s3Client = getS3Client(region);
    
    const listCommand = new ListObjectVersionsCommand({
      Bucket: s3BucketName,
      Prefix: s3Key
    });

    const response = await s3Client.send(listCommand);

    if (!response.Versions || response.Versions.length === 0) {
      return {
        statusCode: 200,
        message: 'No versions found',
        versions: JSON.stringify([])
      };
    }

    // Format versions for response
    const versions = response.Versions
      .filter(v => v.Key === s3Key) // Only exact matches
      .map(v => ({
        versionId: v.VersionId,
        lastModified: v.LastModified?.toISOString(),
        size: v.Size,
        isLatest: v.IsLatest
      }))
      .sort((a, b) => {
        // Sort by date descending (newest first)
        if (!a.lastModified || !b.lastModified) return 0;
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
      });

    logger.info('Versions retrieved', { count: versions.length });

    return {
      statusCode: 200,
      message: `Found ${versions.length} version(s)`,
      versions: JSON.stringify(versions)
    };

  } catch (error) {
    logger.error('Failed to list versions', error);
    return {
      statusCode: 500,
      message: 'Failed to list versions',
      versions: JSON.stringify([]),
      errorType: error instanceof Error ? error.name : 'UnknownError'
    };
  }
};
