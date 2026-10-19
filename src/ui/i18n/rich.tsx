import { Fragment, type ReactNode } from 'react';
import { en } from './en';
import { dictionaries, interpolateMessage, type Locale, type MessageParams, type TranslationKey } from './messages';

type Tags<S extends string> = S extends `${string}<${infer Tag}>${infer Rest}`
  ? (Tag extends `/${string}` ? never : Tag) | Tags<Rest> : never;
type Component = (children: ReactNode) => ReactNode;
export type RichTranslate = <K extends TranslationKey>(key: K, params: MessageParams<K>, components: Record<Tags<(typeof en)[K]>, Component>) => ReactNode;

/** Only paired, named tags from trusted dictionaries; user parameters are literal text.
 * Components control markup/props, so messages cannot supply HTML attributes or URLs.
 */
export function createRichTranslator(locale: Locale): RichTranslate {
  return (key, params, components) => {
    const renderers = components as Record<string, Component>;
    const root: ReactNode[] = [];
    const stack: { tag: string; children: ReactNode[] }[] = [{ tag: '', children: root }];
    for (const [index, token] of dictionaries[locale][key].split(/(<\/?\w+>)/g).entries()) {
      const tag = /^<(\/?)(\w+)>$/.exec(token);
      if (!tag) {
        stack[stack.length - 1]!.children.push(interpolateMessage(token, params, key));
      } else if (!tag[1]) {
        if (!Object.hasOwn(renderers, tag[2]!) || typeof renderers[tag[2]!] !== 'function') throw new Error(`Missing rich component: ${key}.${tag[2]}`);
        stack.push({ tag: tag[2]!, children: [] });
      } else {
        if (stack.length === 1 || stack[stack.length - 1]!.tag !== tag[2]) throw new Error(`Unbalanced rich message: ${key}`);
        const frame = stack.pop()!;
        stack[stack.length - 1]!.children.push(<Fragment key={index}>{renderers[frame.tag]!(frame.children)}</Fragment>);
      }
    }
    if (stack.length !== 1) throw new Error(`Unbalanced rich message: ${key}`);
    return root;
  };
}
