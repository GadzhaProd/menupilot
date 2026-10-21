import { useEffect, useState } from 'react';
import { useLocale } from '@/ui/i18n';
import { useLocalMode } from './localMode';

interface BackupStatus {
  lastBackupAt: string | null;
  lastExternalBackupAt: string | null;
  externalConfigured: boolean;
  dirty: boolean;
  overdue: boolean;
  externalOverdue: boolean;
  backupError: string | null;
  externalError: string | null;
  clockWarning: boolean;
}

/** Observational only: backup state never enters the document or form reducers. */
export function LocalBackupStatus() {
  const local = useLocalMode();
  const { locale } = useLocale();
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const token = local?.token;
  useEffect(() => {
    if (!token) return;
    let active = true, timer: ReturnType<typeof setTimeout>;
    let abort: AbortController | undefined;
    async function poll() {
      abort = new AbortController();
      const timeout = setTimeout(() => abort?.abort(), 8000);
      try {
        const response = await fetch('/api/backups/status', {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', redirect: 'error',
          signal: abort.signal,
        });
        if (!response.ok) throw new Error();
        const value = await response.json() as BackupStatus;
        if (active) { setStatus(value); setFailed(false); }
      } catch { if (active) setFailed(true); }
      finally { clearTimeout(timeout); if (active) timer = setTimeout(() => { void poll(); }, 5000); }
    }
    void poll();
    return () => { active = false; clearTimeout(timer); abort?.abort(); };
  }, [token]);
  if (!local) return null;
  const nl = locale === 'nl';
  const date = (value: string | null) => value ? new Date(value).toLocaleString(nl ? 'nl-NL' : 'en-GB') : (nl ? 'nog geen' : 'none yet');
  return <div data-testid="backup-status" className="mx-auto max-w-7xl space-y-1 px-4 pb-2 text-xs text-muted-foreground">
    {status && <>
      <p>{nl ? 'Laatste reservekopie: ' : 'Last backup: '}{date(status.lastBackupAt)}
        {status.dirty && (nl ? ' · wijzigingen wachten op een kopie' : ' · changes awaiting backup')}</p>
      <p>{nl ? 'Laatste externe kopie: ' : 'Last external copy: '}{status.externalConfigured ? date(status.lastExternalBackupAt) : (nl ? 'niet ingesteld' : 'not configured')}</p>
      {status.externalConfigured && <p>{nl ? 'Een kopie in een cloudmap bewijst niet dat deze is gesynchroniseerd.' : 'A copy in a cloud folder does not prove it has synced.'}</p>}
    </>}
    <div role="status" className="text-destructive">
      {failed && <p>{nl ? 'De status van reservekopieën is niet beschikbaar. Controleer de lokale server.' : 'Backup status is unavailable. Check the local server.'}</p>}
      {status?.backupError && <p>{nl ? 'Reservekopie mislukt. Controleer vrije schijfruimte en maprechten; MenuPilot probeert het opnieuw.' : 'Backup failed. Check free disk space and folder permissions; MenuPilot will retry.'}</p>}
      {status?.overdue && <p>{nl ? 'Reservekopie te laat: wijzigingen wachten al meer dan 5 minuten.' : 'Backup overdue: changes have waited more than 5 minutes.'}</p>}
      {status?.externalError && <p>{nl ? 'Externe kopie mislukt. Controleer de externe map; MenuPilot probeert het opnieuw.' : 'External copy failed. Check the external folder; MenuPilot will retry.'}</p>}
      {status?.externalOverdue && <p>{nl ? 'Externe kopie te laat: geen bevestigde kopie in de afgelopen 24 uur.' : 'External copy overdue: no confirmed copy in the last 24 hours.'}</p>}
      {status?.clockWarning && <p>{nl ? 'De systeemklok is teruggezet. Controleer de datum en de tijden van reservekopieën.' : 'The system clock moved backwards. Check the date and backup times.'}</p>}
    </div>
    {!status && !failed && <p>{nl ? 'Reservekopieën controleren…' : 'Checking backups…'}</p>}
  </div>;
}
