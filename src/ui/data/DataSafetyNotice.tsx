import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/ui/i18n';
import { useSimulatorSessions } from '@/ui/simulator/session';
import { useDataSafety } from './DataProvider';

/** Keep the action reachable inside a modal's focus trap as well as on a page. */
export function DataSafetyNotice() {
  const { t } = useLocale();
  const { safety, reloadLatest, activateEditing, hasDrafts } = useDataSafety();
  const sessions = useSimulatorSessions();
  const [dialog, setDialog] = useState<Element | null>(null);
  useEffect(() => { hasDrafts.current = () => sessions.unsavedTotal() > 0; return () => { hasDrafts.current = () => false; }; }, [hasDrafts, sessions]);
  useEffect(() => {
    if (!safety) { setDialog(null); return; }
    const find = () => setDialog(document.querySelector('[role="dialog"], [role="alertdialog"]'));
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [safety]);
  if (!safety) return null;
  const text = safety === 'draft-target-removed' ? t('safety.removed') : safety === 'conflict' ? t('safety.changed') : safety === 'write-busy' ? t('safety.busy')
    : safety === 'write-unavailable' ? t('safety.unavailable') : t('safety.readFailed');
  const notice = <div role="status" className="space-y-2 rounded-md border border-amber-500/50 bg-card p-3 text-sm">
    <p>{text}</p>
    {safety !== 'write-unavailable' && <Button type="button" variant="outline" className="whitespace-normal" onClick={() => {
      void (safety === 'write-busy' ? activateEditing() : reloadLatest());
    }}>{safety === 'write-busy' ? t('safety.activate') : t('safety.latest')}</Button>}
  </div>;
  return dialog ? createPortal(notice, dialog) : notice;
}
