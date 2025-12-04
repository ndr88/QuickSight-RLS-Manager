import { defineFunction } from '@aws-amplify/backend';

export const rollbackToVersion = defineFunction({
  name: 'rollbackToVersion',
  entry: './handler.ts',
  timeoutSeconds: 60,
  resourceGroupName: 'data'
});
