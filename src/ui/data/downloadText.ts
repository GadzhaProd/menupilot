export function downloadText(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = window.document.createElement('a');
  link.href = url;
  link.download = fileName;
  window.document.body.append(link);
  link.click();
  link.remove();
  // Revoke later: revoking right after click() can cancel the download in Firefox.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

