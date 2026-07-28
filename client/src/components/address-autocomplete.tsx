import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiUrl } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

/**
 * AddressAutocomplete — drop-in address input with Google Places suggestions.
 *
 * Design:
 * - Debounces typing (250ms) so we don't hammer the server on every keystroke.
 * - Generates a fresh sessionToken each time the input gains focus. Google
 *   groups all autocomplete requests + the final details lookup under one
 *   session for billing purposes, so we get one billing event per address the
 *   user actually types.
 * - If the server reports Places isn't configured (`available: false`), we
 *   silently degrade to a plain text input with no dropdown — no user-visible
 *   errors, no broken UX.
 * - Supports either `<Input>` (single-line) or `<Textarea>` (multi-line) via
 *   the `multiline` prop. Project addresses in TrussPath happen to be
 *   textareas today because they include suite / gate / access notes.
 *
 * Keyboard:
 * - Arrow up/down highlights suggestions
 * - Enter picks the highlighted suggestion (or submits form if none)
 * - Escape closes the dropdown
 */

type Suggestion = {
  placeId: string;
  description: string;
  primaryText: string;
  secondaryText: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Called when the user picks a suggestion — receives the canonical
   *  formatted address. Also fires onChange first, so consumers that only
   *  care about the string can ignore this. */
  onPick?: (details: { formattedAddress: string; lat: number | null; lon: number | null }) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  "data-testid"?: string;
  /** Render as a Textarea instead of an Input (multi-line address field). */
  multiline?: boolean;
  /** Restrict suggestions to a country, e.g. "US". Defaults to no restriction. */
  countryBias?: string;
  disabled?: boolean;
};

// Fallback for browsers/environments without crypto.randomUUID (older Safari, jsdom in tests).
function newSessionToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    try { return crypto.randomUUID(); } catch { /* fall through */ }
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function AddressAutocomplete({
  value, onChange, onPick, placeholder, className, id, multiline, countryBias = "US", disabled,
  ...rest
}: Props) {
  const testid = (rest as any)["data-testid"];
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const sessionRef = useRef<string>(newSessionToken());
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  // Tracks whether the current text was set by picking a suggestion — used to
  // suppress the dropdown re-opening from that same value.
  const suppressNextFetch = useRef(false);

  // Fetch on debounced input change. Cancels any in-flight request when the
  // user keeps typing so we don't paint stale results.
  useEffect(() => {
    if (suppressNextFetch.current) {
      suppressNextFetch.current = false;
      return;
    }
    if (!open) return;
    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const url = apiUrl(`/api/places/autocomplete?q=${encodeURIComponent(q)}&session=${sessionRef.current}${countryBias ? `&country=${countryBias}` : ""}`);
        const res = await fetch(url, { signal: ac.signal, credentials: "include" });
        if (!res.ok) { setSuggestions([]); return; }
        const data = await res.json();
        // If server reports Places isn't wired up, permanently stop showing
        // the dropdown for this focus — no UX churn.
        if (data?.available === false) {
          setSuggestions([]);
          setOpen(false);
          return;
        }
        setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
        setHighlight(0);
      } catch (err: any) {
        if (err?.name !== "AbortError") setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, open, countryBias]);

  // Close dropdown when clicking outside.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const pick = async (s: Suggestion) => {
    // Optimistically write the description so the field shows the pick
    // immediately, then refine with the canonical formatted address from
    // the details endpoint (they're usually identical, but details is the
    // source of truth Google recommends storing).
    suppressNextFetch.current = true;
    onChange(s.description);
    setOpen(false);
    setSuggestions([]);
    try {
      const res = await fetch(
        apiUrl(`/api/places/details?placeId=${encodeURIComponent(s.placeId)}&session=${sessionRef.current}`),
        { credentials: "include" },
      );
      if (res.ok) {
        const d = await res.json();
        if (d?.formattedAddress && d.formattedAddress !== s.description) {
          suppressNextFetch.current = true;
          onChange(d.formattedAddress);
        }
        onPick?.({
          formattedAddress: d?.formattedAddress || s.description,
          lat: d?.location?.latitude ?? d?.lat ?? null,
          lon: d?.location?.longitude ?? d?.lon ?? null,
        });
      } else {
        onPick?.({ formattedAddress: s.description, lat: null, lon: null });
      }
    } catch {
      onPick?.({ formattedAddress: s.description, lat: null, lon: null });
    }
    // Rotate the session so the next lookup starts a fresh billing session.
    sessionRef.current = newSessionToken();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % suggestions.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length); }
    else if (e.key === "Enter") {
      const s = suggestions[highlight];
      if (s) { e.preventDefault(); pick(s); }
    }
    else if (e.key === "Escape") { setOpen(false); }
  };

  const commonProps = {
    id,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onFocus: () => setOpen(true),
    onKeyDown,
    placeholder: placeholder ?? "Start typing an address…",
    disabled,
    "data-testid": testid,
    autoComplete: "off" as const,
    // Prevents Chrome / iOS from painting its own inline suggestion list on
    // top of ours. `autoComplete="off"` alone gets ignored by Chrome on
    // address-like fields.
    "data-1p-ignore": "true",
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {multiline ? (
        <Textarea {...(commonProps as any)} rows={3} />
      ) : (
        <Input {...(commonProps as any)} />
      )}
      {loading && (
        <div className="pointer-events-none absolute right-2 top-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      )}
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
          data-testid="address-suggestions"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={i === highlight}
              className={cn(
                "flex cursor-pointer items-start gap-2 px-3 py-2 text-sm",
                i === highlight ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
              )}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setHighlight(i)}
              data-testid={`address-suggestion-${i}`}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="truncate font-medium">{s.primaryText}</div>
                {s.secondaryText && <div className="truncate text-xs text-muted-foreground">{s.secondaryText}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
