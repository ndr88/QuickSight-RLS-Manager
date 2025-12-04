/**
 * Helper functions for working with field types
 */

export interface FieldTypesMap {
  [fieldName: string]: string;
}

/**
 * Parse field types JSON string to object map
 */
export const parseFieldTypes = (fieldTypesJson?: string | null): FieldTypesMap => {
  if (!fieldTypesJson) return {};
  
  try {
    return JSON.parse(fieldTypesJson);
  } catch (e) {
    console.error('Failed to parse fieldTypes:', e);
    return {};
  }
};

/**
 * Get field names from field types map
 */
export const getFieldNames = (fieldTypesJson?: string | null): string[] => {
  const fieldTypes = parseFieldTypes(fieldTypesJson);
  return Object.keys(fieldTypes);
};

/**
 * Check if a field type is a date type
 */
export const isDateType = (type?: string): boolean => {
  if (!type) return false;
  const dateTypes = ['DATETIME', 'DATE', 'TIMESTAMP'];
  return dateTypes.includes(type.toUpperCase());
};

/**
 * Check if a specific field is a date field
 */
export const isDateField = (fieldName: string, fieldTypesJson?: string | null): boolean => {
  const fieldTypes = parseFieldTypes(fieldTypesJson);
  const fieldType = fieldTypes[fieldName];
  return isDateType(fieldType);
};

/**
 * Get non-date fields from field types
 */
export const getNonDateFields = (fieldTypesJson?: string | null): string[] => {
  const fieldTypes = parseFieldTypes(fieldTypesJson);
  return Object.keys(fieldTypes).filter(fieldName => !isDateType(fieldTypes[fieldName]));
};

/**
 * Get field type for a specific field
 */
export const getFieldType = (fieldName: string, fieldTypesJson?: string | null): string | undefined => {
  const fieldTypes = parseFieldTypes(fieldTypesJson);
  return fieldTypes[fieldName];
};

/**
 * Validate that fields are not date types
 * Returns array of invalid fields with their types
 */
export const validateFieldsNotDate = (
  fieldNames: string[],
  fieldTypesJson?: string | null
): { field: string; type: string }[] => {
  const fieldTypes = parseFieldTypes(fieldTypesJson);
  const invalidFields: { field: string; type: string }[] = [];
  
  fieldNames.forEach(fieldName => {
    const fieldType = fieldTypes[fieldName];
    if (fieldType && isDateType(fieldType)) {
      invalidFields.push({ field: fieldName, type: fieldType });
    }
  });
  
  return invalidFields;
};
