import { StoreError } from './errors.js';

/** Transport-neutral adapter. Reads/history previews never silently advance CAS. */
export function createRemoteAdapter(request, { pollMs = 2000 } = {}) {
  let current;
  const accept = result => { if (!result.conflict) current = structuredClone(result); return result; };
  async function write(kind, payload, expectedRevision, opId) {
    if (!current) throw new StoreError('not-loaded', 'Load the saved data before writing.');
    return accept(await request('write', { kind, ...structuredClone(payload), expectedRevision,
      expectedDocumentId: current.documentId, opId }));
  }
  return {
    async load({ beforeReplace = () => {} } = {}) {
      const record = await request('document');
      beforeReplace(structuredClone(record.document));
      return accept(record);
    },
    save: (document, revision, opId) => write('save', { document }, revision, opId),
    importDocument: ({ document, schemaVersion, documentId, revision: sourceRevision }, revision, opId) =>
      write('import', { source: { document, schemaVersion, documentId, revision: sourceRevision } }, revision, opId),
    reset: (document, revision, opId, resetKind) => write('reset', { document, resetKind }, revision, opId),
    history: {
      list: () => request('history'),
      read: id => request('history/read', { id }),
      restore: (id, revision, opId) => write('restore', { id }, revision, opId),
    },
    saveMemoryAsNew: (document, opId) => write('memory', { document }, current?.revision ?? 0, opId),
    subscribe(changed) {
      let stopped = false, timer;
      async function poll() {
        try {
          const version = await request('version');
          if (!stopped && current && (version.documentId !== current.documentId || version.revision !== current.revision)) changed();
        } catch { /* Transient outages do not discard drafts. A write reports the error. */ }
        if (!stopped) timer = setTimeout(poll, pollMs);
      }
      timer = setTimeout(poll, pollMs);
      return () => { stopped = true; clearTimeout(timer); };
    },
  };
}
