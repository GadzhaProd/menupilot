import { afterEach, expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp, memoryStorage, demo, STORAGE_KEY } from './helpers';

function config(text: string) {
  const meta=document.createElement('meta');meta.name='menupilot-mode';meta.content='local';document.head.append(meta);
  const script=document.createElement('script');script.id='menupilot-local-config';script.type='application/json';script.textContent=text;document.head.append(script);
}
afterEach(()=>{document.querySelectorAll('#menupilot-local-config,meta[name="menupilot-mode"]').forEach(el=>el.remove());vi.unstubAllGlobals();});
test('invalid local config fails closed without opening browser data',async()=>{
  config('{bad');const storage=memoryStorage({[STORAGE_KEY]:JSON.stringify(demo)});
  await renderApp(storage);
  expect(screen.getByRole('alert').textContent).toContain('local server configuration');
  expect(screen.queryByRole('navigation')).toBeNull();expect(storage.setCalls).toBe(0);
});
test('local config selects HTTP, shows canonical data directory, and leaves browser document alone',async()=>{
  config(JSON.stringify({mode:'local',apiVersion:1,token:'a'.repeat(64),dataDir:'/tmp/MenuPilot'}));
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({document:{...demo,ingredients:[],recipes:[],scenarios:[]},schemaVersion:2,revision:0,documentId:null}),{status:200}));
  vi.stubGlobal('fetch',fetcher);
  const storage=memoryStorage({[STORAGE_KEY]:JSON.stringify(demo)});await renderApp(storage);
  expect(screen.getByText('Local mode · data: /tmp/MenuPilot')).toBeTruthy();
  expect(fetcher).toHaveBeenCalled();expect(storage.data.get(STORAGE_KEY)).toBe(JSON.stringify(demo));
});

test('local Data page describes disk storage and local version history',async()=>{
  config(JSON.stringify({mode:'local',apiVersion:1,token:'a'.repeat(64),dataDir:'/tmp/MenuPilot'}));
  vi.stubGlobal('fetch',vi.fn(async(url:string)=>new Response(JSON.stringify(url.endsWith('/history') ? [] : {document:demo,schemaVersion:2,revision:1,documentId:'local'}),{status:200})));
  window.location.hash='#/data';await renderApp(memoryStorage());
  expect(screen.queryByText(/Your data lives only in this browser/)).toBeNull();
  expect(screen.getByText(/Up to 32 previous versions/)).toBeTruthy();
});
