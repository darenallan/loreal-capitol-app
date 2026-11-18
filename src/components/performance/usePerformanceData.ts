import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnalyticsProduct, AnalyticsSale, loadAnalyticsProducts, loadAnalyticsSales,
} from '../../db/services/analytics';

/** Charge ventes + produits (lecture seule). `reload()` relit la base. */
export function usePerformanceData() {
  const [sales, setSales] = useState<AnalyticsSale[]>([]);
  const [products, setProducts] = useState<AnalyticsProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date>(() => new Date());
  const alive = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sl, pr] = await Promise.all([loadAnalyticsSales(), loadAnalyticsProducts()]);
      if (!alive.current) return;
      setSales(sl);
      setProducts(pr);
      setLoadedAt(new Date());
    } catch (e: any) {
      if (alive.current) setError(e?.message || 'Chargement impossible');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    reload();
    return () => { alive.current = false; };
  }, [reload]);

  return { sales, products, loading, error, loadedAt, reload };
}
