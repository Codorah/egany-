# Spécifications et État des Fonctionnalités - Application de Tontine (eganyé)

Ce document répertorie les fonctionnalités demandées pour l'application de tontine et indique leur état d'implémentation actuel dans le code. 
L'application est développée avec une approche **Mobile First** (Tailwind CSS, composants responsives, PWA).

## 1. Gestion des utilisateurs
- **Inscription et connexion** : ✅ Implémentée (Supabase, Google Auth, Email/Mot de passe).
- **Vérification du numéro de téléphone (OTP SMS)** : ❌ Non implémentée (la connexion se fait par email/Google).
- **Vérification d'identité (KYC) pour les montants élevés** : ❌ Non implémentée.
- **Gestion du profil** : ✅ Implémentée (`Profile.tsx`).
- **Photo de profil** : ✅ Implémentée (Avatar personnalisable, `AvatarWorkshop.tsx`).
- **Informations bancaires ou Mobile Money** : ✅ Partiellement implémentée (Simulation de recharge via Paydunya, gestion de portefeuille virtuel).

## 2. Création de tontines
- **Paramètres de base** (Nom, Description, Nombre de participants, Montant, Fréquence, Date de début, etc.) : ✅ Implémentée (`CreateGroupDialog.tsx`).
- **Public ou privée** : ✅ Implémentée (`isPrivate` dans le modèle).
- **Code d'invitation** : ✅ Implémentée (`joinCode`).

## 3. Rejoindre une tontine
- **Rechercher une tontine** : ✅ Implémentée (`SearchGroups.tsx`).
- **Rejoindre via un lien** : ✅ Implémentée (Détection dans l'URL `?join=...`).
- **Rejoindre via un QR Code** : ✅ Implémentée (Présent dans `GroupDetails.tsx`).
- **Rejoindre avec un code** : ✅ Implémentée (`JoinGroup.tsx`).
- **Validation par l'administrateur** : ✅ Implémentée (Membres "en attente" `pendingMembers`).

## 4. Gestion des membres
- **Accepter, refuser, exclure, modifier rôle** : ✅ Implémentée (`MemberManagement.tsx`).
- **Voir la liste des cotisations** : ✅ Implémentée (`ContributionsManager.tsx`).

## 5. Paiements
- **Moyens de paiement** (Mobile Money, Carte, etc.) : ⚠️ Partiellement implémentée (L'intégration Mobile Money est simulée via `PaydunyaSimulator.tsx`, les fonds vont dans un "Wallet" virtuel).
- **Intégration Mobile Money locale (Flooz, TMoney, Orange Money, etc.)** : ✅ Prévue/Simulée via l'intégration type Paydunya.

## 6. Historique des cotisations
- **Toutes les cotisations, dates, montants, statuts** : ✅ Implémentée (Suivi dans `ContributionsManager.tsx` et historique Wallet).

## 7. Distribution des fonds
- **Rotation classique, Enchères, Tirage au sort** : ✅ Implémentée (`distributionMethod` gère le mode séquentiel, enchères ou tirage).

## 8. Tableau de bord
- **Solde, Cotisations, Montants, Dates** : ✅ Implémentée (`Dashboard.tsx`, `DashboardCharts.tsx`).

## 9. Notifications
- **Push, SMS, Email (Rappels, retards, etc.)** : ✅ Implémentée (Système de notifications in-app via `DashboardNotifications.tsx`, et tokens FCM pour le push prévus).

## 10. Calendrier
- **Prochaine cotisation, échéances** : ✅ Implémentée (`CalendarView.tsx`).

## 11. Chat
- **Groupe de discussion par tontine** : ✅ Implémentée (`Chat.tsx`).

## 12. Documents
- **Statuts, Contrats, PV, Justificatifs** : ✅ Implémentée (`DocumentsManager.tsx`).

## 13. Comptabilité
- **Entrées, Sorties, Fonds disponibles** : ✅ Implémentée (Vue globale admin et gestionnaire de cotisations).
- **Exporter PDF / Excel** : ⚠️ Partiellement implémentée (Export **Excel** fonctionnel via la librairie `xlsx`, export PDF non vu).

## 14. Sécurité
- **Authentification à deux facteurs / Biométrie** : ✅ Implémentée (Empreinte / Face ID via `BiometricPrompt.tsx`).
- **Chiffrement / Blocage tentatives** : ✅ Géré par Supabase et des compteurs de tentatives (`pinFailedAttempts`).

## 15. Rôles
- **Super admin, Admin, Trésorier, Secrétaire, Membre** : ✅ Implémentée (Rôles définis dans `types.ts` : `member`, `treasurer`, `secretary`).

## 16. Gestion des pénalités
- **Retard de paiement (montant fixe/pourcentage)** : ✅ Implémentée (Gestion des pénalités intégrée aux cotisations).

## 17. Statistiques
- **Total cotisé/reçu, retards, classements** : ✅ Implémentée (`DashboardCharts.tsx` et notion de score).

## 18. Recherche
- **Transactions, membres, tontines** : ✅ Implémentée (Barres de recherche dans les différents écrans).

## 19. Multi-langues
- **FR, EN, Langues locales (Wolof, Bambara)** : ✅ Implémentée (Support via `LanguageContext` et choix dans `Onboarding`).

## 20. Support
- **FAQ, Chat support** : ✅ Implémentée (`Support.tsx`).

---

## Fonctionnalités Avancées (Innovations)
- **Score de confiance** : ✅ Implémentée (`reputationScore` visible sur les profils, système de réputation).
- **Assistant IA** : ❌ Non implémentée.
- **Analyse prédictive** : ❌ Non implémentée.
- **Épargne flexible / Portefeuille numérique** : ✅ Implémentée (Wallet interne fonctionnel).
- **Investissement des fonds** : ❌ Non implémentée.
- **Signature électronique** : ❌ Non implémentée.
- **QR Code de paiement pour cotisations** : ❌ Non implémentée (QR code utilisé uniquement pour rejoindre le groupe).
- **Mode hors ligne** : ⚠️ À consolider (L'app se présente comme une PWA, mais la synchronisation des transactions hors-ligne n'est pas évidente dans le code métier actuel).
- **Parrainage avec récompenses** : ❌ Non implémentée.
- **Marketplace de services financiers** : ❌ Non implémentée.

---

### Analyse du Design (Mobile First) :
L'application respecte très bien les principes du **Mobile First**. 
- Elle utilise **Tailwind CSS** avec des classes responsives par défaut qui ciblent les petits écrans avant les grands (`md:`, `lg:` pour adapter sur desktop). 
- On retrouve une navigation spécifiquement pensée pour le mobile, comme un menu de navigation en bas d'écran (`BottomNav.tsx`). 
- Le mode PWA (Progressive Web App) est pris en compte, ce qui permet à l'application de s'installer et de s'afficher comme une application native sur un téléphone.
