import type { MenuDocument } from '@/ui/domain/types';

/** The store is the source of truth; this state only mirrors its latest document. */
export interface DataState {
  document: MenuDocument | null;
  /** Why the saved data could not be opened (the screen cannot show data then). */
  loadError: string | null;
  /** Why the last command failed. The document on screen is unchanged. */
  commandError: string | null;
}

export type DataAction =
  | { type: 'documentReplaced'; document: MenuDocument }
  | { type: 'commandFailed'; message: string }
  | { type: 'errorDismissed' }
  | { type: 'loadFailed'; message: string };

/** Pure: no store calls here (React may run reducers twice in StrictMode). */
export function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case 'documentReplaced':
      return { ...state, document: action.document, loadError: null, commandError: null };
    case 'commandFailed':
      return { ...state, commandError: action.message };
    case 'loadFailed':
      return { ...state, loadError: action.message, commandError: null };
    case 'errorDismissed':
      return { ...state, commandError: null };
  }
}
