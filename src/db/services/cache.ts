// Helper pour cache local afin de réduire la consommation de données mobiles
const inMemoryCache: Record<string, any> = {};

export function getFastCache<T = any>(key: string): T | null {
  if (inMemoryCache[key]) {
    return inMemoryCache[key];
  }
  const disk = getLocalCache(key);
  if (disk) {
    inMemoryCache[key] = disk;
    return disk;
  }
  return null;
}

export function saveFastCache(key: string, data: any) {
  inMemoryCache[key] = data;
  setLocalCache(key, data);
}

export function getLocalCache(key: string) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const v = window.localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function setLocalCache(key: string, data: any) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
  }
}
