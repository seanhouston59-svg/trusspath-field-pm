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

/**
 * Build a Google Maps URL for a location descriptor (e.g. "Level 4 mechanical room")
 * combined with the parent project's street address. Location fields on their own
 * are usually area descriptors, not geocodable places — pairing them with the
 * project address gives Google Maps enough to drop a pin at the site.
 *
 * Returns null when both location and projectAddress are empty.
 */
export function googleMapsUrlForLocation(
  location: string | null | undefined,
  projectAddress: string | null | undefined,
): string | null {
  const loc = (location ?? "").trim();
  const addr = (projectAddress ?? "").trim();
  if (!loc && !addr) return null;
  const q = [loc, addr].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
