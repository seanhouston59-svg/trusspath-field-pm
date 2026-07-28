/**
 * External API integrations for Jarvis.
 * - Weather: Open-Meteo (free, no API key needed)
 * - Places: Google Maps Places API (requires GOOGLE_MAPS_API_KEY env var)
 *
 * Both gracefully degrade — if the API is unavailable or the key isn't set,
 * Jarvis falls back to its built-in guidance responses.
 */

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

/* --------------------------- Geocoding --------------------------- */

// Open-Meteo free geocoding — no key needed.
async function geocodeOpenMeteo(address: string): Promise<{ lat: number; lon: number; name: string } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.results?.[0];
    if (!hit) return null;
    return { lat: hit.latitude, lon: hit.longitude, name: hit.name };
  } catch {
    return null;
  }
}

// Google Maps geocoding — more accurate for US addresses, needs API key.
async function geocodeGoogle(address: string): Promise<{ lat: number; lon: number; name: string } | null> {
  if (!GOOGLE_MAPS_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.results?.[0];
    if (!hit) return null;
    return {
      lat: hit.geometry.location.lat,
      lon: hit.geometry.location.lng,
      name: hit.formatted_address || address,
    };
  } catch {
    return null;
  }
}

async function geocode(address: string): Promise<{ lat: number; lon: number; name: string } | null> {
  // Try Google first (more accurate), fall back to Open-Meteo
  return (await geocodeGoogle(address)) || (await geocodeOpenMeteo(address));
}

/* ----------------------------- Weather ----------------------------- */

const WEATHER_CODES: Record<number, string> = {
  0: "clear skies",
  1: "mostly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "foggy",
  48: "freezing fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  66: "freezing rain",
  67: "heavy freezing rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  77: "snow grains",
  80: "light rain showers",
  81: "rain showers",
  82: "heavy rain showers",
  85: "snow showers",
  86: "heavy snow showers",
  95: "thunderstorms",
  96: "thunderstorms with hail",
  99: "severe thunderstorms with hail",
};

/**
 * Compact single-line weather summary suitable for inlining into the morning
 * brief (e.g. "72°F, partly cloudy, 6 mph wind"). Returns null on failure.
 * Uses the same free Open-Meteo API — no key needed.
 */
export async function getWeatherOneLiner(address: string): Promise<string | null> {
  const geo = await geocode(address);
  if (!geo) return null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const cur = data?.current;
    if (!cur) return null;
    const temp = Math.round(cur.temperature_2m);
    const wind = Math.round(cur.wind_speed_10m);
    const desc = WEATHER_CODES[cur.weather_code] || "current conditions";
    return `${temp}\u00B0F, ${desc}, ${wind} mph wind`;
  } catch {
    return null;
  }
}

/**
 * Map an Open-Meteo weather_code (WMO) to one of the seven slugs the daily-log
 * form's Weather dropdown supports: Sunny | Partly cloudy | Cloudy | Rain |
 * Snow | Wind | Fog. Note: "Wind" is preferred over precip-based slugs only
 * when it's dry — a rainy windy day is still "Rain".
 *
 * Code groups (per WMO):
 *   0     clear             -> Sunny
 *   1     mostly clear      -> Sunny
 *   2     partly cloudy     -> Partly cloudy
 *   3     overcast          -> Cloudy
 *   45,48 fog               -> Fog
 *   51-67 drizzle/rain      -> Rain
 *   71-77 snow              -> Snow
 *   80-82 rain showers      -> Rain
 *   85-86 snow showers      -> Snow
 *   95-99 thunderstorms     -> Rain (safest bucket for daily-log)
 */
function weatherCodeToSlug(code: number, windMph: number, precipInches: number): "Sunny" | "Partly cloudy" | "Cloudy" | "Rain" | "Snow" | "Wind" | "Fog" {
  if (code === 45 || code === 48) return "Fog";
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return "Snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return "Rain";
  // At this point conditions are dry (clear/partly cloudy/overcast). If wind is
  // notable and precipitation is nil, surface "Wind" so the field crew flags it.
  if (windMph >= 20 && precipInches < 0.05) return "Wind";
  if (code === 3) return "Cloudy";
  if (code === 2) return "Partly cloudy";
  return "Sunny";
}

export interface DailyLogWeather {
  /** One of the seven daily-log slugs. */
  weather: "Sunny" | "Partly cloudy" | "Cloudy" | "Rain" | "Snow" | "Wind" | "Fog";
  /** Rounded degrees Fahrenheit. For historical/future dates: daily mean temp.
   *  For today: current temp reading. */
  temp: number;
  /** Extras for the UI — never persisted on the log. */
  meta: {
    /** "Aspen, CO" or similar, from the geocoder. */
    locationName: string;
    /** "today" | "historical" | "forecast" — which Open-Meteo endpoint was used. */
    source: "today" | "historical" | "forecast";
    /** Descriptive text ("partly cloudy", "heavy rain", ...) — for tooltip. */
    description: string;
    /** Wind mph, rounded — used to decide "Wind" slug. */
    windMph: number;
  };
}

/**
 * Look up daily-log-ready weather + temperature for a project address on a
 * given date. Uses Open-Meteo (no API key). Picks the correct endpoint:
 *   - today                -> /v1/forecast?current=...
 *   - past dates           -> /v1/archive?daily=... (ERA5 reanalysis)
 *   - future dates (<= 15d) -> /v1/forecast?daily=...
 *
 * Returns null when we can't geocode the address or the API fails. The caller
 * (route handler) turns null into a 404 so the client can fall back to manual
 * entry silently.
 *
 * @param address Full street address from the project record.
 * @param dateStr YYYY-MM-DD. Defaults to today (in the site's local tz).
 */
export async function getDailyLogWeather(address: string, dateStr?: string): Promise<DailyLogWeather | null> {
  const geo = await geocode(address);
  if (!geo) return null;

  // Normalize the date. We compare in UTC-ish YYYY-MM-DD because Open-Meteo
  // does the same — the API's timezone=auto param handles the site-local shift.
  const today = new Date().toISOString().slice(0, 10);
  const target = (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) ? dateStr : today;

  try {
    if (target === today) {
      // Current conditions — matches getWeatherOneLiner's request shape.
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,wind_speed_10m,precipitation,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const cur = data?.current;
      if (!cur) return null;
      const temp = Math.round(cur.temperature_2m);
      const wind = Math.round(cur.wind_speed_10m);
      const precip = Number(cur.precipitation ?? 0);
      const code = Number(cur.weather_code ?? 0);
      return {
        weather: weatherCodeToSlug(code, wind, precip),
        temp,
        meta: {
          locationName: geo.name,
          source: "today",
          description: WEATHER_CODES[code] || "current conditions",
          windMph: wind,
        },
      };
    }

    // Past vs future — Open-Meteo has separate endpoints. We pick archive for
    // any date strictly before today, and forecast for today+1 through +15.
    const isPast = target < today;
    const baseUrl = isPast ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast";
    const url = `${baseUrl}?latitude=${geo.lat}&longitude=${geo.lon}&start_date=${target}&end_date=${target}&daily=temperature_2m_mean,temperature_2m_max,wind_speed_10m_max,precipitation_sum,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const daily = data?.daily;
    if (!daily?.time?.length) return null;
    // Prefer the daily mean; fall back to the max if mean is missing (some
    // archive rows are sparse right at the edge of the ERA5 lag window).
    const meanTemp = Number(daily.temperature_2m_mean?.[0] ?? NaN);
    const maxTemp = Number(daily.temperature_2m_max?.[0] ?? NaN);
    const temp = Math.round(Number.isFinite(meanTemp) ? meanTemp : maxTemp);
    const wind = Math.round(Number(daily.wind_speed_10m_max?.[0] ?? 0));
    const precip = Number(daily.precipitation_sum?.[0] ?? 0);
    const code = Number(daily.weather_code?.[0] ?? 0);
    if (!Number.isFinite(temp)) return null;
    return {
      weather: weatherCodeToSlug(code, wind, precip),
      temp,
      meta: {
        locationName: geo.name,
        source: isPast ? "historical" : "forecast",
        description: WEATHER_CODES[code] || (isPast ? "historical conditions" : "forecast"),
        windMph: wind,
      },
    };
  } catch {
    return null;
  }
}

export async function getWeather(address: string): Promise<string | null> {
  const geo = await geocode(address);
  if (!geo) return null;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,apparent_temperature,wind_speed_10m,precipitation,weather_code,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=3`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const cur = data?.current;
    const daily = data?.daily;
    if (!cur) return null;

    const temp = Math.round(cur.temperature_2m);
    const feelsLike = Math.round(cur.apparent_temperature);
    const wind = Math.round(cur.wind_speed_10m);
    const precip = cur.precipitation;
    const humidity = Math.round(cur.relative_humidity_2m);
    const desc = WEATHER_CODES[cur.weather_code] || "current conditions";
    const locationName = geo.name;

    let response = `Here's the weather at ${locationName} right now:\n\n`;
    response += `It's ${temp} degrees and ${desc}, feels like ${feelsLike} degrees. `;
    response += `Wind's at ${wind} miles per hour`;
    if (precip > 0) response += `, with ${precip} inches of precipitation`;
    response += `. Humidity is at ${humidity} percent.\n\n`;

    // Add construction-relevant safety notes
    const safetyNotes: string[] = [];
    if (temp >= 90) {
      safetyNotes.push("That's hot — make sure everyone's hydrating, taking shade breaks, and watching for signs of heat illness. Schedule the heavy work for early morning if you can.");
    } else if (temp >= 80) {
      safetyNotes.push("It's warm out there — keep water on site and remind the crew to stay hydrated.");
    }
    if (wind >= 20) {
      safetyNotes.push("Wind's picking up — be careful with crane operations and anything at height. Most manufacturers say to stop lifts at twenty miles per hour sustained, some lower.");
    }
    if (cur.weather_code >= 95) {
      safetyNotes.push("Thunderstorms in the area — use the thirty/thirty rule. If you hear thunder within thirty seconds of lightning, get to shelter, and wait thirty minutes after the last thunder before going back out.");
    }
    if (precip > 0.1) {
      safetyNotes.push("There's active precipitation — watch for slippery surfaces, mud, and trench stability issues.");
    }
    if (safetyNotes.length) {
      response += "Heads up for the crew:\n";
      response += safetyNotes.map((n) => `- ${n}`).join("\n");
      response += "\n\n";
    }

    // 3-day forecast
    if (daily && daily.time && daily.time.length > 1) {
      response += "Next couple of days:\n";
      for (let i = 1; i < Math.min(3, daily.time.length); i++) {
        const dayName = new Date(daily.time[i]).toLocaleDateString("en-US", { weekday: "short" });
        const hi = Math.round(daily.temperature_2m_max[i]);
        const lo = Math.round(daily.temperature_2m_min[i]);
        const rainChance = daily.precipitation_probability_max?.[i] ?? 0;
        const dayDesc = WEATHER_CODES[daily.weather_code?.[i] ?? 0] || "variable";
        response += `- ${dayName}: ${lo} to ${hi} degrees, ${dayDesc}, ${rainChance}% chance of rain\n`;
      }
    }

    return response;
  } catch {
    return null;
  }
}

/* --------------------------- Google Places --------------------------- */

const PLACE_TYPES: Record<string, string> = {
  lunch: "restaurant",
  food: "restaurant",
  eat: "restaurant",
  restaurant: "restaurant",
  hungry: "restaurant",
  dinner: "restaurant",
  breakfast: "restaurant",
  coffee: "cafe",
  hardware: "hardware_store",
  supplies: "hardware_store",
  material: "hardware_store",
  hotel: "lodging",
  motel: "lodging",
  lodging: "lodging",
  gas: "gas_station",
  fuel: "gas_station",
};

export async function getNearbyPlaces(address: string, query: string): Promise<string | null> {
  if (!GOOGLE_MAPS_KEY) return null;

  const lower = query.toLowerCase();
  let placeType = "restaurant";
  for (const [keyword, type] of Object.entries(PLACE_TYPES)) {
    if (lower.includes(keyword)) {
      placeType = type;
      break;
    }
  }

  const geo = await geocodeGoogle(address);
  if (!geo) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${geo.lat},${geo.lon}&radius=5000&type=${placeType}&key=${GOOGLE_MAPS_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.results;
    if (!results || results.length === 0) return null;

    const top = results.slice(0, 5);
    const typeLabel = placeType === "restaurant" ? "lunch spots" : placeType.replace(/_/g, " ");

    let response = `Here are some ${typeLabel} near ${geo.name}:\n\n`;
    for (let i = 0; i < top.length; i++) {
      const place = top[i];
      const name = place.name;
      const rating = place.rating ? `${place.rating} stars` : "no rating";
      const vicinity = place.vicinity || "";
      const open = place.opening_hours?.open_now === true ? "open now" : place.opening_hours?.open_now === false ? "closed" : "";
      const priceStr = place.price_level ? "$".repeat(place.price_level) : "";
      response += `${i + 1}. ${name} — ${rating}${priceStr ? `, ${priceStr}` : ""}${open ? `, ${open}` : ""}\n   ${vicinity}\n`;
    }

    response += "\nThese are within about three miles of your site. For directions, maps.google.com has you covered.";

    return response;
  } catch {
    return null;
  }
}

/* ------------------------- Availability checks ------------------------- */

export function hasWeatherApi(): boolean {
  return true; // Open-Meteo is always available
}

export function hasPlacesApi(): boolean {
  return !!GOOGLE_MAPS_KEY;
}
