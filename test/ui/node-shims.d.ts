/** The few Node functions the guide's file checks use (the project has no @types/node). */
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string): Uint8Array;
  export function statSync(path: string): { size: number };
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
}
declare const process: { cwd(): string };
