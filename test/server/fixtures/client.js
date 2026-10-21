// A separate OS process: no shared adapter, memory or database handle.
process.on('message', async ({ id, url, options }) => {
  try {
    const response = await fetch(url, options);
    process.send({ id, status: response.status, body: await response.json() });
  } catch { process.send({ id, transportError: true }); }
});
