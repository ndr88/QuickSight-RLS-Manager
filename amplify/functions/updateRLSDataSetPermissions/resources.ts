import { defineFunction } from '@aws-amplify/backend';

export const updateRLSDataSetPermissions = defineFunction({
  name: 'updateRLSDataSetPermissions',
  timeoutSeconds: 120,
});
