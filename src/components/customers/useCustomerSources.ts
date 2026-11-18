import { useEffect, useState } from 'react';
import { subscribeResilient } from '../../db/resilientSync';
import type { CustomerSources } from '../../db/services/customers';

/**
 * Lecture temps réel (cache → REST → WebSocket) des nœuds `sales` et `advances`.
 * Lecture seule : aucune écriture.
 */
export function useCustomerSources(): CustomerSources & { ready: boolean } {
  const [sales, setSales] = useState<Record<string, any> | null>(null);
  const [advances, setAdvances] = useState<Record<string, any> | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const unSales = subscribeResilient<Record<string, any>>('sales', data => setSales(data || {}), { cacheKey: 'loreal_cache_sales' });
    const unAdv = subscribeResilient<Record<string, any>>('advances', data => setAdvances(data || {}), { cacheKey: 'loreal_cache_advances' });
    // Hors ligne sans cache : on affiche quand même l'écran (vide) après 9 s.
    const t = setTimeout(() => setTimedOut(true), 9000);
    return () => { clearTimeout(t); unSales(); unAdv(); };
  }, []);

  return { sales: sales || {}, advances: advances || {}, ready: (sales !== null && advances !== null) || timedOut };
}
