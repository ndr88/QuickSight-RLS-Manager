import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";

const client = generateClient<Schema>();


export const generateCSVOutput = async (dataSetArn: string) => {
  // console.log("generateCSVOutput" + dataSetArn);
  try{
    const permissions_list = await client.models.Permission.list({
      filter: {
        dataSetArn: {
          eq: dataSetArn
        }
      }
    });

    
    // Sort the permissions by userGroupArn
    const permissions = permissions_list.data.sort((a, b) => {
      // Handle cases where userGroupArn might be undefined
      const groupA = a.userGroupArn || '';
      const groupB = b.userGroupArn || '';
      return groupA.localeCompare(groupB);
    });

    if (!permissions || permissions.length === 0){
      console.log("No Permissions Found")
      return '';
    }
    
    // First, collect all unique fields
    const uniqueFields = new Set<string>();
    permissions.forEach(permission => {
      if (permission.field && permission.field != "*") {
        uniqueFields.add(permission.field);
      }
    });
    
    // If no specific fields are defined (all permissions are "view all"), 
    // fetch dataset fields and include all of them
    if (uniqueFields.size === 0) {
      console.log("No specific fields found, fetching dataset fields for 'view all' permissions");
      
      // Fetch the dataset to get its fields
      const { data: dataset } = await client.models.DataSet.get({ dataSetArn });
      
      if (dataset && dataset.fieldTypes) {
        // Get field names from fieldTypes object map
        const fieldNames = Object.keys(JSON.parse(dataset.fieldTypes));
        fieldNames.forEach(field => {
          if (field) {
            uniqueFields.add(field);
          }
        });
        console.log(`Added ${uniqueFields.size} dataset fields for 'view all' permissions`);
      } else {
        console.warn("Dataset has no fieldTypes defined, CSV will only have UserARN and GroupARN");
      }
    }
    
    // Create header row
    const headerRow = ['UserARN', 'GroupARN', ...Array.from(uniqueFields)].join(',');

    // Group permissions by userGroupArn
    const groupedByDataSetArn = permissions.reduce((acc, permission) => {
      if (!acc[permission.userGroupArn]) {
        acc[permission.userGroupArn] = [];
      }
      acc[permission.userGroupArn].push(permission);
      return acc;
    }, {} as Record<string, typeof permissions>);
    
    // Generate rows
    const rows = Object.values(groupedByDataSetArn).map(permissionGroup => {
      // check if permissionGroup is an array
      if (!Array.isArray(permissionGroup)) {
        console.log("permissionGroup is not an array")
        return '';
      }

      const firstPermission = permissionGroup[0];
      const userGroupArn = firstPermission.userGroupArn || '';
        
      // Determine if it's a user or group ARN
      const isUser = userGroupArn.includes(':user/');
      const isGroup = userGroupArn.includes(':group/');
        
      const userArn = isUser ? userGroupArn : '';
      const groupArn = isGroup ? userGroupArn : '';
    
      // Create a map of field to RLS value
      const fieldValueMap = permissionGroup.reduce((map, permission) => {
        if (permission.field) {
          map[permission.field] = permission.rlsValues || '';
        }
        return map;
        
      }, {} as Record<string, string>);
    
      // Check if this user/group has "view all" permission
      const hasViewAll = permissionGroup.some(p => p.field === "*" && p.rlsValues === "*");
    
      // Create row with all fields
      const fieldValues = Array.from(uniqueFields).map(field => {
        // If user has "view all" permission, leave all fields empty (grants access to all values)
        if (hasViewAll) {
          return '';
        }
        
        const value = fieldValueMap[field] || '';
        if(value==="*"){
          return ""
        }
        return value.includes(',') ? `"${value}"` : value;
      });
  
      return [userArn, groupArn, ...fieldValues].join(',');
    });
    
    // Combine header and rows
    return [headerRow, ...rows].join('\n');
  }catch(error){
    console.log("Error generating CSV Output")
    console.log(error)
    return '';
  }
}
