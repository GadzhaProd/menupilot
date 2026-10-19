import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { hrefFor } from '@/ui/router/routes';
import { useLocale } from '@/ui/i18n';

export function NotFoundPage({ what = 'page' }: { what?: 'recipe' | 'ingredient' | 'dish' | 'page' }) {
  const { t } = useLocale();
  return (
    <Surface aria-labelledby="page-title" className="space-y-4">
      <h1 id="page-title" className="text-4xl font-semibold">{what === 'recipe' || what === 'dish' ? t('notfound.recipeTitle') : what === 'ingredient' ? t('notfound.ingredientTitle') : t('page.notFound')}</h1>
      <p className="max-w-prose text-muted-foreground">{t(what === 'recipe' ? 'notfound.recipeDescription' : what === 'dish' ? 'notfound.dishDescription' : what === 'ingredient' ? 'notfound.ingredientDescription' : 'notfound.pageDescription')}</p>
      <div className="flex flex-wrap gap-3">
        {what === 'recipe' || what === 'dish' ? <Button asChild variant="outline"><a href={hrefFor({ name: 'recipes' })}>{t('notfound.backRecipes')}</a></Button> : null}
        <Button asChild><a href={hrefFor({ name: 'dashboard' })}>{t('notfound.backHome')}</a></Button>
      </div>
    </Surface>
  );
}
