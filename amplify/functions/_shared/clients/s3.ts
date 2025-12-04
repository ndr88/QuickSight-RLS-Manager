/**
 * S3 client factory
 */

import { S3Client } from "@aws-sdk/client-s3";

const clients = new Map<string, S3Client>();

export function getS3Client(region: string): S3Client {
  if (!clients.has(region)) {
    clients.set(region, new S3Client({ region }));
  }
  return clients.get(region)!;
}
