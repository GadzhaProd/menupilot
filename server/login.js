// External script only. Erase the fragment before any network request or navigation.
function signIn() {
  const key = new URLSearchParams(location.hash.slice(1)).get('k');
  if (key === null) return;
  history.replaceState(null, '', '/menupilot/');
  void fetch('/menupilot/session', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }),
  }).then(response => {
    if (!response.ok) throw new Error('login');
    location.replace('/menupilot/');
  }).catch(() => {
    const error = document.getElementById('login-error');
    if (error) error.hidden = false;
    else location.replace('/menupilot/');
  });
}
addEventListener('hashchange', signIn);
signIn();
