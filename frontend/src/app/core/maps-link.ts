/** Google Maps link parsing and embed/directions URL builders. */

const AT_COORDS = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const QUERY_COORDS = /[?&](?:q|ll|query|destination)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const PLACE_COORDS = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;
const MAPS_HOSTS = ['google.com', 'maps.google', 'goo.gl'];

export interface MapPoint {
  lat: number;
  lng: number;
}

export function isMapsLink(url: string): boolean {
  const lower = url.toLowerCase();
  return url.startsWith('https://') && MAPS_HOSTS.some((h) => lower.includes(h));
}

/** Extract (lat, lng) from a Google Maps URL, or null if none is embedded. */
export function parseGoogleMapsLink(url: string): MapPoint | null {
  if (!isMapsLink(url)) return null;
  for (const pattern of [AT_COORDS, QUERY_COORDS, PLACE_COORDS]) {
    const match = pattern.exec(url);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    }
  }
  return null;
}

/** Google Maps embed iframe URL (no API key needed). */
export function mapEmbedUrl(point: MapPoint, zoom: number): string {
  return `https://www.google.com/maps?q=${point.lat},${point.lng}&z=${zoom}&hl=en&output=embed`;
}

/** "Get directions" deep link into the Google Maps app/site. */
export function mapDirectionsUrl(point: MapPoint): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;
}
