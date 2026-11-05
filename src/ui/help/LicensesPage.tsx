import { useEffect, useRef, useState } from 'react';
import type { HelpDocument } from './types';

/** A Help route also works on the local server, which does not serve extra HTML pages. */
export function LicensesPage({ ui, lang }: { ui: HelpDocument['ui']; lang: HelpDocument['lang'] }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    void fetch(`${import.meta.env.BASE_URL}THIRD_PARTY_LICENSES.json`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('License request failed');
        const value: unknown = await response.json();
        if (!value || typeof value !== 'object' || !('text' in value) || typeof value.text !== 'string') throw new Error('Invalid license file');
        if (!controller.signal.aborted) setText(value.text);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [attempt]);
  return <article lang={lang} className="mx-auto max-w-[80ch] space-y-6" aria-labelledby="licenses-title">
    <h1 id="licenses-title" ref={heading} tabIndex={-1} className="text-3xl font-semibold outline-none">{ui.licenses}</h1>
    <a href="#/help" className="inline-flex min-h-12 items-center underline underline-offset-4 focus-visible:ring-[3px] focus-visible:ring-ring">{ui.backToContents}</a>
    {failed ? <div role="alert"><p>{ui.licensesError}</p><button type="button" className="mt-2 min-h-12 rounded border px-4 focus-visible:ring-[3px] focus-visible:ring-ring" onClick={() => setAttempt(value => value + 1)}>{ui.retry}</button></div>
      : text === null ? <p role="status">{ui.licensesLoading}</p>
        : <pre lang="en" className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{text}</pre>}
  </article>;
}
