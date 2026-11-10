import { useState } from 'react';
import { Surface } from '@/components/ui/surface';
import { useLocale } from '@/ui/i18n';

const KEY = 'menupilot.ui.local-version-notice-hidden.v1';

function readHidden() {
  try { return window.localStorage.getItem(KEY) === 'true'; }
  catch { return false; }
}

/** A quiet, dismissible pointer to the computer version; preference stays outside the menu document. */
export function LocalVersionNotice() {
  const { t } = useLocale();
  const [hidden, setHidden] = useState(readHidden);
  if (hidden) return null;
  return (
    <Surface className="flex flex-col gap-3 border-border bg-panel sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t('data.localVersionTitle')}</h2>
        <p className="max-w-prose text-sm text-muted-foreground">{t('data.localVersionText')}</p>
        <a className="font-medium text-accent-foreground underline underline-offset-4 hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2" href="https://github.com/GadzhaProd/menupilot#run-locally" target="_blank" rel="noreferrer">{t('data.localVersionLink')}</a>
      </div>
      <button type="button" className="min-h-11 shrink-0 rounded px-3 text-sm text-muted-foreground underline underline-offset-4 hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => {
        try { window.localStorage.setItem(KEY, 'true'); } catch { /* Still dismiss it for this visit. */ }
        setHidden(true);
      }}>{t('data.localVersionHide')}</button>
    </Surface>
  );
}
