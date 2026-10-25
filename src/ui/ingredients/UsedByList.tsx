import { summarizeUsers } from '@/ui/forms/usage';
import { useLocale } from '@/ui/i18n';
import { hrefFor } from '@/ui/router/routes';

/** Links to the recipes that use an item: at most 3, then "and N more". */
export function UsedByList({ users }: { users: readonly { id: string; name: string }[] }) {
  const { t } = useLocale();
  const { shown, more } = summarizeUsers(users);
  return (
    <>
      <ul className="mt-1 list-disc pl-5">
        {shown.map((recipe) => (
          <li key={recipe.id}>
            <a className="underline underline-offset-4" href={hrefFor({ name: 'recipe', id: recipe.id })}>{recipe.name}</a>
          </li>
        ))}
      </ul>
      {more > 0 ? <p className="mt-1 text-muted-foreground">{t('prices.andMore', { count: more })}</p> : null}
    </>
  );
}
