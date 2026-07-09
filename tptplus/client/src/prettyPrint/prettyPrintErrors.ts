export const DUPLICATE_FORMULA_NAME_ERROR_PREFIX =
  'ERROR: Duplicate annotated formula name';

export function isDuplicateFormulaNameError(message: string): boolean {
  return message.trim().startsWith(DUPLICATE_FORMULA_NAME_ERROR_PREFIX);
}
