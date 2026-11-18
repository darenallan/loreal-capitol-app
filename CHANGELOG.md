# Journal des changements — L'Oréal Capitol

Référence de départ : commit `b1608b8` (ton code original, tel que reçu).
Chaque phase est un commit séparé : tu peux comparer ou revenir en arrière phase par phase avec `git log` / `git diff`.

Ce qui n'a PAS changé : les fonctionnalités existantes des deux boutiques (caisse, stock, avances, transferts, recette du jour, arrivages, inventaire), les codes d'accès, la structure de la base Firebase, et le thème noir & or.

---

## P0 — Remise en route & environnement de test
- `App.tsx` affichait un écran noir (version « en pause ») : l'application active est restaurée.
- **Mode test local** : `npm run emulator` + `npm run seed:test` + `npm run dev:test`. L'app tourne sur `http://localhost:8081` contre une base Firebase **locale** remplie de données fictives. La base de production n'est jamais touchée (voir README §6).
- Rangement de la racine : scripts dans `tools/`, rapports PDF dans `docs/rapports/`, reçus clients dans `archive/prive/` (exclu de Git : données personnelles).

## P1 — Écran Boss « Historique & Saisie antérieure » (demande principale)
Accès **Boss uniquement** (menu Direction & Contrôle + tuile du tableau de bord). Les autres comptes ne voient ni le menu ni la tuile.
- **Consulter** : n'importe quel jour ou mois passé, par boutique ou les deux, avec le détail des ventes et la répartition par moyen de paiement. Export CSV.
- **Saisir** une recette passée, de deux façons :
  - *recette globale* : un montant total du jour par moyen de paiement (quand on n'a plus le détail) ;
  - *vente détaillée* : articles choisis dans le catalogue, client, vendeuse, moyen de paiement.
- Option « impacter le stock » (désactivée par défaut, puisqu'en général le stock a déjà été corrigé à l'époque).
- Une saisie antérieure peut être supprimée ; le stock retiré est remis exactement. Seules les saisies antérieures sont supprimables depuis cet écran, jamais une vraie vente de caisse.
- Chaque saisie est marquée (`backdated`, `entered_by`, `entered_at`) et tracée dans le journal de sécurité.
- Les ventes saisies apparaissent normalement dans le tableau de bord du jour concerné.

## P2 — Restructuration du code (sans changement de fonctionnement)
- `src/db/database.ts` (gros fichier unique) découpé en modules dans `src/db/services/` ; `database.ts` les ré-exporte tous, donc **aucun import existant n'a changé**.
- `DashboardScreen` (3 500 lignes → ~1 400) et `LedgerScreen` (2 800 → ~900) découpés en composants dans `src/components/dashboard/` et `src/components/ledger/`.
- Code mort supprimé (une fenêtre qui appelait une fonction inexistante, des imports inutilisés). TypeScript : 3 erreurs → 0.
- **Correctif** : le jour d'une vente était calculé en heure UTC. Au Cameroun (UTC+1), une vente faite entre minuit et 1h du matin était comptée la veille. Le jour est maintenant calculé en heure locale (`src/utils/saleMath.ts`).

## P3 — Affichage
- Couleurs centralisées dans le thème (763 couleurs codées en dur remplacées par les jetons du thème noir & or — même rendu, plus facile à maintenir).
- Contrastes améliorés, aucun texte sous 12 px, zones tactiles d'au moins 44 px, libellés d'accessibilité sur les boutons-icônes.
- En-têtes d'écran harmonisés.

## P4 — Nouvelles fonctionnalités pour les boutiques
- **Clôture de caisse** (tous les comptes, sur leur boutique) : fond de caisse, comptage des espèces billet par billet, MoMo / OM / carte, sorties de caisse, calcul de l'écart avec ce que l'app a enregistré. Alerte au-delà de 1 000 F d'écart. Récap partageable sur WhatsApp. Le Boss voit les deux boutiques, peut rouvrir une clôture, et consulte l'historique sur 30 jours.
- **Performance & Stock** (Boss uniquement) : comparaison Falaise / Tougou avec la période précédente, classement des vendeuses, meilleurs articles, stock bas (seuil réglable), articles qui ne se vendent plus, ruptures. Export CSV.
- **Fichier clients** : une fiche par client (regroupée par numéro de téléphone) avec historique d'achats et acomptes. Vue « Relances » des acomptes en retard avec boutons WhatsApp et Appel. Les vendeuses ne voient que les clients de leur boutique.
- Affichage téléphone : le « Bonjour, … » n'est plus tronqué ; le bouton de l'assistant ne cache plus le bas du tableau de bord.

## P6 — Revue & sécurité
Correctifs issus de la revue de code :
- Supprimer une **saisie antérieure** depuis le tableau de bord remettait en stock toute la quantité, même si la saisie n'avait jamais touché au stock (stock gonflé). Désormais seul le stock réellement retiré est restitué. Vérifié : stock inchangé (10 → 10) pour une saisie sans impact, et une vente normale est toujours remise en stock (7 → 8).
- Supprimer deux fois la même saisie antérieure (deux appareils) pouvait restituer le stock deux fois : refusé maintenant si la vente n'existe plus.
- Saisie antérieure sur réseau lent : un nouvel essai après « non confirmé » ne crée plus de doublon (clé d'idempotence).
- Clôture de caisse : un don « Ami / Don » avec montant empêchait l'enregistrement (le « / » est interdit dans une clé Firebase).
- Performance & Stock lit maintenant le stock frais du serveur (et non le cache du téléphone).

Sécurité :
- Reçu en ligne (`receipt.html`) : le nom des articles et le téléphone, venant du lien, sont maintenant échappés (une faille permettait d'exécuter du code via un lien de reçu piégé).
- Exports CSV : une cellule commençant par `=`, `+`, `-` ou `@` est neutralisée (évite qu'un nom de client piégé devienne une formule Excel).
- `tools/update_pins.js` (écrit en production et écrase tous les utilisateurs) refuse désormais de tourner sans `CONFIRM_PROD=oui`.
- Le script de remplissage de test refuse toute adresse qui n'est pas strictement locale.

---

## À faire de ton côté (important)
1. **Changer la clé Groq** de l'assistant IA (`src/components/AIAssistantModal.tsx`) : elle est écrite dans le code, donc visible par toute personne qui a le code ou ouvre l'app dans un navigateur. Crée une nouvelle clé sur console.groq.com et supprime l'ancienne.
2. **Phase 5 sécurité (prévue plus tard)** : aujourd'hui la base de production est ouverte en lecture/écriture à quiconque connaît son adresse, et les codes sont stockés en clair. La phase 5 prévoit : vraie connexion Firebase Auth, codes chiffrés, règles de la base par rôle et par boutique, clé IA côté serveur.
3. `npm audit` signale des dépendances à mettre à jour (surtout des outils de développement Expo, et `firebase` 9). À faire avec un re-test complet, car c'est une montée de version majeure.

## Questions ouvertes
- **Dimanches** : la vue Semaine et Mois du tableau de bord ignore les ventes du dimanche (comportement d'origine, conservé). Est-ce voulu ?
- **Acomptes dans la clôture** : le tableau de bord range un premier versement d'acompte sous « Avance » ; la clôture de caisse le compte dans son vrai moyen de paiement (espèces, MoMo…), sinon chaque acompte en espèces créerait un faux écart de caisse. Le total du jour est identique ; seule la répartition diffère.
