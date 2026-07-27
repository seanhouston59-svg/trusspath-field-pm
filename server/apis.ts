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
