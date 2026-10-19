import { CheckCircle2Icon, ShieldCheckIcon, TriangleAlertIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useSectionLink } from './HelpNav';
import { HELP_IMAGES, helpImageUrl } from './images';
import type { HelpBlock, HelpDocument, HelpImage, HelpSectionId, HelpStep, Rich } from './types';

const LINK = 'rounded-sm font-medium text-accent-foreground underline underline-offset-4 outline-none hover:bg-panel focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

function SectionLink({ section, children }: { section: HelpSectionId; children: ReactNode }) {
  const link = useSectionLink(section);
  return <a className={LINK} {...link}>{children}</a>;
}

/** Inline text: names of buttons and fields in bold, links to other sections. */
export function RichText({ text }: { text: Rich }) {
  if (typeof text === 'string') return <>{text}</>;
  return (
    <>
      {text.map((part, index) => {
        if (typeof part === 'string') return part;
        if ('b' in part) return <strong key={index} className="font-semibold">{part.b}</strong>;
        return <SectionLink key={index} section={part.to}>{part.text}</SectionLink>;
      })}
    </>
  );
}

export function HelpFigure({ image, ui }: { image: HelpImage; ui: HelpDocument['ui'] }) {
  const file = HELP_IMAGES[image.id];
  const url = helpImageUrl(file.file);
  return (
    <figure className="my-4 space-y-2 print:break-inside-avoid">
      <img
        src={url}
        width={file.width}
        height={file.height}
        alt={image.alt}
        loading="lazy"
        className="h-auto max-w-full rounded-lg border-2 border-border bg-card print:max-h-[8cm] print:w-auto"
      />
      {image.caption ? <figcaption className="text-base">{image.caption}</figcaption> : null}
      {/* The full-size file, for small screens where the picture is too small to read. */}
      <a href={url} target="_blank" rel="noreferrer" className={cn(LINK, 'inline-flex min-h-12 items-center print:hidden')}>
        {ui.openLarger}
        <span className="sr-only">: {image.alt}</span>
      </a>
    </figure>
  );
}

function Steps({ title, steps, ui }: { title: string; steps: readonly HelpStep[]; ui: HelpDocument['ui'] }) {
  return (
    <div className="my-5 space-y-3">
      <h3 className="text-2xl font-semibold">{title}</h3>
      <ol className="space-y-4">
        {steps.map((step, index) => (
          <li key={index} className="flex gap-4 border-b border-line py-4 print:break-inside-avoid">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-semibold text-accent-foreground print:border print:border-black print:bg-white print:text-black"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <p><RichText text={step.text} /></p>
              {step.result ? (
                <p className="flex gap-2">
                  <CheckCircle2Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary print:hidden" />
                  <span><strong className="font-semibold">{ui.stepsDone}:</strong> <RichText text={step.result} /></span>
                </p>
              ) : null}
              {step.image ? <HelpFigure image={step.image} ui={ui} /> : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Note({ block }: { block: Extract<HelpBlock, { kind: 'note' }> }) {
  const safe = block.tone === 'safe';
  const Icon = safe ? ShieldCheckIcon : TriangleAlertIcon;
  return (
    <aside
      className={cn(
        'my-5 flex gap-3 border-y p-4 print:break-inside-avoid',
        safe ? 'border-positive bg-surface' : 'border-negative bg-surface text-negative',
      )}
    >
      <Icon aria-hidden="true" className="mt-1 size-6 shrink-0" />
      <div className="space-y-1">
        <p className="font-semibold">{block.title}</p>
        <p><RichText text={block.text} /></p>
      </div>
    </aside>
  );
}

export function HelpBlockView({ block, ui }: { block: HelpBlock; ui: HelpDocument['ui'] }): ReactNode {
  switch (block.kind) {
    case 'p': return <p className="my-4"><RichText text={block.text} /></p>;
    case 'h3': return <h3 className="mt-8 text-2xl font-semibold">{block.text}</h3>;
    case 'steps': return <Steps title={block.title} steps={block.steps} ui={ui} />;
    case 'note': return <Note block={block} />;
    case 'image': return <HelpFigure image={block.image} ui={ui} />;
    case 'list':
      return (
        <ul className="my-4 list-disc space-y-2 pl-7">
          {block.items.map((item, index) => <li key={index}><RichText text={item} /></li>)}
        </ul>
      );
    case 'terms':
      return (
        <dl className="my-4 space-y-4">
          {block.items.map((item) => (
            <div key={item.term} className="border-y border-line py-4 print:break-inside-avoid">
              <dt className="text-xl font-semibold">{item.term}</dt>
              <dd className="mt-1"><RichText text={item.meaning} /></dd>
              {item.example ? <dd className="mt-2 border-t border-line pt-3 text-muted-foreground"><RichText text={item.example} /></dd> : null}
            </div>
          ))}
        </dl>
      );
    case 'messages':
      return (
        <dl className="my-4 space-y-4">
          {block.items.map((item) => (
            <div key={item.message} className="border-y border-line py-4 print:break-inside-avoid">
              <dt className="sr-only">{ui.messageHeader}</dt>
              <dd className="border-y border-negative bg-surface p-3 font-medium text-negative print:text-black">{item.message}</dd>
              <dt className="sr-only">{ui.meaningHeader}</dt>
              <dd className="mt-2"><RichText text={item.meaning} /></dd>
            </div>
          ))}
        </dl>
      );
  }
}
