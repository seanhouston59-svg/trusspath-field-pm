/**
 * Build a Google Maps directions URL for an address. Uses the universal
 * `?api=1&query=` search endpoint which:
 *   - opens the native Google Maps app on iOS / Android when installed
 *   - opens maps.google.com in the browser otherwise
 *   - drops the pin on the address and lets the user tap "Directions"
 *
 * See https://developers.google.com/maps/documentation/urls/get-started
 */
export function googleMapsUrl(address: string | null | undefined): string | null {
  const q = (address ?? "").trim();
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
