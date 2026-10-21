/** These failures have their own actionable notice; forms must not add a generic error. */
export const isSafetyError = (code: string) => ['conflict', 'write-busy', 'write-unavailable', 'migration-backup-required'].includes(code);
