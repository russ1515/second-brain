import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { Locale } from '../lib/i18n';

export interface AdminUiState {
  dark: boolean;
  locale: Locale;
  setDark: Dispatch<SetStateAction<boolean>>;
  setLocale: Dispatch<SetStateAction<Locale>>;
}

const AdminUiContext = createContext<AdminUiState | null>(null);

export const AdminUiProvider = AdminUiContext.Provider;

/** Shared shell preferences, so protected pages react immediately to the header controls. */
export function useAdminUi(): AdminUiState {
  const value = useContext(AdminUiContext);
  if (!value) throw new Error('AdminUiProvider missing');
  return value;
}
