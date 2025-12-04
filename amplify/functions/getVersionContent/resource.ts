import { defineFunction } from '@aws-amplify/backend';

export const getVersionContent = defineFunction({
  name: 'getVersionContent',
  entry: './handler.ts',
  timeoutSeconds: 30,
  resourceGroupName: 'data'
});
