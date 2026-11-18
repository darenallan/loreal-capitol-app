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
  - `database.ts` : Fonctions CRUD temps réel, cache hors-ligne résilient et règles métier
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

## 4. Note Importante : `App.tsx` & `App.active.tsx`
- `App.active.tsx` contient l'intégralité du code actif de l'application (toutes les routes, la navigation et les écrans).
- Si `App.tsx` est en mode pause, il vous suffit de remplacer le contenu de `App.tsx` par celui de `App.active.tsx` (ou de copier `App.active.tsx` vers `App.tsx`) pour retrouver immédiatement l'application complète active.

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
