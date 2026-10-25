import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDemoWelcome, useCommands } from '@/ui/data/DataProvider';
import { useLocale } from '@/ui/i18n';

export function DemoWelcome() {
  const { demoWelcome, dismissDemoWelcome } = useDemoWelcome();
  const { execute, commandStatus } = useCommands();
  const { t } = useLocale();
  const [confirming, setConfirming] = useState(false);
  if (!demoWelcome) return null;
  return <aside className="rounded-lg border border-primary/40 bg-primary/5 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4" aria-label={t('local.demoNotice')}>
    <p className="font-medium">{t('local.demoNotice')}</p>
    <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
      <Button onClick={() => setConfirming(true)}>{t('local.demoStart')}</Button>
      <Button variant="outline" onClick={dismissDemoWelcome}>{t('local.demoContinue')}</Button>
    </div>
    <Dialog open={confirming} onOpenChange={setConfirming}>
      <DialogContent role="alertdialog">
        <DialogHeader><DialogTitle>{t('local.demoConfirm')}</DialogTitle><DialogDescription>{t('local.demoConfirmText')}</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={commandStatus === 'saving'} onClick={() => setConfirming(false)}>{t('data.cancel')}</Button>
          <Button type="button" disabled={commandStatus === 'saving'} onClick={async () => {
            const result = await execute(store => store.resetToEmpty(), { report: false, clearRecipeDrafts: true });
            if (result.ok) { setConfirming(false); dismissDemoWelcome(); }
          }}>{t('local.demoConfirmAction')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </aside>;
}
