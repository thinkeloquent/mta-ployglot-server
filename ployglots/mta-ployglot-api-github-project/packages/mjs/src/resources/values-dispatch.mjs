import { ValidationError } from '../client/errors.mjs';

/**
 * @param {string} dataType
 * @param {*} value
 * @param {object} [fieldMeta]
 * @returns {object} value-shaped input for UpdateProjectV2ItemFieldValueInput
 */
export function buildValueInput(dataType, value, fieldMeta) {
  switch (dataType) {
    case 'TEXT':
      if (typeof value !== 'string') throw new ValidationError('TEXT value must be a string');
      return { text: value };
    case 'NUMBER':
      if (typeof value !== 'number') throw new ValidationError('NUMBER value must be a number');
      return { number: value };
    case 'DATE':
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new ValidationError('DATE value must be ISO YYYY-MM-DD');
      }
      return { date: value };
    case 'SINGLE_SELECT':
      if (typeof value !== 'string') throw new ValidationError('SINGLE_SELECT value must be option id (string)');
      return { singleSelectOptionId: value };
    case 'ITERATION':
      if (typeof value === 'string') return { iterationId: value };
      if (value?.iterationId) return { iterationId: value.iterationId };
      throw new ValidationError('ITERATION value must be iteration id (string) or { iterationId }');
    default:
      throw new ValidationError(`unsupported dataType: ${dataType}`);
  }
}
