import type { Schema } from "../../data/resource";
import { env } from '$amplify/env/updateRLSDataSetPermissions';
import { 
  DescribeDataSetPermissionsCommand, 
  UpdateDataSetPermissionsCommand 
} from "@aws-sdk/client-quicksight";

import { initializeAmplify } from '../_shared/utils/amplify-config';
import { createLogger } from '../_shared/utils/logger';
import { validateRequired } from '../_shared/utils/validation';
import { getQuickSightClient } from '../_shared/clients/quicksight';

const FUNCTION_NAME = 'updateRLSDataSetPermissions';

// Fixed permission sets for Owner and Viewer
const OWNER_ACTIONS = [
  "quicksight:DeleteDataSet",
  "quicksight:UpdateDataSetPermissions",
  "quicksight:PutDataSetRefreshProperties",
  "quicksight:CreateRefreshSchedule",
  "quicksight:CancelIngestion",
  "quicksight:PassDataSet",
  "quicksight:ListRefreshSchedules",
  "quicksight:UpdateRefreshSchedule",
  "quicksight:DeleteRefreshSchedule",
  "quicksight:DescribeDataSetRefreshProperties",
  "quicksight:DescribeDataSet",
  "quicksight:CreateIngestion",
  "quicksight:DescribeRefreshSchedule",
  "quicksight:ListIngestions",
  "quicksight:DescribeDataSetPermissions",
  "quicksight:UpdateDataSet",
  "quicksight:DeleteDataSetRefreshProperties",
  "quicksight:DescribeIngestion"
];

const VIEWER_ACTIONS = [
  "quicksight:DescribeRefreshSchedule",
  "quicksight:ListIngestions",
  "quicksight:DescribeDataSetPermissions",
  "quicksight:PassDataSet",
  "quicksight:ListRefreshSchedules",
  "quicksight:DescribeDataSet",
  "quicksight:DescribeIngestion"
];

export const handler: Schema["updateRLSDataSetPermissions"]["functionHandler"] = async (event) => {
  const logger = createLogger(FUNCTION_NAME);
  
  try {
    await initializeAmplify(env);
    
    validateRequired(env.ACCOUNT_ID, 'ACCOUNT_ID');
    validateRequired(event.arguments.region, 'region');
    validateRequired(event.arguments.rlsDataSetId, 'rlsDataSetId');
    validateRequired(event.arguments.permissions, 'permissions');

    const accountId = env.ACCOUNT_ID;
    const region = event.arguments.region;
    const rlsDataSetId = event.arguments.rlsDataSetId;
    const permissionsJson = event.arguments.permissions;

    logger.info('Updating RLS DataSet permissions', { rlsDataSetId });

    // Parse permissions
    const permissions = JSON.parse(permissionsJson);

    const quicksightClient = getQuickSightClient(region);

    // Get current permissions
    const describeCommand = new DescribeDataSetPermissionsCommand({
      AwsAccountId: accountId,
      DataSetId: rlsDataSetId
    });

    const currentPermissions = await quicksightClient.send(describeCommand);
    
    logger.info('Current permissions retrieved', { 
      count: currentPermissions.Permissions?.length || 0 
    });

    // Build grants list
    const grants = permissions.map((perm: any) => ({
      Principal: perm.userGroupArn,
      Actions: perm.permissionLevel === 'OWNER' ? OWNER_ACTIONS : VIEWER_ACTIONS
    }));

    // Build revokes list (principals that should be removed)
    const desiredPrincipals = new Set(permissions.map((p: any) => p.userGroupArn));
    const revokes = (currentPermissions.Permissions || [])
      .filter(p => p.Principal && !desiredPrincipals.has(p.Principal))
      .map(p => ({
        Principal: p.Principal!,
        Actions: p.Actions || []
      }));

    logger.info('Permissions to update', { 
      grants: grants.length, 
      revokes: revokes.length 
    });

    // Update permissions
    const updateCommand = new UpdateDataSetPermissionsCommand({
      AwsAccountId: accountId,
      DataSetId: rlsDataSetId,
      ...(grants.length > 0 && { GrantPermissions: grants }),
      ...(revokes.length > 0 && { RevokePermissions: revokes })
    });

    const updateResponse = await quicksightClient.send(updateCommand);

    if (updateResponse.$metadata.httpStatusCode === 200) {
      logger.info('Permissions updated successfully');
      return {
        statusCode: 200,
        message: "RLS DataSet permissions updated successfully."
      };
    }

    throw new Error("Unexpected response from UpdateDataSetPermissions");

  } catch (error) {
    logger.error('Failed to update RLS DataSet permissions', error);
    return {
      statusCode: 500,
      message: 'Failed to update RLS DataSet permissions',
      errorType: error instanceof Error ? error.name : 'UnknownError'
    };
  }
};
