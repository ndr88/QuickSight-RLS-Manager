/**
 * Amplify configuration utility
 * Initializes Amplify and returns configured client
 * 
 * NOTE: This does NOT import Schema to avoid circular dependencies
 * Each Lambda should initialize Amplify and create its own client if needed
 */

import { Amplify } from 'aws-amplify';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';

let isConfigured = false;

export async function initializeAmplify(env: any) {
  if (!isConfigured) {
    const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
    Amplify.configure(resourceConfig, libraryOptions);
    isConfigured = true;
  }
  
  // Return void - each Lambda creates its own client to avoid circular deps
  return;
}
