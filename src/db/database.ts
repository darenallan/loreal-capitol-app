/**
 * Point d'entrée unique de la couche données (barrel).
 *
 * Le code est réparti par domaine dans src/db/services/. Ce fichier ré-exporte
 * tout pour que les imports existants (`from '../db/database'`) restent valides.
 * Ajouter une nouvelle fonction : la placer dans le service adéquat (elle sera
 * ré-exportée automatiquement via `export *`).
 */
export * from './services/config';
export * from './services/roles';
export * from './services/cache';
export * from './services/users';
export * from './services/audit';
export * from './services/products';
export * from './services/advances';
export * from './services/sales';
export * from './services/backdated';
export * from './services/stores';
export * from './services/transfers';
export * from './services/inventory';
export * from './services/cashClosing';
export * from './services/analytics';
export * from './services/customers';
