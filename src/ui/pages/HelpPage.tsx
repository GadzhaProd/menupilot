import { ArrowUpIcon, PrinterIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { HELP_CONTENT } from '@/ui/help/content';
import { HelpBlockView } from '@/ui/help/HelpBlocks';
import { HelpNavContext, useSectionLink } from '@/ui/help/HelpNav';
import { readHelpLanguage, saveHelpLanguage } from '@/ui/help/language';
import { HELP_SECTION_IDS, type HelpDocument, type HelpLang, type HelpSectionId } from '@/ui/help/types';
import { hrefFor } from '@/ui/router/routes';
import { useLocale } from '@/ui/i18n';

const LANGUAGES: readonly { lang: HelpLang; label: string }[] = [
  { lang: 'en', label: 'English' },
  { lang: 'ru', label: 'Русский' },
];

const BIG_BUTTON = [
  'inline-flex min-h-12 items-center justify-center gap-2 rounded border border-input px-4 py-2 text-lg font-semibold',
  'outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
].join(' ');

export const sectionElementId = (id: HelpSectionId) => `help-${id}`;

function asSectionId(value: string | null): HelpSectionId | null {
  return HELP_SECTION_IDS.find((id) => id === value) ?? null;
}

function TocLink({ id, number, title }: { id: HelpSectionId; number: number; title: string }) {
  const link = useSectionLink(id);
  return (
    <a
      {...link}
      className="flex min-h-12 items-center gap-3 rounded px-3 py-2 text-lg font-medium text-accent underline underline-offset-4 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span aria-hidden="true" className="w-8 shrink-0 text-right tabular-nums">{number}.</span>
      <span>{title}</span>
    </a>
  );
}

/** At the end of every section: back to the contents list (the floating button is hidden on phones). */
function BackToContents({ label }: { label: string }) {
  const link = useSectionLink(null);
  return (
    <p className="mt-6 print:hidden">
      <a
        {...link}
        className="inline-flex min-h-12 items-center gap-2 rounded px-3 py-2 text-lg font-semibold text-accent underline underline-offset-4 outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ArrowUpIcon aria-hidden="true" className="size-5" /> {label}
      </a>
    </p>
  );
}

function Toolbar({ doc, lang, onLanguage }: { doc: HelpDocument; lang: HelpLang; onLanguage: (lang: HelpLang) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <div role="group" aria-label={doc.ui.languageLabel} className="flex gap-2">
        {LANGUAGES.map((entry) => (
          <button
            key={entry.lang}
            type="button"
            lang={entry.lang}
            aria-pressed={lang === entry.lang}
            onClick={() => onLanguage(entry.lang)}
            className={cn(
              BIG_BUTTON,
              lang === entry.lang ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-accent',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => window.print()} className={cn(BIG_BUTTON, 'border-border bg-card hover:bg-accent')}>
        <PrinterIcon aria-hidden="true" className="size-5" /> {doc.ui.print}
      </button>
    </div>
  );
}

/** The built-in step-by-step guide, in English or Russian. */
export function HelpPage({ section }: { section: string | null }) {
  const { locale, t } = useLocale();
  const [lang, setLang] = useState<HelpLang>(() => readHelpLanguage());
  const [showTop, setShowTop] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const doc = HELP_CONTENT[lang];
  const target = asSectionId(section);

  const scrollTo = useCallback((id: HelpSectionId | null) => {
    const heading = id === null ? titleRef.current : window.document.getElementById(`${sectionElementId(id)}-title`);
    if (heading === null) return;
    (id === null ? heading : heading.closest('section') ?? heading).scrollIntoView?.({ block: 'start' });
    if (id === null) window.scrollTo?.({ top: 0 });
    heading.focus({ preventScroll: true });
  }, []);

  // Follow the address: #/help goes to the start, #/help/<id> to that section, anything else to the start.
  useEffect(() => { scrollTo(target); }, [target, scrollTo]);

  const open = useCallback((id: HelpSectionId | null) => {
    const hash = hrefFor({ name: 'help', section: id });
    if (window.location.hash === hash) scrollTo(id);
    else window.location.hash = hash;
  }, [scrollTo]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function chooseLanguage(next: HelpLang) {
    setLang(next);
    saveHelpLanguage(next);
  }

  return (
    <HelpNavContext.Provider value={open}>
      <article lang={lang} className="mx-auto max-w-[70ch] space-y-8 text-lg leading-relaxed" aria-labelledby="help-title">
        <header className="space-y-4">
          <h1 id="help-title" ref={titleRef} tabIndex={-1} className="text-4xl font-semibold outline-none">{doc.title}</h1>
          <p className="text-xl">{doc.subtitle}</p>
          <Toolbar doc={doc} lang={lang} onLanguage={chooseLanguage} />
          {locale === 'nl' ? <p className="border-y border-line py-3 text-base text-muted-foreground" aria-label={t('help.ui.availableIn')}>{t('help.ui.languageNote')}</p> : null}
        </header>

        <nav aria-label={doc.ui.contents} className="border-y border-line bg-surface p-4 print:break-inside-avoid">
          <h2 className="mb-2 px-3 text-2xl font-semibold">{doc.ui.contents}</h2>
          <ul>
            {doc.sections.map((entry, index) => (
              <li key={entry.id}><TocLink id={entry.id} number={index + 1} title={entry.title} /></li>
            ))}
          </ul>
        </nav>

        {doc.sections.map((entry, index) => (
          <section key={entry.id} id={sectionElementId(entry.id)} aria-labelledby={`${sectionElementId(entry.id)}-title`} className="scroll-mt-4">
            <h2
              id={`${sectionElementId(entry.id)}-title`}
              tabIndex={-1}
              className="border-b border-line pb-3 text-3xl font-semibold outline-none"
            >
              {index + 1}. {entry.title}
            </h2>
            {entry.blocks.map((block, blockIndex) => <HelpBlockView key={blockIndex} block={block} ui={doc.ui} />)}
            <BackToContents label={doc.ui.backToContents} />
          </section>
        ))}
      </article>

      {showTop ? (
        <button
          type="button"
          onClick={() => open(null)}
          className={cn(BIG_BUTTON, 'fixed right-4 bottom-4 z-20 hidden border-primary bg-primary text-primary-foreground shadow-lg sm:inline-flex print:hidden')}
        >
          <ArrowUpIcon aria-hidden="true" className="size-5" /> {doc.ui.toTop}
        </button>
      ) : null}
    </HelpNavContext.Provider>
  );
}
