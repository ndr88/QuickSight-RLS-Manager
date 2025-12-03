import { defineFunction } from '@aws-amplify/backend';

export const listPublishHistory = defineFunction({
  name: 'listPublishHistory',
  entry: './handler.ts',
  timeoutSeconds: 30,
  resourceGroupName: 'data'
});
