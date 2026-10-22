# Refonte de l'Onboarding & Visuels Réels — 22 octobre 2026

Ce document détaille l'ensemble des modifications effectuées sur le parcours d'accueil et d'inscription (`Onboarding`, `AvatarWorkshop`, `Landing`, `PHOTO-CREDITS`) afin d'éliminer les illustrations/dessins animés au profit de photographies réelles et de corriger les défauts d'ergonomie et de mise en page.

> **Note importante** : La vidéo en motion design (`video/promo.html`, `video/render.mjs`, `public/video/eganye-presentation.mp4`, `public/video/eganye-presentation.jpg`) ainsi que ses ressources sources dans `public/brand-visuals/` et `public/illustrations/` n'ont **pas** été modifiées ni supprimées.

---

## 1. Nouvelles photographies réelles ajoutées (`public/onboarding/`)

Les deux dernières diapositives de l'onboarding utilisaient auparavant des illustrations vectorielles plates (`/illustrations/money-received.svg` et `/illustrations/savings-created.svg`). Elles ont été remplacées par deux photographies réelles sous licence Unsplash, recadrées en format portrait `1080×1620` et compressées en WebP :

| Fichier | Usage | Sujet photographié | Crédit |
|---|---|---|---|
| `public/onboarding/aid-shopkeeper.webp` | Diapo 4 (*Un coup de pouce pour votre activité*), écran d'intention & page `Landing` | Commerçante souriante accoudée au comptoir de sa boutique bien achalandée, téléphone posé devant elle | Ali Mkumbwa — Unsplash (`EOkN2pRjFsg`) |
| `public/onboarding/credit-merchant.webp` | Diapo 5 (*Un microcrédit simple et transparent*), écran d'intention & page `Landing` | Commerçant de fruits souriant devant son étal garni (ananas, bananes, agrumes), téléphone en main | Ali Mkumbwa — Unsplash (`WUG0QcXVh0k`) |

### Fichiers de scripts et crédits mis à jour
- **`scripts/fetch-onboarding-photos.mjs`** : Ajout des entrées `aid-shopkeeper` (`EOkN2pRjFsg`) et `credit-merchant` (`WUG0QcXVh0k`) pour régénérer les 5 photos d'accueil de manière reproductible.
- **`public/PHOTO-CREDITS.md`** : Ajout des crédits officiels pour `aid-shopkeeper.webp` et `credit-merchant.webp`.

---

## 2. Refonte du composant `src/components/Onboarding.tsx`

### A. Suppression des mascottes 3D (« dessin animé ») et correction de `AuthLayout`
- **Avant** : `AuthLayout` affichait un personnage 3D (`<BrandVisual name="welcome" />` et `<BrandVisual name="signup" />`) à gauche du titre, ce qui forçait le titre (`h1`) et le sous-titre en alignement à droite (`text-right`). Sur les écrans sans mascotte (`forgot`, `otp`, `reset`) ou sur les petits téléphones (`< 380px`), le titre restait collé à droite face à un espace vide. De plus, le bandeau supérieur de `300px` repoussait les champs sous le clavier mobile.
- **Après** :
  - Suppression complète de `BrandVisual` sur les écrans d'authentification.
  - Alignement naturel à gauche (`text-left`) du titre et de la description sur tous les écrans (`login`, `register`, `forgot`, `otp-signup`, `otp-recovery`, `reset`).
  - Bandeau supérieur compacté (`168px` / `192px`) avec un discret filigrane photographique réel (`/onboarding/vendor.webp` en `mix-blend-luminosity`), le bouton retour à gauche et la capsule de marque `EganyeLogo` + `eganyé` centrée.

### B. Épuration des champs de saisie (`PillField`) et du code OTP (`OtpBoxes`)
- **Champs `PillField`** : Remplacement des grosses pastilles rondes `gradient-sunset` (`48×48px`) empilées sur chaque champ par une icône sobre sur fond teinté doux (`bg-primary/12 text-primary`, `rounded-xl`) dans un champ `h-14 rounded-2xl border border-border bg-card shadow-soft`.
- **Grille `OtpBoxes` (8 chiffres)** : Passage de `grid-cols-4` (2 lignes de 4 grosses boîtes qui coupaient le code en deux) à `grid-cols-8` sur une seule ligne adaptative (`gap-1.5 sm:gap-2 max-w-[380px]`).
- **Renvoi du code OTP** : Activation du bouton *« Renvoyer le code »* également sur l'écran de récupération de mot de passe (`otp-recovery` via `sendPasswordResetCode(email)`), alors qu'il n'était auparavant disponible qu'à l'inscription.

### C. Carrousel des 5 diapositives (`screen === 'slides'`)
- **100 % photographies réelles** : Les 5 diapositives utilisent désormais exclusivement des photos plein écran (`mamas.webp`, `young-savers.webp`, `vendor.webp`, `aid-shopkeeper.webp`, `credit-merchant.webp`) accompagnées d'un badge thématique (*Tontine & Solidarité*, *Épargne Flexible*, *Flooz & Mixx*, *Coup de pouce · 0 % à rembourser*, *Microcrédit · 3 à 24 mois*) et d'un compteur `1/5`.
- **Cadre téléphone sur ordinateur** : Sur grand écran (`md:`), le carrousel est encadré dans un format mobile centré (`md:max-w-[440px] md:h-[820px] md:rounded-[2.25rem]`) au lieu d'étirer des photos portrait sur un écran 16:9.
- **Navigation tactile (Swipe)** : Ajout du glissement horizontal (`drag="x"`) avec `motion` pour passer d'une diapo à l'autre au doigt sur téléphone.

### D. Écran de bienvenue (`screen === 'welcome'`) et écran d'intention (`screen === 'intent'`)
- **`welcome`** : Remplacement du disque isolé `/brand-visuals/coin-textile.webp` par une carte photographique éditoriale mettant en scène `/onboarding/vendor.webp` ainsi que les médaillons réels (`aid-shopkeeper.webp`, `young-savers.webp`, `credit-merchant.webp`) et l'en-tête officiel `EganyeLogo`.
- **`intent`** : Ajout des vignettes photographiques réelles sur les cartes *Demander un coup de pouce* et *Faire un crédit*, et cohérence du flux lorsque l'utilisateur clique sur *« Pas encore de compte ? Créez-en un »* depuis l'écran de connexion (redirection vers `intent` si aucune intention n'a encore été choisie).

### E. Import d'une vraie photo de profil dès l'inscription (`finalizeAccountSetup` & `AvatarWorkshop`)
- Activation de `allowPhotoUpload={true}` sur l'étape `avatar` de l'onboarding.
- Dans `finalizeAccountSetup(userId)`, prise en charge automatique de l'envoi vers Supabase Storage (`avatars/${userId}/...`) si l'utilisateur a choisi une vraie photo locale (`data:image/...`) avant la création de sa session.

---

## 3. Mise à jour de `src/components/AvatarWorkshop.tsx`
- Mise en avant de l'import d'une **vraie photo de profil** en premier (bouton principal *Importer une photo* + badge caméra cliquable directement sur l'aperçu de l'avatar), et placement de la grille d'emojis en option secondaire en dessous.

---

## 4. Mise à jour de `src/components/Landing.tsx` (sans toucher à la vidéo)
- Remplacement de l'illustration vectorielle `/illustrations/money-received.svg` dans la carte Bento par un filigrane photographique réel (`/onboarding/mamas.webp`).
- Ajout des photographies réelles `/onboarding/aid-shopkeeper.webp` et `/onboarding/credit-merchant.webp` en en-tête des cartes **Coup de pouce** et **Microcrédit** de la section `#argent`.
- La section `#video` (`/video/eganye-presentation.mp4`) est restée **strictement intacte**.

