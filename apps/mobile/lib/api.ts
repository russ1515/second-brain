import Constants from 'expo-constants';

/**
 * Base URL of the Second Brain API.
 * On a physical device / emulator, `localhost` points at the device itself, so
 * we derive the dev machine's IP from the Metro bundler host. For staging or
 * production builds, set `extra.apiUrl` in app.json.
 */
function resolveApiBaseUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (configured) return configured;

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:3000`;
}

export const API_BASE_URL = resolveApiBaseUrl();
