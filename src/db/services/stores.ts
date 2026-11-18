import { db } from '../firebaseConfig';
import { ref, get, update } from 'firebase/database';

export interface StoreLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  updated_at?: string;
  updated_by?: string;
}

export const DEFAULT_STORE_LOCATIONS: Record<string, StoreLocation> = {
  falaise: {
    id: 'falaise',
    name: 'La Falaise',
    address: 'Boutique La Falaise, Douala (3°52\'13.7"N 11°30\'57.9"E)',
    lat: 3.870472,
    lng: 11.516083,
  },
  tougou: {
    id: 'tougou',
    name: 'Tougou',
    address: 'Boutique Tougou, Douala (3°52\'56.9"N 11°31\'24.1"E)',
    lat: 3.882472,
    lng: 11.523361,
  }
};

export async function getStoreLocations(): Promise<Record<string, StoreLocation>> {
  try {
    const locRef = ref(db, 'store_locations');
    const snapshot = await get(locRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      return {
        falaise: { ...DEFAULT_STORE_LOCATIONS.falaise, ...(data.falaise || {}) },
        tougou: { ...DEFAULT_STORE_LOCATIONS.tougou, ...(data.tougou || {}) }
      };
    }
  } catch (e) {
    console.error('Erreur getStoreLocations:', e);
  }
  return DEFAULT_STORE_LOCATIONS;
}

export async function updateStoreLocation(
  storeId: string, 
  data: { address?: string; lat: number; lng: number }, 
  userName: string = ''
) {
  const updates: any = {};
  const now = new Date().toISOString();
  if (data.address !== undefined) updates[`store_locations/${storeId}/address`] = data.address;
  updates[`store_locations/${storeId}/lat`] = data.lat;
  updates[`store_locations/${storeId}/lng`] = data.lng;
  updates[`store_locations/${storeId}/updated_at`] = now;
  updates[`store_locations/${storeId}/updated_by`] = userName;
  await update(ref(db), updates);
}

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 3.5;
  const R = 6371; // Rayon Terre en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

export function calculateTravelMinutes(distanceKm: number, averageSpeedKmh: number = 20): number {
  if (!distanceKm || distanceKm <= 0) return 15;
  // Trajet moto/taxi en circulation urbaine : distance / vitesse * 60 + 3 min marge feux
  const minutes = Math.round((distanceKm / averageSpeedKmh) * 60) + 3;
  return Math.max(5, Math.min(120, minutes));
}
