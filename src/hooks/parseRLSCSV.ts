/**
 * Parse RLS CSV file in any of the 3 QuickSight formats:
 * 1. GroupName,field_1,...,field_n
 * 2. UserName,field_1,...,field_n
 * 3. UserARN,GroupARN,field_1,...,field_n
 */

interface ParsedPermission {
  userGroupArn: string;
  userGroupName: string;
  userGroupType: 'USER' | 'GROUP';
  field: string;
  rlsValues: string;
  isResolved: boolean; // Whether name was successfully matched to ARN
}

interface ParseResult {
  permissions: ParsedPermission[];
  format: 'FORMAT_1' | 'FORMAT_2' | 'FORMAT_3' | 'UNKNOWN';
  errors: string[];
  warnings: string[];
}

export const parseRLSCSV = (
  csvContent: string,
  users: any[],
  groups: any[],
  fieldTypesJson?: string | null
): ParseResult => {
  const result: ParseResult = {
    permissions: [],
    format: 'UNKNOWN',
    errors: [],
    warnings: []
  };

  try {
    // Split into lines and remove empty lines
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      result.errors.push('CSV must have at least a header row and one data row');
      return result;
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim());
    
    // Detect format
    const firstCol = header[0].toLowerCase();
    const secondCol = header[1]?.toLowerCase();
    
    if (firstCol === 'userarn' && secondCol === 'grouparn') {
      result.format = 'FORMAT_3';
    } else if (firstCol === 'groupname' || firstCol === 'group') {
      result.format = 'FORMAT_1';
    } else if (firstCol === 'username' || firstCol === 'user') {
      result.format = 'FORMAT_2';
    } else {
      result.errors.push(`Unrecognized CSV format. First column should be 'UserARN', 'GroupARN', 'GroupName', or 'UserName'. Found: '${header[0]}'`);
      return result;
    }

    // Get field columns (skip first 1 or 2 columns depending on format)
    const fieldStartIndex = result.format === 'FORMAT_3' ? 2 : 1;
    const fields = header.slice(fieldStartIndex);

    if (fields.length === 0) {
      result.errors.push('CSV must have at least one field column');
      return result;
    }

    // Validate fields against date types if fieldTypes provided
    if (fieldTypesJson) {
      try {
        const fieldTypesMap = JSON.parse(fieldTypesJson);
        const dateFields: string[] = [];
        
        fields.forEach(field => {
          const fieldType = fieldTypesMap[field];
          if (fieldType) {
            const dateTypes = ['DATETIME', 'DATE', 'TIMESTAMP'];
            if (dateTypes.includes(fieldType.toUpperCase())) {
              dateFields.push(`${field} (${fieldType})`);
            }
          }
        });
        
        if (dateFields.length > 0) {
          result.warnings.push(
            `Date fields detected in CSV: ${dateFields.join(', ')}. ` +
            `QuickSight RLS does not support date fields. These permissions may not work correctly.`
          );
        }
      } catch (e) {
        console.warn('Failed to parse fieldTypes for validation:', e);
      }
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle quoted values
      const values = parseCSVLine(line);
      
      if (values.length < header.length) {
        result.warnings.push(`Row ${i + 1}: Not enough columns (expected ${header.length}, got ${values.length})`);
        continue;
      }

      // Process based on format
      if (result.format === 'FORMAT_3') {
        // Format 3: UserARN,GroupARN,field_1,...,field_n
        const userArn = values[0].trim();
        const groupArn = values[1].trim();
        
        if (!userArn && !groupArn) {
          result.warnings.push(`Row ${i + 1}: Both UserARN and GroupARN are empty`);
          continue;
        }

        const userGroupArn = userArn || groupArn;
        const isUser = !!userArn;
        
        // Extract name from ARN
        const arnParts = userGroupArn.split('/');
        const name = arnParts.slice(2).join('/');

        // Create permissions for each field
        for (let j = 0; j < fields.length; j++) {
          const fieldValue = values[fieldStartIndex + j]?.trim() || '';
          
          result.permissions.push({
            userGroupArn: userGroupArn,
            userGroupName: name,
            userGroupType: isUser ? 'USER' : 'GROUP',
            field: fields[j],
            rlsValues: fieldValue || '*',
            isResolved: true
          });
        }
      } else {
        // Format 1 or 2: Name-based
        const name = values[0].trim();
        const isGroup = result.format === 'FORMAT_1';
        
        if (!name) {
          result.warnings.push(`Row ${i + 1}: Name is empty`);
          continue;
        }

        // Find ARN from name
        const sourceList = isGroup ? groups : users;
        const match = sourceList.find(item => 
          item.name === name || 
          item.name.toLowerCase() === name.toLowerCase()
        );

        if (!match) {
          result.warnings.push(`Row ${i + 1}: Could not find ${isGroup ? 'group' : 'user'} '${name}' in QuickSight`);
        }

        const userGroupArn = match?.userGroupArn || '';

        // Create permissions for each field
        for (let j = 0; j < fields.length; j++) {
          const fieldValue = values[fieldStartIndex + j]?.trim() || '';
          
          result.permissions.push({
            userGroupArn: userGroupArn,
            userGroupName: name,
            userGroupType: isGroup ? 'GROUP' : 'USER',
            field: fields[j],
            rlsValues: fieldValue || '*',
            isResolved: !!match
          });
        }
      }
    }

    if (result.permissions.length === 0) {
      result.errors.push('No valid permissions found in CSV');
    }

    // Consolidate permissions: if a user/group has wildcard (*) for ALL fields, 
    // replace with a single permission with field='*' and rlsValues='*'
    result.permissions = consolidateWildcardPermissions(result.permissions, fields);

  } catch (error) {
    result.errors.push(`Failed to parse CSV: ${error}`);
  }

  return result;
};

/**
 * Consolidate permissions: if a user/group has wildcard values for ALL fields,
 * replace with a single permission with field='*' and rlsValues='*'
 */
const consolidateWildcardPermissions = (
  permissions: ParsedPermission[],
  allFields: string[]
): ParsedPermission[] => {
  // Group permissions by user/group ARN
  const grouped = new Map<string, ParsedPermission[]>();
  
  for (const perm of permissions) {
    const key = perm.userGroupArn;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(perm);
  }

  const consolidated: ParsedPermission[] = [];

  // Check each user/group
  for (const [, perms] of grouped.entries()) {
    // Check if this user/group has permissions for all fields
    const hasAllFields = perms.length === allFields.length;
    
    // Check if all permissions have wildcard values
    const allWildcard = perms.every(p => !p.rlsValues || p.rlsValues === '*');

    if (hasAllFields && allWildcard) {
      // Replace with single wildcard permission
      consolidated.push({
        userGroupArn: perms[0].userGroupArn,
        userGroupName: perms[0].userGroupName,
        userGroupType: perms[0].userGroupType,
        field: '*',
        rlsValues: '*',
        isResolved: perms[0].isResolved
      });
    } else {
      // Keep all individual permissions
      consolidated.push(...perms);
    }
  }

  return consolidated;
};

/**
 * Parse a CSV line handling quoted values
 */
const parseCSVLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
};
