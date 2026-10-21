import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '@/ui/App';
import { DataProvider, useCommands, useDataSafety } from '@/ui/data/DataProvider';
import { createBrowserStorageAdapter } from '@/store/browserAdapter.js';
import { createStore, StoreError } from '@/ui/domain/store';
import type { MenuDocument } from '@/ui/domain/types';
import { demo, go, memoryStorage, NOW, renderApp, STORAGE_KEY } from './helpers';
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});
const initial=()=>structuredClone(demo) as MenuDocument;
async function mount(adapter: ReturnType<typeof createBrowserStorageAdapter>, storage: ReturnType<typeof memoryStorage>, children=<App />) {
  await act(async()=>{render(<DataProvider storage={storage} adapter={adapter} demo={demo} now={()=>NOW}>{children}</DataProvider>);});
}
async function dirtyRecipe() {
  await go('#/recipe/dish_classic_burger');
  await userEvent.clear(screen.getByLabelText('Name'));await userEvent.type(screen.getByLabelText('Name'),'Persistent recipe draft');
}
it('failed recipe save keeps its cached draft after leaving and returning',async()=>{
  const storage=memoryStorage();const adapter=createBrowserStorageAdapter(storage,{initialDocument:initial(),now:()=>NOW});
  adapter.save=async()=>{throw new StoreError('write-failed','offline');};
  await mount(adapter,storage);await dirtyRecipe();
  await userEvent.click(screen.getByRole('button',{name:'Save changes'}));
  await go('#/ingredients');await go('#/recipe/dish_classic_burger');
  expect(screen.getByLabelText('Name')).toHaveProperty('value','Persistent recipe draft');
});
it('failed version restoration keeps recipe and simulator caches',async()=>{
  const storage=memoryStorage({[STORAGE_KEY]:JSON.stringify(demo)});
  const seed=createStore(storage,{demo,now:()=>NOW});await seed.load();await seed.updateIngredient('ing_beef',{name:'Edited'});
  await renderApp(storage);await dirtyRecipe();await go('#/simulator/dish_classic_burger');
  await userEvent.click(screen.getByRole('button',{name:'Add scenario'}));
  const name=screen.getByLabelText('Scenario name');await userEvent.clear(name);await userEvent.type(name,'Persistent scenario draft');
  await go('#/data');await userEvent.click(screen.getByRole('button',{name:'Preview version'}));
  storage.failOnSet=new Error('full');
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:'Restore version'}));
  expect(screen.getByRole('alert').textContent).toMatch(/could not be restored/);
  await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:'Cancel'}));
  await go('#/recipe/dish_classic_burger');expect(screen.getByLabelText('Name')).toHaveProperty('value','Persistent recipe draft');
  await go('#/simulator/dish_classic_burger');expect(screen.getByLabelText('Scenario name')).toHaveProperty('value','Persistent scenario draft');
});
it('migration requires an exact original download and explicit confirmation, preserving the form',async()=>{
  const raw=JSON.stringify(demo,null,2), backing=memoryStorage({[STORAGE_KEY]:raw});
  const storage={...backing,setItem(k:string,v:string){if(k==='menupilot:premigration-v1')throw new Error('full');backing.setItem(k,v);}};
  let blob:Blob|undefined;
  URL.createObjectURL=value=>{blob=value as Blob;return 'blob:source';};URL.revokeObjectURL=()=>{};
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
  await renderApp(storage);await go('#/ingredients');await userEvent.click(screen.getByRole('button',{name:'Add ingredient'}));
  const region=within(screen.getByRole('dialog'));await userEvent.type(region.getByLabelText('Name'),'Kept migration draft');
  await userEvent.click(region.getByRole('button',{name:'Add ingredient'}));
  expect(region.getByText(/original v1 data could not be backed up/)).toBeTruthy();
  expect(region.queryByRole('button',{name:/I have saved/})).toBeNull();
  expect(backing.getItem(STORAGE_KEY)).toBe(raw);
  await userEvent.click(region.getByRole('button',{name:'Download original v1 data'}));
  expect(await blob!.text()).toBe(raw);expect(backing.getItem(STORAGE_KEY)).toBe(raw);
  await userEvent.click(region.getByRole('button',{name:/I have saved/}));
  expect(region.getByLabelText('Name')).toHaveProperty('value','Kept migration draft');
  expect(backing.getItem(STORAGE_KEY)).toBe(raw);
  await userEvent.click(region.getByRole('button',{name:'Add ingredient'}));
  expect(JSON.parse(backing.getItem(STORAGE_KEY)!).document.ingredients.at(-1).name).toBe('Kept migration draft');
});
it('lock timeout unlocks the form, keeps the input and permits closing the dialog',async()=>{
  const storage=memoryStorage();
  const locks={request(_name:string,options:LockOptions){return new Promise((_resolve,reject)=>options.signal!.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));}} as unknown as LockManager;
  const adapter=createBrowserStorageAdapter(storage,{initialDocument:initial(),locks,lockTimeoutMs:30});
  await mount(adapter,storage);await go('#/ingredients');await userEvent.click(screen.getByRole('button',{name:'Add ingredient'}));
  const region=within(screen.getByRole('dialog'));await userEvent.type(region.getByLabelText('Name'),'Timed out draft');
  await userEvent.click(region.getByRole('button',{name:'Add ingredient'}));
  await region.findByText(/Another tab is still saving/);
  expect(region.getByLabelText('Name')).toHaveProperty('value','Timed out draft');
  expect(region.getByLabelText('Name').matches(':disabled')).toBe(false);
  expect(storage.getItem(STORAGE_KEY)).toBeNull();
  await userEvent.keyboard('{Escape}');expect(screen.queryByRole('dialog')).toBeNull();
});
function StatusProbe(){const {execute,commandStatus}=useCommands();const {reloadLatest}=useDataSafety();
 const [error,setError]=React.useState('');return <><output>{commandStatus}</output><p>{error}</p>
 <button onClick={()=>execute(s=>s.updateSettings({defaultVatRateBp:1000})).then(r=>{if(!r.ok)setError(r.error);})}>Write</button>
 <button onClick={reloadLatest}>Refresh</button></>;}
import React from 'react';
it('Saved expires and route changes reset status',async()=>{
 const storage=memoryStorage(),adapter=createBrowserStorageAdapter(storage,{initialDocument:initial()});
 await mount(adapter,storage,<StatusProbe/>);vi.useFakeTimers();
 await act(async()=>{fireEvent.click(screen.getByText('Write'));});expect(screen.getByText('saved')).toBeTruthy();
 await act(async()=>{vi.advanceTimersByTime(3001);});expect(screen.getByText('idle')).toBeTruthy();
 await act(async()=>{fireEvent.click(screen.getByText('Write'));});expect(screen.getByText('saved')).toBeTruthy();
 act(()=>window.dispatchEvent(new HashChangeEvent('hashchange')));expect(screen.getByText('idle')).toBeTruthy();
});
it('refreshing data never reports Saving when another command is attempted',async()=>{
 const storage=memoryStorage(),adapter=createBrowserStorageAdapter(storage,{initialDocument:initial()});
 await mount(adapter,storage,<StatusProbe/>);
 const load=adapter.load;let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 adapter.load=async(...args)=>{await gate;return load(...args);};
 fireEvent.click(screen.getByText('Refresh'));fireEvent.click(screen.getByText('Write'));
 await screen.findByText(/Data is being refreshed/);expect(screen.getByText('idle')).toBeTruthy();expect(screen.queryByText('saving')).toBeNull();
 await act(async()=>release());
});
it.each([false,true])('a delayed new recipe save does not navigate after leaving (return to new editor: %s)',async returnToEditor=>{
 const storage=memoryStorage(),adapter=createBrowserStorageAdapter(storage,{initialDocument:initial(),now:()=>NOW});
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});const save=adapter.save;
 adapter.save=async(...args)=>{await gate;return save(...args);};
 await mount(adapter,storage);await go('#/recipe/new?kind=dish');
 await userEvent.type(screen.getByLabelText('Name'),'Delayed dish');await userEvent.type(screen.getByLabelText(/Menu price/),'12');
 const ingredient=screen.getByLabelText('Ingredient or prep');await userEvent.selectOptions(ingredient,'ingredient:ing_beef');
 await userEvent.type(screen.getByLabelText(/Net quantity/),'100');
 await userEvent.click(screen.getByRole('button',{name:'Save dish'}));
 expect(screen.getByRole('button',{name:'Saving…'})).toBeTruthy();await go('#/data');
 if(returnToEditor){await go('#/recipe/new?kind=dish');expect(screen.getByLabelText('Name').matches(':disabled')).toBe(true);}
 await act(async()=>release());await waitFor(()=>expect(JSON.parse(storage.getItem(STORAGE_KEY)!).document.recipes.some((r:{name:string})=>r.name==='Delayed dish')).toBe(true));
 expect(window.location.hash).toBe(returnToEditor?'#/recipe/new?kind=dish':'#/data');expect(screen.queryByText('Saved',{exact:true})).toBeNull();
});
