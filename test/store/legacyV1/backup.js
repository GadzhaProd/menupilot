const KEY = 'menupilot:backup';
const WEEK = 7 * 24 * 60 * 60 * 1000;
export function createBackupStatus(storage, isoNow) {
  function read() {
    try {
      const data = JSON.parse(storage.getItem(KEY));
      const valid = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
      return { remindedAt: valid(data?.remindedAt) ? data.remindedAt : null, startedAt: valid(data?.startedAt) ? data.startedAt : null, lastExportAt: valid(data?.lastExportAt) ? data.lastExportAt : null };
    } catch { return { remindedAt: null, startedAt: null, lastExportAt: null }; }
  }
  return {
    get() {
      const value = read();
      return { ...value, due: value.startedAt !== null && Date.parse(isoNow()) - Math.max(Date.parse(value.startedAt), Date.parse(value.lastExportAt ?? value.startedAt), Date.parse(value.remindedAt ?? value.startedAt)) >= WEEK };
    },
    saved(ownData) {
      const value = read();
      if (ownData && !value.startedAt) storage.setItem(KEY, JSON.stringify({ ...value, startedAt: isoNow() }));
      else if (!ownData && value.startedAt) storage.setItem(KEY, JSON.stringify({ ...value, startedAt: null }));
    },
    remindLater() { storage.setItem(KEY, JSON.stringify({ ...read(), remindedAt: isoNow() })); },
    exported() { storage.setItem(KEY, JSON.stringify({ ...read(), lastExportAt: isoNow() })); },
  };
}
