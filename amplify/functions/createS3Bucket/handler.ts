import type { Schema } from "../../data/resource"
import { env } from '$amplify/env/createS3Bucket';
import { v4 as uuidv4 } from 'uuid';
import { CreateBucketCommand, BucketLocationConstraint, PutBucketVersioningCommand } from "@aws-sdk/client-s3";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getS3Client } from '../_shared/clients/s3';

const FUNCTION_NAME = 'createS3Bucket';

export const handler: Schema["createS3Bucket"]["functionHandler"] = async ( event ) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');

    const region = event.arguments.region;
    const uuid = uuidv4();
    const bucketName = env.RESOURCE_PREFIX + uuid;

    logger.info('Creating S3 bucket', { region, bucketName });

    // us-east-1 doesn't require LocationConstraint
    const createBucketCommand = region === "us-east-1"
      ? new CreateBucketCommand({ Bucket: bucketName })
      : new CreateBucketCommand({
          Bucket: bucketName,
          CreateBucketConfiguration: {
            LocationConstraint: region as BucketLocationConstraint
          }
        });

    const s3Client = getS3Client(region);
    const response = await s3Client.send(createBucketCommand);

    if (response.$metadata.httpStatusCode === 200) {
      logger.info('S3 bucket created successfully', { bucketName });
      
      // Enable versioning on the bucket
      logger.info('Enabling versioning on S3 bucket', { bucketName });
      const versioningCommand = new PutBucketVersioningCommand({
        Bucket: bucketName,
        VersioningConfiguration: {
          Status: 'Enabled'
        }
      });
      
      await s3Client.send(versioningCommand);
      logger.info('Versioning enabled successfully', { bucketName });
      
      return {
        statusCode: 200,
        message: `Bucket ${bucketName} created in Region ${region} with versioning enabled.`,
        s3BucketName: bucketName
      };
    } else {
      throw new Error('Failed to create S3 bucket');
    }

  } catch (error) {
    logger.error('Failed to create S3 bucket', error);
    return {
      statusCode: 500,
      message: 'Failed to create S3 bucket',
      s3BucketName: '',
      errorName: error instanceof Error ? error.name : 'UnknownError'
    };
  }
}