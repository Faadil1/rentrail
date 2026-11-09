import { emptyPortfolio, type Portfolio } from './domain.ts';
const STORAGE_KEY = 'rentrail-local-portfolio-v1';

/** Local drafts only. This browser record is not a source of verified blockchain payments. */
export function loadPortfolio(): Portfolio {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyPortfolio();
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return emptyPortfolio();
    const p = data as Partial<Portfolio>;
    if (p.schemaVersion !== 1 || !Array.isArray(p.properties) || !Array.isArray(p.units) || !Array.isArray(p.charges) || !Array.isArray(p.submissions)) return emptyPortfolio();
    // Persisted state is always *untrusted local draft*, never live evidence.
    return { schemaVersion: 1, properties: p.properties, units: p.units, charges: p.charges, submissions: p.submissions };
  } catch { return emptyPortfolio(); }
}
export function savePortfolio(portfolio: Portfolio): void { localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio)); }
export function clearPortfolio(): void { localStorage.removeItem(STORAGE_KEY); }