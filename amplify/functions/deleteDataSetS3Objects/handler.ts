import type { Schema } from "../../data/resource"
import { env } from '$amplify/env/deleteDataSetS3Objects';
import { DeleteObjectCommand, ListObjectsCommand } from "@aws-sdk/client-s3";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getS3Client } from '../_shared/clients/s3';

const FUNCTION_NAME = 'deleteDataSetS3Objects';

export const handler: Schema["deleteDataSetS3Objects"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');
    validateRequired(event.arguments.s3Key, 's3Key');
    validateRequired(event.arguments.s3BucketName, 's3BucketName');

    const region = event.arguments.region;
    const s3BucketName = event.arguments.s3BucketName;
    const s3Key = event.arguments.s3Key;
    const s3Path = `RLS-Datasets/${s3Key}`;

    logger.info('Deleting S3 objects', { bucket: s3BucketName, path: s3Path });

    const s3Client = getS3Client(region);

    const listParams = {
      Bucket: s3BucketName,
      Prefix: s3Path
    };
    
    const listedObjects = await s3Client.send(new ListObjectsCommand(listParams));
    
    if (listedObjects.Contents?.length === 0 && listedObjects.CommonPrefixes?.length === 0) {
      logger.info('S3 folder not found or already empty');
      return {
        statusCode: 404,
        message: `S3 folder '${s3Path}' not found.`,
      };
    }

    if (listedObjects.Contents) {
      const deletePromises = listedObjects.Contents.map(async (object) => {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: s3BucketName,
          Key: object.Key
        }));
      });
      await Promise.all(deletePromises);
      logger.debug('Deleted objects', { count: listedObjects.Contents.length });
    }

    if (listedObjects.CommonPrefixes) {
      const deletePromises = listedObjects.CommonPrefixes.map(async (prefix) => {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: s3BucketName,
          Key: prefix.Prefix
        }));
      });
      await Promise.all(deletePromises);
    }

    logger.info('S3 folder deleted successfully', { path: s3Path });

    return {
      statusCode: 200,
      message: `S3 folder '${s3Path}' deleted successfully.`,
    };

  } catch (error) {
    logger.error('Failed to delete S3 objects', error);
    return {
      statusCode: 500,
      message: 'Failed to delete S3 objects',
      errorType: error instanceof Error ? error.name : 'UnknownError'
    };
  }
}