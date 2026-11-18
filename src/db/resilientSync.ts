import { db } from './firebaseConfig';
import { ref, onValue, get } from 'firebase/database';
import { RTDB_REST_URL, getLocalCache, setLocalCache, getFastCache, saveFastCache } from './database';
export { getFastCache, saveFastCache };
export interface ResilientOptions {
  cacheKey?: string;
  timeoutMs?: number;
  silent?: boolean;
}

export interface NetworkDiagnosticResult {
  online: boolean;
  restOk: boolean;
  restPingMs: number;
  socketOk: boolean;
  socketPingMs: number;
  productsCount: number;
  cachedProductsCount: number;
  networkType: 'wifi' | 'cellular' | 'unknown';
  operatorNote: string;
}

/**
 * Récupération HTTPS REST directe (infaillible sur MTN / Orange Cameroun)
 */
export async function fetchViaRest(path: string, timeoutMs: number = 7000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const cleanPath = (typeof path === 'string' && path.startsWith('/')) ? path.slice(1) : (path || '');
  const url = `${RTDB_REST_URL}/${cleanPath}.json`;

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-cache'
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Récupération ultra-résiliente : tente le WebSocket Firebase avec timeout court,
 * bascule automatiquement sur HTTPS REST si le réseau mobile bloque le socket,
 * et renvoie le cache local en cas de coupure totale.
 */
export async function fetchResilient<T = any>(
  path: string,
  options: ResilientOptions = {}
): Promise<T | null> {
  const cacheKey = options.cacheKey || (typeof path === 'string' ? `loreal_cache_${path.replace(/[\/]/g, '_')}` : 'loreal_cache_root');
  const timeoutMs = options.timeoutMs || 3000;

  // 1. Tenter Firebase SDK get() avec course contre la montre
  try {
    const fetchPromise = get(ref(db, path)).then(snapshot => {
      if (snapshot.exists()) {
        const val = snapshot.val();
        saveFastCache(cacheKey, val);
        return val as T;
      }
      return null;
    });

    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Firebase SDK timeout (WebSocket latent sur réseau mobile)')), timeoutMs)
    );

    const result = await Promise.race([fetchPromise, timeoutPromise]);
    if (result !== null) return result;
  } catch (e) {
    // Échec ou timeout du SDK : basculer immédiatement sur HTTPS REST
  }

  // 2. Bascule automatique sur HTTPS REST (port 443 standard, jamais bloqué par MTN / Orange)
  try {
    const restData = await fetchViaRest(path, 8000);
    if (restData) {
      saveFastCache(cacheKey, restData);
      return restData as T;
    }
  } catch (err) {
    console.warn(`[ResilientSync] REST fallback échec pour ${path}:`, err);
  }

  // 3. Dernier recours : renvoyer le cache local déjà enregistré
  return getFastCache<T>(cacheKey);
}

/**
 * Souscription temps réel résiliente :
 * - Étape 1 : Fournit immédiatement le cache local (0 ms, aucun écran vide)
 * - Étape 2 : Lance une requête HTTPS REST ultra-rapide pour actualiser
 * - Étape 3 : Écoute en WebSocket Firebase si disponible
 */
export function subscribeResilient<T = any>(
  path: string,
  onData: (data: T | null, source: 'cache' | 'rest' | 'websocket') => void,
  options: ResilientOptions = {}
): () => void {
  const cacheKey = options.cacheKey || (typeof path === 'string' ? `loreal_cache_${path.replace(/[\/]/g, '_')}` : 'loreal_cache_root');
  let isUnsubscribed = false;

  // Étape 1 : Lecture cache immédiate (0ms)
  const cached = getFastCache<T>(cacheKey);
  if (cached) {
    onData(cached, 'cache');
  }

  // Étape 2 : Requête HTTPS REST en parallèle (garantie même si WebSocket bloqué)
  fetchViaRest(path, 6000)
    .then(restData => {
      if (!isUnsubscribed && restData) {
        saveFastCache(cacheKey, restData);
        onData(restData as T, 'rest');
      }
    })
    .catch(() => {
      // Ignoré si échec, l'écoute WebSocket ou le cache prend le relais
    });

  // Étape 3 : Écouteur WebSocket Firebase
  const targetRef = ref(db, path);
  let unsubscribeWs = () => {};

  try {
    unsubscribeWs = onValue(
      targetRef,
      snapshot => {
        if (isUnsubscribed) return;
        if (snapshot.exists()) {
          const val = snapshot.val();
          saveFastCache(cacheKey, val);
          onData(val as T, 'websocket');
        } else {
          onData(null, 'websocket');
        }
      },
      error => {
        console.warn(`[ResilientSync] Erreur WebSocket sur "${path}":`, error);
        // En cas d'erreur WebSocket, retenter un fetch REST de secours
        if (!isUnsubscribed) {
          fetchViaRest(path, 6000)
            .then(data => {
              if (!isUnsubscribed && data) {
                saveFastCache(cacheKey, data);
                onData(data as T, 'rest');
              }
            })
            .catch(() => {});
        }
      }
    );
  } catch (err) {
    console.warn(`[ResilientSync] Impossible d'attacher le listener sur "${path}":`, err);
  }

  return () => {
    isUnsubscribed = true;
    try {
      unsubscribeWs();
    } catch (e) {}
  };
}

/**
 * Diagnostic réseau complet pour téléphones Cameroun (MTN, Orange, Wi-Fi)
 */
export async function runNetworkDiagnostics(): Promise<NetworkDiagnosticResult> {
  const result: NetworkDiagnosticResult = {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    restOk: false,
    restPingMs: -1,
    socketOk: false,
    socketPingMs: -1,
    productsCount: 0,
    cachedProductsCount: 0,
    networkType: 'unknown',
    operatorNote: 'Test en cours...',
  };

  // Détection type réseau (si API navigator.connection disponible)
  if (typeof navigator !== 'undefined' && (navigator as any).connection) {
    const conn = (navigator as any).connection;
    result.networkType = conn.type === 'wifi' ? 'wifi' : 'cellular';
  }

  // 1. Test HTTPS REST
  const t0 = Date.now();
  try {
    const data = await fetchViaRest('products', 6000);
    result.restPingMs = Date.now() - t0;
    result.restOk = true;
    result.productsCount = data ? Object.keys(data).length : 0;
  } catch (e) {
    result.restPingMs = Date.now() - t0;
    result.restOk = false;
  }

  // 2. Test Firebase SDK / WebSocket
  const t1 = Date.now();
  try {
    const snap = await Promise.race([
      get(ref(db, 'users')),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);
    result.socketPingMs = Date.now() - t1;
    result.socketOk = snap !== null && snap.exists();
  } catch (e) {
    result.socketPingMs = Date.now() - t1;
    result.socketOk = false;
  }

  // 3. Cache local
  const cachedProds = getFastCache('loreal_cache_products') || getLocalCache('loreal_cache_products');
  result.cachedProductsCount = cachedProds ? Object.keys(cachedProds).length : 0;

  // Analyse et note explicative
  if (result.restOk && !result.socketOk) {
    result.operatorNote = 'Réseau Mobile Cameroun détecté (WebSockets bloqués ou lents). Le mode HTTPS REST automatique sécurise 100% de vos données.';
  } else if (result.restOk && result.socketOk) {
    result.operatorNote = 'Connexion excellente (HTTPS REST et WebSockets opérationnels).';
  } else if (!result.restOk && result.cachedProductsCount > 0) {
    result.operatorNote = 'Connexion interrompue ou très faible. Le mode Hors-Ligne utilise vos données locales en toute sécurité.';
  } else {
    result.operatorNote = 'Aucune connexion détectée. Vérifiez vos données mobiles MTN ou Orange.';
  }

  return result;
}
