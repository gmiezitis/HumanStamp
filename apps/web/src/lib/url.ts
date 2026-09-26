/**
 * Get the application base URL.
 * Uses NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_BASE_URL, RENDER_EXTERNAL_URL, or falls back to localhost.
 */
export function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'http://localhost:3000'
  );
}
