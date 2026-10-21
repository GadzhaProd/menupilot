import { serveLocal } from '../../../server/http.js';
const server = await serveLocal({ dataDir: process.argv[2], distDir: process.argv[2], port: 0,
  storage: { load() { return { toJSON() { throw new Error('serialization failure'); } }; } } });
process.send({ address: server.address, cliToken: server.cliToken });
process.on('SIGTERM', async () => { await server.close(); process.exit(); });
