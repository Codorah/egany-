# Dossier Google Play — eganyé (CODORAH)

Préparé le 21 octobre 2026, à partir du code de l'application et des règles Google Play lues le même jour.
Toutes les réponses ci-dessous décrivent **ce que l'application fait réellement**. Si une fonction change, ce dossier doit changer aussi.

---

## 1. Les adresses à donner à Google

| Champ Play Console | Adresse |
|---|---|
| Politique de confidentialité | https://eganye.codorah.com/confidentialite |
| Suppression du compte (lien web) | https://eganye.codorah.com/suppression-compte |
| Conditions d'utilisation | https://eganye.codorah.com/conditions |
| Règlement des cercles | https://eganye.codorah.com/reglement |
| Conditions du microcrédit | https://eganye.codorah.com/conditions-credit |
| Conditions du Coup de pouce | https://eganye.codorah.com/conditions-coup-de-pouce |
| Mentions légales | https://eganye.codorah.com/mentions-legales |
| Site web du développeur | https://eganye.codorah.com |
| E-mail du développeur | codorah@hotmail.com (une adresse @codorah.com serait mieux) |

Avant d'envoyer : ouvrir chaque lien dans un navigateur et vérifier que la page s'affiche (Google refuse une page qui ne charge pas).

---

## 2. Le compte développeur

- **Type de compte : Organisation**, au nom de CODORAH (Google l'exige pour une application financière exploitée par une entreprise).
- **D‑U‑N‑S** : demander d'abord le numéro gratuitement à Dun & Bradstreet. Si le Togo n'est pas proposé ou si la demande échoue, **contacter l'assistance Google AVANT de créer le compte** (Google le précise) pour obtenir la vérification alternative. Message prêt à envoyer en section 8.
- Ne pas passer par un compte personnel pour contourner la vérification.

---

## 3. Le microcrédit : garder ou couper au lancement ?

### Ce que dit Google (vérifié)

| Règle Google pour les prêts personnels | eganyé |
|---|---|
| Licence obligatoire seulement dans 8 pays : États-Unis, Inde, Indonésie, Philippines, Nigeria, Kenya, Pakistan, Thaïlande | ✅ Le Togo n'en fait pas partie |
| Remboursement en 60 jours ou moins interdit | ✅ 3 à 24 mois |
| Afficher dans la fiche : durée min/max, taux annuel maximum, exemple de coût total | ⚠️ À écrire dans la fiche (texte prêt en section 5) |
| Catégorie de l'app : Finance | ⚠️ À choisir |
| Permissions interdites (contacts, photos, localisation, stockage…) | ✅ L'app ne demande que INTERNET |
| Google peut demander une licence « à tout moment » | ⚠️ Risque |

**Côté Google, le microcrédit peut passer.**

### Ce qui reste risqué

Au Togo, prêter de l'argent avec intérêt est en principe réservé aux banques et aux institutions de microfinance agréées. C'est le point où CODORAH est la plus exposée, bien plus que le portefeuille. Si Google demande un justificatif, il n'y en a pas.

### Les deux choix possibles

- **A. Couper le microcrédit au lancement (recommandé).** Pas besoin de toucher au code : dans l'admin, désactiver les services de crédit de la marketplace (ils sont filtrés par `is_active`). On garde le **Coup de pouce**, qui aide les gens sans être un prêt. On ne coche pas les prêts dans la déclaration. On le rallume plus tard avec une institution de microfinance partenaire qui prête son propre argent.
- **B. Le garder.** Cocher « Personal loan direct lender », mettre l'app en catégorie Finance, ajouter les mentions de la section 5 à la fiche, et accepter le risque d'une demande de licence par Google ou d'un problème avec les autorités togolaises.

**La décision t'appartient.** Le reste du dossier indique ce qui change selon A ou B.

---

## 4. Déclaration des fonctionnalités financières (Play Console → Contenu de l'application)

Cocher :

| Catégorie Google | Pourquoi |
|---|---|
| **Payments and transfers → Mobile payments and digital wallets** | Portefeuille en FCFA : dépôts Mobile Money via PayDunya, solde, retraits |
| **Trading and funds → Crowdfunding and chit funds** | Les cercles de tontine (« chit funds » est le nom anglais des tontines) |
| **Banking and loans → Personal loan direct lender** | **Seulement si choix B** (le prêt sort d'un fonds géré par CODORAH) |

Ne pas cocher « Money transfer and wire services » : l'app ne propose pas d'envoi d'argent libre d'une personne à une autre en dehors des cercles.

Pays ciblé : **Togo** uniquement au lancement. Ajouter d'autres pays seulement après avoir vérifié leurs règles.

---

## 5. Fiche Play Store

**Catégorie** : Finance.

**Description courte** (80 caractères max) :
> Vos tontines en ligne : cotisez, suivez vos tours et épargnez en Mobile Money.

**Description longue** (base à adapter) :
> eganyé simplifie les tontines. Créez un cercle ou rejoignez celui de vos proches, fixez le montant et la fréquence des cotisations, et suivez qui a payé et qui reçoit le pot à chaque tour.
>
> • Cercles en rotation, par tirage au sort ou aux enchères
> • Rappels avant chaque échéance
> • Portefeuille en FCFA : rechargez et retirez par Mobile Money (Mixx, Moov Flooz)
> • Épargne bloquée pour vos projets
> • Coup de pouce : une aide offerte pour soutenir votre activité
>
> eganyé est édité par CODORAH, entreprise individuelle immatriculée au Togo (RCCM TG-LFW-01-2026-A10-02627). Les dépôts Mobile Money sont encaissés par notre prestataire de paiement PayDunya. eganyé n'est pas une banque et ne verse pas d'intérêts.

**À ajouter seulement si choix B (microcrédit gardé)** :
> Microcrédit : de 3 à 24 mois. Taux annuel maximum : 36 % (intérêt simple, aucun autre frais). Exemple : pour 50 000 FCFA empruntés sur 6 mois à un taux de 10 % sur la durée (20 % par an), vous remboursez 55 000 FCFA au total, soit environ 9 166 FCFA par mois.

---

## 6. Formulaire « Sécurité des données » (Data safety)

### Questions générales

| Question | Réponse |
|---|---|
| L'app collecte-t-elle des données ? | Oui |
| Les données sont-elles chiffrées en transit ? | Oui (HTTPS) |
| Les utilisateurs peuvent-ils demander la suppression ? | Oui — lien : https://eganye.codorah.com/suppression-compte |
| Données partagées avec des tiers ? | **Non**. Google ne compte pas comme « partage » l'envoi à des prestataires qui travaillent pour vous (PayDunya, Supabase, Twilio…) ni aux autorités quand la loi l'exige. |

### Données collectées

Pour chaque ligne : **collectée**, **non partagée**, **obligatoire** sauf mention contraire, **traitée de façon non éphémère**.

| Catégorie Google | Type | Pourquoi (choix Google) |
|---|---|---|
| Informations personnelles | Nom | Fonctionnement de l'app, Gestion du compte, Prévention des fraudes |
| Informations personnelles | Adresse e-mail | Gestion du compte, Communications du développeur |
| Informations personnelles | Numéro de téléphone | Fonctionnement de l'app, Communications du développeur |
| Informations personnelles | Autres informations (date de naissance, pièce d'identité, personne de confiance) | Prévention des fraudes, sécurité et conformité |
| Informations financières | Autres informations financières (solde, dépôts, retraits, cotisations, demandes de crédit et d'aide) | Fonctionnement de l'app, Prévention des fraudes |
| Messages | Autres messages dans l'app (discussions de cercle, Centre d'aide) | Fonctionnement de l'app |
| Photos et vidéos | Photos (pièce d'identité, avatar : facultatif) | Prévention des fraudes, Personnalisation |
| Photos et vidéos | Vidéos (Coup de pouce : facultatif) | Fonctionnement de l'app |
| Activité dans l'app | Autres actions (cercles rejoints, tours, retards) | Fonctionnement de l'app |
| Identifiants de l'appareil ou autres | Adresse IP, type d'appareil | Prévention des fraudes, sécurité et conformité |

**Pas collecté** : position, contacts, agenda, santé, historique web, fichiers audio, numéro de carte bancaire.

Ces réponses doivent rester identiques à la politique de confidentialité. Si on ajoute un outil (statistiques, publicité, nouveau prestataire), il faut mettre à jour les deux.

---

## 7. Autres rubriques « Contenu de l'application »

| Rubrique | Réponse |
|---|---|
| Accès à l'application | L'app demande un compte : fournir à Google un **compte de test** (e-mail + mot de passe + code PIN) avec un petit solde, et expliquer que la vérification d'identité est déjà validée sur ce compte |
| Publicités | Non, l'app ne contient pas de publicité |
| Classification du contenu | Questionnaire : catégorie « Utilitaire / Productivité / Communication » ; pas de violence ni de jeu d'argent. Coup de pouce : ce n'est pas une loterie (pas de hasard, étude par une personne) |
| Public cible | 18 ans et plus |
| Application d'actualités | Non |
| Applications gouvernementales | Non |

---

## 8. Messages prêts à envoyer

### À l'assistance Google Play (vérification sans D‑U‑N‑S)

> Objet : Organization verification without a D‑U‑N‑S number — Togo
>
> Hello,
>
> I am the owner of CODORAH, a sole proprietorship registered in Lomé, Togo (RCCM TG-LFW-01-2026-A10-02627, NIF 1002121599). I want to create an Organization developer account to publish our app "eganyé" (com.codorah.eganye), a tontine (chit fund) management app for users in Togo.
>
> I could not obtain a D‑U‑N‑S number for my organization in Togo. As described in your Help Center, I am contacting support before creating the account to request an alternative way to verify my organization. I can provide our official business registration card (Carte unique de création d'entreprise, CFE Togo, issued on 15 April 2026) and any other document you need.
>
> Thank you,
> ATANA Essodom Elodie H. — CODORAH
> codorah@hotmail.com — https://eganye.codorah.com

(Remplacer « I could not obtain » par ce qui s'est vraiment passé : le Togo n'est pas proposé, la demande a été refusée, ou pas de réponse après 30 jours.)

### À PayDunya (à garder pour le dossier)

> Bonjour,
>
> CODORAH (RCCM TG-LFW-01-2026-A10-02627) utilise votre API de paiement pour l'application eganyé, une application de tontine au Togo. Pourriez-vous nous confirmer par écrit :
> 1. l'entité PayDunya avec laquelle nous sommes sous contrat pour le Togo, et l'agrément sous lequel elle encaisse les paiements ;
> 2. que notre contrat couvre l'encaissement de recharges de portefeuille et de cotisations de tontine ;
> 3. si vous proposez une API de décaissement vers Mobile Money au Togo (Mixx, Moov Flooz) ;
> 4. si vous pouvez ouvrir des comptes au nom de chaque utilisateur, plutôt que de tout encaisser sur notre compte marchand.
>
> Merci.

---

## 9. Avant d'appuyer sur « Envoyer pour examen »

- [ ] Choix A ou B fait pour le microcrédit, et l'app, la déclaration et la fiche disent la même chose
- [ ] Les 7 liens de la section 1 s'ouvrent
- [ ] Compte de test prêt pour Google
- [ ] Déclaration financière remplie
- [ ] Formulaire Sécurité des données rempli
- [ ] Commencer par un **test fermé** avec quelques testeurs (obligatoire seulement pour les comptes personnels, mais utile pour voir la réaction de Google sans risque)
- [ ] Garder ce dossier et les réponses de Google : en cas de refus, Google indique la règle précise, et on corrige à partir de là
