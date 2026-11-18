# L'Oréal Capitol — Code Source Complet du Projet

Bienvenue sur le projet **L'Oréal Capitol** (Application de Gestion Commerciale, Caisse, Stocks & Vitrine Web).

---

## 1. Technologies Utilisées
- **Framework Mobile & Web** : [Expo SDK 57](https://docs.expo.dev/) (React Native 0.86, React 19)
- **Langage** : TypeScript
- **Base de Données Temps Réel** : Google Firebase Realtime Database
- **Navigation** : React Navigation v7 (Stack)
- **Hébergement & Déploiement** : Vercel
- **Reçus & Impression** : Impression thermique Bluetooth, Reçu numérique interactif WhatsApp/SMS, Export PDF & CSV

---

## 2. Structure du Projet
- `src/screens/` : Tous les écrans de l'application :
  - `LoginScreen.tsx` : Authentification caissiers, employés et administrateurs / Boss
  - `LedgerScreen.tsx` : Caisse en direct, panier de vente manuelle, scan code-barres, acomptes/avances
  - `DashboardScreen.tsx` : Tableau de bord financier, statistiques, graphiques, journal d'audit
  - `InventoryScreen.tsx` : Gestion et suivi des stocks (La Falaise & Tougou), alertes rupture
  - `AdvancesScreen.tsx` : Suivi des acomptes, réservations clients et encaissements des soldes
  - `TransfersScreen.tsx` : Suivi des transferts inter-boutiques et livreurs en temps réel
  - `DailyReceiptScreen.tsx` : Récapitulatif journalier et recette de caisse
  - `PhysicalInventoryScreen.tsx` : Inventaire physique par scan
- `src/db/` :
  - `firebaseConfig.ts` : Configuration du projet Firebase
  - `database.ts` : point d'entrée unique (barrel) qui ré-exporte `src/db/services/*` (voir « Architecture des données »)
  - `services/` : fonctions CRUD temps réel, cache hors-ligne et règles métier, découpées par domaine
  - `resilientSync.ts` : souscriptions résilientes (REST + WebSocket)
- `src/utils/saleMath.ts` : règles de calcul partagées (total effectif d'une vente, avances, jour local d'une vente)
- `src/components/` : Modales, composants réutilisables, scanners et cartes produits
- `src/theme/` : Thème de luxe (doré & sombre), polices et constantes graphiques
- `website/` : Site web vitrine grand public (collections, showrooms, catalogue)
- `receipt.html` : Template du reçu officiel en direct pour les clients

---

## 3. Démarrage Rapide

### Prérequis
- [Node.js](https://nodejs.org/) (version 18, 20 ou 22 recommandée)
- `npm`

### Installation des dépendances
```bash
npm install
```

### Lancement de l'application
- **Mode Web (Navigateur)** :
  ```bash
  npm run web
  ```
  *(ou `npx expo start --web`)*

- **Mode Mobile (Expo Go sur iOS / Android)** :
  ```bash
  npm start
  ```

---

## 4. Point d'entrée de l'application : `App.tsx`
- `App.tsx` est l'**unique source** du code actif de l'application (routes, navigation, écrans).
- L'ancien fichier `App.active.tsx` (copie de sauvegarde identique) a été supprimé : ne plus le recréer, modifier directement `App.tsx`.

---

## Architecture des données (`src/db/services/`)
Tous les écrans importent depuis `src/db/database.ts`, qui ne contient plus que des `export * from './services/...'`.
Chaque service regroupe un domaine :

| Module | Contenu |
|---|---|
| `config.ts` | `RTDB_REST_URL` (URL REST de la base, dérivée de `firebaseConfig`) |
| `roles.ts` | `DEFAULT_USERS`, `isUserAdmin`, `isSuperBoss` (aucune dépendance interne) |
| `cache.ts` | cache mémoire + disque : `getFastCache`, `saveFastCache`, `getLocalCache`, `setLocalCache` (aucune dépendance interne) |
| `users.ts` | `initDB`, utilisateurs (ajout, modification, PIN, profil, suppression), journaux de sécurité |
| `audit.ts` | `logAudit`, `getAuditLogs` |
| `products.ts` | produits : lecture, création, modification, stock, arrivages, noms |
| `advances.ts` | acomptes : `getAdvanceStore`, `addAdvancePayment`, `completeAdvance`, `deleteAdvanceAndRestoreStock` |
| `sales.ts` | ventes : `recordSale`, `getDailySales`, `getSalesByDateRange`, `deleteSale`, `updateSalePaymentMethod`, `exchangeProduct` |
| `backdated.ts` | saisies antérieures (Super Boss) : `recordBackdatedSale`, `deleteBackdatedSale` et leurs types |
| `stores.ts` | emplacements des boutiques, distance et temps de trajet |
| `transfers.ts` | transferts inter-boutiques (envoi, demande, suivi, annulation, retour) |
| `inventory.ts` | `applyPhysicalInventory`, `getProductByBarcode` |

Règles :
- Les dépendances vont toujours vers `config`, `roles`, `cache`, `audit` (et `stores` pour `transfers`) : pas d'import circulaire.
- Une nouvelle fonction se place dans le service adéquat ; elle est ré-exportée automatiquement par `database.ts`.
- Le jour d'une vente se calcule en **heure locale** avec `localDayKey` / `isOnLocalDay` / `todayKey` (`src/utils/saleMath.ts`), jamais avec `date.slice(0, 10)` ou `toISOString().split('T')[0]` (jour UTC). Les dates restent **écrites** en ISO UTC (`toISOString()`).
- Le montant encaissé d'une vente se calcule avec `getEffectiveTotal` (avance initiale = montant versé).

---

## 5. Déploiement Vercel
Le projet est prêt à être déployé sur Vercel :
```bash
npm run vercel-build
# ou directement
npx expo export --platform web
npx vercel --prod
```

---

## 6. Mode TEST local (sans toucher la base de production)

Une base Firebase **locale** (émulateur) permet de tester toutes les fonctionnalités
sans écrire dans la vraie base des boutiques.

Prérequis : Java 11+ installé.

```bash
npm install --include=dev   # (si NODE_ENV=production est défini sur la machine)
npm run emulator            # terminal 1 — base locale sur 127.0.0.1:9000, UI sur http://127.0.0.1:4000
npm run seed:test           # terminal 2 — données fictives : 2 boutiques, 12 articles, 60 ventes, 1 acompte
npm run dev:test            # terminal 2 — app sur http://localhost:8081 branchée sur l'émulateur
```

- La console du navigateur affiche `[Capitol] Mode TEST — émulateur Firebase local`.
- Sans `EXPO_PUBLIC_USE_EMULATOR=1`, l'app fonctionne exactement comme avant (production).
- Les données de l'émulateur sont effacées à son arrêt : relancer `npm run seed:test`.

## 7. Rangement du dépôt
- `tools/` : scripts utilitaires ponctuels (`check_bundle.js`, `update_pins.js`, `photo-retouche/`).
- `docs/rapports/` : rapports PDF générés.
- `test-env/` : règles et données de l'environnement de test local.
