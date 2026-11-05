import { assertRuntime } from './runtime.js';

// Dynamic import keeps old Node releases on the helpful runtime error path.
try {
  assertRuntime();
  const { start } = await import('./startLocal.js');
  await start();
} catch (error) {
  const message = error.code === 'EADDRINUSE'
    ? 'The port is already in use. Set MENUPILOT_PORT to another port.'
    : error.message;
  console.error(`MenuPilot: ${message}`);
  process.exitCode = 1;
}
