export async function signIn(server, dir) {
  const r = await fetch(server.address + '/menupilot/session', { method: 'POST', headers: { Origin: server.address, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: server.openUrl.split('#k=')[1] }) });
  if (!r.ok) throw new Error('Test sign-in failed');
  return { ...await r.json(), cookie: r.headers.get('set-cookie').split(';')[0] };
}
