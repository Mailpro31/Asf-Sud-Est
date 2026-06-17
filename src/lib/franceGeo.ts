/**
 * Projection géographique de la France métropolitaine (+ Corse) pour la carte
 * interactive des antennes.
 *
 * Les antennes sont positionnées en pourcentages `x`/`y` (0–100) sur un conteneur
 * dont le ratio correspond aux proportions réelles de la France, de sorte qu'une
 * coordonnée (longitude, latitude) tombe au bon endroit.
 */

export const FRANCE_BOUNDS = {
  lonMin: -5.15,
  lonMax: 9.56,
  latMin: 41.33,
  latMax: 51.09,
};

/** Ratio largeur/hauteur du conteneur pour des proportions géographiques correctes. */
export const FRANCE_ASPECT =
  ((FRANCE_BOUNDS.lonMax - FRANCE_BOUNDS.lonMin) *
    Math.cos((((FRANCE_BOUNDS.latMin + FRANCE_BOUNDS.latMax) / 2) * Math.PI) / 180)) /
  (FRANCE_BOUNDS.latMax - FRANCE_BOUNDS.latMin);

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

/** Convertit (longitude, latitude) en position (x%, y%) sur la carte. */
export function lonLatToXY(lon: number, lat: number): { x: number; y: number } {
  const x = ((lon - FRANCE_BOUNDS.lonMin) / (FRANCE_BOUNDS.lonMax - FRANCE_BOUNDS.lonMin)) * 100;
  const y = ((FRANCE_BOUNDS.latMax - lat) / (FRANCE_BOUNDS.latMax - FRANCE_BOUNDS.latMin)) * 100;
  return { x: Math.round(clamp(x) * 10) / 10, y: Math.round(clamp(y) * 10) / 10 };
}

/** Contour simplifié de la France métropolitaine (longitude, latitude), sens horaire. */
export const FRANCE_MAINLAND: [number, number][] = [
  [2.38, 51.03], [3.2, 50.52], [3.66, 50.34], [4.23, 50.27], [4.79, 50.13],
  [5.8, 49.55], [6.74, 49.16], [8.13, 48.97], [7.79, 48.58], [7.55, 47.59],
  [6.86, 47.0], [6.45, 46.3], [6.0, 46.13], [6.86, 45.83], [6.6, 45.1],
  [6.9, 44.36], [7.5, 44.13], [7.52, 43.79], [7.26, 43.7], [6.64, 43.27],
  [5.93, 43.06], [5.3, 43.18], [4.6, 43.35], [3.7, 43.4], [3.03, 42.7],
  [3.17, 42.43], [1.45, 42.6], [-0.7, 42.85], [-1.4, 43.05], [-1.79, 43.36],
  [-1.25, 44.5], [-1.06, 45.57], [-1.57, 46.16], [-2.2, 47.27], [-3.37, 47.55],
  [-4.79, 48.04], [-4.78, 48.39], [-3.98, 48.72], [-2.76, 48.51], [-2.0, 48.65],
  [-1.6, 48.84], [-1.62, 49.64], [-0.2, 49.3], [0.11, 49.49], [0.37, 49.76],
  [1.08, 49.93], [1.59, 50.52], [1.86, 50.95],
];

/** Contour simplifié de la Corse. */
export const FRANCE_CORSICA: [number, number][] = [
  [9.36, 43.0], [9.45, 42.7], [9.5, 42.1], [9.18, 41.39], [8.74, 41.92], [8.76, 42.57],
];

/** Convertit un contour [lon,lat][] en chaîne `points` SVG, mise à l'échelle. */
export function toSvgPoints(coords: [number, number][], scale = 1): string {
  return coords
    .map(([lon, lat]) => {
      const { x, y } = lonLatToXY(lon, lat);
      return `${(x * scale).toFixed(1)},${(y * scale).toFixed(1)}`;
    })
    .join(' ');
}

/** Répertoire des principales villes françaises : nom normalisé → [lon, lat]. */
const CITY_COORDS: Record<string, [number, number]> = {
  'paris': [2.3522, 48.8566],
  'marseille': [5.3698, 43.2965],
  'lyon': [4.8357, 45.764],
  'toulouse': [1.4442, 43.6047],
  'nice': [7.262, 43.7102],
  'nantes': [-1.5536, 47.2184],
  'strasbourg': [7.7521, 48.5734],
  'montpellier': [3.8767, 43.6108],
  'bordeaux': [-0.5792, 44.8378],
  'lille': [3.0573, 50.6292],
  'rennes': [-1.6778, 48.1173],
  'reims': [4.0317, 49.2583],
  'le havre': [0.1079, 49.4944],
  'saint etienne': [4.3872, 45.4397],
  'toulon': [5.928, 43.1242],
  'grenoble': [5.7245, 45.1885],
  'dijon': [5.0415, 47.322],
  'angers': [-0.5632, 47.4784],
  'nimes': [4.3601, 43.8367],
  'clermont ferrand': [3.087, 45.7772],
  'aix en provence': [5.4474, 43.5297],
  'brest': [-4.4861, 48.3904],
  'tours': [0.6848, 47.3941],
  'amiens': [2.2958, 49.8941],
  'limoges': [1.2611, 45.8336],
  'annecy': [6.1294, 45.8992],
  'perpignan': [2.8954, 42.6986],
  'besancon': [6.0241, 47.238],
  'metz': [6.1757, 49.1193],
  'orleans': [1.909, 47.9029],
  'mulhouse': [7.3389, 47.7508],
  'rouen': [1.0993, 49.4431],
  'caen': [-0.3708, 49.1829],
  'nancy': [6.1844, 48.6921],
  'avignon': [4.8055, 43.9493],
  'poitiers': [0.3404, 46.5802],
  'pau': [-0.3707, 43.2951],
  'la rochelle': [-1.1511, 46.1603],
  'calais': [1.8587, 50.9513],
  'bayonne': [-1.4748, 43.4929],
  'ajaccio': [8.7369, 41.9192],
  'bastia': [9.4509, 42.7028],
  'troyes': [4.0744, 48.2973],
  'lorient': [-3.366, 47.7485],
  'cannes': [7.0174, 43.5528],
  'antibes': [7.1251, 43.5808],
  'chambery': [5.9203, 45.5646],
  'valence': [4.8918, 44.9333],
  'dunkerque': [2.377, 51.0343],
  'le mans': [0.1996, 48.0061],
  'angouleme': [0.156, 45.6485],
  'chartres': [1.4889, 48.4439],
  'colmar': [7.3585, 48.0794],
  'quimper': [-4.0978, 47.9961],
  'vannes': [-2.7603, 47.6582],
  'pontoise': [2.1009, 49.0506],
  'versailles': [2.1301, 48.8049],
};

/** Normalise un nom de ville pour la recherche (minuscules, sans accents/ponctuation). */
export function normalizeCityName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Cherche une ville dans le répertoire local (exact, puis inclusion). */
export function lookupCity(name: string): [number, number] | null {
  const n = normalizeCityName(name);
  if (!n) return null;
  if (CITY_COORDS[n]) return CITY_COORDS[n];
  // Le nom saisi contient/est contenu dans une clé connue (ex. "paris ile de france").
  for (const key of Object.keys(CITY_COORDS)) {
    if (n === key || n.startsWith(key + ' ') || n.includes(key) || key.includes(n)) {
      return CITY_COORDS[key];
    }
  }
  return null;
}

/**
 * Géocode une ville : répertoire local d'abord (instantané, hors-ligne), sinon
 * API officielle française (adresse.data.gouv.fr). Renvoie [lon, lat] ou null.
 */
export async function geocodeCity(name: string): Promise<[number, number] | null> {
  const local = lookupCity(name);
  if (local) return local;
  const q = name.trim();
  if (q.length < 2) return null;
  try {
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&type=municipality&limit=1`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data?.features?.[0]?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length === 2) {
      return [coords[0], coords[1]];
    }
  } catch {
    /* hors-ligne : on garde la position manuelle */
  }
  return null;
}

/** Position (x%, y%) d'une ville si connue/géocodable, sinon null. */
export async function cityToXY(name: string): Promise<{ x: number; y: number } | null> {
  const coords = await geocodeCity(name);
  return coords ? lonLatToXY(coords[0], coords[1]) : null;
}
