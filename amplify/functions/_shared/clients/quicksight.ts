/**
 * QuickSight client factory
 */

import { QuickSightClient } from "@aws-sdk/client-quicksight";

const clients = new Map<string, QuickSightClient>();

export function getQuickSightClient(region: string): QuickSightClient {
  if (!clients.has(region)) {
    clients.set(region, new QuickSightClient({ region }));
  }
  return clients.get(region)!;
}
