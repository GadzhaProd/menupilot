export function hasValidOpenResult(result) {
  return result !== null && typeof result === 'object' && Object.keys(result).length === 1 && typeof result.opened === 'boolean';
}
