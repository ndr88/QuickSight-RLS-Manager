import { defineFunction } from '@aws-amplify/backend';

export const fetchRLSDataSetPermissions = defineFunction({
  name: 'fetchRLSDataSetPermissions',
  timeoutSeconds: 60,
});
