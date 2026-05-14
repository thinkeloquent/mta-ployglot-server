import { ValidationError } from '../client/errors.mjs';

const VALID_DATA_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SINGLE_SELECT', 'ITERATION'];
const VALID_COLORS = ['GRAY', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'RED', 'PINK', 'PURPLE'];

export function validateCreateInput({ name, dataType, singleSelectOptions, iterationConfiguration }) {
  if (!name) throw new ValidationError('name is required');
  if (!VALID_DATA_TYPES.includes(dataType)) {
    throw new ValidationError(`dataType must be one of: ${VALID_DATA_TYPES.join(', ')}`);
  }
  if (dataType === 'SINGLE_SELECT') {
    if (!Array.isArray(singleSelectOptions) || singleSelectOptions.length === 0) {
      throw new ValidationError('SINGLE_SELECT requires non-empty singleSelectOptions');
    }
    for (const o of singleSelectOptions) {
      if (!o.name) throw new ValidationError('every option needs a name');
      if (o.color && !VALID_COLORS.includes(o.color)) {
        throw new ValidationError(`invalid color "${o.color}"; valid: ${VALID_COLORS.join(', ')}`);
      }
    }
  }
  if (dataType === 'ITERATION') {
    if (!iterationConfiguration?.duration || !iterationConfiguration?.startDate) {
      throw new ValidationError('ITERATION requires iterationConfiguration with duration and startDate');
    }
  }
}

export { VALID_DATA_TYPES, VALID_COLORS };
