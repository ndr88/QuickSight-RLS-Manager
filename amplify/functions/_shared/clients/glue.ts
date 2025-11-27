/**
 * Glue client factory
 */

import { GlueClient } from "@aws-sdk/client-glue";

const clients = new Map<string, GlueClient>();

export function getGlueClient(region: string): GlueClient {
  if (!clients.has(region)) {
    clients.set(region, new GlueClient({ region }));
  }
  return clients.get(region)!;
}
