import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type LanguageCode = 'fr' | 'en' | 'ee' | 'kbp';

export interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  t: (key: string) => string;
}

const translations: Record<string, Record<LanguageCode, string>> = {
  // Navigation / App Layout
  app_name: {
    fr: 'égané',
    en: 'égané',
    ee: 'égané',
    kbp: 'égané'
  },
  dashboard: {
    fr: 'Tableau de bord',
    en: 'Dashboard',
    ee: 'Nuxaxlẽdzesi',
    kbp: 'Kɩɖɛzaɣ ñɩnɖɛ'
  },
  profile: {
    fr: 'Mon Profil',
    en: 'My Profile',
    ee: 'Nye Ŋkɔmeɖeɖe',
    kbp: 'Man ma-ɖɔkɔtɔ'
  },
  create_group: {
    fr: 'Créer une Tontine',
    en: 'Create a Tontine',
    ee: 'Wɔ Tontine',
    kbp: 'Ma tontine'
  },
  join_group: {
    fr: 'Rejoindre un Cercle',
    en: 'Join a Circle',
    ee: 'Ge Ɖe Ha me',
    kbp: 'Kpɛndɩ nɖɩɛ taa'
  },
  admin_panel: {
    fr: 'Administration',
    en: 'Administration',
    ee: 'Dziɖuɖu',
    kbp: 'Ñʋʋdʋ'
  },
  calendar: {
    fr: 'Calendrier',
    en: 'Calendar',
    ee: 'Ŋkeke Xexlẽme',
    kbp: 'Kɩyakʋ kalɩyʋ'
  },
  search_circles: {
    fr: 'Rechercher un cercle',
    en: 'Search for a circle',
    ee: 'Di Ha aɖe',
    kbp: 'Pɔzɩ nɖɩɛ nakɛyɛ'
  },
  marketplace: {
    fr: 'Services Annexes',
    en: 'Ancillary Services',
    ee: 'Subɔsubɔdɔ Bubuwo',
    kbp: 'Lɩmaɣza lɛɛka'
  },
  ai_assistant: {
    fr: 'Copilote IA',
    en: 'AI Copilot',
    ee: 'AI Kpeɖeŋutɔ',
    kbp: 'AI sɩnɩyʋ'
  },
  support: {
    fr: 'Support',
    en: 'Support',
    ee: 'Kpekpeɖeŋu',
    kbp: 'Sɩnʋʋ'
  },
  logout: {
    fr: 'Se déconnecter',
    en: 'Sign Out',
    ee: 'Do Le Me',
    kbp: 'Lɩɩ'
  },

  // Dashboard & Wallet
  welcome: {
    fr: 'Bienvenue',
    en: 'Welcome',
    ee: 'Woezɔ',
    kbp: 'Ð6w6zɔɔtʋ'
  },
  my_wallet: {
    fr: 'Mon Portefeuille',
    en: 'My Wallet',
    ee: 'Nye Gaxɔ',
    kbp: 'Man liidiye kpou'
  },
  balance: {
    fr: 'Solde',
    en: 'Balance',
    ee: 'Ga si susɔ',
    kbp: 'Liidiye ɖɩŋ'
  },
  recharge: {
    fr: 'Recharger',
    en: 'Recharge',
    ee: 'Trɔ De Ga',
    kbp: 'Sɔnzɩ liidiye'
  },
  withdraw: {
    fr: 'Retirer',
    en: 'Withdraw',
    ee: 'Ɖe Ga Le Eme',
    kbp: 'Kpeɣ liidiye'
  },
  reputation_score: {
    fr: 'Score de Réputation',
    en: 'Reputation Score',
    ee: 'Ŋkɔ Nyui Xexlẽme',
    kbp: 'Ñɩm hɩɖɛ kɩlaʋ'
  },
  score_formula: {
    fr: 'Formule du Score',
    en: 'Score Formula',
    ee: 'Xexlẽme Ɖoɖo',
    kbp: 'Kɩlaʋ tɔm'
  },
  calculated_realtime: {
    fr: 'Calculé en temps réel',
    en: 'Calculated in real-time',
    ee: 'Wobu le ɣeyiɣi ma nu',
    kbp: 'Palakɩ-ɩ lɛɛlɛɛyɔ'
  },

  // Alerts & Notifications Center
  alerts_activities: {
    fr: "Centre d'Alertes & Activités",
    en: 'Alerts & Activities Center',
    ee: 'Nyaɖeɖe kple Dɔwɔwɔwo Xɔxɔnu',
    kbp: 'Lakasɩ nɛ tɔm susuu ñɩnɖɛ'
  },
  active_circles: {
    fr: 'Mes Cercles Actifs',
    en: 'My Active Circles',
    ee: 'Nye Habɔbɔ siwo le dɔwɔm',
    kbp: 'Man tontinaa wena awɛ ñʋʋ taa'
  },
  all: {
    fr: 'Tous',
    en: 'All',
    ee: 'Katãwo',
    kbp: 'Kpeekpe'
  },
  late_alerts: {
    fr: 'Alertes Retard',
    en: 'Late Alerts',
    ee: 'Nyaɖeɖe Tsitsitɔ',
    kbp: 'Kɩgbɛdɩŋ tɔm susuu'
  },
  contributions: {
    fr: 'Versements',
    en: 'Contributions',
    ee: 'Gaxexlẽ Dede',
    kbp: 'Liidiye haʋ'
  },
  no_alert_found: {
    fr: 'Aucune alerte trouvée',
    en: 'No alerts found',
    ee: 'Nyaɖeɖe aɖeke meli o',
    kbp: 'Tɔm susuu naɖɩyɛ fɛyɩ'
  },
  no_alert_desc_late: {
    fr: "Aucun retard de paiement n'est signalé sur vos cercles d'épargne actifs.",
    en: 'No late payments reported on your active savings circles.',
    ee: 'Fexexlẽ tsitsi aɖeke meva le wò habɔbɔ siwo le dɔwɔm la me o.',
    kbp: 'Fenaɣ ñɔɔzʋʋ kɩgbɛdɩŋ naɖɩyɛ fɛyɩ ñɛ-tontinaa wena awɛ ñʋʋ taa yɔ, a-taa.'
  },
  no_alert_desc_payout: {
    fr: "Aucun encaissement ou payout n'a encore été enregistré.",
    en: 'No cash-outs or payouts have been recorded yet.',
    ee: 'Ga xɔxɔ alo mavomavo aɖeke woŋlɔ da ɖi haɖe o.',
    kbp: 'Liidiye mʋʋ yaa nɩɩnʋʋ naɖɩyɛ pataɣ ñɔɔzɩ fɛyɩ nɛ paɣzɩ.'
  },
  no_alert_desc_all: {
    fr: "Votre historique d'alertes est vierge pour le moment.",
    en: 'Your alert history is empty at the moment.',
    ee: 'Wò nyaɖeɖewo ƒe ŋutinya le ƒuƒlu fifia.',
    kbp: 'Ñɛ-tɔm susuu tɩŋa fɛyɩ lɛɛlɛɛyɔ.'
  },
  settle_my_contribution: {
    fr: 'Régler ma cotisation',
    en: 'Settle my contribution',
    ee: 'Xe nye gaxexlẽ',
    kbp: 'Fɛ man liidiye haʋ'
  },
  view_details: {
    fr: 'Voir le détail',
    en: 'View detail',
    ee: 'Kpɔ nyawo',
    kbp: 'Cɔnɩ tɔm ndʋ'
  },
  read: {
    fr: 'Lu',
    en: 'Read',
    ee: 'Xlẽ',
    kbp: 'Kalɩ'
  },
  dismiss: {
    fr: 'Supprimer',
    en: 'Dismiss',
    ee: 'Tutu',
    kbp: 'Ɖɩzɩ'
  },

  // Onboarding & Language Selector Settings
  onboarding_title: {
    fr: 'Bienvenue sur égané',
    en: 'Welcome to égané',
    ee: 'Woezɔ le égané',
    kbp: 'Ð6w6zɔɔtʋ egané taa'
  },
  onboarding_subtitle: {
    fr: 'La tontine africaine moderne sécurisée par la réputation.',
    en: 'Modern African tontine secured by reputation.',
    ee: 'Afrika tontine yeye si ŋkɔ nyuiwo léa be nɛ.',
    kbp: 'Afrika tontine kɩfam ŋgʋ ñɩm hɩɖɛ ɖɔŋ nɛ.'
  },
  onboarding_step_lang: {
    fr: 'Étape 1 : Choisissez votre langue',
    en: 'Step 1: Choose your language',
    ee: 'Afɔɖeɖe 1: Tia wò gbe',
    kbp: 'Ðoŋ 1: Lɩzɩ ño-kʋnʋŋ'
  },
  next_step: {
    fr: 'Continuer',
    en: 'Continue',
    ee: 'Yi Edzi',
    kbp: 'Ðɔ nɛ pɩ-yɔɔ'
  },
  app_language: {
    fr: "Langue de l'app",
    en: 'App Language',
    ee: 'App ƒe Gbe',
    kbp: 'App kʋnʋŋ'
  },
  visual_theme: {
    fr: 'Thème Visuel',
    en: 'Visual Theme',
    ee: 'Nukpɔɖeɖe Ɖoɖo',
    kbp: 'Cɔnɩyʋ tɔm'
  },
  light_mode: {
    fr: 'Clair',
    en: 'Light',
    ee: 'Kekeli',
    kbp: 'Kɩjɛjɛ'
  },
  dark_mode: {
    fr: 'Sombre',
    en: 'Dark',
    ee: 'Viviti',
    kbp: 'Cɩkpɛndʋʋ'
  },
  save_preferences: {
    fr: 'Enregistrer les préférences',
    en: 'Save preferences',
    ee: 'Dzra Lɔlɔ̃nuwo Ɖo',
    kbp: 'Ñɔɔzɩ sɔɔlɩm'
  },
  profile_information: {
    fr: 'Informations du Profil',
    en: 'Profile Information',
    ee: 'Ŋkɔmeɖeɖe ƒe Nyatakakawo',
    kbp: 'Ma-ɖɔkɔtɔ tɔm'
  },
  display_preferences: {
    fr: "Préférences d'Affichage",
    en: 'Display Preferences',
    ee: 'Ale si Wòdona Ɖeɖe',
    kbp: 'Lɩzʋʋ ɖoŋ'
  },
  full_name: {
    fr: 'Nom complet',
    en: 'Full Name',
    ee: 'Ŋkɔ Blibo',
    kbp: 'Hɩɖɛ tɩŋa'
  },
  edit_profile: {
    fr: 'Modifier le profil',
    en: 'Edit Profile',
    ee: 'Trɔ Ŋkɔmeɖeɖe',
    kbp: 'Yekiɣ ma-ɖɔkɔtɔ'
  },
  cancel: {
    fr: 'Annuler',
    en: 'Cancel',
    ee: 'Tsi Enu',
    kbp: 'Cɛlɩ'
  },
  save: {
    fr: 'Sauvegarder',
    en: 'Save',
    ee: 'Dzra Ɖo',
    kbp: 'Ñɔɔzɩ'
  },

  // Score Reputation Details
  reputation_tip_s: {
    fr: 'Félicitations ! Votre score exemplaire (Tier S) vous confère la priorité absolue pour être désigné premier bénéficiaire des fonds des tontines auxquelles vous postulez.',
    en: 'Congratulations! Your exemplary score (S-Tier) gives you absolute priority to be designated as the first beneficiary of funds in tontines you apply to.',
    ee: 'Míedo dzidzɔ na wò! Wò xexlẽme nyui la (Tier S) na wòxɔa gbɔgblɔ gbãtɔ le tontine siwo nàle me la ƒe gaxɔxɔ me.',
    kbp: 'Ðɩsam-ŋ! Ño-kɩlaʋ kɩbaŋʋ (Tier S) haɣ-ŋ waɖɛ se ŋgbaŋ ŋ-ñɩnɩ liidiye kajalaɣ tontine ŋgʋ ŋ-ñɩnɩɣ pɩ-taa yɔ.'
  },
  reputation_tip_a: {
    fr: "Excellent ! Vous êtes un membre de confiance (Tier A). Pour passer au Tier S, assurez-vous d'anticiper le rechargement de votre portefeuille virtuel 24h avant chaque échéance.",
    en: 'Excellent! You are a trusted member (A-Tier). To reach S-Tier, make sure to recharge your virtual wallet 24h before each deadline.',
    ee: 'Enyo ŋutɔ! Wòe nye ame si dzi woka ɖo (Tier A). Be nàɖo Tier S gbɔ la, trɔ ga de wò gaxɔ me gbã hafi ŋkeke wo nade.',
    kbp: 'Pɩ-wɛ ɖeu! N-kɛ ñɩm mʋyʋ (Tier A). Se ŋ-tasɩ Tier S taa, sɔnzɩ liidiye n-kpou taa ɖooo kɩyakʋ ŋga ka-kaŋ yɔ, kɩ-yɔɔ.'
  },
  reputation_tip_b: {
    fr: "Votre réputation est correcte (Tier B) mais perfectible. Astuce : Pour éviter les oublis, effectuez des recharges régulières de votre compte via Flooz ou T-Money.",
    en: 'Your reputation is correct (B-Tier) but could be improved. Tip: To avoid forgetting, recharge regularly via Flooz or T-Money.',
    ee: 'Wò ŋkɔ nyuie le eme (Tier B) gake wòate ŋu anyo wu. Aɖaŋuɖoɖo: Be maŋlɔ nu be o la, trɔ ga de wò akɔnta me edziedzi to Flooz alo T-Money dzi.',
    kbp: 'Ño-hɩɖɛ wɛ ɖeu (Tier B) piye pɩpɔzʋʋ se pɩ-cɛzɩɣ. Ñɩnɩ: Se n-ta pɩ-yɔɔ, sɔnzɩ liidiye tam-tam Flooz yaa T-Money yɔɔ.'
  },
  reputation_tip_c: {
    fr: "Attention ! Votre score est critique (Tier C) à cause de retards répétés. Pour restaurer votre réputation, alimentez immédiatement votre solde de portefeuille et réglez vos cotisations en attente.",
    en: 'Warning! Your score is critical (C-Tier) due to repeated late payments. To restore your reputation, immediately fund your wallet and settle pending contributions.',
    ee: 'Kpɔ nyuie! Wò xexlẽme le xaxa me (Tier C) le tsitsi gbe gbe ta. Be nàgbugbɔ wò ŋkɔ nyui aɖo la, trɔ ga de wò gaxɔ me enumake eye nàxe wò gaxexlẽ siwo susɔ.',
    kbp: 'Kpaɣ ño-lɩmaɣzɩyɛ! Ño-kɩlaʋ wɛ kaɖɛ (Tier C) mbʋ pʋyɔɔ yɔ ŋ-gbɛdɩɣ tam-tam. Se ño-hɩɖɛ ɖɔ pɩ-taa, sɔnzɩ liidiye ñɛ-kpou taa lɛɛlɛɛyɔ nɛ ŋ-fɛ liidiye haʋ ŋgʋ kɩ-caɣ yɔ.'
  },

  // Dashboard (home screen)
  dashboard_greeting: {
    fr: 'Bonjour',
    en: 'Hello',
    ee: 'Ŋdi',
    kbp: 'Ɛzɩma'
  },
  dashboard_subtitle: {
    fr: "Heureux de vous revoir ! Voici l'aperçu de vos cercles d'épargne.",
    en: 'Glad to see you again! Here is an overview of your savings circles.',
    ee: 'Edzɔ dzi be míegakpɔ wò! Esiae nye wò gadzraɖoƒe habɔbɔwo ƒe kpuiƒoƒo.',
    kbp: 'Man-taa wɛ leleŋ se man-nawa-ŋ! Ðɩnɩ ñɛ-tontinaa tɔm kɩ-tɩŋa cɔlɔ.'
  },
  quick_actions: {
    fr: 'Actions rapides',
    en: 'Quick Actions',
    ee: 'Dɔwɔwɔ Kabakaba',
    kbp: 'Lakasɩ kɛlɛɣ'
  },
  recharge_wallet_title: {
    fr: 'Recharger mon portefeuille',
    en: 'Recharge my wallet',
    ee: 'Trɔ ga de nye gaxɔ me',
    kbp: 'Sɔnzɩ liidiye man-kpou taa'
  },
  recharge_wallet_desc: {
    fr: 'Ajouter des fonds par Paydunya (Flooz, T-Money...)',
    en: 'Add funds via Paydunya (Flooz, T-Money...)',
    ee: 'Tsɔ ga kpe ɖe eŋu to Paydunya dzi (Flooz, T-Money...)',
    kbp: 'Kpɛndɩ liidiye Paydunya yɔɔ (Flooz, T-Money...)'
  },
  create_new_circle: {
    fr: 'Créer un nouveau cercle',
    en: 'Create a new circle',
    ee: 'Wɔ habɔbɔ yeye',
    kbp: 'Ma tontine kɩfaŋa'
  },
  create_circle_desc: {
    fr: 'Lancer une tontine digitale avec vos proches',
    en: 'Start a digital tontine with your loved ones',
    ee: 'Dze tontine si le komputa dzi gɔme kple wò ƒometɔwo',
    kbp: 'Paɣzɩ tontine ñɛ-taabalaa nɛ'
  },
  search_circle_desc: {
    fr: 'Trouver une tontine publique à rejoindre',
    en: 'Find a public tontine to join',
    ee: 'Di tontine dutoƒe si nàge ɖe eme',
    kbp: 'Pɔzɩ tontine kʋɖʋm ŋgʋ ŋ-pɩzɩɣ ŋ-kpɛndɩ pɩ-taa yɔ'
  },
  excellent_reliability: {
    fr: 'Fiabilité financière excellente.',
    en: 'Excellent financial reliability.',
    ee: 'Gadzikpɔkpɔ nyui ŋutɔ.',
    kbp: 'Liidiye taa lidaʋ kɩbaŋʋ.'
  },
  total_saved: {
    fr: 'Total Épargné',
    en: 'Total Saved',
    ee: 'Gadzraɖo Katã',
    kbp: 'Liidiye kɩ-tɩŋa'
  },
  savings_accumulated: {
    fr: "d'épargne accumulée",
    en: 'savings accumulated',
    ee: 'gadzraɖo si ƒo ƒu',
    kbp: 'liidiye lɩnzɩ'
  },
  active_groups: {
    fr: 'Groupes Actifs',
    en: 'Active Groups',
    ee: 'Habɔbɔ siwo le dɔwɔm',
    kbp: 'Tontinaa wena awɛ ñʋʋ taa'
  },
  circles_unit: {
    fr: 'cercles',
    en: 'circles',
    ee: 'habɔbɔwo',
    kbp: 'tontinaa'
  },
  circles_joined: {
    fr: 'cercles rejoints',
    en: 'circles joined',
    ee: 'habɔbɔ siwo me nège ɖo',
    kbp: 'tontinaa wena ŋ-kpɛndaa'
  },
  no_circle_title: {
    fr: "Aucun cercle d'épargne",
    en: 'No savings circle',
    ee: 'Gadzraɖo habɔbɔ aɖeke meli o',
    kbp: 'Tontine naɖɩyɛ fɛyɩ'
  },
  no_circle_desc: {
    fr: "Vous ne faites partie d'aucun cercle d'épargne pour le moment. Créez votre propre tontine ou rejoignez un cercle existant !",
    en: 'You are not part of any savings circle yet. Create your own tontine or join an existing circle!',
    ee: 'Mele gadzraɖo habɔbɔ aɖeke me haɖe o. Wɔ wò ŋutɔ wò tontine alo ge ɖe habɔbɔ si li me!',
    kbp: 'Ŋ-fɛyɩ tontine naɖɩyɛ taa fɛyɛ. Ma ño-maɣmaɣ tontine yaa kpɛndɩ ŋgʋ kɩ-wɛɛ yɔ, kɩ-taa!'
  },
  create_first_circle: {
    fr: 'Créer mon premier cercle',
    en: 'Create my first circle',
    ee: 'Wɔ nye habɔbɔ gbãtɔ',
    kbp: 'Ma man tontine kajalaɣ'
  },
  status_active: {
    fr: 'En cours',
    en: 'Active',
    ee: 'Le edzi yim',
    kbp: 'Ka ñʋʋ taa'
  },
  status_completed: {
    fr: 'Terminé',
    en: 'Completed',
    ee: 'Wowu enu',
    kbp: 'Pɩ-tɛma'
  },
  contribution_label: {
    fr: 'Cotisation',
    en: 'Contribution',
    ee: 'Gaxexlẽ',
    kbp: 'Liidiye haʋ'
  },
  members: {
    fr: 'Membres',
    en: 'Members',
    ee: 'Xɔ́wo',
    kbp: 'Mʋyaa'
  },
  participants: {
    fr: 'participants',
    en: 'participants',
    ee: 'amesiwo kpɔ gome',
    kbp: 'mʋyaa'
  },
  cycle_progress: {
    fr: 'Progression du cycle',
    en: 'Cycle progress',
    ee: 'Ale si dzɔgbenya la ɖo edzi',
    kbp: 'Kɩyakʋ ɖɔ tɔm'
  },
  manage: {
    fr: 'Gérer',
    en: 'Manage',
    ee: 'Kpɔ Edzi',
    kbp: 'Ñɩɩ nɛ'
  },
  my_contributions: {
    fr: 'Mes versements',
    en: 'My contributions',
    ee: 'Nye gaxexlẽwo',
    kbp: 'Man liidiye haʋ'
  },
  details: {
    fr: 'Détails',
    en: 'Details',
    ee: 'Numele',
    kbp: 'Tɔm ndʋ'
  },
  freq_daily: {
    fr: 'Quotidien',
    en: 'Daily',
    ee: 'Gbesiagbe',
    kbp: 'Kɩyakʋ kʋɖʋmaɣ'
  },
  freq_weekly: {
    fr: 'Hebdomadaire',
    en: 'Weekly',
    ee: 'Kwasiɖasiɖa',
    kbp: 'Kɩyɛ kʋɖʋmaɣ'
  },
  'freq_bi-weekly': {
    fr: 'Bi-hebdomadaire',
    en: 'Bi-weekly',
    ee: 'Kwasiɖa evelia ɖe sia ɖe',
    kbp: 'Kɩyɛ naalɛ kʋɖʋmaɣ'
  },
  freq_monthly: {
    fr: 'Mensuel',
    en: 'Monthly',
    ee: 'Ɣletisiɣleti',
    kbp: 'Fenaɣ kʋɖʋmaɣ'
  },

  // Contributions - circle accounting (Sprint 6)
  circle_accounting: {
    fr: 'Comptabilité du cercle',
    en: 'Circle accounting',
    ee: 'Habɔbɔ ƒe Gaxexlẽ',
    kbp: 'Tontine liidiye kalɩyɛ'
  },
  total_collected_in: {
    fr: 'Total collecté (entrées)',
    en: 'Total collected (in)',
    ee: 'Ga si woƒo ƒu katã (nudede)',
    kbp: 'Liidiye kɩ-tɩŋa (sʋʋ)'
  },
  total_distributed_out: {
    fr: 'Total distribué (sorties)',
    en: 'Total distributed (out)',
    ee: 'Ga si womã katã (nuɖeɖe)',
    kbp: 'Liidiye kɩ-tɩŋa (lɩʋ)'
  },
  available_funds: {
    fr: 'Fonds disponibles',
    en: 'Available funds',
    ee: 'Ga si li fifia',
    kbp: 'Liidiye ŋgʋ kɩ-wɛɛ yɔ'
  },
  export_excel: {
    fr: 'Exporter en Excel',
    en: 'Export to Excel',
    ee: 'Ɖe Le Excel Me',
    kbp: 'Lɩzɩ Excel taa'
  },
  excel_generated: {
    fr: 'Export Excel généré !',
    en: 'Excel export generated!',
    ee: 'Excel nya la wɔ!',
    kbp: 'Excel taa lɩzʋʋ tɛma!'
  },

  // Contributions - full screen (Sprint 6)
  contributions_management: {
    fr: 'Gestion des Cotisations',
    en: 'Contributions Management',
    ee: 'Gaxexlẽwo Dzikpɔkpɔ',
    kbp: 'Liidiye haʋ ñɩɩnɩyɛ'
  },
  my_contributions_title: {
    fr: 'Mes Cotisations',
    en: 'My Contributions',
    ee: 'Nye Gaxexlẽwo',
    kbp: 'Man liidiye haʋ'
  },
  payment_history: {
    fr: 'Historique des Paiements',
    en: 'Payment History',
    ee: 'Fexexlẽ ƒe Ŋutinya',
    kbp: 'Fenaɣ ñɔɔzʋʋ tɔm'
  },
  my_payments: {
    fr: 'Mes Paiements',
    en: 'My Payments',
    ee: 'Nye Fexexlẽwo',
    kbp: 'Man fenaɣ ñɔɔzʋʋ'
  },
  contributions_list_desc: {
    fr: 'Liste de toutes les cotisations enregistrées pour ce groupe.',
    en: 'List of all contributions recorded for this group.',
    ee: 'Gaxexlẽ siwo katã woŋlɔ ɖi na habɔbɔ sia ƒe list.',
    kbp: 'Tontine ŋgʋ kɩ-liidiye haʋ kɩ-tɩŋa kalɩyɛ.'
  },
  my_contributions_desc: {
    fr: 'Historique de vos versements pour ce cercle.',
    en: 'History of your contributions for this circle.',
    ee: 'Wò gaxexlẽ siwo nàwɔ na habɔbɔ sia ƒe ŋutinya.',
    kbp: 'Ño-liidiye haʋ tontine ŋgʋ kɩ-taa yɔ, kɩ-tɔm.'
  },
  search_member: {
    fr: 'Rechercher un membre...',
    en: 'Search a member...',
    ee: 'Di xɔlɔ̃ aɖe...',
    kbp: 'Pɔzɩ mʋyʋ nakʋyʋ...'
  },
  member: {
    fr: 'Membre',
    en: 'Member',
    ee: 'Xɔ́',
    kbp: 'Mʋyʋ'
  },
  period: {
    fr: 'Période',
    en: 'Period',
    ee: 'Ɣeyiɣi',
    kbp: 'Alɩwaatʋ'
  },
  amount: {
    fr: 'Montant',
    en: 'Amount',
    ee: 'Ga home',
    kbp: 'Liidiye ñɩma'
  },
  penalty: {
    fr: 'Pénalité',
    en: 'Penalty',
    ee: 'Tohehe',
    kbp: 'Tɔlɩm'
  },
  status: {
    fr: 'Statut',
    en: 'Status',
    ee: 'Nɔnɔme',
    kbp: 'Ðoŋ'
  },
  actions: {
    fr: 'Actions',
    en: 'Actions',
    ee: 'Dɔwɔwɔwo',
    kbp: 'Lakasɩ'
  },
  date: {
    fr: 'Date',
    en: 'Date',
    ee: 'Ŋkeke',
    kbp: 'Kɩyakʋ'
  },
  penalty_status_col: {
    fr: 'Statut pénalité',
    en: 'Penalty status',
    ee: 'Tohehe ƒe nɔnɔme',
    kbp: 'Tɔlɩm ɖoŋ'
  },
  no_contribution_found: {
    fr: 'Aucune cotisation trouvée.',
    en: 'No contribution found.',
    ee: 'Gaxexlẽ aɖeke meli o.',
    kbp: 'Liidiye haʋ naɖɩyɛ fɛyɩ.'
  },
  status_paid: {
    fr: 'Payé',
    en: 'Paid',
    ee: 'Woxee',
    kbp: 'Pɩ-fɛlɩ'
  },
  status_pending: {
    fr: 'En attente',
    en: 'Pending',
    ee: 'Le lalam',
    kbp: 'Ka taɣ taa'
  },
  status_late: {
    fr: 'En retard',
    en: 'Late',
    ee: 'Etsi',
    kbp: 'Kɩ-gbɛdɩɣ'
  },
  status_verifying: {
    fr: 'En vérification',
    en: 'Verifying',
    ee: 'Wole ekpɔm',
    kbp: 'Ka pɔzʋʋ'
  },
  status_verification_short: {
    fr: 'Vérification',
    en: 'Verification',
    ee: 'Nukpɔkpɔ',
    kbp: 'Pɔzʋʋ'
  },
  due: {
    fr: 'Due',
    en: 'Due',
    ee: 'Anɔ Xexlẽ',
    kbp: 'Kɩ-caɣ'
  },
  penalty_paid_short: {
    fr: '(payée)',
    en: '(paid)',
    ee: '(woxee)',
    kbp: '(pɩ-fɛlɩ)'
  },
  penalty_due_short: {
    fr: '(due)',
    en: '(due)',
    ee: '(susɔ)',
    kbp: '(kɩ-caɣ)'
  },
  approve_payment: {
    fr: 'Approuver le paiement',
    en: 'Approve payment',
    ee: 'Da Asi Ɖe Fexexlẽ Dzi',
    kbp: 'Ña fenaɣ ñɔɔzʋʋ'
  },
  reject_proof: {
    fr: 'Rejeter la preuve',
    en: 'Reject proof',
    ee: 'Gbe Kpeɖodzinya',
    kbp: 'Gbɛ tɔm taa spɩyɛ'
  },
  ref_label: {
    fr: 'Réf:',
    en: 'Ref:',
    ee: 'Dzesi:',
    kbp: 'Tʋmɩyɛ:'
  },
  circle_members: {
    fr: 'Membres du Cercle',
    en: 'Circle Members',
    ee: 'Habɔbɔ Xɔ́wo',
    kbp: 'Tontine mʋyaa'
  },
  init_contribution_desc: {
    fr: 'Initialiser une nouvelle cotisation pour un membre.',
    en: 'Initialize a new contribution for a member.',
    ee: 'Dze gaxexlẽ yeye gɔme na xɔ́ aɖe.',
    kbp: 'Paɣzɩ liidiye haʋ kɩfaŋa mʋyʋ nakʋyʋ ñʋʋ taa.'
  },
  score_label: {
    fr: 'Score:',
    en: 'Score:',
    ee: 'Xexlẽme:',
    kbp: 'Kɩlaʋ:'
  },
  call_contribution: {
    fr: 'Appel',
    en: 'Call',
    ee: 'Yɔyɔ',
    kbp: 'Yaʋ'
  },
  pay: {
    fr: 'Payer',
    en: 'Pay',
    ee: 'Xe Fe',
    kbp: 'Fɛ'
  },
  contribution_call_created_for: {
    fr: 'Demande de cotisation créée pour',
    en: 'Contribution request created for',
    ee: 'Gaxexlẽ biabia wowɔ na',
    kbp: 'Liidiye haʋ pɔzʋʋ paɖʋ'
  },
  payment_registered_for: {
    fr: 'Paiement enregistré pour',
    en: 'Payment registered for',
    ee: 'Woŋlɔ fexexlẽ ɖi na',
    kbp: 'Fenaɣ ñɔɔzʋʋ pakalɩ'
  },
  proof_submitted: {
    fr: 'Preuve de paiement soumise ! En attente de validation.',
    en: 'Payment proof submitted! Awaiting validation.',
    ee: 'Fexexlẽ kpeɖodzinya woɖo ɖa! Ele lalam be woada asi edzi.',
    kbp: 'Fenaɣ ñɔɔzʋʋ spɩyɛ pɛɖʋ! Ka taɣ taa se pañaɣ-ɩ.'
  },
  error_submitting: {
    fr: 'Erreur lors de la soumission.',
    en: 'Error while submitting.',
    ee: 'Vodada dzɔ le eɖoɖo ɖa me.',
    kbp: 'Kɩdɛkɛdɩm lɩna ɖʋʋ taa.'
  },
  error_creating: {
    fr: 'Erreur lors de la création.',
    en: 'Error while creating.',
    ee: 'Vodada dzɔ le ewɔwɔ me.',
    kbp: 'Kɩdɛkɛdɩm lɩna malʋʋ taa.'
  },
  error_registering_payment: {
    fr: "Erreur lors de l'enregistrement du paiement.",
    en: 'Error while registering the payment.',
    ee: 'Vodada dzɔ le fexexlẽ ŋɔŋlɔ me.',
    kbp: 'Kɩdɛkɛdɩm lɩna fenaɣ ñɔɔzʋʋ kalʋʋ taa.'
  },
  declare: {
    fr: 'Déclarer',
    en: 'Declare',
    ee: 'Gblɔe',
    kbp: 'Yɔɔdɩ'
  },
  declare_payment: {
    fr: 'Déclarer un paiement',
    en: 'Declare a payment',
    ee: 'Gblɔ Fexexlẽ Aɖe',
    kbp: 'Yɔɔdɩ fenaɣ ñɔɔzʋʋ'
  },
  declare_payment_desc: {
    fr: "Saisissez la référence du transfert (Mobile Money, Virement, etc.) pour que l'administrateur puisse valider votre cotisation.",
    en: 'Enter the transfer reference (Mobile Money, bank transfer, etc.) so the administrator can validate your contribution.',
    ee: 'Ŋlɔ ga ɖoɖo la ƒe dzesi (Mobile Money, gaɖoɖo, kple bubuwo) be dziɖula nate ŋu ada asi wò gaxexlẽ dzi.',
    kbp: 'Kalɩ liidiye ɖʋʋ tʋmɩyɛ (Mobile Money, banki taa ɖʋʋ, nɛ lɛlaa) se ñʋʋdʋ ɩña ño-liidiye haʋ.'
  },
  transaction_reference: {
    fr: 'Référence de transaction',
    en: 'Transaction reference',
    ee: 'Gaɖoɖo Dzesi',
    kbp: 'Liidiye ɖʋʋ tʋmɩyɛ'
  },
  enter_reference_error: {
    fr: 'Veuillez saisir une référence (ex: ID Flooz, T-Money...)',
    en: 'Please enter a reference (e.g. Flooz ID, T-Money...)',
    ee: 'Taflatse ŋlɔ dzesi aɖe (kpɔɖeŋu: Flooz ID, T-Money...)',
    kbp: 'Taa kalɩ tʋmɩyɛ nakʋyʋ (ɛzɩ: Flooz ID, T-Money...)'
  },
  send_proof: {
    fr: 'Envoyer le justificatif',
    en: 'Send proof',
    ee: 'Ɖo Kpeɖodzinya Ɖa',
    kbp: 'Tiyi spɩyɛ'
  },
  reference_placeholder: {
    fr: 'Ex: OM-20230512-8271, WAVE-...',
    en: 'e.g. OM-20230512-8271, WAVE-...',
    ee: 'Kpɔɖeŋu: OM-20230512-8271, WAVE-...',
    kbp: 'Ɛzɩ: OM-20230512-8271, WAVE-...'
  },

  // Shared / previously missing
  settings: {
    fr: 'Paramètres',
    en: 'Settings',
    ee: 'Ɖoɖowo',
    kbp: 'Ñɔɔzʋʋ'
  },
  frequency: {
    fr: 'Fréquence',
    en: 'Frequency',
    ee: 'Zi Nenie',
    kbp: 'Ðɩɣzʋʋ'
  },

  // Admin dashboard (Sprint 6)
  admin_loading: {
    fr: "Chargement de l'Administration...",
    en: 'Loading Administration...',
    ee: 'Dziɖuɖu Gomenu Le Wɔwɔm...',
    kbp: 'Ñʋʋdʋ tɔm ka sʋʋ...'
  },
  admin_super_admin_space: {
    fr: 'Espace Super-Admin',
    en: 'Super-Admin Space',
    ee: 'Dziɖula Gãtɔ ƒe Nɔƒe',
    kbp: 'Ñʋʋdʋ sɔsɔ ɖɩɣa'
  },
  admin_panel_title: {
    fr: 'Panneau de Contrôle Admin',
    en: 'Admin Control Panel',
    ee: 'Dziɖula ƒe Dzikpɔɖoƒe',
    kbp: 'Ñʋʋdʋ ñɩɩnɩyɛ ñɩnɖɛ'
  },
  admin_panel_subtitle: {
    fr: "Supervisez les statistiques globales des cercles d'épargne (tontines), modifiez la réputation des membres et gérez l'ensemble des transactions du système.",
    en: 'Oversee global statistics of savings circles (tontines), edit member reputation, and manage all system transactions.',
    ee: 'Kpɔ tontine habɔbɔwo katã ƒe dzesiwo dzi, trɔ xɔ́wo ƒe ŋkɔ nyui, eye nàkpɔ ɖoɖo blibo la ƒe gaɖoɖowo katã dzi.',
    kbp: 'Cɔnɩ tontinaa kɩ-tɩŋa kalɩyɛ, yekiɣ mʋyaa hɩɖɛ, nɛ ñɩɩ liidiye ɖʋʋ kɩ-tɩŋa.'
  },
  admin_refresh_data: {
    fr: 'Rafraîchir les données',
    en: 'Refresh data',
    ee: 'Trɔ Nyatakakawo Wɔ Yeye',
    kbp: 'Kpɛndɩ kɩ-fɛyɩ tɔm'
  },
  admin_registered_members: {
    fr: 'Membres Inscrits',
    en: 'Registered Members',
    ee: 'Xɔ́ siwo Woŋlɔ Ŋkɔ',
    kbp: 'Mʋyaa pakalɩ'
  },
  admin_users_word: {
    fr: 'Utilisateurs',
    en: 'Users',
    ee: 'Zãnuwo',
    kbp: 'Lɩmaɣza ñɩnɩyaa'
  },
  admin_admins_word: {
    fr: 'Admins',
    en: 'Admins',
    ee: 'Dziɖulawo',
    kbp: 'Ñʋʋdaa'
  },
  admin_tontine_circles: {
    fr: 'Cercles de Tontine',
    en: 'Tontine Circles',
    ee: 'Tontine Habɔbɔwo',
    kbp: 'Tontinaa'
  },
  admin_active_word: {
    fr: 'Actifs',
    en: 'Active',
    ee: 'Le Dɔwɔm',
    kbp: 'Ka ñʋʋ taa'
  },
  admin_cumulative_volume: {
    fr: 'Volume Cumulé',
    en: 'Cumulative Volume',
    ee: 'Ga si Ƒo Ƒu',
    kbp: 'Liidiye lɩnzɩ'
  },
  admin_total_savings_goals: {
    fr: "Total des objectifs d'épargne",
    en: 'Total savings goals',
    ee: 'Gadzraɖo taɖodzinuwo katã',
    kbp: 'Liidiye taɖʋʋ laɖʋ'
  },
  admin_reputation_health: {
    fr: 'Santé de Réputation',
    en: 'Reputation Health',
    ee: 'Ŋkɔ Nyui ƒe Dedienɔnɔme',
    kbp: 'Hɩɖɛ alaafɩya'
  },
  admin_member_config_console: {
    fr: 'Console de Configuration Membre',
    en: 'Member Configuration Console',
    ee: 'Xɔ́ Ɖoɖo Dzesidede',
    kbp: 'Mʋyʋ ñɔɔzʋʋ ñɩnɖɛ'
  },
  admin_adjustment_of: {
    fr: 'Ajustement de',
    en: 'Adjustment of',
    ee: 'Ɖoɖo trɔtrɔ na',
    kbp: 'Yekiɣu:'
  },
  admin_reputation_score_range: {
    fr: 'Score de Réputation (0 - 100)',
    en: 'Reputation Score (0 - 100)',
    ee: 'Ŋkɔ Nyui Xexlẽme (0 - 100)',
    kbp: 'Hɩɖɛ kɩlaʋ (0 - 100)'
  },
  admin_virtual_wallet_balance: {
    fr: 'Solde Portefeuille Virtuel (FCFA)',
    en: 'Virtual Wallet Balance (FCFA)',
    ee: 'Komputa Gaxɔ me Ga (FCFA)',
    kbp: 'Kpou taa liidiye ɖɩŋ (FCFA)'
  },
  admin_applying: {
    fr: 'Application...',
    en: 'Applying...',
    ee: 'Wole Ewɔm...',
    kbp: 'Ka lakasɩ...'
  },
  admin_apply: {
    fr: 'Appliquer',
    en: 'Apply',
    ee: 'Wɔe',
    kbp: 'La-ɩ'
  },
  admin_toggle_role_title: {
    fr: 'Inverser le rôle (Admin <-> User)',
    en: 'Toggle role (Admin <-> User)',
    ee: 'Trɔ Dɔdeasi (Dziɖula <-> Zãnu)',
    kbp: 'Yekiɣ tʋmɩyɛ (Ñʋʋdʋ <-> Lɩmaɣzɩyʋ)'
  },
  admin_tab_groups: {
    fr: 'Cercles (Tontines)',
    en: 'Circles (Tontines)',
    ee: 'Habɔbɔwo (Tontinewo)',
    kbp: 'Tontinaa'
  },
  admin_tab_ledger: {
    fr: 'Ledger & Sécurité',
    en: 'Ledger & Security',
    ee: 'Gaxexlẽdzesi kple Dedienɔnɔme',
    kbp: 'Liidiye kalɩyɛ nɛ ñʋʋ taa lakasɩ'
  },
  admin_member_directory_mgmt: {
    fr: "Gestion de l'Annuaire des Membres",
    en: 'Member Directory Management',
    ee: 'Xɔ́wo ƒe Ŋkɔliste Dzikpɔkpɔ',
    kbp: 'Mʋyaa kalɩyɛ ñɩɩnɩyɛ'
  },
  admin_member_directory_desc: {
    fr: "Recherchez des tontiniers, modifiez les scores d'évaluation pour tester les priorités de payout ou modifiez les privilèges administratifs.",
    en: 'Search members, edit reputation scores to test payout priorities, or change administrative privileges.',
    ee: 'Di tontine zãnuwo, trɔ xexlẽme dzesiwo be nàdo mavomavo ƒe gbãtɔyenɔnɔ kpɔ, alo trɔ dziɖula ƒe mɔnukpɔkpɔwo.',
    kbp: 'Pɔzɩ tontine mʋyaa, yekiɣ hɩɖɛ kɩlaʋ se ñɩnɩ liidiye lɩʋ ɖoŋ, yaa yekiɣ ñʋʋdʋ waɖɛ.'
  },
  admin_search_name_email: {
    fr: 'Chercher nom/email...',
    en: 'Search name/email...',
    ee: 'Di ŋkɔ/email...',
    kbp: 'Pɔzɩ hɩɖɛ/email...'
  },
  admin_profil_col: {
    fr: 'Profil',
    en: 'Profile',
    ee: 'Ŋkɔmeɖeɖe',
    kbp: 'Ma-ɖɔkɔtɔ'
  },
  admin_role_col: {
    fr: 'Rôle',
    en: 'Role',
    ee: 'Dɔdeasi',
    kbp: 'Tʋmɩyɛ'
  },
  admin_reputation_col: {
    fr: 'Réputation',
    en: 'Reputation',
    ee: 'Ŋkɔ Nyui',
    kbp: 'Hɩɖɛ'
  },
  admin_wallet_col: {
    fr: 'Portefeuille',
    en: 'Wallet',
    ee: 'Gaxɔ',
    kbp: 'Liidiye kpou'
  },
  admin_no_member_found: {
    fr: 'Aucun membre correspondant trouvé.',
    en: 'No matching member found.',
    ee: 'Xɔ́ si sɔ ɖe eŋu la aɖeke meli o.',
    kbp: 'Mʋyʋ nɔɔyʋ fɛyɩ.'
  },
  admin_administrator: {
    fr: 'Administrateur',
    en: 'Administrator',
    ee: 'Dziɖula',
    kbp: 'Ñʋʋdʋ'
  },
  admin_adjust: {
    fr: 'Ajuster',
    en: 'Adjust',
    ee: 'Trɔe',
    kbp: 'Yekiɣ-ɩ'
  },
  admin_demote_user: {
    fr: 'Rétrograder en utilisateur standard',
    en: 'Demote to standard user',
    ee: 'Trɔe Wòzu Zãnu Nɔrmalwo',
    kbp: 'Kpaɖɩ-ɩ lɩmaɣzɩyʋ ɖɔɖɔ'
  },
  admin_promote_admin: {
    fr: 'Promouvoir en administrateur',
    en: 'Promote to administrator',
    ee: 'Kɔe Woazu Dziɖula',
    kbp: 'Kɔ-ɩ ñʋʋdʋ'
  },
  admin_delete_user: {
    fr: "Supprimer l'utilisateur",
    en: 'Delete user',
    ee: 'Tutu Zãnu Ŋkɔ',
    kbp: 'Ɖɩzɩ lɩmaɣzɩyʋ'
  },
  admin_active_circles_mgmt: {
    fr: 'Gestion des Cercles Actifs',
    en: 'Active Circles Management',
    ee: 'Habɔbɔ siwo le Dɔwɔm Dzikpɔkpɔ',
    kbp: 'Tontinaa wena awɛ ñʋʋ taa ñɩɩnɩyɛ'
  },
  admin_active_circles_desc: {
    fr: "Visualisez les cotisations globales, l'état d'avancement des payouts des bénéficiaires et supprimez les groupes inactifs de test.",
    en: 'View global contributions, beneficiary payout progress, and delete inactive test groups.',
    ee: 'Kpɔ gaxexlẽwo katã, ale si mavomavo la yina edzi na ame siwo axɔe kple tutu habɔbɔ siwo mele dɔ wɔm o.',
    kbp: 'Cɔnɩ liidiye haʋ kɩ-tɩŋa, liidiye lɩʋ ɖɔ tɔm, nɛ ɖɩzɩ tontinaa wena aɩɛ ñʋʋ taa yɔ.'
  },
  admin_search_group: {
    fr: 'Chercher groupe/tontine...',
    en: 'Search group/tontine...',
    ee: 'Di habɔbɔ/tontine...',
    kbp: 'Pɔzɩ tontine...'
  },
  admin_circle_name: {
    fr: 'Nom du Cercle',
    en: 'Circle Name',
    ee: 'Habɔbɔ ƒe Ŋkɔ',
    kbp: 'Tontine hɩɖɛ'
  },
  admin_installment_amount: {
    fr: 'Montant Échéance',
    en: 'Installment Amount',
    ee: 'Fexexlẽ Home',
    kbp: 'Kɩyakʋ liidiye ñɩma'
  },
  admin_payout_cycle: {
    fr: 'Cycle de Payout',
    en: 'Payout Cycle',
    ee: 'Mavomavo Ɖoɖo',
    kbp: 'Liidiye lɩʋ ɖɔɖʋʋ'
  },
  admin_no_group_found: {
    fr: 'Aucun groupe ou cercle de tontine trouvé.',
    en: 'No group or tontine circle found.',
    ee: 'Habɔbɔ alo tontine aɖeke meli o.',
    kbp: 'Tontine naɖɩyɛ fɛyɩ.'
  },
  admin_invite_code: {
    fr: 'Code invitation',
    en: 'Invite code',
    ee: 'Amekpekpe Kod',
    kbp: 'Yaʋ tʋmɩyɛ'
  },
  admin_none_word: {
    fr: 'aucun',
    en: 'none',
    ee: 'aɖeke meli o',
    kbp: 'nakʋyʋ fɛyɩ'
  },
  admin_payouts_word: {
    fr: 'payouts',
    en: 'payouts',
    ee: 'mavomavowo',
    kbp: 'liidiye lɩʋ'
  },
  admin_status_active: {
    fr: 'En Cours',
    en: 'Active',
    ee: 'Le Edzi Yim',
    kbp: 'Ka ñʋʋ taa'
  },
  admin_status_init: {
    fr: 'Initialisation',
    en: 'Initializing',
    ee: 'Gɔmedzedze',
    kbp: 'Paɣzʋʋ'
  },
  admin_status_closed: {
    fr: 'Clôturé',
    en: 'Closed',
    ee: 'Wotui',
    kbp: 'Pɩ-sʋʋ'
  },
  admin_delete_group_perm: {
    fr: 'Supprimer définitivement le groupe',
    en: 'Permanently delete the group',
    ee: 'Tutu Habɔbɔ La Gbidigbidi',
    kbp: 'Ɖɩzɩ tontine tam tam'
  },
  admin_global_settings: {
    fr: 'Paramètres Système Globaux',
    en: 'Global System Settings',
    ee: 'Ɖoɖo Blibo Ƒe Ɖoɖowo',
    kbp: 'Ñʋʋdʋ ñɔɔzʋʋ kɩ-tɩŋa'
  },
  admin_global_settings_desc: {
    fr: "Configurez les modes de simulation pour les démonstrations de l'application eganyé.",
    en: 'Configure simulation modes for eganyé app demonstrations.',
    ee: 'Ɖo kpɔɖeŋu ɖoɖowo na eganyé app ƒe fiafiawo.',
    kbp: 'Ñɔɔzɩ kɩlɩzɩ ñɔɔzʋʋ eganyé app wɩlʋʋ ñʋʋ taa.'
  },
  admin_maintenance_sim: {
    fr: 'Simulation de Maintenance',
    en: 'Maintenance Simulation',
    ee: 'Dzadzraɖo Kpɔɖeŋu',
    kbp: 'Ñɔɔzʋʋ kɩlɩzɩ'
  },
  admin_maintenance_sim_desc: {
    fr: 'Mettre la plateforme en maintenance pour simuler les interruptions techniques.',
    en: 'Put the platform in maintenance to simulate technical interruptions.',
    ee: 'Tsɔ app la de dzadzraɖo me be nàdo teknoloji ƒe dzedzeme kpɔ.',
    kbp: 'Kpaɣ app ñɔɔzɩ se ŋ-cɔnɩ kaɖɛ nɖɩyɛ ñɔɔzʋʋ.'
  },
  admin_maintenance_mode: {
    fr: 'Mode maintenance',
    en: 'Maintenance mode',
    ee: 'Dzadzraɖo Ɖoɖo',
    kbp: 'Ñɔɔzʋʋ ɖoŋ'
  },
  admin_enabled: {
    fr: 'Activé',
    en: 'Enabled',
    ee: 'Wole Dɔ Wɔm',
    kbp: 'Pɩ-lakɩ'
  },
  admin_disabled: {
    fr: 'Désactivé',
    en: 'Disabled',
    ee: 'Wometsɔ Wɔ Dɔ O',
    kbp: 'Pɩ-lakɩ pɩ-tɩŋa'
  },
  admin_mode_enabled: {
    fr: 'Mode Activé',
    en: 'Mode Enabled',
    ee: 'Ɖoɖo Le Dɔ Wɔm',
    kbp: 'Ðoŋ ka la'
  },
  admin_allow_signups: {
    fr: 'Autoriser les Nouvelles Inscriptions',
    en: 'Allow New Signups',
    ee: 'Ɖe Mɔ Na Ŋkɔŋɔŋlɔ Yeyewo',
    kbp: 'Ha waɖɛ kalɩyɛ kɩfaŋa'
  },
  admin_allow_signups_desc: {
    fr: "Bloquer la création de nouveaux profils sur l'onboarding si la limite de test est atteinte.",
    en: 'Block new profile creation on onboarding if the test limit is reached.',
    ee: 'Xe mɔ na ŋkɔmeɖeɖe yeyewo wɔwɔ ne kpɔɖeŋu ƒe seƒe ɖo.',
    kbp: 'Kpaɣ ma-ɖɔkɔtɔ kɩfaŋa nɖɩyɛ ni kɩlɩzɩ hɩɖɛ tɛma.'
  },
  admin_signups_word: {
    fr: 'Inscriptions',
    en: 'Signups',
    ee: 'Ŋkɔŋɔŋlɔwo',
    kbp: 'Kalɩyɛ'
  },
  admin_open_fem: {
    fr: 'Ouvertes',
    en: 'Open',
    ee: 'Wole Ʋuʋu',
    kbp: 'Pɩ-mʋʋ'
  },
  admin_closed_fem: {
    fr: 'Fermées',
    en: 'Closed',
    ee: 'Wotu',
    kbp: 'Pɩ-sʋʋ'
  },
  admin_signups_active: {
    fr: 'Inscriptions Actives',
    en: 'Signups Active',
    ee: 'Ŋkɔŋɔŋlɔ Le Edzi Yim',
    kbp: 'Kalɩyɛ ka la'
  },
  admin_blocked: {
    fr: 'Bloqué',
    en: 'Blocked',
    ee: 'Woxe Mɔ',
    kbp: 'Pɩ-sʋʋ'
  },
  admin_reputation_control: {
    fr: 'Contrôle de réputation eganyé :',
    en: 'eganyé reputation control:',
    ee: 'eganyé ƒe ŋkɔ nyui dzikpɔkpɔ:',
    kbp: 'eganyé hɩɖɛ ñɩɩnɩyɛ:'
  },
  admin_recontrol_before: {
    fr: "Les cotes de confiance des tontiniers influent directement sur l'ordonnancement de leur payout. Augmentez ou réduisez les réputations dans l'onglet",
    en: 'Trust ratings of members directly affect their payout ordering. Increase or decrease reputations in the',
    ee: 'Xɔ́wo ƒe ŋkɔ nyui kpɔ ŋusẽ tẽe ɖe woƒe mavomavo ɖoɖo dzi. Kɔ ŋkɔ nyuiwo dzi alo ɖiɖii le',
    kbp: 'Mʋyaa hɩɖɛ ɖɔŋ liidiye lɩʋ ɖɔɖʋʋ yɔɔ tɔntɔ. Kɔɔzɩ yaa yebi hɩɖɛ'
  },
  admin_recontrol_after: {
    fr: "pour voir instantanément le calculateur de Profile s'adapter en direct dans la console utilisateur.",
    en: 'tab to instantly see the Profile calculator adapt live in the user console.',
    ee: 'nu me be nàkpɔ ale si Ŋkɔmeɖeɖe ƒe helẽ trɔna enumake le zãnu ƒe nɔƒe.',
    kbp: 'taa se ŋ-cɔnɩ ma-ɖɔkɔtɔ kɩlaʋ ɖɔɔdʋʋ lɛɛlɛɛyɔ lɩmaɣzɩyʋ ñɩnɖɛ taa.'
  },
  admin_integrity_report: {
    fr: "Rapport d'Intégrité",
    en: 'Integrity Report',
    ee: 'Nuteƒewɔwɔ ƒe Nyatakaka',
    kbp: 'Tɔm sɩɖʋʋ ñɔɔzʋʋ'
  },
  admin_ledger_reconciled: {
    fr: 'Ledger Intègre & Réconcilié',
    en: 'Ledger Sound & Reconciled',
    ee: 'Gaxexlẽdzesi le Dedie & Wolée Ɖekae',
    kbp: 'Liidiye kalɩyɛ sɩɖʋʋ nɛ ɖɔɖʋʋ'
  },
  admin_no_discrepancy: {
    fr: 'Aucun écart détecté. Les écritures de débit/crédit correspondent exactement aux balances des portefeuilles virtuels.',
    en: 'No discrepancy detected. Debit/credit entries exactly match virtual wallet balances.',
    ee: 'Vovototo aɖeke meva dze o. Gaxexlẽ nuŋɔŋlɔwo katã sɔ pɛpɛpɛ kple gaxɔ mele ga home.',
    kbp: 'Kɩmʋʋ kʋɖʋm fɛyɩ. Liidiye kalɩyɛ nɛ kpou taa ɖɩŋ ɖɔŋ tam tam.'
  },
  admin_total_accounts: {
    fr: 'Total Comptes :',
    en: 'Total Accounts:',
    ee: 'Akɔnta Katã:',
    kbp: 'Kalɩyɛ kɩ-tɩŋa:'
  },
  admin_ledger_entries_label: {
    fr: 'Écritures Ledger :',
    en: 'Ledger Entries:',
    ee: 'Gaxexlẽdzesi Nuŋɔŋlɔwo:',
    kbp: 'Liidiye kalɩyɛ:'
  },
  admin_accounting_gaps: {
    fr: 'Écarts Comptables :',
    en: 'Accounting Gaps:',
    ee: 'Gaxexlẽ Vovototowo:',
    kbp: 'Liidiye kɩmʋʋ:'
  },
  admin_recon_status: {
    fr: 'Statut Réconciliation :',
    en: 'Reconciliation Status:',
    ee: 'Ɖekaewɔwɔ ƒe Nɔnɔme:',
    kbp: 'Ðɔɖʋʋ ɖoŋ:'
  },
  admin_reconciling: {
    fr: 'Réconciliation en cours...',
    en: 'Reconciliation in progress...',
    ee: 'Ɖekaewɔwɔ Le Edzi Yim...',
    kbp: 'Ðɔɖʋʋ ka la...'
  },
  admin_run_reconciliation: {
    fr: 'Lancer la Réconciliation',
    en: 'Run Reconciliation',
    ee: 'Dze Ɖekaewɔwɔ Gɔme',
    kbp: 'Paɣzɩ ɖɔɖʋʋ'
  },
  admin_reports_history: {
    fr: 'Historique des Rapports',
    en: 'Reports History',
    ee: 'Nyatakakawo ƒe Ŋutinya',
    kbp: 'Tɔm sɩɖʋʋ tɩŋa'
  },
  admin_no_report: {
    fr: 'Aucun rapport disponible. Cliquez sur Lancer ci-dessus.',
    en: 'No report available. Click Run above.',
    ee: 'Nyatakaka aɖeke meli o. Te asi Dzedze dzi le tame.',
    kbp: 'Tɔm sɩɖʋʋ fɛyɩ. Tɩlɩ Paɣzɩ ɖɩ-yɔɔ.'
  },
  admin_report_word: {
    fr: 'Rapport',
    en: 'Report',
    ee: 'Nyatakaka',
    kbp: 'Tɔm sɩɖʋʋ'
  },
  admin_success_upper: {
    fr: 'RÉUSSI',
    en: 'SUCCESS',
    ee: 'EWO DZIDZƆME',
    kbp: 'PƖ-TƐMA CEEZUU'
  },
  admin_entries_checked: {
    fr: 'entrées vérifiées',
    en: 'entries checked',
    ee: 'nuŋɔŋlɔ siwo wokpɔ',
    kbp: 'kalɩyɛ pacɔnaa'
  },
  admin_gaps_short: {
    fr: 'Écarts:',
    en: 'Gaps:',
    ee: 'Vovototowo:',
    kbp: 'Kɩmʋʋ:'
  },
  admin_accounts_short: {
    fr: 'Comptes:',
    en: 'Accounts:',
    ee: 'Akɔntawo:',
    kbp: 'Kalɩyɛ:'
  },
  admin_ledger_double: {
    fr: 'Grand Livre (Partie Double)',
    en: 'General Ledger (Double Entry)',
    ee: 'Gaxexlẽdzesi Gã (Akpa Eve)',
    kbp: 'Liidiye kalɩyɛ sɔsɔ (Nabudozo)'
  },
  admin_audit_immutable: {
    fr: "Journaux d'Audit Immuables",
    en: 'Immutable Audit Logs',
    ee: 'Nudzɔdzɔ Ŋlɔɖa siwo Metrɔna O',
    kbp: 'Cɔnɩyɛ kalɩyɛ ŋgʋ kɩ-tɩɩ yekiɣ'
  },
  admin_account_col: {
    fr: 'Compte',
    en: 'Account',
    ee: 'Akɔnta',
    kbp: 'Kalɩyɛ'
  },
  admin_type_col: {
    fr: 'Type',
    en: 'Type',
    ee: 'Ƒomevi',
    kbp: 'Suguu'
  },
  admin_counterparty_col: {
    fr: 'Contrepartie',
    en: 'Counterparty',
    ee: 'Kpevi',
    kbp: 'Ðʋ tɔm taa'
  },
  admin_no_ledger_entry: {
    fr: 'Aucune écriture de ledger enregistrée. Alimentez un portefeuille ou payez une cotisation pour initier les transactions.',
    en: 'No ledger entry recorded. Fund a wallet or pay a contribution to initiate transactions.',
    ee: 'Gaxexlẽdzesi nuŋɔŋlɔ aɖeke meli o. Trɔ ga de gaxɔ me alo xe gaxexlẽ be nàdze gaɖoɖo gɔme.',
    kbp: 'Liidiye kalɩyɛ naɖɩyɛ fɛyɩ. Sɔnzɩ liidiye kpou taa yaa fɛ liidiye haʋ se ŋ-paɣzɩ ɖʋʋ.'
  },
  admin_wallet_prefix: {
    fr: 'Portefeuille:',
    en: 'Wallet:',
    ee: 'Gaxɔ:',
    kbp: 'Liidiye kpou:'
  },
  admin_circle_prefix: {
    fr: 'Cercle:',
    en: 'Circle:',
    ee: 'Habɔbɔ:',
    kbp: 'Tontine:'
  },
  admin_credit: {
    fr: 'CRÉDIT',
    en: 'CREDIT',
    ee: 'GA NADEDE',
    kbp: 'SƲƲ'
  },
  admin_debit: {
    fr: 'DÉBIT',
    en: 'DEBIT',
    ee: 'GA NUXEXLẼ',
    kbp: 'LƖƖ'
  },
  admin_no_audit_log: {
    fr: "Aucun log d'audit disponible.",
    en: 'No audit log available.',
    ee: 'Nudzɔdzɔ ŋlɔɖa aɖeke meli o.',
    kbp: 'Cɔnɩyɛ kalɩyɛ fɛyɩ.'
  },
  admin_device: {
    fr: 'Périphérique:',
    en: 'Device:',
    ee: 'Mɔ̃:',
    kbp: 'Kɩlɩzɩ:'
  },
  admin_recon_success: {
    fr: 'Réconciliation terminée avec succès ! Le système est intègre.',
    en: 'Reconciliation completed successfully! The system is sound.',
    ee: 'Ɖekaewɔwɔ wu enu nyuie! Ɖoɖo la le dedie.',
    kbp: 'Ðɔɖʋʋ tɛma camɩyɛ! Ñɔɔzʋʋ wɛ sɩɖʋʋ.'
  },
  admin_recon_failed: {
    fr: 'La réconciliation a échoué.',
    en: 'Reconciliation failed.',
    ee: 'Ɖekaewɔwɔ mewu enu nyuie o.',
    kbp: 'Ðɔɖʋʋ ta se.'
  },
  admin_recon_error: {
    fr: 'Erreur critique de réconciliation.',
    en: 'Critical reconciliation error.',
    ee: 'Vodada gã le ɖekaewɔwɔ me.',
    kbp: 'Ðɔɖʋʋ kɩdɛkɛdɩm sɔsɔm.'
  },
  admin_role_updated: {
    fr: 'Rôle mis à jour',
    en: 'Role updated',
    ee: 'Dɔdeasi Trɔ',
    kbp: 'Tʋmɩyɛ yekiɣ'
  },
  admin_role_error: {
    fr: 'Erreur lors de la mise à jour du rôle.',
    en: 'Error while updating the role.',
    ee: 'Vodada dzɔ le dɔdeasi trɔtrɔ me.',
    kbp: 'Kɩdɛkɛdɩm tʋmɩyɛ yekiɣu taa.'
  },
  admin_user_deleted: {
    fr: 'Utilisateur supprimé',
    en: 'User deleted',
    ee: 'Wotutu Zãnu La',
    kbp: 'Lɩmaɣzɩyʋ pɩ-ɖɩzɩ'
  },
  admin_user_delete_error: {
    fr: "Erreur lors de la suppression de l'utilisateur.",
    en: 'Error while deleting the user.',
    ee: 'Vodada dzɔ le zãnu tutu me.',
    kbp: 'Kɩdɛkɛdɩm lɩmaɣzɩyʋ ɖɩzʋʋ taa.'
  },
  admin_group_deleted: {
    fr: 'Cercle supprimé',
    en: 'Circle deleted',
    ee: 'Wotutu Habɔbɔ La',
    kbp: 'Tontine pɩ-ɖɩzɩ'
  },
  admin_group_delete_error: {
    fr: 'Erreur lors de la suppression du groupe.',
    en: 'Error while deleting the group.',
    ee: 'Vodada dzɔ le habɔbɔ tutu me.',
    kbp: 'Kɩdɛkɛdɩm tontine ɖɩzʋʋ taa.'
  },
  admin_profile_adjusted: {
    fr: 'Profil ajusté',
    en: 'Profile adjusted',
    ee: 'Wotrɔ Ŋkɔmeɖeɖe',
    kbp: 'Ma-ɖɔkɔtɔ pɩ-yekiɣ'
  },
  admin_save_error: {
    fr: 'Échec de la sauvegarde des modifications.',
    en: 'Failed to save changes.',
    ee: 'Trɔtrɔwo dzadzraɖo medze edzi o.',
    kbp: 'Yekiɣu ñɔɔzʋʋ ta se.'
  },
  admin_recon_starting: {
    fr: 'Lancement de la réconciliation comptable en partie double...',
    en: 'Starting double-entry accounting reconciliation...',
    ee: 'Ɖekaewɔwɔ le gaxexlẽ akpa eve dzedzem gɔme...',
    kbp: 'Liidiye kalɩyɛ nabudozo ɖɔɖʋʋ paɣzʋʋ...'
  },
  admin_confirm_delete_user: {
    fr: "⚠️ Êtes-vous sûr de vouloir SUPPRIMER cet utilisateur ? Cette action effacera ses accès et données.",
    en: '⚠️ Are you sure you want to DELETE this user? This action will erase their access and data.',
    ee: "⚠️ Èka ɖe edzi be yeadi be yeatutu zãnu sia ŋkɔ? Nu sia atutu eƒe mɔnukpɔkpɔ kple nyatakakawo.",
    kbp: '⚠️ N-taa se n-ɖɩzɩ lɩmaɣzɩyʋ ɛnɛ na? Lakasɩ ɛnɛ kɩ-ɖɩzɩɣ ɩ-waɖɛ nɛ ɩ-tɔm kɩ-tɩŋa.'
  },
  admin_confirm_delete_group: {
    fr: '⚠️ Êtes-vous sûr de vouloir supprimer ce cercle de tontine ? Les contributions associées seront perdues.',
    en: '⚠️ Are you sure you want to delete this tontine circle? Associated contributions will be lost.',
    ee: '⚠️ Èka ɖe edzi be yeadi be yeatutu tontine habɔbɔ sia? Gaxexlẽ siwo ku ɖe eŋu la abu.',
    kbp: '⚠️ N-taa se n-ɖɩzɩ tontine ɛnɛ na? Liidiye haʋ ŋgʋ kɩ-ɖɔŋ pɩ-yɔɔ yɔ kɩ-tɩɩ tɔlʋʋ.'
  },

  // Profile - toasts, CSV & PDF statement (Sprint 6)
  prof_no_tx_export: {
    fr: "Aucune transaction disponible pour l'export.",
    en: 'No transaction available for export.',
    ee: 'Gaɖoɖo aɖeke meli be woaɖe o.',
    kbp: 'Liidiye ɖʋʋ naɖɩyɛ fɛyɩ se palɩzɩ.'
  },
  prof_csv_exported: {
    fr: 'Historique exporté au format CSV !',
    en: 'History exported to CSV!',
    ee: 'Woɖe ŋutinya la le CSV ƒomevi me!',
    kbp: 'Tɔm tɩŋa palɩzɩ CSV taa!'
  },
  prof_allow_popups: {
    fr: 'Veuillez autoriser les popups pour pouvoir exporter en PDF.',
    en: 'Please allow popups to export as PDF.',
    ee: 'Taflatse ɖe mɔ na popup fesre be nàte ŋu aɖe le PDF me.',
    kbp: 'Taa ha popup waɖɛ se ŋ-lɩzɩ PDF taa.'
  },
  prof_pdf_generated: {
    fr: "Document PDF généré ! Lancez l'impression ou enregistrez au format PDF.",
    en: 'PDF document generated! Print or save as PDF.',
    ee: 'PDF nuŋɔŋlɔ la le anyi! Ta nu alo dzra ɖo le PDF me.',
    kbp: 'PDF sɛbɩyɛ ma. Ma spɩyɛ yaa ñɔɔzɩ PDF taa.'
  },
  prof_push_disabled: {
    fr: 'Notifications push désactivées.',
    en: 'Push notifications disabled.',
    ee: 'Wotu push nyagbedeasi.',
    kbp: 'Push tɔm susuu pɩ-sʋʋ.'
  },
  prof_push_error: {
    fr: 'Erreur lors de la mise à jour des notifications push.',
    en: 'Error while updating push notifications.',
    ee: 'Vodada dzɔ le push nyagbedeasi trɔtrɔ me.',
    kbp: 'Kɩdɛkɛdɩm push tɔm susuu yekiɣu taa.'
  },
  prof_email_error: {
    fr: 'Erreur lors de la mise à jour des préférences email.',
    en: 'Error while updating email preferences.',
    ee: 'Vodada dzɔ le email lɔlɔ̃nu trɔtrɔ me.',
    kbp: 'Kɩdɛkɛdɩm email sɔɔlɩm yekiɣu taa.'
  },
  prof_min_100: {
    fr: 'Veuillez saisir un montant minimum de 200 FCFA.',
    en: 'Please enter a minimum amount of 200 FCFA.',
    ee: 'Taflatse ŋlɔ home si mede 200 FCFA.',
    kbp: 'Taa kalɩ liidiye ñɩma ŋgʋ kɩ-fɛyɩ 200 FCFA.'
  },
  prof_valid_amount: {
    fr: 'Veuillez entrer un montant valide.',
    en: 'Please enter a valid amount.',
    ee: 'Taflatse ŋlɔ home nyuitɔ.',
    kbp: 'Taa kalɩ liidiye ñɩma kɩbaŋʋ.'
  },
  prof_min_withdraw_500: {
    fr: 'Le montant minimum de retrait est de 500 FCFA.',
    en: 'The minimum withdrawal amount is 500 FCFA.',
    ee: 'Ga si nàte ŋu aɖe le eme suetɔ nye 500 FCFA.',
    kbp: 'Kpeɣu liidiye dɔɔsʋ ye 500 FCFA.'
  },
  prof_insufficient_balance: {
    fr: 'Solde insuffisant dans votre portefeuille virtuel.',
    en: 'Insufficient balance in your virtual wallet.',
    ee: 'Ga mede o le wò komputa gaxɔ me.',
    kbp: 'Liidiye fɛyɩ ño-kpou taa.'
  },
  prof_enter_pin_4: {
    fr: 'Veuillez entrer un code PIN à 4 chiffres.',
    en: 'Please enter a 4-digit PIN.',
    ee: 'Taflatse ŋlɔ PIN kod si le xexlẽme 4.',
    kbp: 'Taa kalɩ PIN kɩlɩzɩ sɔɔndʋ 4.'
  },
  prof_withdraw_success: {
    fr: 'Retrait effectué avec succès !',
    en: 'Withdrawal completed successfully!',
    ee: 'Ɖeɖe le eme wu enu nyuie!',
    kbp: 'Kpeɣu tɛma camɩyɛ!'
  },
  prof_withdraw_error: {
    fr: "Une erreur est survenue lors de l'enregistrement de votre retrait.",
    en: 'An error occurred while recording your withdrawal.',
    ee: 'Vodada aɖe dzɔ le wò ɖeɖe le eme ŋɔŋlɔ me.',
    kbp: 'Kɩdɛkɛdɩm lɩna ño-kpeɣu kalʋʋ taa.'
  },
  prof_redirect_paydunya: {
    fr: 'Redirection vers le portail sécurisé Paydunya...',
    en: 'Redirecting to the secure Paydunya portal...',
    ee: 'Wole nu tsɔm yina Paydunya ƒe nɔƒe dedie...',
    kbp: 'Ka tiyu Paydunya lɩmaɣza sɩɖʋʋ...'
  },
  prof_recharge_error: {
    fr: "Erreur lors de l'initiation de la recharge.",
    en: 'Error while initiating the top-up.',
    ee: 'Vodada dzɔ le ga trɔɖeɖe gɔmedzedze me.',
    kbp: 'Kɩdɛkɛdɩm sɔnzʋʋ paɣzʋʋ taa.'
  },
  prof_valid_username: {
    fr: "Veuillez entrer un nom d'utilisateur valide.",
    en: 'Please enter a valid username.',
    ee: 'Taflatse ŋlɔ zãnu ƒe ŋkɔ nyuitɔ.',
    kbp: 'Taa kalɩ hɩɖɛ kɩbaŋɖɛ.'
  },
  prof_pin_exactly_4: {
    fr: 'Le code PIN de retrait doit comporter exactement 4 chiffres.',
    en: 'The withdrawal PIN must be exactly 4 digits.',
    ee: 'Ɖeɖe le eme ƒe PIN kod le be wòanɔ xexlẽme 4 tututu.',
    kbp: 'Kpeɣu PIN kɩlɩzɩ pɩ-wɛɛ se pɩ-kɛ sɔɔndʋ 4 tam-tam.'
  },
  prof_pw_min_6: {
    fr: 'Le nouveau mot de passe doit contenir au moins 6 caractères.',
    en: 'The new password must contain at least 6 characters.',
    ee: 'Nyagbe yeye la le be wòanɔ nyaŋɔŋlɔ 6 teƒe.',
    kbp: 'Tɛmɛnsira kɩfaŋa ɖɔ ka kɛ nɖʋʋ 6 sɔɔndʋ dɔɔsʋ.'
  },
  prof_pw_relogin: {
    fr: 'Pour changer votre mot de passe, veuillez vous déconnecter puis vous reconnecter, et réessayez.',
    en: 'To change your password, please log out and log back in, then try again.',
    ee: 'Be nàtrɔ wò nyagbe la, do le eme eye nàgage ɖe eme, eye nàgadze agbagba.',
    kbp: 'Se ŋ-yekiɣ ño-tɛmɛnsira, lɩɩ nɛ ŋ-tasɩ sʋʋ, nɛ ŋ-tasɩ ño-lakasɩ.'
  },
  prof_pw_change_failed: {
    fr: "Le mot de passe n'a pas pu être modifié : ",
    en: 'The password could not be changed: ',
    ee: 'Womate ŋu atrɔ nyagbe la o : ',
    kbp: 'Tɛmɛnsira ta se yekiɣu : '
  },
  prof_settings_saved: {
    fr: 'Paramètres enregistrés avec succès !',
    en: 'Settings saved successfully!',
    ee: 'Ɖoɖowo dzadzraɖo nyuie!',
    kbp: 'Ñɔɔzʋʋ pɩ-ñɔɔzɩ camɩyɛ!'
  },
  prof_settings_error: {
    fr: 'Erreur lors de la sauvegarde des paramètres.',
    en: 'Error while saving settings.',
    ee: 'Vodada dzɔ le ɖoɖowo dzadzraɖo me.',
    kbp: 'Kɩdɛkɛdɩm ñɔɔzʋʋ marʋʋ taa.'
  },
  prof_type: {
    fr: 'Type',
    en: 'Type',
    ee: 'Ƒomevi',
    kbp: 'Suguu'
  },
  prof_description: {
    fr: 'Description',
    en: 'Description',
    ee: 'Numeɖeɖe',
    kbp: 'Tɔm yɔɔdʋʋ'
  },
  prof_method: {
    fr: 'Méthode',
    en: 'Method',
    ee: 'Mɔnu',
    kbp: 'Ðoŋ'
  },
  prof_credit: {
    fr: 'Crédit',
    en: 'Credit',
    ee: 'Ga Nadede',
    kbp: 'Sʋʋ'
  },
  prof_debit: {
    fr: 'Débit',
    en: 'Debit',
    ee: 'Ga Nuxexlẽ',
    kbp: 'Lɩɩ'
  },
  prof_completed: {
    fr: 'Complété',
    en: 'Completed',
    ee: 'Wowu Enu',
    kbp: 'Pɩ-tɛma'
  },
  prof_date_time: {
    fr: 'Date & Heure',
    en: 'Date & Time',
    ee: 'Ŋkeke & Gaƒoƒo',
    kbp: 'Kɩyakʋ nɛ alɩwaatʋ'
  },
  prof_wallet_statement: {
    fr: 'Relevé de Portefeuille',
    en: 'Wallet Statement',
    ee: 'Gaxɔ ƒe Nyatakaka',
    kbp: 'Kpou taa liidiye kalɩyɛ'
  },
  prof_account_holder: {
    fr: 'Titulaire du compte',
    en: 'Account holder',
    ee: 'Akɔnta Kpɔla',
    kbp: 'Kalɩyɛ tʋ'
  },
  prof_statement_period: {
    fr: 'Période du Relevé',
    en: 'Statement Period',
    ee: 'Nyatakaka ƒe Ɣeyiɣi',
    kbp: 'Kalɩyɛ alɩwaatʋ'
  },
  prof_up_to: {
    fr: "Jusqu'au",
    en: 'Up to',
    ee: 'Vaseɖe',
    kbp: 'Halɩ'
  },
  prof_total_credited: {
    fr: 'Total Crédité',
    en: 'Total Credited',
    ee: 'Ga Nadede Katã',
    kbp: 'Sʋʋ kɩ-tɩŋa'
  },
  prof_total_debited: {
    fr: 'Total Débité',
    en: 'Total Debited',
    ee: 'Ga Nuxexlẽ Katã',
    kbp: 'Lɩɩ kɩ-tɩŋa'
  },
  prof_current_balance: {
    fr: 'Solde Actuel',
    en: 'Current Balance',
    ee: 'Ga si Susɔ Fifia',
    kbp: 'Liidiye ɖɩŋ lɛɛlɛɛyɔ'
  },
  prof_movement: {
    fr: 'Mouvement',
    en: 'Movement',
    ee: 'Nuʋuʋu',
    kbp: 'Ðɔɖʋʋ'
  },
  prof_pdf_footer: {
    fr: 'Document généré électroniquement par eganyé - Votre tontine numérique fiable et solidaire.',
    en: 'Document generated electronically by eganyé - Your reliable and united digital tontine.',
    ee: 'eganyé wɔ nuŋɔŋlɔ sia to komputa dzi - Wò tontine si dzi woka ɖo eye wòbla mia ɖekae.',
    kbp: 'eganyé ma sɛbɩyɛ ɛnɛ kpou taa - Ño-tontine ŋgʋ pɩ-lidaɣ nɛ pɩ-kpɛndʋʋ yɔ.'
  },
  prof_rights_reserved: {
    fr: 'Tous droits réservés.',
    en: 'All rights reserved.',
    ee: 'Gome siwo katã le eŋu la wodzra ɖo.',
    kbp: 'Waɖɛ kɩ-tɩŋa kɩ-mʋʋ.'
  },

  // Profile - score section, header & tiers (Sprint 6)
  prof_score_calculator: {
    fr: 'Calculateur de Score de Réputation en Temps Réel',
    en: 'Real-Time Reputation Score Calculator',
    ee: 'Ŋkɔ Nyui Xexlẽme Helẽ Le Ɣeyiɣi Ma Nu',
    kbp: 'Hɩɖɛ kɩlaʋ kalɩyʋ lɛɛlɛɛyɔ'
  },
  prof_score_calc_desc: {
    fr: "Le score récompense la rigueur de vos dépôts pour sécuriser le cercle d'épargne.",
    en: 'The score rewards the discipline of your deposits to secure the savings circle.',
    ee: 'Xexlẽme la naa fetu ale si nètoa nu tututu le ga dede me be nàkpɔ tontine habɔbɔ dzi.',
    kbp: 'Kɩlaʋ ɛnɛ ɖɩsɔɔlɩ ño-liidiye haʋ ɖɔɖʋʋ se pɩ-ɖɔɔsɩ tontine.'
  },
  prof_trust_score: {
    fr: 'Score de Confiance',
    en: 'Trust Score',
    ee: 'Kakaɖedzi Xexlẽme',
    kbp: 'Lidaʋ kɩlaʋ'
  },
  prof_initial_capital: {
    fr: 'Capital initial octroyé',
    en: 'Initial capital granted',
    ee: 'Gɔmedzedze ga si wona wò',
    kbp: 'Liidiye kajalaɣ ŋgʋ pɔ-hɔ-ŋ yɔ'
  },
  prof_payment_bonus: {
    fr: 'Bonus Versements',
    en: 'Payment Bonus',
    ee: 'Fexexlẽ Bonus',
    kbp: 'Fenaɣ ñɔɔzʋʋ ɖɔ-yɔɔ'
  },
  prof_payments_paid_label: {
    fr: 'versement(s) payé(s)',
    en: 'payment(s) made',
    ee: 'fexexlẽ si woxee',
    kbp: 'fenaɣ ñɔɔzʋʋ pɩ-fɛlɩ'
  },
  prof_late_penalties: {
    fr: 'Pénalités Retards',
    en: 'Late Penalties',
    ee: 'Tsitsi Tohehewo',
    kbp: 'Kɩgbɛdɩŋ tɔlɩm'
  },
  prof_lates_noted: {
    fr: 'retard(s) constaté(s)',
    en: 'late(s) recorded',
    ee: 'tsitsi si wokpɔ',
    kbp: 'kɩgbɛdɩŋ pakalɩ'
  },
  prof_current_score: {
    fr: 'Score Actuel',
    en: 'Current Score',
    ee: 'Xexlẽme si Li Fifia',
    kbp: 'Kɩlaʋ lɛɛlɛɛyɔ'
  },
  prof_live_updated: {
    fr: 'Cliqué & mis à jour en direct',
    en: 'Clicked & updated live',
    ee: 'Wote asi edzi & wotrɔe wɔ yeye enumake',
    kbp: 'Pɩ-tɩlɩ nɛ pɩ-yekiɣ lɛɛlɛɛyɔ'
  },
  prof_improve_tip: {
    fr: "Conseil d'amélioration personnalisé",
    en: 'Personalized improvement tip',
    ee: 'Aɖaŋuɖoɖo si le wò ŋutɔ ta be nàva nyo ɖe edzi',
    kbp: 'Ñɩnɩ ŋga kɩ-ɖɔŋ ño-yɔɔ se ŋ-cɛzɩɣ yɔ'
  },
  prof_global_reliability: {
    fr: 'Fiabilité Globale',
    en: 'Overall Reliability',
    ee: 'Dzikpɔkpɔ Katã',
    kbp: 'Lidaʋ kɩ-tɩŋa'
  },
  prof_instant_treasury: {
    fr: 'Performance instantanée de trésorerie',
    en: 'Instant treasury performance',
    ee: 'Ale si gadzikpɔƒe la le dɔ wɔm enumake',
    kbp: 'Liidiye mara ɖɔ tɔm lɛɛlɛɛyɔ'
  },
  prof_tier_s_name: {
    fr: 'Fiabilité Exemplaire',
    en: 'Exemplary Reliability',
    ee: 'Dzikpɔkpɔ Kpɔɖeŋu',
    kbp: 'Lidaʋ kɩbaŋʋ'
  },
  prof_tier_s_desc: {
    fr: 'Excellent gestionnaire. Vos cotisations sont toujours payées à temps ou en avance.',
    en: 'Excellent manager. Your contributions are always paid on time or early.',
    ee: 'Dzikpɔla nyuitɔ. Wò gaxexlẽwo woxena ɣesiaɣi le ɣeyiɣi nyuitɔ dzi alo do ŋgɔ.',
    kbp: 'Ñɩɩnɩyʋ kɩbaŋʋ. Ño-liidiye haʋ pɩ-fɛlɩɣ alɩwaatʋ taa yaa pɩ-kɔŋ.'
  },
  prof_tier_a_name: {
    fr: 'Membre de Confiance',
    en: 'Trusted Member',
    ee: 'Xɔ́ si Dzi Woka Ɖo',
    kbp: 'Mʋyʋ danamalʋ'
  },
  prof_tier_a_desc: {
    fr: 'Trésorier et adhérent performant. Vous honorez vos échéances avec régularité.',
    en: 'High-performing treasurer and member. You meet your deadlines regularly.',
    ee: 'Gadzikpɔla kple xɔ́ si wɔa dɔ nyuie. Èléa wò ɣeyiɣiwo dzi edziedzi.',
    kbp: 'Waribɔla nɛ mʋyʋ kɩbaŋʋ. N-fɛɣ ño-kɩyakʋ tam-tam.'
  },
  prof_tier_b_name: {
    fr: 'Profil Régulier',
    en: 'Regular Profile',
    ee: 'Ŋkɔmeɖeɖe Nɔrmaltɔ',
    kbp: 'Ma-ɖɔkɔtɔ ɖɔɖɔ'
  },
  prof_tier_b_desc: {
    fr: 'Membre correct. Essayez de régler vos cotisations un peu plus tôt pour remonter de Tier.',
    en: 'Fair member. Try to pay your contributions a bit earlier to move up a Tier.',
    ee: 'Xɔ́ nyuitɔ. Dze agbagba nàxe wò gaxexlẽwo kaba vie be nàyi tier bubu me.',
    kbp: 'Mʋyʋ kɩbaŋʋ. Ñɩnɩ se ŋ-fɛ ño-liidiye haʋ lɛɛ joona se ŋ-kpaɖɩ tier.'
  },
  prof_tier_c_name: {
    fr: 'Score Fragile',
    en: 'Fragile Score',
    ee: 'Xexlẽme si Gbã Bɔbɔe',
    kbp: 'Kɩlaʋ ŋga kɩ-tɩɩ sɩɖʋʋ yɔ'
  },
  prof_tier_c_desc: {
    fr: 'Des retards répétés ont affecté votre fiabilité financière. Réglez les cotisations en suspens.',
    en: 'Repeated delays have affected your financial reliability. Settle the pending contributions.',
    ee: 'Tsitsi gbe gbe gblẽ wò gadzikpɔkpɔ nyuie la me. Xe gaxexlẽ siwo susɔ.',
    kbp: 'Kɩgbɛdɩŋ tam-tam ɖɩzɩ ño-liidiye lidaʋ. Fɛ liidiye haʋ ŋgʋ kɩ-caɣ yɔ.'
  },
  prof_unknown_circle: {
    fr: 'Cercle inconnu',
    en: 'Unknown circle',
    ee: 'Habɔbɔ si womenya o',
    kbp: 'Tontine ŋgʋ paatɩlɩɣ yɔ'
  },
  prof_registered_on: {
    fr: 'Inscrit le',
    en: 'Registered on',
    ee: 'Woŋlɔe ŋkɔ le',
    kbp: 'Pakalɩ-ɩ'
  },

  // Profile - wallet cards, recharge/withdraw dialogs & stats (Sprint 6)
  prof_virtual_wallet: {
    fr: 'Portefeuille Virtuel Tontine',
    en: 'Virtual Tontine Wallet',
    ee: 'Tontine Komputa Gaxɔ',
    kbp: 'Tontine liidiye kpou'
  },
  prof_secured_paydunya: {
    fr: 'Sécurisé par Paydunya',
    en: 'Secured by Paydunya',
    ee: 'Paydunya Le Ekpɔm Dzi',
    kbp: 'Paydunya ɩ-sɩɖɩ-ɩ'
  },
  prof_balance_available_desc: {
    fr: 'Solde disponible pour vos prélèvements et versements automatiques.',
    en: 'Balance available for your automatic debits and payments.',
    ee: 'Ga si li be woazãe na wò ga nuxexlẽ kple fexexlẽ siwo wɔna wo ɖokui.',
    kbp: 'Liidiye ɖɩŋ ŋgʋ kɩ-wɛɛ ño-liidiye lɩʋ nɛ fenaɣ ñɔɔzʋʋ ɖɔɖɔyɔ ñʋʋ taa yɔ.'
  },
  prof_recharge_via_paydunya: {
    fr: 'Recharger via Paydunya',
    en: 'Recharge via Paydunya',
    ee: 'Trɔ Ga De Eme To Paydunya Dzi',
    kbp: 'Sɔnzɩ liidiye Paydunya yɔɔ'
  },
  prof_recharge_dialog_desc: {
    fr: 'Alimentez votre portefeuille virtuel via Paydunya (Flooz, T-Money, Carte Bancaire) pour automatiser vos cotisations quotidiennes de tontine.',
    en: 'Fund your virtual wallet via Paydunya (Flooz, T-Money, Bank Card) to automate your daily tontine contributions.',
    ee: 'Trɔ ga de wò komputa gaxɔ me to Paydunya dzi (Flooz, T-Money, Gakaɖi) be wò tontine gaxexlẽ gbesiagbe nàwɔ eɖokui.',
    kbp: 'Sɔnzɩ ño-kpou taa Paydunya yɔɔ (Flooz, T-Money, Banki kaatɩ) se ño-tontine liidiye haʋ kɩyakʋ kʋɖʋmaɣ ɩ-la ɩ-maɣmaɣ.'
  },
  prof_recharge_amount: {
    fr: 'Montant de la recharge (FCFA)',
    en: 'Top-up amount (FCFA)',
    ee: 'Ga home si nàtsɔ (FCFA)',
    kbp: 'Sɔnzʋʋ liidiye ñɩma (FCFA)'
  },
  prof_ex_5000: {
    fr: 'Ex: 5000',
    en: 'e.g. 5000',
    ee: 'Kpɔɖeŋu: 5000',
    kbp: 'Ɛzɩ: 5000'
  },
  prof_min_amount_100: {
    fr: 'Montant minimum : 100 FCFA',
    en: 'Minimum amount: 100 FCFA',
    ee: 'Ga home suetɔ : 100 FCFA',
    kbp: 'Liidiye ñɩma dɔɔsʋ : 100 FCFA'
  },
  prof_redirecting: {
    fr: 'Redirection...',
    en: 'Redirecting...',
    ee: 'Wole Nu Tsɔm...',
    kbp: 'Ka tiyu...'
  },
  prof_proceed_payment: {
    fr: 'Procéder au paiement',
    en: 'Proceed to payment',
    ee: 'Yi Edzi Kple Fexexlẽ',
    kbp: 'Ðɔ nɛ fenaɣ ñɔɔzʋʋ yɔɔ'
  },
  prof_withdraw_funds: {
    fr: 'Retirer mes fonds',
    en: 'Withdraw my funds',
    ee: 'Ɖe Nye Ga Le Eme',
    kbp: 'Kpeɣ man liidiye'
  },
  prof_withdraw_money: {
    fr: "Retirer de l'argent",
    en: 'Withdraw money',
    ee: 'Ɖe Ga Le Eme',
    kbp: 'Kpeɣ liidiye'
  },
  prof_withdraw_dialog_desc: {
    fr: 'Transférez vos gains ou fonds disponibles de votre portefeuille virtuel vers votre compte externe (Mobile Money ou Carte Bancaire).',
    en: 'Transfer your gains or available funds from your virtual wallet to your external account (Mobile Money or Bank Card).',
    ee: 'Ɖo wò viɖe alo ga si li le wò komputa gaxɔ me ɖe wò akɔnta bubu si le gota (Mobile Money alo Gakaɖi).',
    kbp: 'Tiyi ño-liidiye yaa ɖɩŋ ŋgʋ kɩ-wɛɛ ño-kpou taa yɔ ño-kalɩyɛ lɛɛka taa (Mobile Money yaa Banki kaatɩ).'
  },
  prof_amount_to_withdraw: {
    fr: 'Montant à retirer (FCFA)',
    en: 'Amount to withdraw (FCFA)',
    ee: 'Ga home si nàɖe (FCFA)',
    kbp: 'Kpeɣu liidiye ñɩma (FCFA)'
  },
  prof_available_balance: {
    fr: 'Solde disponible',
    en: 'Available balance',
    ee: 'Ga si Li',
    kbp: 'Liidiye ɖɩŋ ŋgʋ kɩ-wɛɛ yɔ'
  },
  prof_withdraw_method: {
    fr: 'Moyen de retrait',
    en: 'Withdrawal method',
    ee: 'Ɖeɖe le eme Mɔnu',
    kbp: 'Kpeɣu ɖoŋ'
  },
  prof_card: {
    fr: 'Carte',
    en: 'Card',
    ee: 'Kaɖi',
    kbp: 'Kaatɩ'
  },
  prof_dest_details: {
    fr: 'Numéro de téléphone / Coordonnées de destination',
    en: 'Phone number / Destination details',
    ee: 'Kaɖifon Xexlẽ / Nɔƒe si Woɖo Ɖo',
    kbp: 'Kaɖifɔɔnɩ nimɔrɔ / Tɔm ndʋ'
  },
  prof_ex_phone: {
    fr: 'Ex: +228 90 00 00 00',
    en: 'e.g. +228 90 00 00 00',
    ee: 'Kpɔɖeŋu: +228 90 00 00 00',
    kbp: 'Ɛzɩ: +228 90 00 00 00'
  },
  prof_2fa_pin: {
    fr: '2FA : Entrez votre code PIN de Retrait',
    en: '2FA: Enter your Withdrawal PIN',
    ee: '2FA : Ŋlɔ wò Ɖeɖe le eme ƒe PIN Kod',
    kbp: '2FA : Kalɩ ño-kpeɣu PIN'
  },
  prof_wrong_pin_blocks: {
    fr: "Un code PIN incorrect bloquera l'opération (Par défaut: 0000).",
    en: 'An incorrect PIN will block the operation (Default: 0000).',
    ee: 'PIN kod si mesɔ o la axe mɔ na dɔwɔwɔ la (Le gɔmedzedze me: 0000).',
    kbp: 'PIN ŋga kɩ-tɩɩ ɖɔŋ yɔ, kɩ-kpaɣ lakasɩ (Kɩ-kajalaɣ: 0000).'
  },
  prof_secure_withdrawing: {
    fr: 'Retrait sécurisé...',
    en: 'Secure withdrawal...',
    ee: 'Ɖeɖe le eme le Dedie...',
    kbp: 'Kpeɣu ka sɩɖʋʋ...'
  },
  prof_confirm_withdraw: {
    fr: 'Confirmer le retrait',
    en: 'Confirm withdrawal',
    ee: 'Da Asi Ɖe Ɖeɖe le eme Dzi',
    kbp: 'Ña kpeɣu'
  },
  // NOTE: ee/kbp not yet translated for this group — duplicated from fr so
  // the app shows correct French rather than fabricated Ewe/Kabiyè text.
  // Same visible result as the t() fallback, spelled out explicitly here
  // because `translations` requires all four LanguageCode keys.
  prof_withdraw_operator_label: {
    fr: 'Opérateur Mobile Money',
    en: 'Mobile Money operator',
    ee: 'Opérateur Mobile Money',
    kbp: 'Opérateur Mobile Money'
  },
  prof_operator_flooz: {
    fr: 'Flooz (Moov)',
    en: 'Flooz (Moov)',
    ee: 'Flooz (Moov)',
    kbp: 'Flooz (Moov)'
  },
  prof_operator_tmoney: {
    fr: 'T-Money (Togocom)',
    en: 'T-Money (Togocom)',
    ee: 'T-Money (Togocom)',
    kbp: 'T-Money (Togocom)'
  },
  // NOTE: ee/kbp not yet translated for this group — duplicated from fr, comme
  // pour prof_withdraw_operator_label ci-dessus.
  pay_country_label: {
    fr: 'Pays',
    en: 'Country',
    ee: 'Pays',
    kbp: 'Pays'
  },
  pay_operator_label: {
    fr: 'Opérateur',
    en: 'Operator',
    ee: 'Opérateur',
    kbp: 'Opérateur'
  },
  pay_available_methods_prefix: {
    fr: 'Réglable via :',
    en: 'Payable via:',
    ee: 'Réglable via :',
    kbp: 'Réglable via :'
  },
  recharge_pending_title: {
    fr: 'Confirmez sur votre téléphone',
    en: 'Confirm on your phone',
    ee: 'Confirmez sur votre téléphone',
    kbp: 'Confirmez sur votre téléphone'
  },
  recharge_pending_desc_prefix: {
    fr: 'Une demande de débit de',
    en: 'A debit request for',
    ee: 'Une demande de débit de',
    kbp: 'Une demande de débit de'
  },
  recharge_pending_desc_suffix: {
    fr: 'a été envoyée sur votre téléphone. Validez-la pour terminer la recharge.',
    en: 'has been sent to your phone. Approve it to complete the top-up.',
    ee: 'a été envoyée sur votre téléphone. Validez-la pour terminer la recharge.',
    kbp: 'a été envoyée sur votre téléphone. Validez-la pour terminer la recharge.'
  },
  recharge_pending_cancel: {
    fr: 'Annuler',
    en: 'Cancel',
    ee: 'Annuler',
    kbp: 'Annuler'
  },
  recharge_pending_close: {
    fr: 'Fermer',
    en: 'Close',
    ee: 'Fermer',
    kbp: 'Fermer'
  },
  recharge_success_title: {
    fr: 'Paiement confirmé ! Votre solde sera mis à jour sous peu.',
    en: 'Payment confirmed! Your balance will update shortly.',
    ee: 'Paiement confirmé ! Votre solde sera mis à jour sous peu.',
    kbp: 'Paiement confirmé ! Votre solde sera mis à jour sous peu.'
  },
  recharge_failed_title: {
    fr: "Aucune confirmation reçue. Réessayez, ou vérifiez que vous avez bien validé la demande sur votre téléphone.",
    en: 'No confirmation received. Try again, or check that you approved the request on your phone.',
    ee: "Aucune confirmation reçue. Réessayez, ou vérifiez que vous avez bien validé la demande sur votre téléphone.",
    kbp: "Aucune confirmation reçue. Réessayez, ou vérifiez que vous avez bien validé la demande sur votre téléphone."
  },
  prof_enter_recharge_phone: {
    fr: 'Entrez le numéro Mobile Money qui effectuera le paiement',
    en: 'Enter the Mobile Money number that will make the payment',
    ee: 'Entrez le numéro Mobile Money qui effectuera le paiement',
    kbp: 'Entrez le numéro Mobile Money qui effectuera le paiement'
  },
  prof_withdraw_phone_placeholder: {
    fr: '+228 90 00 00 00',
    en: '+228 90 00 00 00',
    ee: '+228 90 00 00 00',
    kbp: '+228 90 00 00 00'
  },
  prof_enter_withdraw_operator: {
    fr: 'Choisissez un opérateur Mobile Money',
    en: 'Choose a Mobile Money operator',
    ee: 'Choisissez un opérateur Mobile Money',
    kbp: 'Choisissez un opérateur Mobile Money'
  },
  prof_enter_valid_phone: {
    fr: 'Entrez le numéro Mobile Money qui doit recevoir le retrait',
    en: 'Enter the Mobile Money number that should receive the withdrawal',
    ee: 'Entrez le numéro Mobile Money qui doit recevoir le retrait',
    kbp: 'Entrez le numéro Mobile Money qui doit recevoir le retrait'
  },
  prof_withdraw_confirm_title: {
    fr: 'Vérifiez ce retrait',
    en: 'Review this withdrawal',
    ee: 'Vérifiez ce retrait',
    kbp: 'Vérifiez ce retrait'
  },
  prof_withdraw_confirm_desc: {
    fr: "L'argent sera envoyé sur ce numéro Mobile Money. Vérifiez qu'il est correct avant de continuer — ce n'est pas modifiable une fois envoyé.",
    en: 'The money will be sent to this Mobile Money number. Double-check it before continuing — it cannot be changed once sent.',
    ee: "L'argent sera envoyé sur ce numéro Mobile Money. Vérifiez qu'il est correct avant de continuer — ce n'est pas modifiable une fois envoyé.",
    kbp: "L'argent sera envoyé sur ce numéro Mobile Money. Vérifiez qu'il est correct avant de continuer — ce n'est pas modifiable une fois envoyé."
  },
  prof_total_capital_saved: {
    fr: 'Capital Total Épargné',
    en: 'Total Capital Saved',
    ee: 'Gadzraɖo Katã',
    kbp: 'Liidiye maralen kɩ-tɩŋa'
  },
  prof_all_circles_combined: {
    fr: "Tous les cercles d'épargne confondus",
    en: 'All savings circles combined',
    ee: 'Gadzraɖo habɔbɔwo katã ƒoƒu',
    kbp: 'Tontinaa kɩ-tɩŋa lajɛlaɣ'
  },
  prof_punctuality_rate: {
    fr: 'Taux de Ponctualité',
    en: 'Punctuality Rate',
    ee: 'Ɣeyiɣi Dede Nɔnɔme Xexlẽme',
    kbp: 'Alɩwaatʋ taa lakasɩ kɩlaʋ'
  },
  prof_punctuality_desc: {
    fr: 'Mesure la part de paiements faits à temps sans dépassement ou pénalités de retard.',
    en: 'Measures the share of payments made on time without overrun or late penalties.',
    ee: 'Edzidzena ale si fexexlẽ siwo wowɔ le ɣeyiɣi nyuitɔ dzi la sɔ gbɔ, ke tsitsi tohehe aɖeke meli o.',
    kbp: 'Kɩ-kalɩɣ fenaɣ ñɔɔzʋʋ ŋgʋ kɩ-lakɩ alɩwaatʋ taa nɛ tɔlɩm fɛyɩ yɔ.'
  },
  prof_active_circles_joined: {
    fr: 'Cercles Actifs Rejoints',
    en: 'Active Circles Joined',
    ee: 'Habɔbɔ siwo le Dɔwɔm si Nège Ɖo',
    kbp: 'Tontinaa wena n-kpɛndaa yɔ'
  },
  prof_member_of_prefix: {
    fr: 'Vous êtes membre de',
    en: 'You are a member of',
    ee: 'Ènye xɔ́ na',
    kbp: 'N-kɛ mʋyʋ'
  },
  prof_member_of_suffix: {
    fr: "différents cercles d'épargne tontine actifs.",
    en: 'different active tontine savings circles.',
    ee: 'tontine gadzraɖo habɔbɔ vovovo siwo le dɔwɔm.',
    kbp: 'tontinaa wena awɛ ñʋʋ taa yɔ kɩ-taa.'
  },
  prof_contributions_dashboard: {
    fr: 'Tableau de bord des cotisations',
    en: 'Contributions dashboard',
    ee: 'Gaxexlẽ Ŋɔŋlɔdzesi',
    kbp: 'Liidiye haʋ ñɩnɖɛ'
  },
  prof_paid_plural: {
    fr: 'Payés',
    en: 'Paid',
    ee: 'Woxee',
    kbp: 'Pɩ-fɛlɩ'
  },
  prof_lates: {
    fr: 'Retards',
    en: 'Late',
    ee: 'Tsitsiwo',
    kbp: 'Kɩgbɛdɩŋ'
  },
  prof_to_pay: {
    fr: 'À payer',
    en: 'To pay',
    ee: 'Woaxe',
    kbp: 'Kɩ-caɣ fɛʋ'
  },

  // Profile - tabs, tables, empty states (Sprint 6)
  prof_contributions_registry: {
    fr: 'Registre des Contributions',
    en: 'Contributions Registry',
    ee: 'Gaxexlẽwo Ŋɔŋlɔ',
    kbp: 'Liidiye haʋ kalɩyɛ'
  },
  prof_contributions_registry_desc: {
    fr: 'Historique complet de toutes vos transactions et justificatifs de versement',
    en: 'Full history of all your transactions and payment proofs',
    ee: 'Wò gaɖoɖo kple fexexlẽ kpeɖodzinya siwo katã ƒe ŋutinya blibo',
    kbp: 'Ño-liidiye ɖʋʋ nɛ fenaɣ ñɔɔzʋʋ spɩyɛ kɩ-tɩŋa'
  },
  prof_in_verification: {
    fr: 'En vérification',
    en: 'Under verification',
    ee: 'Wole Ekpɔm',
    kbp: 'Ka pɔzʋʋ'
  },
  prof_fetching_ledger: {
    fr: 'Récupération du registre de trésorerie...',
    en: 'Fetching treasury registry...',
    ee: 'Wole gadzikpɔƒe ŋɔŋlɔ xɔm...',
    kbp: 'Ka lɩzʋʋ liidiye kalɩyɛ...'
  },
  prof_no_contribution: {
    fr: 'Aucune contribution',
    en: 'No contribution',
    ee: 'Gaxexlẽ aɖeke meli o',
    kbp: 'Liidiye haʋ fɛyɩ'
  },
  prof_no_contribution_desc: {
    fr: "Aucune contribution n'a été enregistrée dans cette catégorie pour le moment. Vos cotisations s'afficheront ici automatiquement.",
    en: 'No contribution has been recorded in this category yet. Your contributions will appear here automatically.',
    ee: 'Womeŋlɔ gaxexlẽ aɖeke ɖi le ƒomevi sia me haɖe o. Wò gaxexlẽwo ado le afisia eɖokui si.',
    kbp: 'Liidiye haʋ naɖɩyɛ fɛyɩ suguu ɛnɛ taa fɛyɛ. Ño-liidiye haʋ kɩ-lɩɣ cɩnɛ ɖɔɖɔyɔ.'
  },
  prof_circle_col: {
    fr: "Cercle d'épargne",
    en: 'Savings circle',
    ee: 'Gadzraɖo Habɔbɔ',
    kbp: 'Marali tontine'
  },
  prof_call_period_col: {
    fr: "Période d'appel",
    en: 'Call period',
    ee: 'Yɔyɔ Ɣeyiɣi',
    kbp: 'Yaʋ alɩwaatʋ'
  },
  prof_due_date_col: {
    fr: "Date d'échéance",
    en: 'Due date',
    ee: 'Ɣeyiɣi si Woɖo',
    kbp: 'Kɩyakʋ ŋga kɩ-caɣ yɔ'
  },
  prof_id_ref_col: {
    fr: 'Identifiant / Réf de transaction',
    en: 'ID / Transaction reference',
    ee: 'Dzesi / Gaɖoɖo Dzesi',
    kbp: 'Idɛntitee / Liidiye ɖʋʋ tʋmɩyɛ'
  },
  prof_direct_validation: {
    fr: 'Validation direct',
    en: 'Direct validation',
    ee: 'Ɖoɖo Tẽe',
    kbp: 'Ñaʋ cɛɖɛɛ'
  },
  prof_wallet_transactions: {
    fr: 'Transactions du Portefeuille',
    en: 'Wallet Transactions',
    ee: 'Gaxɔ Gaɖoɖowo',
    kbp: 'Kpou taa liidiye ɖʋʋ'
  },
  prof_wallet_transactions_desc: {
    fr: 'Historique complet de vos recharges Paydunya, prélèvements automatiques et payouts de tontine.',
    en: 'Full history of your Paydunya top-ups, automatic debits and tontine payouts.',
    ee: 'Wò Paydunya ga trɔɖeɖe, ga nuxexlẽ siwo wɔna wo ɖokui kple tontine mavomavowo ƒe ŋutinya blibo.',
    kbp: 'Ño-Paydunya sɔnzʋʋ, liidiye lɩʋ ɖɔɖɔyɔ nɛ tontine liidiye lɩʋ kɩ-tɩŋa.'
  },
  prof_export_csv: {
    fr: 'Export CSV',
    en: 'Export CSV',
    ee: 'Ɖe CSV',
    kbp: 'Lɩzɩ CSV'
  },
  prof_statement_pdf: {
    fr: 'Statement PDF',
    en: 'PDF Statement',
    ee: 'PDF Nyatakaka',
    kbp: 'PDF kalɩyɛ'
  },
  prof_fetching_wallet: {
    fr: "Récupération de l'historique du portefeuille...",
    en: 'Fetching wallet history...',
    ee: 'Wole gaxɔ ŋutinya xɔm...',
    kbp: 'Ka lɩzʋʋ kpou taa tɔm...'
  },
  prof_no_transaction: {
    fr: 'Aucune transaction',
    en: 'No transaction',
    ee: 'Gaɖoɖo aɖeke meli o',
    kbp: 'Liidiye ɖʋʋ fɛyɩ'
  },
  prof_no_transaction_desc: {
    fr: "Votre portefeuille virtuel n'a encore enregistré aucun mouvement financier. Effectuez un rechargement pour commencer !",
    en: 'Your virtual wallet has not recorded any financial movement yet. Make a top-up to get started!',
    ee: 'Wò komputa gaxɔ meŋlɔ ga ƒe nuʋuʋu aɖeke ɖi haɖe o. Trɔ ga de eme be nàdze egɔme!',
    kbp: 'Ño-kpou ta liidiye ɖɔɖʋʋ naɖɩyɛ fɛyɩ fɛyɛ. Sɔnzɩ liidiye se ŋ-paɣzɩ!'
  },

  // Profile - settings tab (Sprint 6)
  prof_general_settings: {
    fr: "Paramètres généraux d'eganyé",
    en: 'eganyé general settings',
    ee: 'eganyé ƒe Ɖoɖo Gbatoawo',
    kbp: 'eganyé ñɔɔzʋʋ tɩŋa'
  },
  prof_general_settings_desc: {
    fr: "Personnalisez vos identifiants de connexion, la langue de l'application, et dessinez votre avatar vectoriel unique.",
    en: 'Customize your login credentials, the app language, and design your unique vector avatar.',
    ee: 'Trɔ wò gadede nyawo, app ƒe gbe, eye nàta wò avatar tɔxɛ.',
    kbp: 'Yekiɣ ño-sʋʋ tɔm, app kʋnʋŋ nɛ ma ño-lɔŋ maɣmaɣ.'
  },
  prof_security_identity: {
    fr: 'Sécurité & Identité',
    en: 'Security & Identity',
    ee: 'Dedienɔnɔme & Dzesi',
    kbp: 'Ñʋʋ taa lakasɩ nɛ hɩɖɛ'
  },
  prof_username_nickname: {
    fr: "Nom d'utilisateur / Surnom",
    en: 'Username / Nickname',
    ee: 'Zãnu Ŋkɔ / Lãkɔ',
    kbp: 'Lɩmaɣzɩyʋ hɩɖɛ'
  },
  prof_ex_name: {
    fr: 'Ex: Ama Kodjo',
    en: 'e.g. Ama Kodjo',
    ee: 'Kpɔɖeŋu: Ama Kodjo',
    kbp: 'Ɛzɩ: Ama Kodjo'
  },
  prof_new_password: {
    fr: 'Nouveau mot de passe',
    en: 'New password',
    ee: 'Nyagbe Yeye',
    kbp: 'Tɛmɛnsira kɩfaŋa'
  },
  prof_leave_blank: {
    fr: 'Laisser vide pour ne pas changer',
    en: 'Leave blank to keep unchanged',
    ee: 'Gblẽe ɖi ƒuƒlu ne mèdi be yeatrɔe o',
    kbp: 'Ta lakolen ni n-tɩɩ yekiɣu'
  },
  prof_leave_blank_pw_desc: {
    fr: 'Laissé vide si vous ne voulez pas changer votre mot de passe. Minimum 6 caractères.',
    en: 'Leave blank if you do not want to change your password. Minimum 6 characters.',
    ee: 'Gblẽe ɖi ƒuƒlu ne mèdi be yeatrɔ wò nyagbe o. Nyaŋɔŋlɔ 6 teƒe suetɔ.',
    kbp: 'Ta lakolen ni n-tɩɩ yekiɣu ño-tɛmɛnsira. Sɔɔndʋ 6 dɔɔsʋ.'
  },
  prof_withdrawal_pin: {
    fr: 'Code PIN de Retrait Sécurisé (4 chiffres)',
    en: 'Secure Withdrawal PIN (4 digits)',
    ee: 'Ɖeɖe le eme ƒe PIN Kod Dedie (Xexlẽme 4)',
    kbp: 'Kpeɣu PIN sɩɖʋʋ (sɔɔndʋ 4)'
  },
  prof_pin_placeholder_set: {
    fr: '••••',
    en: '••••',
    ee: '••••',
    kbp: '••••'
  },
  prof_pin_placeholder_define: {
    fr: 'Définir un code PIN',
    en: 'Set a PIN code',
    ee: 'Ɖo PIN Kod',
    kbp: 'Ñɔɔzɩ PIN kɩlɩzɩ'
  },
  prof_pin_desc: {
    fr: "Sert d'authentification pour toutes vos actions de retrait. Laissé vide pour ne pas changer.",
    en: 'Used to authenticate all your withdrawal actions. Leave blank to keep unchanged.',
    ee: 'Wozãnɛ be wòakpɔ egbɔ be wò ɖeɖe le eme dɔwɔwɔwo katã le wò tɔ. Gblẽe ɖi ƒuƒlu ne mèdi be yeatrɔe o.',
    kbp: 'Pɩ-wɛɛ se pɩ-tɔzɩ ño-kpeɣu lakasɩ kɩ-tɩŋa. Ta lakolen ni n-tɩɩ yekiɣu.'
  },
  prof_notifications_section: {
    fr: 'Notifications',
    en: 'Notifications',
    ee: 'Nyagbedeasiwo',
    kbp: 'Tɔm susuu'
  },
  prof_push_notif: {
    fr: 'Notifications push',
    en: 'Push notifications',
    ee: 'Push Nyagbedeasi',
    kbp: 'Push tɔm susuu'
  },
  prof_push_notif_desc: {
    fr: 'Recevoir des alertes même app fermée',
    en: 'Receive alerts even when the app is closed',
    ee: 'Xɔ nyaɖeɖe ne app la gɔ̃ hã tui',
    kbp: 'Mʋ tɔm susuu ha app pɩ-sʋʋ yɔ'
  },
  prof_enable_push: {
    fr: 'Activer les notifications push',
    en: 'Enable push notifications',
    ee: 'Wɔ Push Nyagbedeasi Dɔ',
    kbp: 'La push tɔm susuu'
  },
  prof_disable_push: {
    fr: 'Désactiver les notifications push',
    en: 'Disable push notifications',
    ee: 'Tu Push Nyagbedeasi',
    kbp: 'Kpaɣ push tɔm susuu'
  },
  prof_email_notif: {
    fr: 'Notifications par email',
    en: 'Email notifications',
    ee: 'Email Nyagbedeasi',
    kbp: 'Email tɔm susuu'
  },
  prof_email_notif_desc: {
    fr: 'Recevoir un résumé par email',
    en: 'Receive a summary by email',
    ee: 'Xɔ nyakpitiwo to email dzi',
    kbp: 'Mʋ tɔm kpɩyɩnɖʋ email taa'
  },
  prof_enable_email: {
    fr: 'Activer les notifications par email',
    en: 'Enable email notifications',
    ee: 'Wɔ Email Nyagbedeasi Dɔ',
    kbp: 'La email tɔm susuu'
  },
  prof_disable_email: {
    fr: 'Désactiver les notifications par email',
    en: 'Disable email notifications',
    ee: 'Tu Email Nyagbedeasi',
    kbp: 'Kpaɣ email tɔm susuu'
  },
  prof_save_settings: {
    fr: 'Enregistrer les paramètres',
    en: 'Save settings',
    ee: 'Dzra Ɖoɖowo Ɖo',
    kbp: 'Ñɔɔzɩ ñɔɔzʋʋ'
  },
  prof_confirm_recharge_title: {
    fr: 'Confirmer la recharge',
    en: 'Confirm top-up',
    ee: 'Da Asi Ɖe Ga Trɔɖeɖe Dzi',
    kbp: 'Ña sɔnzʋʋ'
  },
  prof_confirm_recharge_desc: {
    fr: "Vous allez être redirigé vers l'interface de paiement sécurisée Paydunya afin d'approvisionner votre portefeuille virtuel d'un montant de :",
    en: 'You will be redirected to the secure Paydunya payment interface to fund your virtual wallet with an amount of:',
    ee: 'Woava kplɔ wò yi Paydunya ƒe fexexlẽ nɔƒe dedie be nàtsɔ ga home sia ade wò komputa gaxɔ me :',
    kbp: 'N-kɔŋ tiyu Paydunya fenaɣ ñɔɔzʋʋ lɩmaɣza sɩɖʋʋ taa se ño-kpou ɩ-sɔnzɩ nɛ liidiye ñɩma ɛnɛ :'
  },
  status_updated: {
    fr: 'Statut mis à jour !',
    en: 'Status updated!',
    ee: 'Wotrɔ Nɔnɔme!',
    kbp: 'Ðoŋ pɩ-yekiɣ!'
  },
  status_update_error: {
    fr: 'Erreur lors de la mise à jour.',
    en: 'Error while updating.',
    ee: 'Vodada dzɔ le trɔtrɔ me.',
    kbp: 'Kɩdɛkɛdɩm yekiɣu taa.'
  },

  // Dashboard — hardcoded strings audit
  admin_badge_short: {
    fr: 'Admin',
    en: 'Admin',
    ee: 'Dziɖula',
    kbp: 'Ñʋʋdʋ'
  },
  view_all: {
    fr: 'Voir tout',
    en: 'View all',
    ee: 'Kpɔ Katã',
    kbp: 'Cɔnɩ pɩ-tɩŋa'
  },
  available_balance: {
    fr: 'Solde disponible',
    en: 'Available balance',
    ee: 'Ga si li',
    kbp: 'Liidiye ɖɩŋ ŋgʋ kɩ-wɛɛ yɔ'
  },
  to_receive: {
    fr: 'À recevoir',
    en: 'To receive',
    ee: 'Woaxɔ',
    kbp: 'Kɩ-caɣ mʋʋ'
  },
  circles_active_short: {
    fr: 'Cercles actifs',
    en: 'Active circles',
    ee: 'Habɔbɔ siwo le dɔwɔm',
    kbp: 'Tontinaa wena awɛ ñʋʋ taa'
  },
  marketplace_shortcut_desc: {
    fr: 'Services entre membres',
    en: 'Services between members',
    ee: 'Subɔsubɔdɔ le xɔ́wo dome',
    kbp: 'Lɩmaɣza mʋyaa hazɩyɛ'
  },
  ai_assistant_shortcut_desc: {
    fr: 'Bilan de caisse, rappels',
    en: 'Treasury summary, reminders',
    ee: 'Gadzikpɔƒe kpuiƒoƒo, ŋkuɖodzi',
    kbp: 'Liidiye kɩlaʋ, ñɔɔzʋʋ'
  },
  next_contribution: {
    fr: 'Prochaine Cotisation',
    en: 'Next Contribution',
    ee: 'Gaxexlẽ Si Gbɔna',
    kbp: 'Liidiye haʋ ŋgʋ kɩ-kɔŋ yɔ'
  },
  contribute_now: {
    fr: 'Cotiser',
    en: 'Contribute',
    ee: 'Xe Gaxexlẽ',
    kbp: 'Fɛ liidiye haʋ'
  },
  cash_label: {
    fr: 'Espèces',
    en: 'Cash',
    ee: 'Ga Home',
    kbp: 'Liidiye kaɖaɣ'
  },
  no_pending_contribution: {
    fr: 'Aucune cotisation en attente.',
    en: 'No pending contribution.',
    ee: 'Gaxexlẽ aɖeke mele lalam o.',
    kbp: 'Liidiye haʋ naɖɩyɛ fɛyɩ ka taɣ taa.'
  },
  next_payout_turn: {
    fr: 'Mon Prochain Tour (Gain)',
    en: 'My Next Turn (Payout)',
    ee: 'Nye Turn Si Gbɔna (Viɖe)',
    kbp: 'Man kɩyakʋ ŋga kɩ-kɔŋ yɔ (Sʋʋ)'
  },
  distribution_label: {
    fr: 'Distribution',
    en: 'Distribution',
    ee: 'Mavomavo',
    kbp: 'Liidiye lɩʋ'
  },
  deadline_prefix: {
    fr: 'Échéance :',
    en: 'Deadline:',
    ee: 'Ɣeyiɣi si wòle be woade:',
    kbp: 'Alɩwaatʋ ŋga kɩ-caɣ:'
  },
  estimated_date_prefix: {
    fr: 'Date estimée :',
    en: 'Estimated date:',
    ee: 'Ŋkeke si wobu:',
    kbp: 'Kɩyakʋ ŋga papɩzɩɣ yɔ:'
  },
  join_circle_to_plan: {
    fr: 'Rejoignez un cercle pour planifier votre tour.',
    en: 'Join a circle to plan your turn.',
    ee: 'Ge ɖe habɔbɔ me be nàɖo wò turn ɖoɖo.',
    kbp: 'Kpɛndɩ tontine se ŋ-ñɔɔzɩ ño-kɩyakʋ.'
  },
  reliability_score: {
    fr: 'Score de Fiabilité',
    en: 'Reliability Score',
    ee: 'Dzikpɔkpɔ Xexlẽme',
    kbp: 'Lidaʋ kɩlaʋ'
  },
  payments_on_time: {
    fr: "Paiements à l'heure",
    en: 'On-time payments',
    ee: 'Fexexlẽ si wowɔ le Ɣeyiɣi Nyuitɔ dzi',
    kbp: 'Fenaɣ ñɔɔzʋʋ alɩwaatʋ taa'
  },
  circles_completed: {
    fr: 'Cercles complétés',
    en: 'Circles completed',
    ee: 'Habɔbɔ siwo wu enu',
    kbp: 'Tontinaa wena pɩ-tɛma yɔ'
  },
  your_active_tontines: {
    fr: 'Vos groupes de tontine en cours',
    en: 'Your ongoing tontine groups',
    ee: 'Wò tontine habɔbɔ siwo le dɔwɔm',
    kbp: 'Ño-tontinaa wena awɛ ñʋʋ taa yɔ'
  },
  default_circle_description: {
    fr: 'Cercle de tontine collaborative.',
    en: 'Collaborative tontine circle.',
    ee: 'Tontine habɔbɔ si wɔa dɔ ɖekae.',
    kbp: 'Tontine ŋgʋ pɩ-kpɛndʋʋ yɔ.'
  },
  reliability_modal_title: {
    fr: 'Comment est calculé votre Score de Fiabilité ?',
    en: 'How is your Reliability Score calculated?',
    ee: 'Aleke wobua wò Dzikpɔkpɔ Xexlẽme?',
    kbp: 'Ɛzɩma pɔ-kalɩɣ ño-lidaʋ kɩlaʋ?'
  },
  reliability_modal_desc: {
    fr: 'Votre score mesure votre régularité et renforce la confiance des cercles.',
    en: 'Your score measures your consistency and strengthens circle trust.',
    ee: 'Wò xexlẽme dzidzena wò nuwɔwɔ ɖoɖo eye wòdoa ŋusẽ na habɔbɔwo ƒe kakaɖedzi.',
    kbp: 'Ño-kɩlaʋ kɩ-kalɩɣ ño-lakasɩ tam-tam nɛ kɩ-ɖɔɔsɩ tontinaa lidaʋ.'
  },
  reliability_pts_ontime_desc: {
    fr: "Chaque versement effectué avant l'échéance augmente directement votre score.",
    en: 'Each payment made before the deadline directly increases your score.',
    ee: 'Fexexlẽ ɖesiaɖe si nàwɔ hafi ɣeyiɣi la nade la doa wò xexlẽme ɖe edzi tẽe.',
    kbp: 'Fenaɣ ñɔɔzʋʋ ŋgʋ kɩ-lakɩ ɖooo kɩyakʋ ŋga kɩ-caɣ yɔ, kɩ-tasɩɣ ño-kɩlaʋ yɔɔ tɔntɔ.'
  },
  reliability_seniority: {
    fr: 'Ancienneté & Cercles Complétés',
    en: 'Seniority & Completed Circles',
    ee: 'Ɣeyiɣi Didi & Habɔbɔ Siwo Wu Enu',
    kbp: 'Alɩwaatʋ didiye nɛ tontinaa wena pɩ-tɛma yɔ'
  },
  reliability_seniority_desc: {
    fr: 'Terminer un cycle complet de tontine sans aucun incident valorise votre profil.',
    en: 'Completing a full tontine cycle without incident boosts your profile.',
    ee: 'Tontine ƒe ɣeyiɣi blibo nuwuwu nyuie doa asixɔxɔ na wò ŋkɔmeɖeɖe.',
    kbp: 'Ño-tontine kɩyɛ kʋɖʋm tɛzʋʋ kʋñɔŋ fɛyɩ yɔ, kɩ-ɖɔɔsɩ ma-ɖɔkɔtɔ.'
  },
  reliability_penalty: {
    fr: 'Pénalité de Retard',
    en: 'Late Penalty',
    ee: 'Tsitsi Tohehe',
    kbp: 'Kɩgbɛdɩŋ tɔlɩm'
  },
  reliability_penalty_pts: {
    fr: '-15 Pts / retard',
    en: '-15 Pts / late payment',
    ee: '-Xexlẽme 15 / tsitsi',
    kbp: '-Kɩlaʋ 15 / kɩgbɛdɩŋ'
  },
  reliability_penalty_desc: {
    fr: 'Les retards répétés diminuent temporairement votre niveau de fiabilité.',
    en: 'Repeated late payments temporarily lower your reliability level.',
    ee: 'Tsitsi gbe gbe ɖiɖia wò dzikpɔkpɔ gome vie.',
    kbp: 'Kɩgbɛdɩŋ tam-tam kɩ-yebiɣ ño-lidaʋ kɩlaʋ alɩwaatʋ nɖɩyɛ taa.'
  },
  banner_savings_label: {
    fr: 'Épargne Solidaire',
    en: 'Solidarity Savings',
    ee: 'Gadzraɖo Ɖekawɔwɔ',
    kbp: 'Kpɛndʋʋ marali'
  },
  banner_mamas_title: {
    fr: 'La Tontine des Mamans & Commerçantes',
    en: 'The Mothers & Traders Tontine',
    ee: 'Nɔviwo & Asitsalawo ƒe Tontine',
    kbp: 'Ðaanaa nɛ laɖaa tontine'
  },
  banner_future_label: {
    fr: 'Avenir & Projets',
    en: 'Future & Projects',
    ee: 'Etsɔ Si Gbɔna & Ɖoɖowo',
    kbp: 'Sɔsɔɔ alɩwaatʋ nɛ lɩmaɣza'
  },
  banner_youth_title: {
    fr: 'Une Jeunesse Prospère qui Construit',
    en: 'A Thriving Youth Building the Future',
    ee: 'Sɔhɛwo Siwo Le Nu Tum Nyuie',
    kbp: 'Pɩyaɣ mʋyaa mba pɔ-maɣ yɔ'
  },

  // Ma Banque
  my_bank: {
    fr: 'Ma Banque',
    en: 'My Bank',
    ee: 'Nye Gaxɔ',
    kbp: 'Man liidiye kpou'
  },
  my_bank_subtitle: {
    fr: 'Bloquez votre épargne le temps qu\'il faut, pas le temps que vous voulez.',
    en: 'Lock your savings for as long as it takes, not as long as you want.',
    ee: 'Do gaxɔ wò gadzraɖo teƒe si wòhiã, menye teƒe si nèdi o.',
    kbp: 'Ha ño-marali alɩwaatʋ ŋga kɩ-pɔzʋʋ yɔ, pɩ-tɩɩ kɛ ŋga n-sɔɔlɩ yɔ.'
  },
  bank_no_subscription_title: {
    fr: "Débloquez l'accès à Ma Banque",
    en: 'Unlock access to My Bank',
    ee: 'Ʋu Mɔnu Na Nye Gaxɔ',
    kbp: 'Mʋ waɖɛ man liidiye kpou'
  },
  bank_no_subscription_desc: {
    fr: "Choisissez un palier pour commencer à créer vos banques personnelles à délai bloqué.",
    en: 'Choose a tier to start creating your locked personal banks.',
    ee: 'Tia asixɔxɔ ɖeka be nàdze wò gaxɔ bubuawo si le blɔkɔm wɔwɔ gɔme.',
    kbp: 'Lɩzɩ kɩlɩzɩ nakʋyʋ se ŋ-paɣzɩ ño-kpou haʋ.'
  },
  bank_tier_starter: {
    fr: '1 à 5 banques',
    en: '1 to 5 banks',
    ee: 'Gaxɔ 1 vaseɖe 5',
    kbp: 'Kpou 1 halɩ 5'
  },
  bank_tier_growth: {
    fr: '6 à 20 banques',
    en: '6 to 20 banks',
    ee: 'Gaxɔ 6 vaseɖe 20',
    kbp: 'Kpou 6 halɩ 20'
  },
  bank_tier_unlimited: {
    fr: '21 banques et plus',
    en: '21 banks and more',
    ee: 'Gaxɔ 21 kple wu nenema',
    kbp: 'Kpou 21 nɛ pɩ-yɔɔ'
  },
  bank_subscribe_cta: {
    fr: "S'abonner",
    en: 'Subscribe',
    ee: 'Bu Eŋu',
    kbp: 'Kpaɣ tʋmɩyɛ'
  },
  bank_per_month: {
    fr: '/ mois',
    en: '/ month',
    ee: '/ ɣleti',
    kbp: '/ fenaɣ'
  },
  bank_create_new: {
    fr: 'Créer une banque',
    en: 'Create a bank',
    ee: 'Wɔ Gaxɔ Yeye',
    kbp: 'Ma kpou kɩfaŋa'
  },
  bank_name_label: {
    fr: 'Nom de la banque',
    en: 'Bank name',
    ee: 'Gaxɔ Ŋkɔ',
    kbp: 'Kpou hɩɖɛ'
  },
  bank_name_placeholder: {
    fr: 'Ex: Achat voiture, Fonds urgence...',
    en: 'e.g. Car purchase, Emergency fund...',
    ee: 'Kpɔɖeŋu: Ʋu Ƒle, Kuxi Ga...',
    kbp: 'Ɛzɩ: Kɛɛ yabʋ, Kaɖɛ liidiye...'
  },
  bank_description_label: {
    fr: 'Description (optionnel)',
    en: 'Description (optional)',
    ee: 'Numeɖeɖe (Menye Nyanya O)',
    kbp: 'Tɔm yɔɔdʋʋ (pɩ-tɩɩ kɛ kɩ-cɛyʋʋ)'
  },
  bank_lock_days_label: {
    fr: 'Délai de blocage (jours)',
    en: 'Lock duration (days)',
    ee: 'Blɔkɔ Ɣeyiɣi (Ŋkekewo)',
    kbp: 'Kɩyakʋ ñɔɔzʋʋ (kɩyakʋ)'
  },
  bank_lock_days_hint: {
    fr: "L'argent déposé sera totalement bloqué jusqu'à cette échéance.",
    en: 'Deposited money will be fully locked until this deadline.',
    ee: 'Ga si nàde eme la ablɔkɔ keŋkeŋ vaseɖe ɣeyiɣi sia.',
    kbp: 'Liidiye ŋgʋ n-sɔnzɩɣ yɔ kɩ-ñɔɔzɩ tam halɩ kɩyakʋ ŋga.'
  },
  bank_create_confirm: {
    fr: 'Créer la banque',
    en: 'Create the bank',
    ee: 'Wɔ Gaxɔ La',
    kbp: 'Ma kpou'
  },
  bank_locked_until: {
    fr: 'Bloquée jusqu\'au',
    en: 'Locked until',
    ee: 'Ablɔkɔ vaseɖe',
    kbp: 'Pɩ-ñɔɔzɩ halɩ'
  },
  bank_unlocked_label: {
    fr: 'Débloquée',
    en: 'Unlocked',
    ee: 'Woʋui',
    kbp: 'Pɩ-mʋʋ'
  },
  bank_deposit_cta: {
    fr: 'Déposer',
    en: 'Deposit',
    ee: 'De Ga',
    kbp: 'Sɔnzɩ'
  },
  bank_withdraw_cta: {
    fr: 'Retirer',
    en: 'Withdraw',
    ee: 'Ɖe Le Eme',
    kbp: 'Kpeɣ'
  },
  bank_relock_cta: {
    fr: 'Re-bloquer',
    en: 'Lock again',
    ee: 'Gblɔkɔe Ake',
    kbp: 'Tasɩ ñɔɔzʋʋ'
  },
  bank_delete_cta: {
    fr: 'Supprimer',
    en: 'Delete',
    ee: 'Tutu',
    kbp: 'Ɖɩzɩ'
  },
  bank_empty_title: {
    fr: "Vous n'avez pas encore de banque",
    en: "You don't have a bank yet",
    ee: 'Mèsu gaxɔ haɖe o',
    kbp: 'Kpou naɖɩyɛ fɛyɩ ño-cɔlɔ fɛyɛ'
  },
  bank_empty_desc: {
    fr: 'Créez votre première banque pour commencer à épargner sans y toucher avant terme.',
    en: 'Create your first bank to start saving without touching it before the deadline.',
    ee: 'Wɔ wò gaxɔ gbãtɔ be nàdze gadzraɖo gɔme mègaka asi eŋu hafi ɣeyiɣi la nade o.',
    kbp: 'Ma ño-kpou kajalaɣ se ŋ-paɣzɩ marʋʋ nɛ ŋ-tɩɩ kpeɣu pɩ-taa ɖooo kɩyakʋ ŋga kɩ-caɣ yɔ.'
  },
  bank_current_tier: {
    fr: 'Votre palier actuel',
    en: 'Your current tier',
    ee: 'Wò Asixɔxɔ Fifitɔ',
    kbp: 'Ño-kɩlɩzɩ lɛɛlɛɛyɔ'
  },
  bank_vaults_used: {
    fr: 'banques utilisées',
    en: 'banks used',
    ee: 'gaxɔ siwo woka zã',
    kbp: 'kpou pɩ-lakɩ'
  },
  bank_upgrade_cta: {
    fr: 'Changer de palier',
    en: 'Change tier',
    ee: 'Trɔ Asixɔxɔ',
    kbp: 'Yekiɣ kɩlɩzɩ'
  },

  // Bottom nav labels
  nav_home: {
    fr: 'Accueil',
    en: 'Home',
    ee: 'Aƒe',
    kbp: 'Ñʋʋdʋ'
  },
  nav_circles: {
    fr: 'Cercles',
    en: 'Circles',
    ee: 'Habɔbɔwo',
    kbp: 'Tontinaa'
  },
  nav_savings: {
    fr: 'Épargne',
    en: 'Savings',
    ee: 'Gadzraɖo',
    kbp: 'Marali'
  },

  // Navbar (top bar)
  nav_switch_lang: {
    fr: 'Changer de langue',
    en: 'Switch language',
    ee: 'Trɔ Gbe',
    kbp: 'Yekiɣ kʋnʋŋ'
  },
  nav_theme_light: {
    fr: 'Passer en mode clair',
    en: 'Switch to light mode',
    ee: 'Trɔ yi kekeli me',
    kbp: 'Yekiɣ kɩjɛyɩtʋ taa'
  },
  nav_theme_dark: {
    fr: 'Passer en mode sombre',
    en: 'Switch to dark mode',
    ee: 'Trɔ yi viviti me',
    kbp: 'Yekiɣ kɩsɩɩmtʋ taa'
  },
  nav_login: {
    fr: 'Se connecter',
    en: 'Log in',
    ee: 'Ge Ɖe Eme',
    kbp: 'Kpɛndɩ'
  },
  nav_tagline: {
    fr: 'Tontine & Épargne',
    en: 'Tontine & Savings',
    ee: 'Tontine & Gadzraɖo',
    kbp: 'Tontine nɛ Marali'
  },
  nav_admin_badge: {
    fr: 'Administrateur',
    en: 'Administrator',
    ee: 'Dziɖula',
    kbp: 'Ñʋʋdʋ tʋ'
  },

  // DashboardCharts (balance/contributions analytics card)
  chart_title: {
    fr: "Analyses d'Épargne & Cotisations",
    en: 'Savings & Contributions Analytics',
    ee: 'Gadzraɖo kple Fɔŋdefewo Ŋkuɖeɖe',
    kbp: 'Marali nɛ liidiye kɩlɩzʋʋ ñʋʋdʋ'
  },
  chart_subtitle: {
    fr: 'Visualisez la croissance de vos fonds et le statut des cotisations.',
    en: 'Visualize how your funds are growing and the status of your contributions.',
    ee: 'Kpɔ ale si wò gaawo le tsitsim kple fɔŋdefewo ƒe nɔnɔme.',
    kbp: 'Nyɩ ɖɔɖɔ ñɩm liidiye kɩgbɛndʋʋ nɛ liidiye kɩsɩɩʋʋ.'
  },
  chart_tab_balance: {
    fr: 'Balance Globale',
    en: 'Overall Balance',
    ee: 'Ga Katã Le Asi',
    kbp: 'Liidiye kpeekpe'
  },
  chart_tab_contributions: {
    fr: 'Cotisations du Cercle',
    en: 'Circle Contributions',
    ee: 'Ha ƒe Fɔŋdefewo',
    kbp: 'Tontinaa liidiye kɩsɩɩʋʋ'
  },
  chart_wallet_balance: {
    fr: 'Solde Portefeuille',
    en: 'Wallet Balance',
    ee: 'Ga Le Kotoku Me',
    kbp: 'Liidiye lɩm ɖɩɣa taa'
  },
  chart_total_saved: {
    fr: 'Total Épargné',
    en: 'Total Saved',
    ee: 'Ga Si Wodzra Ɖo Katã',
    kbp: 'Marali kpeekpe'
  },
  chart_last_transaction: {
    fr: 'Dernière Transaction',
    en: 'Last Transaction',
    ee: 'Gadɔwɔwɔ Mlɔeba',
    kbp: 'Liidiye kɩlɩzʋʋ kɛdɛzaɣ'
  },
  chart_none: {
    fr: 'Aucune',
    en: 'None',
    ee: 'Aɖeke Meli O',
    kbp: 'Nabʋyʋ fɛyɩ'
  },
  chart_tooltip_balance: {
    fr: 'Solde',
    en: 'Balance',
    ee: 'Ga Le Asi',
    kbp: 'Liidiye'
  },
  chart_circle_label: {
    fr: "Cercle d'Épargne :",
    en: 'Savings circle:',
    ee: 'Gadzraɖo Ha:',
    kbp: 'Marali tontine:'
  },
  chart_all_circles: {
    fr: 'Tous mes cercles',
    en: 'All my circles',
    ee: 'Nye Habɔbɔwo Katã',
    kbp: 'Man tontinaa kpeekpe'
  },
  chart_recurring_contribution: {
    fr: 'Cotisation récurrente :',
    en: 'Recurring contribution:',
    ee: 'Fɔŋdefe Si Gagbugbɔna:',
    kbp: 'Liidiye kɩsɩɩʋʋ kɩɖɛɣʋʋ:'
  },

  // Profile.tsx — full page i18n pass (Sprint 7)
  prof_enter_full_name: {
    fr: 'Veuillez saisir votre nom complet.',
    en: 'Please enter your full name.',
    ee: 'Taflatse ŋlɔ wò ŋkɔ blibo.',
    kbp: 'Taa kalɩ ño-hɩɖɛ tɩŋa.'
  },
  prof_select_id_photo: {
    fr: "Veuillez sélectionner une photo de votre pièce d'identité.",
    en: 'Please select a photo of your ID document.',
    ee: 'Taflatse tia wò dzesigbalẽ ƒe foto aɖe.',
    kbp: 'Taa lɩzɩ ño-hɩɖɛ sɛbɩyɛ kɩlɛmʋʋ.'
  },
  prof_kyc_send_error: {
    fr: "Erreur lors de l'envoi du document.",
    en: 'Error while sending the document.',
    ee: 'Vodada dzɔ le nuŋɔŋlɔ ɖoɖo ɖa me.',
    kbp: 'Kɩdɛkɛdɩm sɛbɩyɛ tiyuu taa.'
  },
  prof_mandate_saved: {
    fr: 'Mandataire enregistré !',
    en: 'Proxy saved!',
    ee: 'Woŋlɔ ɖoɖola la ɖi!',
    kbp: 'Ɩ-tɩlɩyʋ pɩ-ñɔɔzɩ!'
  },
  prof_mandate_save_error: {
    fr: "Erreur lors de l'enregistrement du mandataire.",
    en: 'Error while saving the proxy.',
    ee: 'Vodada dzɔ le ɖoɖola ŋɔŋlɔ me.',
    kbp: 'Kɩdɛkɛdɩm ɩ-tɩlɩyʋ ñɔɔzʋʋ taa.'
  },
  prof_pin_update_error: {
    fr: 'Erreur lors de la mise à jour du code PIN.',
    en: 'Error while updating the PIN code.',
    ee: 'Vodada dzɔ le PIN kod trɔtrɔ me.',
    kbp: 'Kɩdɛkɛdɩm PIN kɩlɩzɩ yekiɣu taa.'
  },
  prof_pw_updated: {
    fr: 'Mot de passe mis à jour !',
    en: 'Password updated!',
    ee: 'Wotrɔ Nyagbe La!',
    kbp: 'Tɛmɛnsira pɩ-yekiɣ!'
  },
  prof_pw_update_error: {
    fr: 'Erreur lors de la mise à jour du mot de passe.',
    en: 'Error while updating the password.',
    ee: 'Vodada dzɔ le nyagbe trɔtrɔ me.',
    kbp: 'Kɩdɛkɛdɩm tɛmɛnsira yekiɣu taa.'
  },
  prof_pref_save_error: {
    fr: 'Erreur lors de la sauvegarde de la préférence.',
    en: 'Error while saving the preference.',
    ee: 'Vodada dzɔ le lɔlɔ̃nu dzadzraɖo me.',
    kbp: 'Kɩdɛkɛdɩm sɔɔlɩm ñɔɔzʋʋ taa.'
  },
  prof_personal_info_saved: {
    fr: 'Informations personnelles enregistrées !',
    en: 'Personal information saved!',
    ee: 'Woŋlɔ ŋutɔ ƒe nyatakakawo ɖi!',
    kbp: 'Ño-maɣmaɣ tɔm pɩ-ñɔɔzɩ!'
  },
  prof_save_error_generic: {
    fr: 'Erreur lors de la sauvegarde.',
    en: 'Error while saving.',
    ee: 'Vodada dzɔ le dzadzraɖo me.',
    kbp: 'Kɩdɛkɛdɩm ñɔɔzʋʋ taa.'
  },
  prof_offline_recharge: {
    fr: 'Vous êtes hors-ligne. La recharge nécessite une connexion internet.',
    en: 'You are offline. Recharging requires an internet connection.',
    ee: 'Mèle ligne dzi o. Ga trɔɖeɖe hiã internet kadodo.',
    kbp: 'N-fɛyɩ ɩntɛrnɛɛtɩ taa. Sɔnzʋʋ pɔzʋʋ ɩntɛrnɛɛtɩ.'
  },
  prof_paydunya_start_error: {
    fr: 'Impossible de démarrer le paiement Paydunya.',
    en: 'Unable to start the Paydunya payment.',
    ee: 'Womate ŋu adze Paydunya fexexlẽ gɔme o.',
    kbp: 'Pɩ-fɛyɩ ɖeu se palakɩ Paydunya fenaɣ ñɔɔzʋʋ.'
  },
  prof_offline_withdraw: {
    fr: 'Vous êtes hors-ligne. Le retrait nécessite une connexion internet.',
    en: 'You are offline. Withdrawing requires an internet connection.',
    ee: 'Mèle ligne dzi o. Ɖeɖe le eme hiã internet kadodo.',
    kbp: 'N-fɛyɩ ɩntɛrnɛɛtɩ taa. Kpeɣu pɔzʋʋ ɩntɛrnɛɛtɩ.'
  },
  prof_invalid_withdraw_amount: {
    fr: 'Montant de retrait invalide.',
    en: 'Invalid withdrawal amount.',
    ee: 'Ɖeɖe le eme ga home mesɔ o.',
    kbp: 'Kpeɣu liidiye ñɩma fɛyɩ ɖeu.'
  },
  prof_enter_withdraw_pin: {
    fr: 'Veuillez saisir votre code PIN de retrait.',
    en: 'Please enter your withdrawal PIN.',
    ee: 'Taflatse ŋlɔ wò Ɖeɖe le eme ƒe PIN kod.',
    kbp: 'Taa kalɩ ño-kpeɣu PIN.'
  },
  prof_withdraw_requested_prefix: {
    fr: 'Retrait de',
    en: 'Withdrawal of',
    ee: 'Ɖeɖe le eme si le',
    kbp: 'Kpeɣu ŋgʋ kɩ-kɛ'
  },
  prof_withdraw_requested_mid: {
    fr: 'demandé — vous recevrez l\'argent sur',
    en: 'requested — you will receive the money on',
    ee: 'wobia — àxɔ ga la le',
    kbp: 'pɔzɩ — ŋ-kɔŋ mʋ liidiye'
  },
  prof_withdraw_requested_suffix: {
    fr: 'sous peu.',
    en: 'shortly.',
    ee: 'kpuie sia.',
    kbp: 'kpɛdɛ.'
  },
  prof_cat_account_title: {
    fr: 'Mon compte',
    en: 'My account',
    ee: 'Nye Akɔnta',
    kbp: 'Man kalɩyɛ'
  },
  prof_cat_account_desc: {
    fr: 'Gérez vos informations personnelles et votre identité.',
    en: 'Manage your personal information and identity.',
    ee: 'Kpɔ wò ŋutɔ ƒe nyatakakawo kple wò dzesi dzi.',
    kbp: 'Ñɩɩ ño-maɣmaɣ tɔm nɛ ño-hɩɖɛ.'
  },
  prof_cat_security_title: {
    fr: 'Sécurité & confidentialité',
    en: 'Security & privacy',
    ee: 'Dedienɔnɔme & Nutɔyɔyɔ',
    kbp: 'Ñʋʋ taa lakasɩ nɛ sɩɖʋʋ'
  },
  prof_cat_security_desc: {
    fr: 'Sécurisez votre compte et gérez vos données.',
    en: 'Secure your account and manage your data.',
    ee: 'Dzɔ wò akɔnta dzi eye nàkpɔ wò nyatakakawo dzi.',
    kbp: 'Sɩɖɩ ño-kalɩyɛ nɛ ñɩɩ ño-tɔm.'
  },
  prof_cat_payments_title: {
    fr: 'Argent & paiements',
    en: 'Money & payments',
    ee: 'Ga & Fexexlẽwo',
    kbp: 'Liidiye nɛ fenaɣ ñɔɔzʋʋ'
  },
  prof_cat_payments_desc: {
    fr: 'Gérez vos moyens de paiement, transferts et retraits.',
    en: 'Manage your payment methods, transfers and withdrawals.',
    ee: 'Kpɔ wò fexexlẽ mɔnuwo, gaɖoɖowo kple ɖeɖe le emewo dzi.',
    kbp: 'Ñɩɩ ño-fenaɣ ñɔɔzʋʋ ɖoŋ, tiyuu nɛ kpeɣu.'
  },
  prof_cat_circles_title: {
    fr: 'Mes cercles',
    en: 'My circles',
    ee: 'Nye Habɔbɔwo',
    kbp: 'Man tontinaa'
  },
  prof_cat_circles_desc: {
    fr: 'Gérez vos tontines, vos préférences et invitations.',
    en: 'Manage your tontines, preferences and invitations.',
    ee: 'Kpɔ wò tontinewo, wò lɔlɔ̃nuwo kple amekpekpewo dzi.',
    kbp: 'Ñɩɩ ño-tontinaa, ño-sɔɔlɩm nɛ yaʋ.'
  },
  prof_cat_subscription_title: {
    fr: 'Abonnement & récompenses',
    en: 'Subscription & rewards',
    ee: 'Bubɔ & Fetuwo',
    kbp: 'Kpaɣʋʋ nɛ ñɩm mʋʋ'
  },
  prof_cat_subscription_desc: {
    fr: 'Gérez votre abonnement et vos avantages.',
    en: 'Manage your subscription and benefits.',
    ee: 'Kpɔ wò bubɔ kple viɖe siwo su ŋuwò la dzi.',
    kbp: 'Ñɩɩ ño-kpaɣʋʋ nɛ ño-ñɩm.'
  },
  prof_cat_notifications_title: {
    fr: 'Notifications & communication',
    en: 'Notifications & communication',
    ee: 'Nyagbedeasiwo & Nudɔdɔ',
    kbp: 'Tɔm susuu nɛ yɔɔdʋʋ'
  },
  prof_cat_notifications_desc: {
    fr: 'Choisissez comment vous recevez les notifications.',
    en: 'Choose how you receive notifications.',
    ee: 'Tia ale si nàxɔa nyagbedeasiwo.',
    kbp: 'Lɩzɩ ɛzɩma n-mʋʋ tɔm susuu yɔ.'
  },
  prof_cat_support_title: {
    fr: 'Aide & support',
    en: 'Help & support',
    ee: 'Kpekpeɖeŋu & Alɔdzedze',
    kbp: 'Sɩnʋʋ nɛ ɖeu'
  },
  prof_cat_support_desc: {
    fr: "Trouvez de l'aide, des tutoriels ou contactez le support.",
    en: 'Find help, tutorials, or contact support.',
    ee: 'Di kpekpeɖeŋu, nufiafia alo ka nu kple kpekpeɖeŋumewo.',
    kbp: 'Pɔzɩ sɩnʋʋ, wɩlɩtʋ yaa yaa sɩnʋʋ.'
  },
  prof_cat_legal_title: {
    fr: 'Légal & informations',
    en: 'Legal & information',
    ee: 'Sedede & Nyatakakawo',
    kbp: 'Sɛtʋ nɛ tɔm'
  },
  prof_cat_legal_desc: {
    fr: 'Consultez les conditions, politiques et documents légaux.',
    en: 'Review the terms, policies and legal documents.',
    ee: 'Kpɔ ɖoɖowo, gɔmeɖoɖowo kple sedede nuŋɔŋlɔwo.',
    kbp: 'Cɔnɩ tɔm, ñɔɔzʋʋ nɛ sɛtʋ sɛbɩyɛ.'
  },
  prof_group_account_security: {
    fr: 'Compte & sécurité',
    en: 'Account & security',
    ee: 'Akɔnta & Dedienɔnɔme',
    kbp: 'Kalɩyɛ nɛ ñʋʋ taa lakasɩ'
  },
  prof_group_money_circles: {
    fr: 'Argent & cercles',
    en: 'Money & circles',
    ee: 'Ga & Habɔbɔwo',
    kbp: 'Liidiye nɛ tontinaa'
  },
  prof_group_general: {
    fr: 'Général',
    en: 'General',
    ee: 'Gbatoa',
    kbp: 'Kpeekpe'
  },
  prof_back_to_settings: {
    fr: 'Retour aux Paramètres',
    en: 'Back to Settings',
    ee: 'Trɔ Yi Ɖoɖowo Gbɔ',
    kbp: 'Pɩsɩ ñɔɔzʋʋ taa'
  },
  prof_account_verified: {
    fr: 'Compte vérifié',
    en: 'Verified account',
    ee: 'Akɔnta si Woda Asi Ɖe Edzi',
    kbp: 'Kalɩyɛ ŋga pañaɣ yɔ'
  },
  prof_identity_not_verified: {
    fr: 'Identité non vérifiée',
    en: 'Identity not verified',
    ee: 'Womeda Asi Ɖe Dzesi Dzi O',
    kbp: 'Hɩɖɛ ŋga pataɣ ñaɣ yɔ'
  },
  prof_phone_not_provided: {
    fr: 'Téléphone non renseigné',
    en: 'Phone number not provided',
    ee: 'Womeɖo Kaɖifon Xexlẽ O',
    kbp: 'Kaɖifɔɔnɩ nimɔrɔ fɛyɩ'
  },
  prof_member_since: {
    fr: 'Membre depuis',
    en: 'Member since',
    ee: 'Enye Xɔ́ Tso',
    kbp: 'Kɛ mʋyʋ ɖooo'
  },
  prof_need_help: {
    fr: "Besoin d'aide ?",
    en: 'Need help?',
    ee: 'Èhiã Kpekpeɖeŋu?',
    kbp: 'N-pɔzʋʋ sɩnʋʋ?'
  },
  prof_support_desc_sidebar: {
    fr: 'Contactez notre support disponible 7j/7.',
    en: 'Contact our support, available 7 days a week.',
    ee: 'Ka nu kple mía kpekpeɖeŋumewo, wole klalo ŋkeke 7 sukusuku.',
    kbp: 'Yaa ɖe-sɩnɩyaa, pɛwɛ kɩyakʋ 7 kɩ-tɩŋa.'
  },
  prof_contact_support: {
    fr: 'Contacter le support',
    en: 'Contact support',
    ee: 'Ka Nu Kple Kpekpeɖeŋumewo',
    kbp: 'Yaa sɩnɩyaa'
  },
  prof_suggest: {
    fr: 'Suggérer',
    en: 'Suggest',
    ee: 'Do Susu',
    kbp: 'Ñɩnɩ tɔm'
  },
  prof_report_bug: {
    fr: 'Signaler un bug',
    en: 'Report a bug',
    ee: 'Gblɔ Kuxi Aɖe',
    kbp: 'Yɔɔdɩ kɩlɛmʋʋ kaɖɛ'
  },
  prof_delete_account: {
    fr: 'Supprimer mon compte',
    en: 'Delete my account',
    ee: 'Tutu Nye Akɔnta',
    kbp: 'Ɖɩzɩ man kalɩyɛ'
  },
  prof_tab_personal_info: {
    fr: '1. Informations personnelles',
    en: '1. Personal information',
    ee: '1. Ŋutɔ ƒe Nyatakakawo',
    kbp: '1. Ño-maɣmaɣ tɔm'
  },
  prof_tab_kyc: {
    fr: "2. Vérification d'identité (KYC)",
    en: '2. Identity verification (KYC)',
    ee: '2. Dzesi Nukpɔkpɔ (KYC)',
    kbp: '2. Hɩɖɛ ñaʋ (KYC)'
  },
  prof_tab_mandate: {
    fr: '3. Mandataire numérique',
    en: '3. Digital proxy',
    ee: '3. Komputa Ɖoɖola',
    kbp: '3. Kpou taa tɩlɩyʋ'
  },
  prof_first_name: {
    fr: 'Prénom',
    en: 'First name',
    ee: 'Ŋkɔ Gbãtɔ',
    kbp: 'Hɩɖɛ kajalaɣ'
  },
  prof_last_name_label: {
    fr: 'Nom',
    en: 'Last name',
    ee: 'Ŋkɔ',
    kbp: 'Hɩɖɛ'
  },
  prof_email_address_label: {
    fr: 'Adresse Email',
    en: 'Email address',
    ee: 'Email Adrɛs',
    kbp: 'Email adrɛsɩ'
  },
  prof_phone_label: {
    fr: 'Téléphone',
    en: 'Phone',
    ee: 'Kaɖifon',
    kbp: 'Kaɖifɔɔnɩ'
  },
  prof_date_of_birth: {
    fr: 'Date de naissance',
    en: 'Date of birth',
    ee: 'Dzigbe Ŋkeke',
    kbp: 'Lʋlʋʋ kɩyakʋ'
  },
  prof_language_label: {
    fr: 'Langue',
    en: 'Language',
    ee: 'Gbe',
    kbp: 'Kʋnʋŋ'
  },
  prof_kyc_title: {
    fr: "Vérification d'identité",
    en: 'Identity verification',
    ee: 'Dzesi Nukpɔkpɔ',
    kbp: 'Hɩɖɛ ñaʋ'
  },
  prof_verified_badge: {
    fr: 'Vérifié',
    en: 'Verified',
    ee: 'Woda Asi Ɖe Edzi',
    kbp: 'Pañaɣ'
  },
  prof_kyc_level_prefix: {
    fr: 'Niveau',
    en: 'Level',
    ee: 'Gbã',
    kbp: 'Hɔɔlʋʋ'
  },
  prof_kyc_level_suffix: {
    fr: 'sur 3',
    en: 'out of 3',
    ee: 'le 3 me',
    kbp: 'kɩ-tɛŋga 3'
  },
  prof_kyc_desc: {
    fr: "Une pièce d'identité valide est nécessaire pour créer ou rejoindre un cercle de tontine.",
    en: 'A valid ID document is required to create or join a tontine circle.',
    ee: 'Dzesigbalẽ nyuitɔ hiã be nàwɔ alo nàge ɖe tontine habɔbɔ me.',
    kbp: 'Hɩɖɛ sɛbɩyɛ kɩbaŋɖɛ pɔzʋʋ se ŋ-ma yaa ŋ-kpɛndɩ tontine.'
  },
  prof_id_document_label: {
    fr: "Pièce d'Identité",
    en: 'ID Document',
    ee: 'Dzesigbalẽ',
    kbp: 'Hɩɖɛ sɛbɩyɛ'
  },
  prof_verified_on: {
    fr: 'Vérifiée le',
    en: 'Verified on',
    ee: 'Woda Asi Ɖe Edzi Le',
    kbp: 'Pañaɣ ɖooo'
  },
  prof_verified_word: {
    fr: 'Vérifiée',
    en: 'Verified',
    ee: 'Woda Asi Ɖe Edzi',
    kbp: 'Pañaɣ'
  },
  prof_sent_on: {
    fr: 'Envoyée le',
    en: 'Sent on',
    ee: 'Woɖoe Ɖa Le',
    kbp: 'Patiyi ɖooo'
  },
  prof_pending_validation: {
    fr: 'En attente de validation',
    en: 'Awaiting validation',
    ee: 'Ele Lalam Be Woada Asi Edzi',
    kbp: 'Ka taɣ taa se pañaɣ'
  },
  prof_kyc_rejected_prefix: {
    fr: 'Votre précédente soumission a été refusée',
    en: 'Your previous submission was rejected',
    ee: 'Wogbe wò nusɔsɔ si nèdo ɖa va yi',
    kbp: 'Pagbɛ ño-tɛtɛlɩ sɛbɩyɛ'
  },
  prof_kyc_resubmit: {
    fr: 'Veuillez soumettre à nouveau.',
    en: 'Please submit again.',
    ee: 'Taflatse gado ake.',
    kbp: 'Taa tasɩ tiyu.'
  },
  prof_kyc_full_name_label: {
    fr: 'Nom complet (tel que sur la pièce)',
    en: 'Full name (as shown on the document)',
    ee: 'Ŋkɔ Blibo (Abe ale si wòle dzesigbalẽ dzi ene)',
    kbp: 'Hɩɖɛ tɩŋa (ɛzɩ pɩ-wɛɛ sɛbɩyɛ taa yɔ)'
  },
  prof_kyc_id_number_label: {
    fr: "Numéro de la pièce d'identité (optionnel)",
    en: 'ID document number (optional)',
    ee: 'Dzesigbalẽ Xexlẽ (Menye Nyanya O)',
    kbp: 'Hɩɖɛ sɛbɩyɛ nimɔrɔ (pɩ-tɩɩ kɛ kɩ-cɛyʋʋ)'
  },
  prof_kyc_photo_label: {
    fr: "Photo de la carte nationale d'identité",
    en: 'Photo of the national ID card',
    ee: 'Dukɔ Dzesigbalẽ Foto',
    kbp: 'Kɛ ɖamaɣ hɩɖɛ kaatɩ kɩlɛmʋʋ'
  },
  prof_choose_photo_pdf: {
    fr: 'Choisir une photo ou un PDF',
    en: 'Choose a photo or a PDF',
    ee: 'Tia Foto Alo PDF',
    kbp: 'Lɩzɩ kɩlɛmʋʋ yaa PDF'
  },
  prof_tap_change_file: {
    fr: 'Appuyez pour changer de fichier',
    en: 'Tap to change the file',
    ee: 'Te Asi Edzi Be Nàtrɔ Faili',
    kbp: 'Tɩlɩ se ŋ-yekiɣ sɛbɩyɛ'
  },
  prof_file_format_hint: {
    fr: 'JPG, PNG ou PDF, recto de la pièce',
    en: 'JPG, PNG or PDF, front of the document',
    ee: 'JPG, PNG alo PDF, ŋgɔgbe',
    kbp: 'JPG, PNG yaa PDF, sɛbɩyɛ ŋgʋlʋ'
  },
  prof_submit_for_verification: {
    fr: 'Soumettre pour vérification',
    en: 'Submit for verification',
    ee: 'Do Ɖa Be Woakpɔ',
    kbp: 'Tiyi se pañaɣ'
  },
  prof_mandate_title: {
    fr: 'Mandataire numérique',
    en: 'Digital proxy',
    ee: 'Komputa Ɖoɖola',
    kbp: 'Kpou taa tɩlɩyʋ'
  },
  prof_mandate_desc: {
    fr: 'Désignez une personne de confiance pour vous aider à suivre vos cotisations (sans droit de retrait).',
    en: 'Designate a trusted person to help you track your contributions (without withdrawal rights).',
    ee: 'Tia ame si dzi nàka ɖo be wòakpe ɖe ŋuwò le wò gaxexlẽwo kpɔkpɔ me (Ɖeɖe le eme mɔnukpɔkpɔ meli o).',
    kbp: 'Lɩzɩ mʋyʋ danamalʋ se ɩ-sɩnɩ-ŋ ño-liidiye haʋ taa (kpeɣu waɖɛ fɛyɩ).'
  },
  prof_mandate_name_label: {
    fr: 'Nom complet du mandataire',
    en: "Proxy's full name",
    ee: 'Ɖoɖola Ŋkɔ Blibo',
    kbp: 'Ɩ-tɩlɩyʋ hɩɖɛ tɩŋa'
  },
  prof_phone_number_label: {
    fr: 'Numéro de téléphone',
    en: 'Phone number',
    ee: 'Kaɖifon Xexlẽ',
    kbp: 'Kaɖifɔɔnɩ nimɔrɔ'
  },
  prof_mandate_rights_label: {
    fr: 'Droits accordés au mandataire',
    en: 'Rights granted to the proxy',
    ee: 'Mɔnukpɔkpɔ siwo Wona Ɖoɖola',
    kbp: 'Waɖɛ ŋgʋ pɔ-hɔ ɩ-tɩlɩyʋ yɔ'
  },
  prof_view_contributions_perm: {
    fr: 'Voir les cotisations',
    en: 'View contributions',
    ee: 'Kpɔ Gaxexlẽwo',
    kbp: 'Cɔnɩ liidiye haʋ'
  },
  prof_receive_reminders_perm: {
    fr: 'Recevoir les rappels de cotisation',
    en: 'Receive contribution reminders',
    ee: 'Xɔ Gaxexlẽ Ŋkuɖodziwo',
    kbp: 'Mʋ liidiye haʋ ñɔɔzʋʋ'
  },
  prof_mandate_warning_prefix: {
    fr: 'Le mandataire ne possède',
    en: 'The proxy has',
    ee: 'Ɖoɖola la mele',
    kbp: 'Ɩ-tɩlɩyʋ fɛyɩ'
  },
  prof_mandate_warning_bold: {
    fr: 'aucun accès à votre portefeuille ni aux retraits',
    en: 'no access to your wallet or to withdrawals',
    ee: 'mɔnukpɔkpɔ aɖeke ɖe wò gaxɔ alo ɖeɖe le emewo ŋu o',
    kbp: 'waɖɛ naɖɩyɛ ño-kpou yaa kpeɣu taa'
  },
  prof_mandate_warning_suffix: {
    fr: ', quels que soient les droits ci-dessus.',
    en: ', regardless of the rights above.',
    ee: ', ɖe mɔnukpɔkpɔ siwo le tame la megbe o.',
    kbp: ', halɩ waɖɛ ŋgʋ kɩ-wɛɛ ɖamɛlɛ yɔ.'
  },
  prof_save_mandate: {
    fr: 'Enregistrer le mandataire',
    en: 'Save the proxy',
    ee: 'Dzra Ɖoɖola Ɖo',
    kbp: 'Ñɔɔzɩ ɩ-tɩlɩyʋ'
  },
  prof_wallet_payments_header: {
    fr: 'Portefeuille & Paiements',
    en: 'Wallet & Payments',
    ee: 'Gaxɔ & Fexexlẽwo',
    kbp: 'Kpou nɛ fenaɣ ñɔɔzʋʋ'
  },
  prof_balance_available_now: {
    fr: 'Solde disponible immédiatement',
    en: 'Balance available immediately',
    ee: 'Ga si Li Fifi Laa',
    kbp: 'Liidiye ɖɩŋ ŋgʋ kɩ-wɛɛ lɛɛlɛɛyɔ yɔ'
  },
  prof_recharge_via_mobile_money: {
    fr: 'Recharger via Mobile Money',
    en: 'Recharge via Mobile Money',
    ee: 'Trɔ Ga De Eme To Mobile Money Dzi',
    kbp: 'Sɔnzɩ liidiye Mobile Money yɔɔ'
  },
  prof_amount_fcfa_placeholder: {
    fr: 'Montant en FCFA (ex: 5000)',
    en: 'Amount in FCFA (e.g. 5000)',
    ee: 'Ga home le FCFA me (kpɔɖeŋu: 5000)',
    kbp: 'Liidiye ñɩma FCFA taa (ɛzɩ: 5000)'
  },
  prof_amount_fcfa_simple_placeholder: {
    fr: 'Montant en FCFA',
    en: 'Amount in FCFA',
    ee: 'Ga home le FCFA me',
    kbp: 'Liidiye ñɩma FCFA taa'
  },
  prof_pin_4digits_placeholder: {
    fr: 'PIN 4 chiffres',
    en: '4-digit PIN',
    ee: 'PIN Xexlẽme 4',
    kbp: 'PIN sɔɔndʋ 4'
  },
  prof_transaction_history: {
    fr: 'Historique des transactions',
    en: 'Transaction history',
    ee: 'Gaɖoɖowo ƒe Ŋutinya',
    kbp: 'Liidiye ɖʋʋ tɔm tɩŋa'
  },
  prof_no_transaction_now: {
    fr: 'Aucune transaction pour le moment.',
    en: 'No transaction at the moment.',
    ee: 'Gaɖoɖo aɖeke meli fifia o.',
    kbp: 'Liidiye ɖʋʋ naɖɩyɛ fɛyɩ lɛɛlɛɛyɔ.'
  },
  prof_my_tontine_circles: {
    fr: 'Mes Cercles de Tontine',
    en: 'My Tontine Circles',
    ee: 'Nye Tontine Habɔbɔwo',
    kbp: 'Man tontinaa'
  },
  prof_actif_suffix: {
    fr: 'actif(s)',
    en: 'active',
    ee: 'le dɔ wɔm',
    kbp: 'ka ñʋʋ taa'
  },
  prof_participation_stats: {
    fr: 'Statistiques de participation',
    en: 'Participation statistics',
    ee: 'Gomekpɔkpɔ Dzesiwo',
    kbp: 'Kpɛndʋʋ kalɩyɛ'
  },
  prof_month_label: {
    fr: 'Mois',
    en: 'Month',
    ee: 'Ɣleti',
    kbp: 'Fenaɣ'
  },
  prof_insufficient_data_charts: {
    fr: 'Aucune donnée suffisante pour générer les graphiques complets ce mois-ci.',
    en: 'Not enough data to generate full charts this month.',
    ee: 'Nyatakaka mede o be woawɔ kpɔɖeŋu blibowo ɣleti sia me.',
    kbp: 'Tɔm fɛyɩ dɔɔsʋ se pama kɩlɛmʋʋ tɩŋa fenaɣ kanɛ taa.'
  },
  prof_current_circles: {
    fr: 'Vos cercles actuels',
    en: 'Your current circles',
    ee: 'Wò Habɔbɔ Fifitɔwo',
    kbp: 'Ño-tontinaa lɛɛlɛɛyɔ'
  },
  prof_no_circle_member: {
    fr: "Vous n'êtes membre d'aucun cercle.",
    en: 'You are not a member of any circle.',
    ee: 'Mènye xɔ́ na habɔbɔ aɖeke o.',
    kbp: 'N-tɩɩ kɛ mʋyʋ tontine naɖɩyɛ taa.'
  },
  prof_subscription_advantages: {
    fr: 'Abonnement & Avantages',
    en: 'Subscription & Benefits',
    ee: 'Bubɔ & Viɖewo',
    kbp: 'Kpaɣʋʋ nɛ ñɩm'
  },
  prof_current_plan_label: {
    fr: 'Plan Actuel :',
    en: 'Current Plan:',
    ee: 'Ɖoɖo Fifitɔ:',
    kbp: 'Lɩmaɣza lɛɛlɛɛyɔ:'
  },
  prof_plan_premium: {
    fr: 'Premium',
    en: 'Premium',
    ee: 'Premium',
    kbp: 'Premium'
  },
  prof_plan_free: {
    fr: 'Gratuit',
    en: 'Free',
    ee: 'Femaxee',
    kbp: 'Kɩ-fɛyɩ liidiye'
  },
  prof_eganye_premium: {
    fr: 'Eganyé Premium',
    en: 'Eganyé Premium',
    ee: 'Eganyé Premium',
    kbp: 'Eganyé Premium'
  },
  prof_eganye_essential: {
    fr: 'Eganyé Essentiel',
    en: 'Eganyé Essential',
    ee: 'Eganyé Vevie',
    kbp: 'Eganyé kɩ-cɛyʋʋ'
  },
  prof_basic_access_desc: {
    fr: 'Accès de base aux cercles de tontine.',
    en: 'Basic access to tontine circles.',
    ee: 'Mɔnukpɔkpɔ gɔmetɔ ɖe tontine habɔbɔwo ŋu.',
    kbp: 'Waɖɛ kajalaɣ tontinaa taa.'
  },
  prof_subscription_active_prefix: {
    fr: 'Abonnement actif',
    en: 'Active subscription',
    ee: 'Bubɔ Si Le Dɔ Wɔm',
    kbp: 'Kpaɣʋʋ ŋga kɩ-ka la yɔ'
  },
  prof_subscription_active_until: {
    fr: "jusqu'au",
    en: 'until',
    ee: 'vaseɖe',
    kbp: 'halɩ'
  },
  prof_premium_coming_soon: {
    fr: 'Eganyé Premium — Bientôt disponible',
    en: 'Eganyé Premium — Coming soon',
    ee: 'Eganyé Premium — Ava Kpuie',
    kbp: 'Eganyé Premium — Kɩ-kɔŋ kpɛdɛ'
  },
  prof_security_privacy_title: {
    fr: 'Sécurité & Confidentialité',
    en: 'Security & Privacy',
    ee: 'Dedienɔnɔme & Nutɔyɔyɔ',
    kbp: 'Ñʋʋ taa lakasɩ nɛ sɩɖʋʋ'
  },
  prof_edit_pin_label: {
    fr: 'Modifier le PIN Eganyé (4 chiffres)',
    en: 'Change the Eganyé PIN (4 digits)',
    ee: 'Trɔ Eganyé PIN (Xexlẽme 4)',
    kbp: 'Yekiɣ Eganyé PIN (sɔɔndʋ 4)'
  },
  prof_new_pin_placeholder: {
    fr: 'Nouveau PIN',
    en: 'New PIN',
    ee: 'PIN Yeye',
    kbp: 'PIN kɩfaŋa'
  },
  sending_label: {
    fr: 'Envoi...',
    en: 'Sending...',
    ee: 'Wole Ɖoɖom...',
    kbp: 'Ka tiyuu...'
  },
  edit_label: {
    fr: 'Modifier',
    en: 'Edit',
    ee: 'Trɔe',
    kbp: 'Yekiɣ'
  },
  prof_edit_password_label: {
    fr: 'Modifier le mot de passe',
    en: 'Change password',
    ee: 'Trɔ Nyagbe',
    kbp: 'Yekiɣ tɛmɛnsira'
  },
  prof_new_password_placeholder: {
    fr: 'Nouveau mot de passe (6+ caractères)',
    en: 'New password (6+ characters)',
    ee: 'Nyagbe Yeye (Sɔɔndʋ 6+)',
    kbp: 'Tɛmɛnsira kɩfaŋa (sɔɔndʋ 6+)'
  },
  prof_biometrics_label: {
    fr: 'Biométrie (Empreinte / FaceID)',
    en: 'Biometrics (Fingerprint / FaceID)',
    ee: 'Ŋutinuɖeɖe (Asibidɛwo / FaceID)',
    kbp: 'Tɔnʋʋ dɔkɔtɔ (Nɩɩnzɩ / FaceID)'
  },
  prof_biometrics_desc: {
    fr: "Utiliser l'empreinte pour déverrouiller l'application sur cet appareil.",
    en: 'Use your fingerprint to unlock the app on this device.',
    ee: 'Zã asibidɛ be nàʋu app la le mɔ̃ sia dzi.',
    kbp: 'Kpaɣ nɩɩnzɩ se ŋ-mʋ app kɩlɩzɩ ɛnɛ taa.'
  },
  prof_biometrics_enabled_toast: {
    fr: 'Biométrie activée sur cet appareil !',
    en: 'Biometrics enabled on this device!',
    ee: 'Wowɔ Ŋutinuɖeɖe Dɔ Le Mɔ̃ Sia Dzi!',
    kbp: 'Tɔnʋʋ dɔkɔtɔ pɩ-la kɩlɩzɩ ɛnɛ taa!'
  },
  prof_notif_preferences_title: {
    fr: 'Préférences de Notification',
    en: 'Notification Preferences',
    ee: 'Nyagbedeasi Lɔlɔ̃nuwo',
    kbp: 'Tɔm susuu sɔɔlɩm'
  },
  prof_notif_preferences_desc: {
    fr: 'Choisissez les canaux par lesquels vous souhaitez recevoir vos rappels de cotisation.',
    en: 'Choose the channels through which you want to receive your contribution reminders.',
    ee: 'Tia mɔ siwo dzi nàdi be yeaxɔ wò gaxexlẽ ŋkuɖodziwo le.',
    kbp: 'Lɩzɩ nɔɔ ŋgʋ n-sɔɔlɩ se n-mʋ liidiye haʋ ñɔɔzʋʋ yɔ.'
  },
  prof_push_channel_desc: {
    fr: 'Sur votre téléphone mobile — bientôt disponible',
    en: 'On your mobile phone — coming soon',
    ee: 'Le wò kaɖifon dzi — ava kpuie',
    kbp: 'Ño-kaɖifɔɔnɩ taa — kɩ-kɔŋ kpɛdɛ'
  },
  sms_label: {
    fr: 'SMS',
    en: 'SMS',
    ee: 'SMS',
    kbp: 'SMS'
  },
  prof_sms_channel_desc: {
    fr: 'Rappels directs par SMS',
    en: 'Direct reminders by SMS',
    ee: 'Ŋkuɖodzi tẽe to SMS dzi',
    kbp: 'Ñɔɔzʋʋ tɔntɔ SMS taa'
  },
  email_label: {
    fr: 'Email',
    en: 'Email',
    ee: 'Email',
    kbp: 'Email'
  },
  prof_email_channel_desc: {
    fr: 'Reçus et récapitulatifs mensuels',
    en: 'Monthly receipts and summaries',
    ee: 'Fexexlẽ gbalẽwo kple ɣleti me nyakpitiwo',
    kbp: 'Fenaɣ sɛbɩyɛ nɛ fenaɣ kʋɖʋmaɣ tɔm kpɩyɩnɖʋ'
  },
  whatsapp_label: {
    fr: 'WhatsApp',
    en: 'WhatsApp',
    ee: 'WhatsApp',
    kbp: 'WhatsApp'
  },
  prof_whatsapp_channel_desc: {
    fr: 'Alertes et rappels automatisés',
    en: 'Automated alerts and reminders',
    ee: 'Nyaɖeɖe kple ŋkuɖodzi siwo wɔna wo ɖokui',
    kbp: 'Tɔm susuu nɛ ñɔɔzʋʋ ɖɔɖɔyɔ'
  },
  prof_legal_documents_title: {
    fr: 'Documents Légaux',
    en: 'Legal Documents',
    ee: 'Sedede Nuŋɔŋlɔwo',
    kbp: 'Sɛtʋ sɛbɩyɛ'
  },
  prof_legal_documents_desc: {
    fr: 'Consultez la réglementation des tontines collaboratives et notre politique de confidentialité.',
    en: 'Review the regulations for collaborative tontines and our privacy policy.',
    ee: 'Kpɔ tontine ɖekawɔwɔ ƒe sewo kple míaƒe nutɔyɔyɔ gɔmeɖoɖo.',
    kbp: 'Cɔnɩ tontine kpɛndʋʋ sɛtʋ nɛ ɖɩ-sɩɖʋʋ ñɔɔzʋʋ.'
  },
  prof_cgu_label: {
    fr: "Conditions Générales d'Utilisation (CGU)",
    en: 'General Terms of Use (CGU)',
    ee: 'Zazã Se Gbatoawo (CGU)',
    kbp: 'Kpaɣʋʋ sɛtʋ tɩŋa (CGU)'
  },
  prof_reglement_label: {
    fr: 'Règlement Officiel des Tontines',
    en: 'Official Tontine Regulations',
    ee: 'Tontine Se Vavãtɔ',
    kbp: 'Tontine sɛtʋ kɩbaŋʋ'
  },
  prof_confidentialite_label: {
    fr: 'Politique de Confidentialité & Données',
    en: 'Privacy & Data Policy',
    ee: 'Nutɔyɔyɔ & Nyatakaka Gɔmeɖoɖo',
    kbp: 'Sɩɖʋʋ nɛ tɔm ñɔɔzʋʋ'
  },
  prof_delete_account_confirm_title: {
    fr: 'Supprimer définitivement mon compte ?',
    en: 'Permanently delete my account?',
    ee: 'Àtutu Nye Akɔnta Gbidigbidiaa?',
    kbp: 'Ɖɩzɩ man kalɩyɛ tam tam?'
  },
  prof_delete_account_irreversible: {
    fr: 'Cette action est irréversible. Toutes vos données seront effacées.',
    en: 'This action is irreversible. All your data will be erased.',
    ee: 'Nu sia matɔ ɖe megbe o. Wò nyatakakawo katã abu.',
    kbp: 'Lakasɩ ɛnɛ tɩɩ pɩsɩɣ. Ño-tɔm kɩ-tɩŋa kɩ-tɔlʋʋ.'
  },
  prof_delete_blocked_prefix: {
    fr: 'Vous avez actuellement',
    en: 'You currently have',
    ee: 'Fifia la, èle',
    kbp: 'Lɛɛlɛɛyɔ n-wɛnɩ'
  },
  prof_delete_blocked_suffix: {
    fr: 'cercle(s) actif(s)',
    en: 'active circle(s)',
    ee: 'habɔbɔ si le dɔ wɔm',
    kbp: 'tontine ŋgʋ kɩ-ka ñʋʋ taa yɔ'
  },
  prof_delete_blocked_desc: {
    fr: 'Veuillez quitter ou régler vos cotisations avant de supprimer votre compte.',
    en: 'Please leave or settle your contributions before deleting your account.',
    ee: 'Taflatse dzo alo xe wò gaxexlẽwo hafi nàtutu wò akɔnta.',
    kbp: 'Taa lɩɩ yaa fɛ ño-liidiye haʋ ɖooo ŋ-ɖɩzɩ ño-kalɩyɛ pɩ-yɔɔ.'
  },
  prof_delete_account_confirm_desc: {
    fr: 'Confirmez-vous la suppression immédiate de votre compte Eganyé ?',
    en: 'Do you confirm the immediate deletion of your Eganyé account?',
    ee: 'Èka ɖe edzi be yeatutu wò Eganyé akɔnta enumake?',
    kbp: 'N-ña se pɩ-ɖɩzɩ ño-Eganyé kalɩyɛ lɛɛlɛɛyɔ?'
  },
  prof_account_deleted_toast: {
    fr: 'Compte supprimé.',
    en: 'Account deleted.',
    ee: 'Wotutu Akɔnta La.',
    kbp: 'Kalɩyɛ pɩ-ɖɩzɩ.'
  },

  // Onboarding.tsx — signup/login flow i18n pass (Sprint 7)
  onb_enter_valid_email: {
    fr: 'Veuillez saisir un email valide.',
    en: 'Please enter a valid email.',
    ee: 'Taflatse ŋlɔ email nyuitɔ.',
    kbp: 'Taa kalɩ email kɩbaŋɖɛ.'
  },
  onb_enter_password: {
    fr: 'Veuillez saisir votre mot de passe.',
    en: 'Please enter your password.',
    ee: 'Taflatse ŋlɔ wò nyagbe.',
    kbp: 'Taa kalɩ ño-tɛmɛnsira.'
  },
  onb_invalid_credentials: {
    fr: 'Email ou mot de passe incorrect.',
    en: 'Incorrect email or password.',
    ee: 'Email alo nyagbe mesɔ o.',
    kbp: 'Email yaa tɛmɛnsira fɛyɩ ɖeu.'
  },
  onb_login_error_prefix: {
    fr: 'Erreur de connexion :',
    en: 'Login error:',
    ee: 'Vodada le gebɔbɔ me :',
    kbp: 'Kɩdɛkɛdɩm kpɛndʋʋ taa :'
  },
  onb_enter_username: {
    fr: "Veuillez saisir un nom d'utilisateur.",
    en: 'Please enter a username.',
    ee: 'Taflatse ŋlɔ zãnu ŋkɔ.',
    kbp: 'Taa kalɩ lɩmaɣzɩyʋ hɩɖɛ.'
  },
  onb_pw_min_6: {
    fr: 'Le mot de passe doit contenir au moins 6 caractères.',
    en: 'The password must contain at least 6 characters.',
    ee: 'Nyagbe la le be wòanɔ nyaŋɔŋlɔ 6 teƒe.',
    kbp: 'Tɛmɛnsira ɖɔ ka kɛ nɖʋʋ 6 sɔɔndʋ dɔɔsʋ.'
  },
  onb_pw_not_strong_enough: {
    fr: 'Votre mot de passe doit remplir toutes les conditions ci-dessous.',
    en: 'Your password must meet all the requirements below.',
    ee: 'Ele be wò nyagbe nawɔ ɖe nudidiwo katã le ete la dzi.',
    kbp: 'Pɩ-wɛɛ se ño-tɛmɛnsira wɛɛ nɖʋʋ tɩŋa ŋgʋ kɩ-wɛ tɛtʋ yɔɔ yɔ.'
  },
  onb_pw_req_length: {
    fr: '6 caractères min.',
    en: '6+ characters',
    ee: 'Sɔɔndʋ 6 ya wu',
    kbp: 'Sɔɔndʋ 6 ɖeke-ɖeke'
  },
  onb_pw_req_uppercase: {
    fr: 'Une majuscule',
    en: 'One uppercase letter',
    ee: 'Nyaŋɔŋlɔ gã ɖeka',
    kbp: 'Mbʋlʋ sɔsɔ kʋɖʋm'
  },
  onb_pw_req_lowercase: {
    fr: 'Une minuscule',
    en: 'One lowercase letter',
    ee: 'Nyaŋɔŋlɔ sue ɖeka',
    kbp: 'Mbʋlʋ cikpelaɣ kʋɖʋm'
  },
  onb_pw_req_digit: {
    fr: 'Un chiffre',
    en: 'One number',
    ee: 'Xexlẽdzesi ɖeka',
    kbp: 'Kalʋʋ kʋɖʋm'
  },
  onb_pw_req_special: {
    fr: 'Un caractère spécial',
    en: 'One special character',
    ee: 'Dzesi tɔxɛ ɖeka',
    kbp: 'Sɔɔndʋ kɩjɛyʋʋ kʋɖʋm'
  },
  onb_auth_error_prefix: {
    fr: "Erreur d'authentification:",
    en: 'Authentication error:',
    ee: 'Vodada le dzesidede me:',
    kbp: 'Kɩdɛkɛdɩm ñaʋ taa:'
  },
  onb_slide1_desc: {
    fr: "Digitalisez vos cercles d'épargne en toute sécurité. Cotisez ensemble et suivez chaque versement en toute transparence depuis votre téléphone.",
    en: 'Digitize your savings circles safely. Contribute together and track every payment transparently from your phone.',
    ee: 'Tsɔ wò gadzraɖo habɔbɔwo de komputa me le dedie. Mixea gaxexlẽ ɖekae eye miakpɔ fexexlẽ ɖesiaɖe tẽe tso mia ƒe kaɖifon dzi.',
    kbp: 'Kpaɣ ño-marali tontinaa kpou taa sɩɖʋʋ taa. Mɩ-fɛ liidiye haʋ tɩŋa nɛ mɩ-cɔnɩ fenaɣ ñɔɔzʋʋ kɩ-tɩŋa ño-kaɖifɔɔnɩ taa.'
  },
  onb_slide2_title: {
    fr: 'Une Jeunesse Prospère qui Épargne',
    en: 'A Thriving Youth That Saves',
    ee: 'Sɔhɛwo Siwo Le Nu Tum Nyuie eye Wodzraa Ga Ɖo',
    kbp: 'Pɩyaɣ mʋyaa mba pɔ-maralɩ yɔ'
  },
  onb_slide2_desc: {
    fr: 'Étudiants, jeunes entrepreneurs et travailleurs : créez des cercles d\'épargne flexibles, suivez vos cotisations et réalisez vos projets.',
    en: 'Students, young entrepreneurs and workers: create flexible savings circles, track your contributions and achieve your projects.',
    ee: 'Sukuviwo, dɔwɔla ɖekɛ yeyewo kple dɔwɔlawo: miwɔ gadzraɖo habɔbɔ siwo le bɔbɔe, mikpɔ miaƒe gaxexlẽwo dzi eye miawɔ miaƒe ɖoɖowo.',
    kbp: 'Kalɩyaa, pɩyaɣ maralɩyaa nɛ tʋmɩyaa: mɩ-ma marali tontinaa nɛ pɩ-bɔbɔ, mɩ-cɔnɩ mɩ-liidiye haʋ nɛ mɩ-la mɩ-lɩmaɣza.'
  },
  onb_slide3_title: {
    fr: 'Encaissez par Mobile Money (Flooz, T-Money)',
    en: 'Get Paid via Mobile Money (Flooz, T-Money)',
    ee: 'Xɔ Ga To Mobile Money Dzi (Flooz, T-Money)',
    kbp: 'Mʋ liidiye Mobile Money taa (Flooz, T-Money)'
  },
  onb_slide3_desc: {
    fr: "Recevez directement l'intégralité du pot de tontine sur votre compte dès votre tour venu sans tracas.",
    en: 'Receive the full tontine pot directly to your account as soon as your turn comes, hassle-free.',
    ee: 'Xɔ tontine ga blibo la tẽe ɖe wò akɔnta dzi ne wò turn ɖo la, dzɔdzɔe.',
    kbp: 'Mʋ tontine liidiye kɩ-tɩŋa tɔntɔ ño-kalɩyɛ taa ño-kɩyakʋ ŋga kɩ-tala yɔ, fɛyɩ kaɖɛ.'
  },
  onb_signups_suspended: {
    fr: 'Les inscriptions sont temporairement suspendues. Réessayez plus tard.',
    en: 'Signups are temporarily suspended. Please try again later.',
    ee: 'Wotɔ ŋkɔŋɔŋlɔwo ɖe nu ɣeyiɣi kpui aɖe. Gadze agbagba emegbe.',
    kbp: 'Kalɩyɛ pɩ-sʋʋ alɩwaatʋ nɖɩyɛ taa. Tasɩ lakasɩ ño-cɔlɔ.'
  },
  onb_otp_sent_prefix: {
    fr: 'Un code à',
    en: 'A',
    ee: 'Kod si le',
    kbp: 'Kɩlɩzɩ ŋga kɩ-kɛ'
  },
  onb_otp_sent_mid: {
    fr: 'chiffres a été envoyé à',
    en: '-digit code has been sent to',
    ee: 'xexlẽme la, woɖoe ɖa na',
    kbp: 'sɔɔndʋ, patiyi'
  },
  onb_email_already_registered: {
    fr: 'Cet email est déjà associé à un compte. Connectez-vous plutôt.',
    en: 'This email is already linked to an account. Please log in instead.',
    ee: 'Email sia le akɔnta aɖe ŋu xoxo. Ge ɖe eme boŋ.',
    kbp: 'Email ɛnɛ kɛ kalɩyɛ nakʋyʋ taa. Kpɛndɩ pɩ-tɩŋa kɩ-taa.'
  },
  onb_password_too_weak: {
    fr: 'Le mot de passe est trop faible (minimum 6 caractères).',
    en: 'The password is too weak (minimum 6 characters).',
    ee: 'Nyagbe la gbɔdzɔ akpa (sɔɔndʋ 6 suetɔ).',
    kbp: 'Tɛmɛnsira fɛyɩ toovenim (sɔɔndʋ 6 dɔɔsʋ).'
  },
  onb_account_creation_error_prefix: {
    fr: 'Erreur lors de la création du compte :',
    en: 'Error while creating the account:',
    ee: 'Vodada dzɔ le akɔnta wɔwɔ me :',
    kbp: 'Kɩdɛkɛdɩm kalɩyɛ malʋʋ taa :'
  },
  onb_account_created_success: {
    fr: 'Votre compte eganyé a été créé avec succès !',
    en: 'Your eganyé account has been created successfully!',
    ee: 'Woa wò eganyé akɔnta nyuie!',
    kbp: 'Ño-eganyé kalɩyɛ pɩ-ma camɩyɛ!'
  },
  onb_enter_otp_digits_prefix: {
    fr: 'Veuillez saisir les',
    en: 'Please enter the',
    ee: 'Taflatse ŋlɔ',
    kbp: 'Taa kalɩ'
  },
  onb_enter_otp_digits_suffix: {
    fr: 'chiffres du code.',
    en: 'digits of the code.',
    ee: 'kod la ƒe xexlẽmewo.',
    kbp: 'kɩlɩzɩ sɔɔndʋ.'
  },
  onb_otp_invalid: {
    fr: 'Code incorrect ou expiré. Vérifiez le code ou renvoyez-en un nouveau.',
    en: 'Incorrect or expired code. Check the code or send a new one.',
    ee: 'Kod la mesɔ o alo eŋeɣi va yi. Kpɔ kod la ɖa alo gaɖo bubu ɖa.',
    kbp: 'Kɩlɩzɩ fɛyɩ ɖeu yaa pɩ-tɛma. Cɔnɩ kɩlɩzɩ yaa tasɩ tiyu kɩfaŋa.'
  },
  onb_verification_error_prefix: {
    fr: 'Erreur de vérification :',
    en: 'Verification error:',
    ee: 'Vodada le nukpɔkpɔ me :',
    kbp: 'Kɩdɛkɛdɩm pɔzʋʋ taa :'
  },
  onb_new_code_sent: {
    fr: 'Nouveau code envoyé !',
    en: 'New code sent!',
    ee: 'Woɖo Kod Yeye Ɖa!',
    kbp: 'Kɩlɩzɩ kɩfaŋa patiyi!'
  },
  onb_resend_code_error_prefix: {
    fr: 'Impossible de renvoyer le code :',
    en: 'Unable to resend the code:',
    ee: 'Womate ŋu agaɖo kod la ɖa o :',
    kbp: 'Pɩ-fɛyɩ ɖeu se pa-tasɩ tiyu kɩlɩzɩ :'
  },
  onb_welcome_desc: {
    fr: "Gérez vos cercles d'épargne africains avec simplicité, automatisez vos cotisations via Flooz, T-Money, et augmentez votre score financier.",
    en: 'Manage your African savings circles with ease, automate your contributions via Flooz, T-Money, and boost your financial score.',
    ee: 'Kpɔ wò Afrika gadzraɖo habɔbɔwo dzi bɔbɔe, wɔ wò gaxexlẽwo automatique to Flooz, T-Money dzi, eye nàdo wò ga xexlẽme ɖe edzi.',
    kbp: 'Ñɩɩ ño-Afrika marali tontinaa pɩ-bɔbɔ, la ño-liidiye haʋ ɖɔɖɔyɔ Flooz, T-Money yɔɔ, nɛ tasɩ ño-liidiye kɩlaʋ yɔɔ.'
  },
  onb_discover_eganye: {
    fr: 'Découvrir eganyé',
    en: 'Discover eganyé',
    ee: 'Dze Si eganyé',
    kbp: 'Nyɩ eganyé'
  },
  onb_or_continue_with: {
    fr: 'Ou continuer avec',
    en: 'Or continue with',
    ee: 'Alo yi edzi kple',
    kbp: 'Yaa ɖɔ nɛ pɩ-yɔɔ'
  },
  onb_google_signin: {
    fr: 'Connexion via Google',
    en: 'Sign in with Google',
    ee: 'Ge Ɖe Eme To Google Dzi',
    kbp: 'Kpɛndɩ Google yɔɔ'
  },
  onb_already_have_account: {
    fr: "J'ai déjà un compte, me connecter",
    en: 'I already have an account, log me in',
    ee: 'Akɔnta le asinye xoxo, na mage ɖe eme',
    kbp: 'Man-wɛnɩ kalɩyɛ, ha-m ɩ-kpɛndɩ'
  },
  onb_skip: {
    fr: 'Passer',
    en: 'Skip',
    ee: 'Tu Eme',
    kbp: 'Tɛlɩ'
  },
  onb_got_it: {
    fr: 'Compris !',
    en: 'Got it!',
    ee: 'Mese Egɔme!',
    kbp: 'Man-nɩɩ!'
  },
  onb_next: {
    fr: 'Suivant',
    en: 'Next',
    ee: 'Ɖe Kplɔe Ɖo',
    kbp: 'Kɩ-tɔŋ'
  },
  onb_login_title: {
    fr: 'Connectez-vous',
    en: 'Log in',
    ee: 'Ge Ɖe Eme',
    kbp: 'Kpɛndɩ'
  },
  onb_signup_title: {
    fr: 'Créez votre Compte',
    en: 'Create your Account',
    ee: 'Wɔ Wò Akɔnta',
    kbp: 'Ma ño-kalɩyɛ'
  },
  onb_login_desc: {
    fr: 'Entrez vos identifiants pour retrouver votre espace eganyé.',
    en: 'Enter your credentials to access your eganyé space.',
    ee: 'Ŋlɔ wò gadede nyawo be nàgakpɔ wò eganyé nɔƒe.',
    kbp: 'Kalɩ ño-sʋʋ tɔm se ŋ-tasɩ ño-eganyé ɖɩɣa taa.'
  },
  onb_signup_desc: {
    fr: 'Définissez vos identifiants pour vous connecter en toute sécurité.',
    en: 'Set your credentials to log in securely.',
    ee: 'Ɖo wò gadede nyawo be nàge ɖe eme le dedie.',
    kbp: 'Ñɔɔzɩ ño-sʋʋ tɔm se ŋ-kpɛndɩ sɩɖʋʋ taa.'
  },
  onb_no_account_yet: {
    fr: 'Pas encore de compte ? Créez-en un',
    en: "Don't have an account yet? Create one",
    ee: 'Akɔnta meli haɖe oa? Wɔ ɖeka',
    kbp: 'Kalɩyɛ fɛyɩ fɛyɛ? Ma nakʋyʋ'
  },
  onb_already_account_login: {
    fr: 'Vous avez déjà un compte ? Connectez-vous',
    en: 'Already have an account? Log in',
    ee: 'Akɔnta le asiwò xoxoa? Ge ɖe eme',
    kbp: 'N-wɛnɩ kalɩyɛ? Kpɛndɩ'
  },
  onb_name_placeholder: {
    fr: 'Ex: Fatou Sy',
    en: 'e.g. Fatou Sy',
    ee: 'Kpɔɖeŋu: Fatou Sy',
    kbp: 'Ɛzɩ: Fatou Sy'
  },
  onb_email_placeholder: {
    fr: 'Ex: fatou@gmail.com',
    en: 'e.g. fatou@gmail.com',
    ee: 'Kpɔɖeŋu: fatou@gmail.com',
    kbp: 'Ɛzɩ: fatou@gmail.com'
  },
  onb_password_label: {
    fr: 'Mot de passe',
    en: 'Password',
    ee: 'Nyagbe',
    kbp: 'Tɛmɛnsira'
  },
  onb_min_6_chars_placeholder: {
    fr: 'Min. 6 caractères',
    en: 'Min. 6 characters',
    ee: 'Sɔɔndʋ 6 suetɔ',
    kbp: 'Sɔɔndʋ 6 dɔɔsʋ'
  },
  onb_theme_label: {
    fr: 'Thème',
    en: 'Theme',
    ee: 'Ɖoɖo',
    kbp: 'Cɔnɩyʋ'
  },
  onb_biometric_access: {
    fr: 'Accès Biométrique',
    en: 'Biometric Access',
    ee: 'Ŋutinuɖeɖe Mɔnukpɔkpɔ',
    kbp: 'Tɔnʋʋ dɔkɔtɔ waɖɛ'
  },
  onb_faceid_or_fingerprint: {
    fr: 'Face ID ou Empreinte Digitale',
    en: 'Face ID or Fingerprint',
    ee: 'Face ID alo Asibidɛ',
    kbp: 'Face ID yaa nɩɩnzɩ'
  },
  onb_biometric_disabled_toast: {
    fr: 'Connexion biométrique désactivée.',
    en: 'Biometric login disabled.',
    ee: 'Wotu Ŋutinuɖeɖe Gebɔbɔ.',
    kbp: 'Tɔnʋʋ dɔkɔtɔ kpɛndʋʋ pɩ-sʋʋ.'
  },
  onb_biometric_linked_success: {
    fr: 'Biométrie associée avec succès !',
    en: 'Biometrics linked successfully!',
    ee: 'Wolé Ŋutinuɖeɖe Nyuie!',
    kbp: 'Tɔnʋʋ dɔkɔtɔ pɩ-la camɩyɛ!'
  },
  onb_connecting_ellipsis: {
    fr: 'Connexion...',
    en: 'Logging in...',
    ee: 'Wole Gebɔbɔm...',
    kbp: 'Ka kpɛndʋʋ...'
  },
  onb_next_step_button: {
    fr: 'Étape Suivante',
    en: 'Next Step',
    ee: 'Afɔɖeɖe Si Kplɔe Ɖo',
    kbp: 'Ðoŋ ŋga kɩ-tɔŋ yɔ'
  },
  onb_creating_account: {
    fr: 'Création en cours...',
    en: 'Creating...',
    ee: 'Wole Wɔwɔm...',
    kbp: 'Ka malʋʋ...'
  },
  onb_create_account_cta: {
    fr: 'Créer mon Compte eganyé !',
    en: 'Create my eganyé Account!',
    ee: 'Wɔ Nye eganyé Akɔnta!',
    kbp: 'Ma man eganyé kalɩyɛ!'
  },
  onb_verify_email_title: {
    fr: 'Vérifiez votre email',
    en: 'Verify your email',
    ee: 'Kpɔ Wò Email Ɖa',
    kbp: 'Ña ño-email'
  },
  onb_enter_code_prefix: {
    fr: 'Entrez le code à',
    en: 'Enter the',
    ee: 'Ŋlɔ kod si le',
    kbp: 'Kalɩ kɩlɩzɩ ŋga kɩ-kɛ'
  },
  onb_enter_code_suffix: {
    fr: 'chiffres envoyé à',
    en: '-digit code sent to',
    ee: 'xexlẽme la, si woɖo ɖa na',
    kbp: 'sɔɔndʋ, patiyi'
  },
  onb_verifying_ellipsis: {
    fr: 'Vérification...',
    en: 'Verifying...',
    ee: 'Wole Ekpɔm...',
    kbp: 'Ka pɔzʋʋ...'
  },
  onb_verify_code_button: {
    fr: 'Vérifier le code',
    en: 'Verify the code',
    ee: 'Kpɔ Kod La Ɖa',
    kbp: 'Ña kɩlɩzɩ'
  },
  onb_sending_in_progress: {
    fr: 'Envoi en cours...',
    en: 'Sending...',
    ee: 'Wole Ɖoɖom...',
    kbp: 'Ka tiyuu...'
  },
  onb_resend_code: {
    fr: "Je n'ai pas reçu de code — Renvoyer",
    en: "I didn't receive a code — Resend",
    ee: 'Nyemexɔ kod aɖeke o — Gaɖoe Ɖa',
    kbp: 'Man-mʋʋ kɩlɩzɩ — Tasɩ tiyu'
  },
  loading: {
    fr: 'Chargement…',
    en: 'Loading…',
    ee: 'Chargement…',
    kbp: 'Chargement…'
  },
  nav_contribute: {
    fr: 'Cotiser',
    en: 'Pay in',
    ee: 'Cotiser',
    kbp: 'Cotiser'
  },
  nav_activity: {
    fr: 'Activité',
    en: 'Activity',
    ee: 'Activité',
    kbp: 'Activité'
  },
  activity_title: {
    fr: 'Activité',
    en: 'Activity',
    ee: 'Activité',
    kbp: 'Activité'
  },
  activity_subtitle: {
    fr: 'Vos paiements, vos échéances et les nouvelles de vos cercles.',
    en: 'Your payments, deadlines and circle news.',
    ee: 'Vos paiements, vos échéances et les nouvelles de vos cercles.',
    kbp: 'Vos paiements, vos échéances et les nouvelles de vos cercles.'
  },
  cotiser_pick_circle_title: {
    fr: 'Quel cercle voulez-vous payer ?',
    en: 'Which circle do you want to pay?',
    ee: 'Quel cercle voulez-vous payer ?',
    kbp: 'Quel cercle voulez-vous payer ?'
  },
  cotiser_no_circle: {
    fr: "Vous n'avez pas encore de cercle actif à payer.",
    en: "You don't have an active circle to pay yet.",
    ee: "Vous n'avez pas encore de cercle actif à payer.",
    kbp: "Vous n'avez pas encore de cercle actif à payer."
  },
  // Libellés d'accessibilité (lecteurs d'écran) pour les boutons sans texte.
  a11y_back: {
    fr: 'Retour',
    en: 'Back',
    ee: 'Trɔ Yi Megbe',
    kbp: 'Pɩsɩ'
  },
  a11y_show_password: {
    fr: 'Afficher le mot de passe',
    en: 'Show password',
    ee: 'Afficher le mot de passe',
    kbp: 'Afficher le mot de passe'
  },
  a11y_hide_password: {
    fr: 'Masquer le mot de passe',
    en: 'Hide password',
    ee: 'Masquer le mot de passe',
    kbp: 'Masquer le mot de passe'
  },
  a11y_otp_digit: {
    fr: 'Chiffre',
    en: 'Digit',
    ee: 'Chiffre',
    kbp: 'Chiffre'
  },
  // Parcours « mot de passe oublié » — ee/kbp reprennent le français faute de
  // traduction validée : mieux vaut du français correct qu'un texte inventé.
  onb_forgot_title: {
    fr: 'Mot de passe oublié ?',
    en: 'Forgot your password?',
    ee: 'Mot de passe oublié ?',
    kbp: 'Mot de passe oublié ?'
  },
  onb_forgot_desc: {
    fr: "Pas d'inquiétude. Entrez votre email et nous vous enverrons un code.",
    en: "No worries. Enter your email and we'll send you a code.",
    ee: "Pas d'inquiétude. Entrez votre email et nous vous enverrons un code.",
    kbp: "Pas d'inquiétude. Entrez votre email et nous vous enverrons un code."
  },
  onb_send_code: {
    fr: 'Envoyer le code',
    en: 'Send the code',
    ee: 'Envoyer le code',
    kbp: 'Envoyer le code'
  },
  onb_code_sent_toast: {
    fr: 'Code envoyé. Regardez votre boîte mail.',
    en: 'Code sent. Check your inbox.',
    ee: 'Code envoyé. Regardez votre boîte mail.',
    kbp: 'Code envoyé. Regardez votre boîte mail.'
  },
  onb_reset_title: {
    fr: 'Nouveau mot de passe',
    en: 'New password',
    ee: 'Nouveau mot de passe',
    kbp: 'Nouveau mot de passe'
  },
  onb_reset_desc: {
    fr: 'Choisissez un mot de passe que vous retiendrez.',
    en: "Choose a password you'll remember.",
    ee: 'Choisissez un mot de passe que vous retiendrez.',
    kbp: 'Choisissez un mot de passe que vous retiendrez.'
  },
  onb_confirm_password_label: {
    fr: 'Confirmez le mot de passe',
    en: 'Confirm password',
    ee: 'Confirmez le mot de passe',
    kbp: 'Confirmez le mot de passe'
  },
  onb_passwords_dont_match: {
    fr: 'Les deux mots de passe ne sont pas identiques.',
    en: "The two passwords don't match.",
    ee: 'Les deux mots de passe ne sont pas identiques.',
    kbp: 'Les deux mots de passe ne sont pas identiques.'
  },
  onb_reset_password_button: {
    fr: 'Enregistrer le mot de passe',
    en: 'Save the password',
    ee: 'Enregistrer le mot de passe',
    kbp: 'Enregistrer le mot de passe'
  },
  onb_reset_success: {
    fr: 'Mot de passe modifié. Vous pouvez vous connecter.',
    en: 'Password changed. You can sign in now.',
    ee: 'Mot de passe modifié. Vous pouvez vous connecter.',
    kbp: 'Mot de passe modifié. Vous pouvez vous connecter.'
  },
  onb_reset_error: {
    fr: "Impossible de modifier le mot de passe. Réessayez dans un instant.",
    en: "Couldn't change the password. Try again in a moment.",
    ee: "Impossible de modifier le mot de passe. Réessayez dans un instant.",
    kbp: "Impossible de modifier le mot de passe. Réessayez dans un instant."
  },
  onb_send_code_error: {
    fr: "Impossible d'envoyer le code. Vérifiez l'email et réessayez.",
    en: "Couldn't send the code. Check the email and try again.",
    ee: "Impossible d'envoyer le code. Vérifiez l'email et réessayez.",
    kbp: "Impossible d'envoyer le code. Vérifiez l'email et réessayez."
  },
  onb_back_to_login: {
    fr: 'Retour à la connexion',
    en: 'Back to sign in',
    ee: 'Retour à la connexion',
    kbp: 'Retour à la connexion'
  },
  onb_default_username: {
    fr: 'Utilisateur',
    en: 'User',
    ee: 'Zãnu',
    kbp: 'Lɩmaɣzɩyʋ'
  },
  onb_biometric_auth_success: {
    fr: 'Authentification biométrique activée avec succès !',
    en: 'Biometric authentication enabled successfully!',
    ee: 'Wowɔ Ŋutinuɖeɖe Dzesidede Dɔ Nyuie!',
    kbp: 'Tɔnʋʋ dɔkɔtɔ ñaʋ pɩ-la camɩyɛ!'
  },

  // GroupDetails.tsx
  gd_back: {
    fr: 'Retour',
    en: 'Back',
    ee: 'Trɔ Megbe',
    kbp: 'Pɩsɩ'
  },
  gd_hide_chat: {
    fr: 'Masquer le Chat',
    en: 'Hide Chat',
    ee: 'Ɣla Chat',
    kbp: 'Sɔɔ Chat'
  },
  gd_show_chat: {
    fr: 'Afficher le Chat',
    en: 'Show Chat',
    ee: 'Ɖe Chat Fia',
    kbp: 'Wɩlɩ Chat'
  },
  gd_public: {
    fr: 'Public',
    en: 'Public',
    ee: 'Dutoƒo',
    kbp: 'Kpeekpe'
  },
  gd_private: {
    fr: 'Privé',
    en: 'Private',
    ee: 'Eɖokuitɔ',
    kbp: 'Ɛyʋ ɖeu tʋ'
  },
  gd_mark_completed: {
    fr: 'Marquer comme terminé',
    en: 'Mark as completed',
    ee: 'Dze Esi Wowu Enu',
    kbp: 'Yɔɔdɩ se pɩ-tɛma'
  },
  gd_ledger_card_title: {
    fr: 'Carnet Numérique & Transparence de Caisse',
    en: 'Digital Ledger & Treasury Transparency',
    ee: 'Agbalẽ Digital & Gadzikpɔkpɔ Ʋuʋu',
    kbp: 'Kɛdɛzaɣ Takayaɣ nɛ Liidiye Kɩ-wɛɛ Ɖeu'
  },
  gd_full_transparency_badge: {
    fr: 'Transparence Totale',
    en: 'Full Transparency',
    ee: 'Ʋuʋu Blibo',
    kbp: 'Kɩ-wɛɛ Ɖeu Tɩŋa'
  },
  gd_ledger_card_desc: {
    fr: 'État financier en temps réel accessible à tous les membres du cercle.',
    en: 'Real-time financial statement accessible to all circle members.',
    ee: 'Ga nɔnɔme si le eteƒe ɣesiaɣi si xɔ́ ɖesiaɖe ate ŋu akpɔ.',
    kbp: 'Liidiye kɩlaʋ ŋgʋ kɩ-wɛ lɛɛlɛɛyɔ nɛ tontine mʋyaa tɩŋa pɩzɩɣ pa-na-ɩ.'
  },
  gd_current_treasury_label: {
    fr: 'Caisse Actuelle',
    en: 'Current Treasury',
    ee: 'Ga Home Si Li Fifia',
    kbp: 'Liidiye Ŋgʋ Kɩ-Wɛ Lɛɛlɛɛyɔ'
  },
  gd_active_members_label: {
    fr: 'Membres Actifs',
    en: 'Active Members',
    ee: 'Xɔ́ Siwo Le Dɔ Wɔm',
    kbp: 'Mʋyaa Mba Pa-Lakɩ Tʋmɩyɛ'
  },
  gd_pot_per_cycle_label: {
    fr: 'Pot par Cycle',
    en: 'Pot per Cycle',
    ee: 'Ga Home Le Dzɔgbenya Ɖeka Me',
    kbp: 'Liidiye Kɩyakʋ Kʋɖʋmaɣ Taa'
  },
  gd_distribution_tour_title: {
    fr: 'Tour de Distribution — Qui reçoit quand ?',
    en: 'Distribution Round — Who receives when?',
    ee: 'Mavomavo Ƒe Dzɔgbenya — Ame Kae Axɔe Ɣekaɣi?',
    kbp: 'Liidiye Lɩʋ Kɩyakʋ — Anɩ Kaɣ Mʋʋ Alɩwaatʋ Ndʋ?'
  },
  gd_tour_word: {
    fr: 'Tour',
    en: 'Round',
    ee: 'Dzɔgbenya',
    kbp: 'Kɩyakʋ'
  },
  gd_distribution_tour_desc: {
    fr: 'Planning officiel des décaissements du cercle.',
    en: "Official schedule of the circle's payouts.",
    ee: 'Habɔbɔ ƒe gaxɔxɔ ɖoɖo si le nyanya me.',
    kbp: 'Tontine liidiye lɩʋ alɩwaatʋ ñɔɔzʋʋ ŋgʋ pa-yɔɔdaa yɔ.'
  },
  gd_next_beneficiary_label: {
    fr: 'Prochain Bénéficiaire',
    en: 'Next Beneficiary',
    ee: 'Ame Si Axɔ Ga La Le Vava Ge',
    kbp: 'Weyi Ɛ-Kaɣ Mʋʋ Yɔ'
  },
  gd_date_label: {
    fr: 'Date :',
    en: 'Date:',
    ee: 'Ŋkeke :',
    kbp: 'Kɩyakʋ :'
  },
  gd_net_amount_label: {
    fr: 'Montant Net Prévu',
    en: 'Expected Net Amount',
    ee: 'Ga Home Si Woɖo Anyi',
    kbp: 'Liidiye Ñɩma Ŋgʋ Kɩ-Kaɣ Kɔŋ Yɔ'
  },
  gd_draw_required_title: {
    fr: 'Tirage au sort requis',
    en: 'Draw required',
    ee: 'Nudɔɖeamedzi Le Kpɔkpɔ Ge',
    kbp: 'Pɩ-Wɛɛ Se Pa-Lɩzɩ Weyi'
  },
  gd_no_beneficiary_desc: {
    fr: 'Aucun bénéficiaire désigné pour ce cycle.',
    en: 'No beneficiary designated for this cycle.',
    ee: 'Womtia ame aɖeke haɖe be wòaxɔ ga le dzɔgbenya sia me o.',
    kbp: 'Pa-tɩ-lɩzɩ nɔɔyʋ kɩyakʋ ɛnɛ taa.'
  },
  gd_drawing_in_progress: {
    fr: 'Tirage en cours...',
    en: 'Drawing in progress...',
    ee: 'Nudɔɖeamedzi Le Edzi Yim...',
    kbp: 'Kɩ-Lɩzʋʋ Wɛ Ka Ñʋʋ Taa...'
  },
  gd_draw_button: {
    fr: 'Tirer au sort',
    en: 'Draw',
    ee: 'Da Nudɔɖeamedzi',
    kbp: 'Lɩzɩ Weyi'
  },
  gd_auction_discount_label: {
    fr: "Montant du rabais remporté à l'enchère (optionnel)",
    en: 'Discount amount won at auction (optional)',
    ee: 'Ga Home Si Woɖe Le Asitsatsa Me (Mele Vevie O)',
    kbp: 'Liidiye Ñɩma Ŋgʋ Pa-Ñaɣ Asitsatsa Taa (Pɩ-Fɛyɩ Kɩ-Cɛyɩm)'
  },
  gd_auction_discount_desc: {
    fr: 'Ce montant sera déduit du pot puis redistribué équitablement entre les autres membres actifs.',
    en: 'This amount will be deducted from the pot then redistributed equally among the other active members.',
    ee: 'Woaɖe ga home sia le ga home gã la me eye woagama ɖe xɔ́ bubu siwo le dɔ wɔm la dome sɔsɔe.',
    kbp: 'Pa-Kaɣ Ɖɛzɩ Liidiye Ñɩma Ɛnɛ Liidiye Sɔsɔɖɛ Taa Nɛ Pa-Ma-ɩ Ñɩnɖɛ Nɛ Lɛlaa Mba Pa-Lakɩ Tʋmɩyɛ Yɔ.'
  },
  gd_distribute_funds_button: {
    fr: 'Distribuer les fonds',
    en: 'Distribute funds',
    ee: 'Ma Ga La Ɖe Wo Nu',
    kbp: 'Lɩzɩ Liidiye'
  },
  gd_payout_done_label: {
    fr: 'Décaissement effectué',
    en: 'Payout completed',
    ee: 'Wona Ga La Xoxo',
    kbp: 'Liidiye Lɩʋ Pɩ-Tɛma'
  },
  gd_current_turn_label: {
    fr: 'Tour de gain actuel',
    en: 'Current winning turn',
    ee: 'Dzɔgbenya Si Le Edzi Yim Fifia',
    kbp: 'Kɩyakʋ Ŋgʋ Kɩ-Wɛ Ka Ñʋʋ Taa'
  },
  gd_upcoming_label: {
    fr: 'À venir',
    en: 'Upcoming',
    ee: 'Gbɔna',
    kbp: 'Kɩ-Kaɣ Kɔŋ'
  },
  gd_next_short_label: {
    fr: 'Prochain',
    en: 'Next',
    ee: 'Kplɔeɖo',
    kbp: 'Kɩ-Kɔŋ'
  },
  gd_waiting_short_label: {
    fr: 'Attente',
    en: 'Waiting',
    ee: 'Lalam',
    kbp: 'Taɣ Taa'
  },
  gd_circle_rules_title: {
    fr: 'Règlement du cercle',
    en: 'Circle rules',
    ee: 'Habɔbɔ Ƒe Sewo',
    kbp: 'Tontine Paɣtʋ'
  },
  gd_quick_share_badge: {
    fr: 'Partage Rapide',
    en: 'Quick Share',
    ee: 'Mavɔ Kabakaba',
    kbp: 'Tayɩ Lɔŋ'
  },
  gd_invite_link_title: {
    fr: "Lien d'Invitation & Accès PWA",
    en: 'Invitation Link & PWA Access',
    ee: 'Amekpekpe Ƒe Kadodo & PWA Nudede',
    kbp: 'Yaʋ Tɔm Ñɔɔzʋʋ nɛ PWA Sʋʋ'
  },
  gd_invite_link_desc: {
    fr: "Partagez ce lien personnalisé avec vos proches pour qu'ils rejoignent instantanément votre cercle de cotisation eganyé.",
    en: 'Share this personalized link with your loved ones so they can instantly join your eganyé savings circle.',
    ee: 'Ma kadodo si nye tɔwò sia kple wò ƒometɔwo be woage ɖe wò eganyé gaxexlẽ habɔbɔ me enumake.',
    kbp: 'Tayɩ ño-tɔm ñɔɔzʋʋ ɛnɛ ño-taabalaa nɛ pa-sʋʋ ño-eganyé tontine taa lɛɛlɛɛyɔ.'
  },
  gd_custom_link_label: {
    fr: 'Lien personnalisé du cercle',
    en: 'Circle personalized link',
    ee: 'Habɔbɔ Ƒe Kadodo Tɔwò',
    kbp: 'Tontine Tɔm Ñɔɔzʋʋ Ma-Tʋ'
  },
  gd_invite_link_aria: {
    fr: "Lien d'invitation du cercle",
    en: 'Circle invitation link',
    ee: 'Habɔbɔ Ƒe Amekpekpe Kadodo',
    kbp: 'Tontine Yaʋ Tɔm Ñɔɔzʋʋ'
  },
  gd_copied_label: {
    fr: 'Copié !',
    en: 'Copied!',
    ee: 'Wokopi!',
    kbp: 'Pɩ-Kpiɖi!'
  },
  gd_copy_label: {
    fr: 'Copier',
    en: 'Copy',
    ee: 'Kopi',
    kbp: 'Kpiɖi'
  },
  gd_invite_link_copied_toast: {
    fr: "Lien d'invitation copié !",
    en: 'Invitation link copied!',
    ee: 'Wokopi Amekpekpe Kadodo La!',
    kbp: 'Yaʋ Tɔm Ñɔɔzʋʋ Pɩ-Kpiɖi!'
  },
  gd_unique_code_label: {
    fr: 'Code unique du cercle',
    en: 'Circle unique code',
    ee: 'Habɔbɔ Ƒe Kodi Vovo',
    kbp: 'Tontine Kodi Kɩ-Kɛlɛʋ'
  },
  gd_code_copied_toast: {
    fr: 'Code de cercle copié !',
    en: 'Circle code copied!',
    ee: 'Wokopi Habɔbɔ Ƒe Kodi La!',
    kbp: 'Tontine Kodi Pɩ-Kpiɖi!'
  },
  gd_copy_code_title: {
    fr: 'Copier le code',
    en: 'Copy the code',
    ee: 'Kopi Kodi La',
    kbp: 'Kpiɖi Kodi'
  },
  gd_share_channels_label: {
    fr: 'Canaux de partage',
    en: 'Share channels',
    ee: 'Mɔ Siwo Dzi Woato Ama',
    kbp: 'Tayɩ Nʋmɔŋ'
  },
  gd_whatsapp_share_text: {
    fr: "Rejoins mon cercle d'épargne eganyé en cliquant sur ce lien :",
    en: 'Join my eganyé savings circle by clicking this link:',
    ee: 'Va ge ɖe nye eganyé gaxexlẽ habɔbɔ me to asitewo dzi le kadodo sia dzi :',
    kbp: 'Sʋʋ man eganyé tontine taa nɛ ŋ-nyɔɔ tɔm ñɔɔzʋʋ ɛnɛ yɔɔ :'
  },
  gd_telegram_share_text: {
    fr: "Rejoins mon cercle d'épargne eganyé",
    en: 'Join my eganyé savings circle',
    ee: 'Va ge ɖe nye eganyé gaxexlẽ habɔbɔ me',
    kbp: 'Sʋʋ man eganyé tontine taa'
  },
  gd_qr_code_alt: {
    fr: "Code QR d'invitation",
    en: 'Invitation QR code',
    ee: 'Amekpekpe QR Kodi',
    kbp: 'Yaʋ QR Kodi'
  },
  gd_scan_to_join: {
    fr: 'Scanner pour Rejoindre',
    en: 'Scan to Join',
    ee: 'Skan Be Nàge Ɖe Eme',
    kbp: 'Skanɩ Nɛ Ŋ-Sʋʋ'
  },
  gd_ranking_title: {
    fr: 'Classement du cercle',
    en: 'Circle ranking',
    ee: 'Habɔbɔ Ƒe Ðoɖo',
    kbp: 'Tontine Ðɔkɔtɔ'
  },
  gd_ranking_desc_prefix: {
    fr: 'Membres classés par',
    en: 'Members ranked by',
    ee: 'Woɖo xɔ́wo ɖe',
    kbp: 'Pa-Ðɔ Mʋyaa'
  },
  gd_you_badge: {
    fr: 'Vous',
    en: 'You',
    ee: 'Wò',
    kbp: 'Ño'
  },
  gd_confirm_distribution_title: {
    fr: 'Confirmer la distribution',
    en: 'Confirm distribution',
    ee: 'Kpe Ðe Mavomavo La Dzi',
    kbp: 'Ña Liidiye Lɩʋ'
  },
  gd_distribute_desc_prefix: {
    fr: 'Vous allez distribuer le pot de',
    en: 'You are about to distribute the pot of',
    ee: 'Àma ga home',
    kbp: 'Ŋ-Kaɣ Lɩzɩ Liidiye'
  },
  gd_distribute_desc_to: {
    fr: 'à',
    en: 'to',
    ee: 'na',
    kbp: 'na'
  },
  gd_distribute_desc_for_cycle: {
    fr: 'pour le cycle',
    en: 'for cycle',
    ee: 'na dzɔgbenya',
    kbp: 'kɩyakʋ'
  },
  gd_action_irreversible: {
    fr: 'Cette action est irréversible.',
    en: 'This action is irreversible.',
    ee: 'Nu sia matɔ ɖe megbe o.',
    kbp: 'Lakasɩ ɛnɛ tɩɩ pɩsɩɣ.'
  },
  gd_offline_draw_error: {
    fr: 'Vous êtes hors-ligne. Le tirage au sort nécessite une connexion internet.',
    en: 'You are offline. The draw requires an internet connection.',
    ee: 'Mèle ligne dzi o. Nudɔɖeamedzi hiã internet kadodo.',
    kbp: 'N-fɛyɩ ɩntɛrnɛɛtɩ taa. Weyi lɩzʋʋ pɔzʋʋ ɩntɛrnɛɛtɩ.'
  },
  gd_draw_error_generic: {
    fr: 'Erreur lors du tirage au sort.',
    en: 'Error during the draw.',
    ee: 'Vodada dzɔ le nudɔɖeamedzi me.',
    kbp: 'Kɩdɛkɛdɩm weyi lɩzʋʋ taa.'
  },
  gd_offline_distribute_error: {
    fr: 'Vous êtes hors-ligne. La distribution des fonds nécessite une connexion internet.',
    en: 'You are offline. Distributing funds requires an internet connection.',
    ee: 'Mèle ligne dzi o. Ga mavomavo hiã internet kadodo.',
    kbp: 'N-fɛyɩ ɩntɛrnɛɛtɩ taa. Liidiye lɩʋ pɔzʋʋ ɩntɛrnɛɛtɩ.'
  },
  gd_distribute_error_generic: {
    fr: 'Erreur lors de la distribution du cycle.',
    en: 'Error during cycle distribution.',
    ee: 'Vodada dzɔ le dzɔgbenya ƒe mavomavo me.',
    kbp: 'Kɩdɛkɛdɩm kɩyakʋ liidiye lɩʋ taa.'
  },
  gd_group_completed_toast: {
    fr: 'Le cercle a été marqué comme terminé.',
    en: 'The circle has been marked as completed.',
    ee: 'Wodze habɔbɔ la dzesi be wowu enu.',
    kbp: 'Pa-Yɔɔdɩ Se Tontine Pɩ-Tɛma.'
  },
  gd_complete_error_generic: {
    fr: 'Erreur lors de la clôture du cercle.',
    en: 'Error while closing the circle.',
    ee: 'Vodada dzɔ le habɔbɔ tutu me.',
    kbp: 'Kɩdɛkɛdɩm tontine sɩɖʋʋ taa.'
  },
  mm_role_treasurer: {
    fr: 'Trésorier',
    en: 'Treasurer',
    ee: 'Gadzikpɔla',
    kbp: 'Liidiye Cɔnɩyʋ'
  },
  mm_role_secretary: {
    fr: 'Secrétaire',
    en: 'Secretary',
    ee: 'Agbalẽlãla',
    kbp: 'Takayaɣ Mayʋ'
  },
  mm_management_title: {
    fr: 'Gestion des membres',
    en: 'Member management',
    ee: 'Xɔ́wo Ƒe Dziɖuɖu',
    kbp: 'Mʋyaa Ñɩɩʋ'
  },
  mm_management_desc: {
    fr: "Validez les demandes d'adhésion et gérez les rôles des membres du cercle.",
    en: 'Approve membership requests and manage the roles of circle members.',
    ee: 'Da asi ɖe amebiabia siwo le be woage ɖe habɔbɔ me la dzi eye nàɖu xɔ́wo ƒe dɔdeasiwo dzi.',
    kbp: 'Ña sʋʋ pɔzʋʋ nɛ ñɩɩ tontine mʋyaa tʋmɩyɛ.'
  },
  mm_pending_requests_label: {
    fr: 'Demandes en attente',
    en: 'Pending requests',
    ee: 'Amebiabia Siwo Le Lalam',
    kbp: 'Pɔzʋʋ Ŋgʋ Kɩ-Wɛ Ka Taɣ Taa'
  },
  mm_accept_title: {
    fr: 'Accepter',
    en: 'Accept',
    ee: 'Xɔe',
    kbp: 'Ña'
  },
  mm_reject_title: {
    fr: 'Refuser',
    en: 'Reject',
    ee: 'Gbe',
    kbp: 'Gbɛ'
  },
  mm_current_members_label: {
    fr: 'Membres actuels',
    en: 'Current members',
    ee: 'Xɔ́ Siwo Li Fifia',
    kbp: 'Mʋyaa Mba Pa-Wɛ Lɛɛlɛɛyɔ'
  },
  mm_creator_badge: {
    fr: 'Créateur',
    en: 'Creator',
    ee: 'Dzrala',
    kbp: 'Lɩzɩyʋ'
  },
  mm_exclude_title: {
    fr: 'Exclure',
    en: 'Exclude',
    ee: 'Ðe Ɖa',
    kbp: 'Ɖɩzɩ'
  },
  mm_default_member_fallback: {
    fr: 'ce membre',
    en: 'this member',
    ee: 'xɔ́ sia',
    kbp: 'mʋyʋ ɛnɛ'
  },
  mm_exclude_confirm_desc_main: {
    fr: "Cette personne perdra immédiatement l'accès au cercle et à son historique de cotisations.",
    en: 'This person will immediately lose access to the circle and their contribution history.',
    ee: 'Ame sia abu mɔnukpɔkpɔ be wòage ɖe habɔbɔ me kple eƒe gaxexlẽ ŋutinyawo enumake.',
    kbp: 'Ɛyʋ ɛnɛ ɛ-kaɣ tɔlʋʋ tontine nɛ ɩ-liidiye haʋ tɔm kɩ-tɩŋa lɛɛlɛɛyɔ.'
  },
  mm_confirm_exclude_label: {
    fr: 'Oui, exclure',
    en: 'Yes, exclude',
    ee: 'Ɛ̃, Ðe Ɖa',
    kbp: 'Ɛɛ, Ɖɩzɩ'
  },
  mm_membership_approved_title: {
    fr: 'Adhésion approuvée -',
    en: 'Membership approved -',
    ee: 'Woda Asi Ðe Ememeɖeɖe Dzi -',
    kbp: 'Sʋʋ Pɩ-Ña -'
  },
  mm_join_request_body_open: {
    fr: 'Votre demande pour rejoindre "',
    en: 'Your request to join "',
    ee: 'Wò amebiabia be nàge ɖe "',
    kbp: 'Ño Pɔzʋʋ Se N-Sʋʋ "'
  },
  mm_join_accepted_body_close: {
    fr: '" a été acceptée. Bienvenue !',
    en: '" has been accepted. Welcome!',
    ee: '" me la, woxɔe. Woezɔ!',
    kbp: '" taa pɩ-ña. Ðɛwɛzɔɔtʋ!'
  },
  mm_join_rejected_body_close: {
    fr: '" a été refusée par l\'administrateur.',
    en: '" has been rejected by the administrator.',
    ee: '" me la, amegã gbee.',
    kbp: '" taa admin gbɛ-ɩ.'
  },
  mm_member_accepted_fallback: {
    fr: 'Le membre',
    en: 'The member',
    ee: 'Xɔ́ La',
    kbp: 'Mʋyʋ'
  },
  mm_member_accepted_suffix: {
    fr: 'a été accepté dans le cercle.',
    en: 'has been accepted into the circle.',
    ee: 'woxɔe ɖe habɔbɔ la me.',
    kbp: 'pɩ-ña se ɛ-sʋʋ tontine taa.'
  },
  mm_accept_error: {
    fr: "Erreur lors de l'acceptation.",
    en: 'Error while accepting.',
    ee: 'Vodada dzɔ le exɔxɔ me.',
    kbp: 'Kɩdɛkɛdɩm ñaʋ taa.'
  },
  mm_membership_rejected_title: {
    fr: 'Adhésion refusée -',
    en: 'Membership rejected -',
    ee: 'Wogbe Ememeɖeɖe -',
    kbp: 'Sʋʋ Pa-Gbɛ -'
  },
  mm_request_rejected_toast: {
    fr: 'Demande refusée.',
    en: 'Request rejected.',
    ee: 'Wogbe Amebiabia La.',
    kbp: 'Pa-Gbɛ Pɔzʋʋ.'
  },
  mm_reject_error: {
    fr: 'Erreur lors du refus.',
    en: 'Error while rejecting.',
    ee: 'Vodada dzɔ le gbegbe me.',
    kbp: 'Kɩdɛkɛdɩm gbɛʋ taa.'
  },
  mm_creator_cannot_be_excluded: {
    fr: 'Le créateur du cercle ne peut pas être exclu.',
    en: 'The circle creator cannot be excluded.',
    ee: 'Womate ŋu aɖe habɔbɔ la dzrala ɖa o.',
    kbp: 'Pa-Pɩzɩɣ Pa-Ɖɩzɩ Tontine Lɩzɩyʋ.'
  },
  mm_exclusion_title: {
    fr: 'Exclusion -',
    en: 'Exclusion -',
    ee: 'Ðeɖeɖa -',
    kbp: 'Ðɩzʋʋ -'
  },
  mm_exclusion_body_open: {
    fr: 'Vous avez été exclu du cercle "',
    en: 'You have been excluded from the circle "',
    ee: 'Woɖe wò ɖa le habɔbɔ "',
    kbp: 'Pa-Ɖɩzɩ-ŋ Tontine "'
  },
  mm_exclusion_body_close: {
    fr: '" par l\'administrateur.',
    en: '" by the administrator.',
    ee: '" me la, amegã dzi.',
    kbp: '" taa yɔɔ nɛ admin.'
  },
  mm_member_excluded_toast: {
    fr: 'Membre exclu du cercle.',
    en: 'Member excluded from the circle.',
    ee: 'Woɖe Xɔ́ La Ɖa Le Habɔbɔ La Me.',
    kbp: 'Pa-Ɖɩzɩ Mʋyʋ Tontine Taa.'
  },
  mm_exclude_error: {
    fr: "Erreur lors de l'exclusion.",
    en: 'Error while excluding.',
    ee: 'Vodada dzɔ le ɖeɖeɖa me.',
    kbp: 'Kɩdɛkɛdɩm ɖɩzʋʋ taa.'
  },
  mm_role_updated_prefix: {
    fr: 'Rôle mis à jour :',
    en: 'Role updated:',
    ee: 'Dɔdeasi Trɔ :',
    kbp: 'Tʋmɩyɛ Yekiɣ :'
  },
  mm_role_change_error: {
    fr: 'Erreur lors du changement de rôle.',
    en: 'Error while changing role.',
    ee: 'Vodada dzɔ le dɔdeasi trɔtrɔ me.',
    kbp: 'Kɩdɛkɛdɩm tʋmɩyɛ yekiɣu taa.'
  },

  // CreateGroupDialog.tsx
  cgd_new_circle_button: {
    fr: 'Nouveau Cercle',
    en: 'New Circle',
    ee: 'Habɔbɔ Yeye',
    kbp: 'Tontine kɩfaŋa'
  },
  cgd_dialog_title: {
    fr: 'Créer un nouveau cercle',
    en: 'Create a new circle',
    ee: 'Wɔ Habɔbɔ Yeye',
    kbp: 'Ma tontine kɩfaŋa'
  },
  cgd_dialog_desc: {
    fr: 'Configurez votre tontine digitale. Vous pourrez inviter des proches et automatiser les cotisations après sa création.',
    en: 'Set up your digital tontine. You will be able to invite relatives and automate contributions after creating it.',
    ee: 'Ðo wò tontine komputa dzi ɖoɖo. Àte ŋu akpe wò ƒometɔwo ɖo eye nàna gaxexlẽwo nawɔ nu ɖokuiwo dzi le esi nàwɔe vɔ megbe.',
    kbp: 'Ñɔɔzɩ ño-tontine kɩfaŋa kpou taa. Ŋ-pɩzɩɣ nɛ ŋ-yaa ño-ɛyaa nɛ liidiye haʋ la wɛɛ ɖeke-ɖeke ye n-manɩ-kɛ.'
  },
  cgd_name_label: {
    fr: 'Nom du cercle',
    en: 'Circle name',
    ee: 'Habɔbɔ ƒe Ŋkɔ',
    kbp: 'Tontine hɩɖɛ'
  },
  cgd_name_placeholder: {
    fr: 'Ex: Cotisation de Solidarité',
    en: 'E.g.: Solidarity Contribution',
    ee: 'Kpɔɖeŋu: Gaxexlẽ Dɔmenyowɔwɔ',
    kbp: 'Kɩɖaʋ: Liidiye haʋ lɩmaɣza taa'
  },
  cgd_description_label: {
    fr: 'Description / Objectif',
    en: 'Description / Goal',
    ee: 'Numeɖeɖe / Taɖodzinu',
    kbp: 'Tɔm ndʋ / Kaɖʋʋ'
  },
  cgd_description_placeholder: {
    fr: "Ex: Financer l'achat d'un terrain, équipement ou s'entraider pour des projets...",
    en: 'E.g.: Fund a land purchase, equipment, or support each other on projects...',
    ee: 'Kpɔɖeŋu: Kpe ɖe anyigba ƒle, nu wɔwɔ nu alo mia kpe mia nɔewo ɖe dɔwɔwɔwo ŋu...',
    kbp: 'Kɩɖaʋ: Sɔnzɩ tɛtʋ mʋʋ, tʋmɩyɛ ñɩma yaa sɩnɩ ɖama tʋmɩyɛ nzɩ sɩ-taa...'
  },
  cgd_amount_label: {
    fr: 'Montant (FCFA)',
    en: 'Amount (FCFA)',
    ee: 'Ga Home (FCFA)',
    kbp: 'Liidiye ñɩma (FCFA)'
  },
  cgd_choose_placeholder: {
    fr: 'Choisir',
    en: 'Choose',
    ee: 'Tia',
    kbp: 'Lɩzɩ'
  },
  cgd_max_members_label: {
    fr: 'Nombre de participants',
    en: 'Number of participants',
    ee: 'Amesiwo Kpɔ Gome ƒe Xexlẽme',
    kbp: 'Mʋyaa ñɩma'
  },
  cgd_distribution_method_label: {
    fr: 'Méthode de distribution',
    en: 'Distribution method',
    ee: 'Mɔ Si Dzi Woamã Ga Ðo',
    kbp: 'Liidiye lɩʋ ɖoŋ'
  },
  cgd_dist_sequential: {
    fr: 'Rotation séquentielle',
    en: 'Sequential rotation',
    ee: 'Mavomavo Ðoɖo Nu',
    kbp: 'Liidiye lɩʋ ɖoŋ taa'
  },
  cgd_dist_draw: {
    fr: 'Tirage au sort',
    en: 'Random draw',
    ee: 'Nudzidze Le Dzɔgbenyui Nu',
    kbp: 'Liidiye lɩʋ kɛ kaɣlaɣ taa'
  },
  cgd_dist_auction: {
    fr: 'Enchères',
    en: 'Auction',
    ee: 'Asiƒoƒo',
    kbp: 'Kɩlaʋ sɔsɔŋ taa'
  },
  cgd_start_date_label: {
    fr: 'Date de début',
    en: 'Start date',
    ee: 'Ŋkeke Si Wodze Egɔme',
    kbp: 'Kɩyakʋ ŋga pɩ-paɣzɩɣ yɔ'
  },
  cgd_end_date_label: {
    fr: 'Date de fin (optionnel)',
    en: 'End date (optional)',
    ee: 'Ŋkeke Si Wowu Enu (Ðe Wòle Be)',
    kbp: 'Kɩyakʋ ŋga pɩ-tɛŋɩɣ yɔ (Ye ŋ-sɔɔlaa)'
  },
  cgd_rules_label: {
    fr: 'Règles du cercle (optionnel)',
    en: 'Circle rules (optional)',
    ee: 'Habɔbɔ ƒe Sewo (Ðe Wòle Be)',
    kbp: 'Tontine paɣtʋ (Ye ŋ-sɔɔlaa)'
  },
  cgd_rules_placeholder: {
    fr: 'Ex: Tout retard de plus de 3 jours entraîne une pénalité. Toute exclusion nécessite un vote...',
    en: 'E.g.: Any delay of more than 3 days incurs a penalty. Any exclusion requires a vote...',
    ee: 'Kpɔɖeŋu: Tsitsi si wu ŋkeke 3 la hea tohehe vɛ. Ne woaɖe ame le habɔbɔ me la, ele be woada akɔntabuwo...',
    kbp: 'Kɩɖaʋ: Kɩgbɛdɩŋ ŋgʋ kɩ-tɛɣ kɩyakʋ naadozo yɔ, kɩ-kɔŋnɩ tɔlɩm. Ye pɔzɩ nɛ paɖɛ mʋyʋ nɔɔyʋ yɔ, pɩ-pɔzɩ se pañaɣ kɩcɛyʋʋ...'
  },
  cgd_private_circle_label: {
    fr: 'Cercle privé',
    en: 'Private circle',
    ee: 'Habɔbɔ Adzame',
    kbp: 'Tontine sɔɔlʋʋ'
  },
  cgd_private_circle_desc: {
    fr: 'Invisible dans la recherche publique ; rejoignable uniquement par lien, QR code ou code.',
    en: 'Invisible in public search; joinable only via link, QR code, or code.',
    ee: 'Womate ŋu akpɔe le dutoƒo didi me o; woate ŋu age ɖe eme to kadodo, QR kod alo kod dzi ko.',
    kbp: 'Paapɩzɩɣ nɛ pana-kɛ pɔzʋʋ tɔm taa; pɩ-pɩzɩɣ se pakpɛndɩ ɖeke nɛ kadodo, QR kod yaa kod.'
  },
  cgd_penalty_fixed_toggle: {
    fr: 'Montant fixe',
    en: 'Fixed amount',
    ee: 'Ga Home Si Womatrɔ O',
    kbp: 'Liidiye ñɩma ŋga kɩ-tɩyɩɣ yɔ'
  },
  cgd_penalty_percentage_toggle: {
    fr: 'Pourcentage / jour',
    en: 'Percentage / day',
    ee: 'Akpa Alafa / Ŋkeke',
    kbp: 'Kɩmaŋ (%) / kɩyakʋ'
  },
  cgd_penalty_rate_label: {
    fr: 'Taux (% / jour)',
    en: 'Rate (%/day)',
    ee: 'Home (% / Ŋkeke)',
    kbp: 'Ñɩma (% / kɩyakʋ)'
  },
  cgd_grace_period_label: {
    fr: 'Délai de grâce (jours)',
    en: 'Grace period (days)',
    ee: 'Ɣeyiɣi Vevi (Ŋkekewo)',
    kbp: 'Alɩwaatʋ nʋmɔʋ (kɩyakɩŋ)'
  },
  cgd_legal_validation_title: {
    fr: 'Validation Légale',
    en: 'Legal Validation',
    ee: 'Sedede Ŋuɖoɖo',
    kbp: 'Paɣtʋ ñaʋ'
  },
  cgd_terms_label: {
    fr: "J'accepte les conditions générales et la politique de gestion de tontine.",
    en: 'I accept the general terms and conditions and the tontine management policy.',
    ee: 'Melɔ̃ ɖe se gbadzawo kple tontine dzikpɔkpɔ ƒe ɖoɖowo dzi.',
    kbp: 'Mɛnɖʋ liu se sɔsɔna nɛ tontine ñɩɩʋ paɣtʋ.'
  },
  cgd_terms_desc: {
    fr: 'En tant que gestionnaire, vous vous engagez à respecter les règles de transparence établies par égané.',
    en: 'As the manager, you commit to respecting the transparency rules set by égané.',
    ee: 'Abe dzikpɔla ene la, èlɔ̃ be yeawɔ ɖe se siwo egané ɖo anyi tso nyanyaɖeɖe ŋu la dzi.',
    kbp: 'Ɛzɩ ñɩɩyʋ yɔ, ŋ-mɛnɖʋ liu se se nzɩ egané ɖʋ tɩlɩyɛ yɔɔ, sɩ-yɔɔ.'
  },
  cgd_signature_label: {
    fr: 'Signature Électronique',
    en: 'Electronic Signature',
    ee: 'Asidede Komputa Dzi',
    kbp: 'Kpou taa nɩɩyɛ'
  },
  cgd_creating_ellipsis: {
    fr: 'Création en cours...',
    en: 'Creating...',
    ee: 'Ele Ewɔm...',
    kbp: 'Ka malʋʋ...'
  },
  cgd_submit_cta: {
    fr: "Créer le cercle d'épargne",
    en: 'Create the savings circle',
    ee: 'Wɔ Gadzraɖo Habɔbɔ La',
    kbp: 'Ma tontine liidiye kaɖaɣ'
  },
  cgd_offline_error: {
    fr: "Vous êtes hors-ligne. La création d'un cercle nécessite une connexion internet.",
    en: 'You are offline. Creating a circle requires an internet connection.',
    ee: 'Mèle ɖe intanet dzi o. Ele be nàkpɔ intanet hafi awɔ habɔbɔ.',
    kbp: 'Ŋ-fɛyɩ ɛntɛrnɛɛtɩ taa. Pɩ-pɔzɩ ɛntɛrnɛɛtɩ nɛ ŋ-ma tontine.'
  },
  cgd_kyc_required_error: {
    fr: "Vérifiez votre identité (Profil > Vérification d'identité) avant de créer un cercle.",
    en: 'Verify your identity (Profile > Identity Verification) before creating a circle.',
    ee: 'Kpɔ wò ŋkɔɖeɖe dzi (Ŋkɔmeɖeɖe > Ŋkɔɖeɖe Kpɔkpɔ) hafi nàwɔ habɔbɔ.',
    kbp: 'Ña ño-hɩɖɛ (Ma-ɖɔkɔtɔ > Hɩɖɛ ñaʋ) pʋcɔ ŋ-ma tontine.'
  },
  // Écran de blocage affiché à l'ouverture : on emmène l'utilisatrice au bon
  // endroit avec un bouton, au lieu de lui dicter un chemin de menus.
  cgd_kyc_gate_title: {
    fr: 'Une dernière étape avant de créer',
    en: 'One last step before creating',
    ee: 'Une dernière étape avant de créer',
    kbp: 'Une dernière étape avant de créer'
  },
  cgd_kyc_gate_desc: {
    fr: "Pour créer un cercle, votre identité doit être vérifiée. Cela protège l'argent de toutes les membres. Deux photos suffisent.",
    en: 'To create a circle, your identity must be verified. This protects everyone’s money. Two photos are enough.',
    ee: "Pour créer un cercle, votre identité doit être vérifiée. Cela protège l'argent de toutes les membres. Deux photos suffisent.",
    kbp: "Pour créer un cercle, votre identité doit être vérifiée. Cela protège l'argent de toutes les membres. Deux photos suffisent."
  },
  cgd_kyc_gate_cta: {
    fr: 'Vérifier mon identité',
    en: 'Verify my identity',
    ee: 'Vérifier mon identité',
    kbp: 'Vérifier mon identité'
  },
  cgd_created_success: {
    fr: 'Cercle créé avec succès !',
    en: 'Circle created successfully!',
    ee: 'Wowɔ Habɔbɔ La Nyuie!',
    kbp: 'Pama tontine camɩyɛ!'
  },
  cgd_err_name_min: {
    fr: 'Le nom du groupe doit avoir au moins 2 caractères.',
    en: 'The group name must have at least 2 characters.',
    ee: 'Habɔbɔ ƒe ŋkɔ la ele be wòaxɔ nɔŋɔlɛ 2 ya wu.',
    kbp: 'Tontine hɩɖɛ ɩ-pɔzʋʋ se ɩ-wɛɛ mbʋlʋ naalɛ ɖeke-ɖeke.'
  },
  cgd_err_description_min: {
    fr: 'La description doit avoir au moins 10 caractères.',
    en: 'The description must have at least 10 characters.',
    ee: 'Numeɖeɖe la ele be wòaxɔ nɔŋɔlɛ 10 ya wu.',
    kbp: 'Tɔm ndʋ ɩ-pɔzʋʋ se ɩ-wɛɛ mbʋlʋ hiu ɖeke-ɖeke.'
  },
  cgd_err_amount_min: {
    fr: 'Le montant minimum est de 100.',
    en: 'The minimum amount is 100.',
    ee: 'Ga home suetɔ kekeake nye 100.',
    kbp: 'Liidiye ñɩma cikpelaɣ kɛ 100.'
  },
  cgd_err_max_members_min: {
    fr: 'Il faut au moins 2 participants.',
    en: 'At least 2 participants are required.',
    ee: 'Ele be amesiwo kpɔ gome nasɔ ame 2 ya wu.',
    kbp: 'Pɩ-pɔzʋʋ se mʋyaa naalɛ ɖeke-ɖeke pɛlɛ.'
  },
  cgd_err_start_date_required: {
    fr: 'La date de début est requise.',
    en: 'The start date is required.',
    ee: 'Ŋkeke si wodze egɔme le be woatia.',
    kbp: 'Pɩ-pɔzʋʋ se pɔlɩzɩ kɩyakʋ ŋga pɩ-paɣzɩɣ yɔ.'
  },
  cgd_err_terms_required: {
    fr: 'Vous devez accepter les conditions.',
    en: 'You must accept the terms.',
    ee: 'Ele be nàlɔ̃ ɖe sewo dzi.',
    kbp: 'Pɩ-wɛɛ se ŋ-mɛnɖʋ liu se sɔsɔna.'
  },
  cgd_err_signature_required: {
    fr: 'La signature électronique est requise.',
    en: 'The electronic signature is required.',
    ee: 'Asidede komputa dzi la le be woawɔ.',
    kbp: 'Pɩ-pɔzʋʋ se kpou taa nɩɩyɛ ɩ-wɛɛ.'
  },
  cgd_err_end_date_after_start: {
    fr: 'La date de fin doit être postérieure à la date de début.',
    en: 'The end date must be after the start date.',
    ee: 'Ŋkeke si wowu enu la ele be wòava le ŋkeke si wodze egɔme la megbe.',
    kbp: 'Pɩ-wɛɛ se kɩyakʋ ŋga pɩ-tɛŋɩɣ yɔ kɩ-kɔŋ kɩyakʋ ŋga pɩ-paɣzɩɣ yɔ kɩ-wayɩ.'
  },

  // JoinGroup.tsx
  jg_invalid_invite_code: {
    fr: "Code d'invitation invalide.",
    en: 'Invalid invitation code.',
    ee: 'Amekpekpe Kod Mesɔ O.',
    kbp: 'Yaʋ kod fɛyɩ ɖeu.'
  },
  jg_fetch_group_error: {
    fr: 'Erreur lors de la récupération du groupe.',
    en: 'Error while fetching the group.',
    ee: 'Vodada dzɔ le habɔbɔ la xɔxɔ me.',
    kbp: 'Kɩdɛkɛdɩm lɩna tontine mʋʋ taa.'
  },
  jg_already_member: {
    fr: 'Vous êtes déjà membre de ce groupe.',
    en: 'You are already a member of this group.',
    ee: 'Ènye xɔ́ le habɔbɔ sia me xoxo.',
    kbp: 'N-kɛ tontine ɛnɛ ɩ-mʋyʋ kajalaɣ.'
  },
  jg_join_request_error: {
    fr: "Erreur lors de la demande d'adhésion.",
    en: 'Error while submitting the join request.',
    ee: 'Vodada dzɔ le gegeɖeameme biabia me.',
    kbp: 'Kɩdɛkɛdɩm lɩna kpɛndʋʋ pɔzʋʋ taa.'
  },
  jg_searching_circle: {
    fr: 'Recherche du cercle...',
    en: 'Looking up the circle...',
    ee: 'Ele Habɔbɔ La Dim...',
    kbp: 'Ka pɔzʋʋ tontine...'
  },
  jg_request_sent_title: {
    fr: 'Demande envoyée !',
    en: 'Request sent!',
    ee: 'Woɖo Biabia La Ɖa!',
    kbp: 'Pɔzʋʋ tɔm patɩma!'
  },
  jg_request_sent_desc_prefix: {
    fr: 'Votre demande d\'adhésion au cercle "',
    en: 'Your request to join the circle "',
    ee: 'Wò gegeɖeameme biabia na habɔbɔ "',
    kbp: 'Ño-kpɛndʋʋ pɔzʋʋ tontine "'
  },
  jg_request_sent_desc_suffix: {
    fr: '" a été transmise à l\'administrateur. Vous serez notifié dès qu\'elle sera validée.',
    en: '" has been sent to the administrator. You will be notified as soon as it is approved.',
    ee: '" la, woɖoe ɖe dziɖula gbɔ. Woana nàse esi woda asi edzi.',
    kbp: '" pɛtɩŋɩɣ ñʋʋdʋ. Pakaɣ-ŋ heyuu ye pañaɣ-kɛ yɔ.'
  },
  jg_back_to_dashboard: {
    fr: 'Retour au tableau de bord',
    en: 'Back to dashboard',
    ee: 'Trɔ Yi Nuxaxlẽdzesi Gbɔ',
    kbp: 'Pɩsɩ kɩɖɛzaɣ ñɩnɖɛ taa'
  },
  jg_invited_desc: {
    fr: 'Vous avez été invité à rejoindre une tontine digitale.',
    en: 'You have been invited to join a digital tontine.',
    ee: 'Woakpe wò be nàge ɖe tontine komputa dzi ɖoɖo aɖe me.',
    kbp: 'Payaa-ŋ se ŋ-kpɛndɩ kpou taa tontine nakʋyʋ taa.'
  },
  jg_secure_payments_desc: {
    fr: 'Paiements sécurisés automatisés via Paydunya',
    en: 'Secure automated payments via Paydunya',
    ee: 'Fexexlẽ Dedienɔnɔ Si Wɔa Nu Ðokuiwo Dzi To Paydunya Dzi',
    kbp: 'Fenaɣ ñɔɔzʋʋ kɩ-wɛɛ ɖeke-ɖeke nɛ pɩ-taa fɛyɩ kɩdɛkɛdɩm Paydunya yɔɔ'
  },
  jg_reputation_boost_desc: {
    fr: 'Votre assiduité renforce votre Score de Réputation',
    en: 'Your reliability boosts your Reputation Score',
    ee: 'Wò dzianukwareɖiɖi doa wò Ŋkɔ Nyui Xexlẽme ɖe edzi',
    kbp: 'Ño-lidaʋ hɔɔlʋʋ ño-hɩɖɛ kɩlaʋ'
  },
  jg_request_to_join_cta: {
    fr: 'Demander à rejoindre',
    en: 'Request to join',
    ee: 'Bia Be Yeage Ðe Eme',
    kbp: 'Pɔzɩ kpɛndʋʋ'
  },

  // SearchGroups.tsx
  sg_search_error: {
    fr: 'Erreur lors de la recherche de cercles.',
    en: 'Error while searching for circles.',
    ee: 'Vodada dzɔ le habɔbɔwo didi me.',
    kbp: 'Kɩdɛkɛdɩm lɩna tontinaa pɔzʋʋ taa.'
  },
  sg_page_title: {
    fr: 'Rechercher un cercle public',
    en: 'Search for a public circle',
    ee: 'Di Habɔbɔ Dutoƒo Aɖe',
    kbp: 'Pɔzɩ tontine kɩ-tɩŋa'
  },
  sg_page_subtitle: {
    fr: 'Trouvez une tontine ouverte à rejoindre parmi les cercles publics.',
    en: 'Find an open tontine to join among the public circles.',
    ee: 'Di tontine si le ʋuʋu be nàge ɖe eme le habɔbɔ dutoƒowo dome.',
    kbp: 'Pɔzɩ tontine ŋgʋ kɩ-wɛ ɖeɖe tontinaa kɩ-tɩŋa taa yɔ, nɛ ŋ-kpɛndɩ kɩ-taa.'
  },
  sg_search_placeholder: {
    fr: 'Rechercher par nom ou description...',
    en: 'Search by name or description...',
    ee: 'Di To Ŋkɔ Alo Numeɖeɖe Dzi...',
    kbp: 'Pɔzɩ nɛ hɩɖɛ yaa tɔm ndʋ...'
  },
  sg_empty_title: {
    fr: 'Aucun cercle public trouvé',
    en: 'No public circle found',
    ee: 'Womekpɔ Habɔbɔ Dutoƒo Aɖeke O',
    kbp: 'Tontine kɩ-tɩŋa naɖɩyɛ ɩ-fɛyɩ'
  },
  sg_empty_desc: {
    fr: "Il n'y a aucun cercle public correspondant à votre recherche pour le moment.",
    en: 'There is no public circle matching your search at the moment.',
    ee: 'Habɔbɔ dutoƒo aɖeke mesɔ ɖe wò didi nu fifia o.',
    kbp: 'Tontine kɩ-tɩŋa naɖɩyɛ ɩ-fɛyɩ ŋga kɩ-mʋnɩ ño-pɔzʋʋ yɔ, lɛɛlɛɛyɔ.'
  },
  sg_request_sent_label: {
    fr: 'Demande envoyée',
    en: 'Request sent',
    ee: 'Woɖo Biabia La Ɖa',
    kbp: 'Pɔzʋʋ tɔm patɩma'
  },

  // CalendarView.tsx
  cal_weekday_mon: {
    fr: 'Lun',
    en: 'Mon',
    ee: 'Dzo',
    kbp: 'Lit'
  },
  cal_weekday_tue: {
    fr: 'Mar',
    en: 'Tue',
    ee: 'Bla',
    kbp: 'Tal'
  },
  cal_weekday_wed: {
    fr: 'Mer',
    en: 'Wed',
    ee: 'Ku',
    kbp: 'Ala'
  },
  cal_weekday_thu: {
    fr: 'Jeu',
    en: 'Thu',
    ee: 'Yao',
    kbp: 'Alm'
  },
  cal_weekday_fri: {
    fr: 'Ven',
    en: 'Fri',
    ee: 'Fi',
    kbp: 'Jum'
  },
  cal_weekday_sat: {
    fr: 'Sam',
    en: 'Sat',
    ee: 'Mem',
    kbp: 'Sib'
  },
  cal_weekday_sun: {
    fr: 'Dim',
    en: 'Sun',
    ee: 'Kɔsi',
    kbp: 'Lah'
  },
  cal_page_title: {
    fr: 'Calendrier des échéances',
    en: 'Deadline calendar',
    ee: 'Ŋkeke Xexlẽme Si Ðea Vovo',
    kbp: 'Kɩyakʋ ŋga kɩ-caɣ yɔ kɩ-kalɩyʋ'
  },
  cal_page_subtitle: {
    fr: 'Vos prochains tours de distribution et cotisations.',
    en: 'Your upcoming payout turns and contributions.',
    ee: 'Wò turn siwo gbɔna kple gaxexlẽ siwo susɔ.',
    kbp: 'Ño-kɩyakɩŋ wena akɔŋ yɔ, liidiye lɩʋ nɛ liidiye haʋ.'
  },
  cal_today_short: {
    fr: 'Auj.',
    en: 'Today',
    ee: 'Egbe',
    kbp: 'Sɔnɔ'
  },
  cal_upcoming_title: {
    fr: 'Prochaines échéances',
    en: 'Upcoming deadlines',
    ee: 'Ŋkeke Siwo Gbɔna',
    kbp: 'Kɩyakɩŋ wena akɔŋ yɔ'
  },
  cal_no_upcoming: {
    fr: 'Aucune échéance à venir.',
    en: 'No upcoming deadlines.',
    ee: 'Ŋkeke aɖeke meli si gbɔna o.',
    kbp: 'Kɩyakʋ naɖɩyɛ fɛyɩ kɩ-kɔŋ yɔ.'
  },

  // AIAssistant.tsx
  ais_welcome_message: {
    fr: 'Bonjour ! Je suis votre Copilote IA Eganyé 🤖. Je peux répondre à vos questions sur vos cercles, votre solde et vos cotisations en cours.',
    en: "Hello! I'm your Eganyé AI Copilot 🤖. I can answer your questions about your circles, your balance, and your ongoing contributions.",
    ee: 'Woezɔ! Nyee nye wò Eganyé AI Kpeɖeŋutɔ 🤖. Mate ŋu aɖo nya ŋu na wò tso wò habɔbɔwo, wò gaxɔ me nɔŋ kple wò gaxexlẽ siwo le edzi yim la ŋu.',
    kbp: 'Alaafɩya! Man-tɛ Eganyé AI sɩnɩyʋ 🤖. Mapɩzɩɣ nɛ malɛ pɔzʋʋ ñɩma tontinaa, liidiye ɖɩŋ nɛ liidiye haʋ ŋgʋ kɩ-wɛɛ yɔ kɩ-yɔɔ.'
  },
  ais_no_reply_fallback: {
    fr: "Je n'ai pas pu générer de réponse, réessayez.",
    en: 'I could not generate a response, please try again.',
    ee: 'Nyemate ŋu aɖo nya ŋu o, gadze edzi.',
    kbp: 'Mɩɩsɩɩnɩ se mankpaɣ cosuu, tasɩ ɖʋʋ.'
  },
  ais_connection_error_toast: {
    fr: "Erreur de connexion à l'assistant.",
    en: 'Connection error with the assistant.',
    ee: 'Vodada le gebɔbɔ na kpeɖeŋutɔ la me.',
    kbp: 'Kɩdɛkɛdɩm kpɛndʋʋ sɩnɩyʋ yɔɔ.'
  },
  ais_network_error_message: {
    fr: 'Une erreur réseau est survenue, réessayez dans un instant.',
    en: 'A network error occurred, please try again in a moment.',
    ee: 'Vodada aɖe dzɔ le network me, gadze edzi le sekend aɖewo megbe.',
    kbp: 'Kɩdɛkɛdɩm nakʋyʋ kɔyɔ ɩntɛrnɛɛtɩ taa, tasɩ ɖʋʋ pazɩ yem.'
  },
  ais_header_title: {
    fr: 'Copilote IA Eganyé',
    en: 'Eganyé AI Copilot',
    ee: 'Eganyé AI Kpeɖeŋutɔ',
    kbp: 'Eganyé AI sɩnɩyʋ'
  },
  ais_status_operational: {
    fr: 'Opérationnel',
    en: 'Operational',
    ee: 'Ele Dɔ Wɔm',
    kbp: 'Ka-lakɩ tʋmɩyɛ'
  },
  ais_header_subtitle: {
    fr: 'Répond à partir de vos vraies données de cercles, cotisations et solde.',
    en: 'Responds using your real circle, contribution, and balance data.',
    ee: 'Ɖoa nya ŋu tso wò habɔbɔwo, gaxexlẽwo kple gaxɔ me nɔŋ ƒe nya vavãwo me.',
    kbp: 'Kɩcosuu ño-tontinaa, liidiye haʋ nɛ liidiye ɖɩŋ tɔm siŋŋ yɔɔ.'
  },
  ais_detection_health_title: {
    fr: 'Détection & Santé des Cercles',
    en: 'Detection & Circle Health',
    ee: 'Vodada Kpɔkpɔ Kple Habɔbɔwo ƒe Lãmesẽ',
    kbp: 'Naʋ nɛ tontinaa laŋhɛzɩyɛ'
  },
  ais_draft_reminder_cta: {
    fr: 'Rédiger un rappel',
    en: 'Draft a reminder',
    ee: 'Ŋlɔ Ŋkuɖodzinya',
    kbp: 'Ma ɖɔɖɔyʋ'
  },
  ais_late_contributions_count_label: {
    fr: 'cotisation(s) en retard',
    en: 'contribution(s) late',
    ee: 'gaxexlẽ(wo) si tsi',
    kbp: 'liidiye haʋ (ndʋ) kɩ-gbɛdɩɣ yɔ'
  },
  ais_and_label: {
    fr: 'et',
    en: 'and',
    ee: 'kple',
    kbp: 'nɛ'
  },
  ais_others_label: {
    fr: 'autre(s)',
    en: 'other(s)',
    ee: 'bubuwo',
    kbp: 'lɛlaa'
  },
  ais_no_late_contribution_title: {
    fr: 'Aucune cotisation en retard',
    en: 'No late contributions',
    ee: 'Gaxexlẽ si tsi aɖeke meli o',
    kbp: 'Liidiye haʋ naɖɩyɛ kɩ-gbɛdɩɣ fɛyɩ'
  },
  ais_checking_ellipsis: {
    fr: 'Vérification en cours...',
    en: 'Checking in progress...',
    ee: 'Wole Ekpɔm...',
    kbp: 'Ka pɔzʋʋ...'
  },
  ais_all_payments_uptodate: {
    fr: 'Tous vos versements sont à jour.',
    en: 'All your payments are up to date.',
    ee: 'Wò fexexlẽwo katã le nyuie.',
    kbp: 'Ño-fenaɣ ñɔɔzʋʋ tɩŋa wɛ camɩyɛ.'
  },
  ais_active_circles_count_label: {
    fr: 'cercle(s) actif(s)',
    en: 'active circle(s)',
    ee: 'habɔbɔ(wo) si le edzi yim',
    kbp: 'tontine (ndʋ) kɩ-wɛɛ ka-taa yɔ'
  },
  ais_engaged_this_cycle_suffix: {
    fr: 'FCFA engagés au total ce cycle.',
    en: 'FCFA committed in total this cycle.',
    ee: 'FCFA katã si wotsɔ de dɔ me le dzɔgbenya sia me.',
    kbp: 'FCFA tɩŋa ŋgʋ pɩ-kpɛndaa kɩyakʋ ŋgʋ kɩ-taa yɔ.'
  },
  ais_generate_report_cta: {
    fr: 'Générer le Bilan',
    en: 'Generate the Report',
    ee: 'Ɖe Akɔntabubu La Ɖe Go',
    kbp: 'Lɩzɩ kɩbɩnzʋʋ'
  },
  ais_smart_reminders_chip: {
    fr: 'Rappels Intelligents',
    en: 'Smart Reminders',
    ee: 'Ŋkuɖodzinya Nunyawo',
    kbp: 'Ɖɔɖɔyʋ kɩlaʋ'
  },
  ais_treasury_report_chip: {
    fr: 'Bilan de Caisse',
    en: 'Treasury Report',
    ee: 'Ga Nudɔdzikpɔkpɔ Akɔnta',
    kbp: 'Liidiye kpou kɩbɩnzʋʋ'
  },
  ais_next_turn_chip: {
    fr: 'Prochain Tour',
    en: 'Next Turn',
    ee: 'Turn Si Gbɔna',
    kbp: 'Ðɩɣyɛ kɩfalɩyɛ'
  },
  ais_conversation_label: {
    fr: 'Conversation Copilote IA',
    en: 'AI Copilot Conversation',
    ee: 'AI Kpeɖeŋutɔ Ƒe Dzeɖoɖo',
    kbp: 'AI sɩnɩyʋ yɔɔdʋʋ'
  },
  ais_analyzing_ellipsis: {
    fr: 'Le Copilote IA analyse les données...',
    en: 'The AI Copilot is analyzing the data...',
    ee: 'AI Kpeɖeŋutɔ la le nyawo me dzrom...',
    kbp: 'AI sɩnɩyʋ ka cɔnɩ tɔm...'
  },
  ais_input_placeholder: {
    fr: 'Posez une question sur la caisse ou les cotisations...',
    en: 'Ask a question about the treasury or contributions...',
    ee: 'Bia nya aɖe tso ga nudɔdzikpɔkpɔ alo gaxexlẽwo ŋu...',
    kbp: 'Pɔzɩ tɔm liidiye kpou yaa liidiye haʋ yɔɔ...'
  },
  ais_circle_fallback_label: {
    fr: 'Cercle',
    en: 'Circle',
    ee: 'Habɔbɔ',
    kbp: 'Tontine'
  },

  // Support.tsx
  sup_faq_1_q: {
    fr: 'Comment fonctionne une tontine sur eganyé ?',
    en: 'How does a tontine work on eganyé?',
    ee: 'Aleke tontine wɔa dɔ le eganyé dzi?',
    kbp: 'Ɛzɩma tontine lakɩ tʋmɩyɛ eganyé yɔɔ?'
  },
  sup_faq_1_a: {
    fr: 'Chaque membre cotise le même montant à intervalle régulier (quotidien, hebdomadaire, bi-hebdomadaire ou mensuel). À chaque cycle, un membre reçoit le pot total selon la méthode de distribution choisie (rotation, tirage au sort ou enchères).',
    en: 'Each member contributes the same amount at a regular interval (daily, weekly, bi-weekly, or monthly). At each cycle, one member receives the full pot according to the chosen distribution method (rotation, draw, or auction).',
    ee: 'Xɔ́ ɖe sia ɖe naxe ga home ɖeka le ɣeyiɣi ɖoɖi dzi (gbesiagbe, kwasiɖasiɖa, kwasiɖa evelia ɖe sia ɖe alo ɣletisiɣleti). Le dzɔgbenya ɖe sia ɖe me la, xɔ́ ɖeka axɔ ga home blibo la le mɔ si wotia (trɔtrɔ, dzidzenu alo asitsatsa) nu.',
    kbp: 'Mʋyʋ kʋɖʋm kʋɖʋm haɣ liidiye kʋɖʋm ɖoŋ ɖoŋ (kɩyakʋ kʋɖʋmaɣ, kɩyɛ kʋɖʋmaɣ, kɩyɛ naalɛ kʋɖʋmaɣ yaa fenaɣ kʋɖʋmaɣ). Kɩyakʋ ŋgʋ kɩ-tɩŋa kɩ-taa yɔ, mʋyʋ kʋɖʋm mʋʋ liidiye tɩŋa ɛzɩ pɔlɩzʋʋ tʋmɩyɛ yɔ (pɩ-tazɩɣ, pɔlɩzɩɣ yaa pɔyɔɔdʋʋ).'
  },
  sup_faq_2_q: {
    fr: 'Comment rejoindre une tontine ?',
    en: 'How do I join a tontine?',
    ee: 'Aleke wòle be mage ɖe tontine me?',
    kbp: 'Ɛzɩma mankpaɣ tontine taa?'
  },
  sup_faq_2_a: {
    fr: "Via un lien d'invitation, un code QR, ou un code à saisir. Votre demande doit ensuite être validée par l'administrateur du cercle avant que vous n'en deveniez membre.",
    en: "Via an invitation link, a QR code, or a code to enter. Your request must then be approved by the circle's administrator before you become a member.",
    ee: 'To kpeɖoɖo ƒe kadodo, QR code, alo code si nàŋlɔ ɖo. Le esia megbe la ele be habɔbɔ la ƒe dzikpɔla nada asi ɖe wò biabia dzi hafi nàzu xɔ́.',
    kbp: 'Kpɛlɛkʋʋ kʋdɔyɔɔ taa, QR nɔɔyɔ taa yaa nɔɔyɔ ŋgʋ ŋ-kalɩɣ yɔ. Pɩ-wɛɛ se tontine ñʋʋdʋ ɖʋ ño-pɔzʋʋ ɖoŋ nɛ pʋwayɩ ń-kɛ mʋyʋ.'
  },
  sup_faq_3_q: {
    fr: 'Que se passe-t-il si je paie en retard ?',
    en: 'What happens if I pay late?',
    ee: 'Nu ka adzɔ ne mexe ga la va megbe?',
    kbp: 'Ɛbɛ lakɩ ye mafɛlɩ liidiye kɩ-gbɛdɩɣ yɔ?'
  },
  sup_faq_3_a: {
    fr: 'Si le cercle a activé les pénalités de retard, un montant fixe ou un pourcentage par jour de retard sera automatiquement ajouté à votre prochaine cotisation, après un éventuel délai de grâce.',
    en: 'If the circle has enabled late penalties, a fixed amount or a percentage per day of delay will automatically be added to your next contribution, after any applicable grace period.',
    ee: 'Ne habɔbɔ la ʋu tohehe si wotsɔ na fexexlẽ si va megbe la ɖi la, woatsɔ ga home aɖe si ɖoɖi alo kpekpeme aɖe le ŋkeke si va megbe la dzi ade wò gaxexlẽ si gbɔna la ŋu ɖokuisi, ne dzudzɔɣeyiɣi aɖe li vɔ hã.',
    kbp: 'Ye tontine ha waɖɛ liidiye tɔlɩm ŋga kɩ-lɩnaa gbɛdɩɣ yɔɔ yɔ, liidiye naɖɩyɛ kɩsɔɔlaa yaa kɩyakʋ kʋɖʋm liidiye kɩ-kpɛlɩkɩɣ ño-liidiye haʋ ŋgʋ kɩ-kaɣ-ɩ yɔ kɩ-yɔɔ, alɩwaatʋ ndʋ tɩ-caɣ yɔ tɩ-tɛmna.'
  },
  sup_faq_4_q: {
    fr: 'Comment recharger mon portefeuille eganyé ?',
    en: 'How do I top up my eganyé wallet?',
    ee: 'Aleke matrɔ ga ade nye eganyé gaxɔ me?',
    kbp: 'Ɛzɩma mansɔnzɩ liidiye man-eganyé kpou taa?'
  },
  sup_faq_4_a: {
    fr: 'Depuis votre Profil > Portefeuille, choisissez « Recharger » et suivez les instructions de paiement (Mobile Money : Flooz, T-Money...).',
    en: 'From your Profile > Wallet, choose "Recharge" and follow the payment instructions (Mobile Money: Flooz, T-Money...).',
    ee: 'Tso wò Profil > Gaxɔ me la, tia « Trɔ De Ga » eye nàdze fexexlẽ ƒe mɔfiafiawo yome (Mobile Money : Flooz, T-Money...).',
    kbp: 'Ño-Profil > Kpou taa, lɩzɩ « Sɔnzɩ liidiye » nɛ ŋtɩŋɩɣnɩ liidiye fɛlɩyɛ wɩlɩtʋ yɔɔ (Mobile Money : Flooz, T-Money...).'
  },
  sup_faq_5_q: {
    fr: "Qu'est-ce que le Score de Réputation ?",
    en: 'What is the Reputation Score?',
    ee: 'Nu kae nye Ŋkɔ Nyui Xexlẽme?',
    kbp: 'Ɛbɛ kɛ ñɩm hɩɖɛ kɩlaʋ yɔ?'
  },
  sup_faq_5_a: {
    fr: 'Un score de 0 à 100 calculé selon votre ponctualité de paiement. Un score élevé renforce la confiance des autres membres et administrateurs des cercles que vous rejoignez.',
    en: 'A score from 0 to 100 calculated based on your payment punctuality. A high score strengthens the trust of other members and administrators of the circles you join.',
    ee: 'Xexlẽme si tso 0 va se ɖe 100 si woxlẽ le ale si nèxea wò fewo ɖe ɣeyiɣi dzi la nu. Xexlẽme kɔkɔ dea ŋusẽ ŋuɖoɖo si xɔ́ bubuwo kple dzikpɔla siwo le habɔbɔ siwo nàge ɖe eme la ɖo na wò.',
    kbp: 'Ñɩm ŋga kɩ-lɩnaa 0 nɛ pɩ-kaɖɩɣ 100 yɔ, palakɩ-kʋ ño-liidiye fɛlɩyɛ alɩwaatʋ yɔɔ. Ñɩm kɩbaŋʋ haɣ-ŋ mʋyaa lɛlaa nɛ tontinaa ñʋndɩnaa ŋgʋ ŋ-kpaɣ yɔ kɩ-taa liu.'
  },
  sup_faq_6_q: {
    fr: 'Comment activer les notifications push ?',
    en: 'How do I enable push notifications?',
    ee: 'Aleke maʋu push notification la?',
    kbp: 'Ɛzɩma mahaɣ waɖɛ push tɔm susuu yɔɔ?'
  },
  sup_faq_6_a: {
    fr: "Depuis votre Profil > Paramètres > Notifications, activez l'interrupteur « Notifications push » et autorisez les notifications lorsque votre navigateur vous le demande.",
    en: 'From your Profile > Settings > Notifications, turn on the "Push Notifications" switch and allow notifications when your browser prompts you.',
    ee: 'Tso wò Profil > Ɖoɖowo > Nyagbedeasiwo la, ʋu « Push Notification » la eye nàda mɔ na nyagbedeasiwo ne wò browser la bia wò.',
    kbp: 'Ño-Profil > Ñɔɔzʋʋ > Tɔm susuu taa, hɔ « Push tɔm susuu » nɛ ha waɖɛ tɔm susuu yɔɔ alɩwaatʋ ndʋ ño-browser pɔzɩɣ-ŋ yɔ.'
  },
  sup_faq_title: {
    fr: 'Questions fréquentes',
    en: 'Frequently Asked Questions',
    ee: 'Nya siwo Wobiaa Zi Geɖe',
    kbp: 'Tɔm ndʋ pɔpɔzʋʋ tam tam yɔ'
  },
  sup_header_subtitle: {
    fr: 'Questions fréquentes et signalement de problème.',
    en: 'Frequently asked questions and issue reporting.',
    ee: 'Nya siwo wobiaa zi geɖe kple kuxiwo gbɔgblɔ.',
    kbp: 'Tɔm ndʋ pɔpɔzʋʋ tam tam yɔ nɛ kɩdɛkɛdɩm yɔɔdʋʋ.'
  },
  sup_report_problem_title: {
    fr: 'Signaler un problème',
    en: 'Report a problem',
    ee: 'Gblɔ Kuxi Aɖe',
    kbp: 'Yɔɔdɩ kɩdɛkɛdɩm nakʋyʋ'
  },
  sup_report_problem_desc: {
    fr: 'Notre équipe examinera votre message dans les meilleurs délais.',
    en: 'Our team will review your message as soon as possible.',
    ee: 'Míaƒe ekiplɔ akpɔ wò gbedeasi la me kaba ale si wòate ŋui.',
    kbp: 'Ɖo-tʋmɩyɛ nzʋlʋmɩyɛ kaɣ cɔnʋʋ ño-tɔm lɔŋ.'
  },
  sup_send_report_cta: {
    fr: 'Envoyer le signalement',
    en: 'Send the report',
    ee: 'Ɖo Nyagbɔgblɔ La Ɖa',
    kbp: 'Tiyi kɩdɛkɛdɩm yɔɔdʋʋ'
  },
  sup_ticket_submitted_message: {
    fr: 'Merci ! Votre signalement a bien été transmis.',
    en: 'Thank you! Your report has been sent successfully.',
    ee: 'Akpe! Wò nyagbɔgblɔ la ɖo edzi nyuie.',
    kbp: 'Tɩŋa! Ño-kɩdɛkɛdɩm yɔɔdʋʋ tɛma camɩyɛ.'
  },
  sup_subject_label: {
    fr: 'Sujet',
    en: 'Subject',
    ee: 'Nyati',
    kbp: 'Tɔm kajalaɣ'
  },
  sup_subject_placeholder: {
    fr: "Ex: Problème de paiement, bug d'affichage...",
    en: 'E.g.: Payment issue, display bug...',
    ee: 'Kpɔɖeŋu: Fexexlẽ kuxi, nyaɖeɖefia me vodada...',
    kbp: 'Ɛzɩ: Liidiye fɛlɩyɛ kɩdɛkɛdɩm, kɩdɛkɛdɩm cɔnʋʋ taa...'
  },
  sup_message_placeholder: {
    fr: 'Décrivez le problème rencontré en détail...',
    en: 'Describe the issue you encountered in detail...',
    ee: 'Ɖe kuxi si nèdo goe la me kɔtɛgbe...',
    kbp: 'Yɔɔdɩ kɩdɛkɛdɩm ŋgʋ ŋ-tɔyɩ yɔ, kɩ-tɔm tɩŋa...'
  },
  sup_fill_required_toast: {
    fr: 'Veuillez remplir le sujet et le message.',
    en: 'Please fill in the subject and the message.',
    ee: 'Taflatse yɔ nyati kple gbedeasi la.',
    kbp: 'Taa yele tɔm kajalaɣ nɛ tɔm.'
  },
  sup_ticket_sent_toast: {
    fr: 'Votre signalement a été envoyé !',
    en: 'Your report has been sent!',
    ee: 'Woɖo wò nyagbɔgblɔ la ɖa!',
    kbp: 'Pɩ-tiyi ño-kɩdɛkɛdɩm yɔɔdʋʋ!'
  },
  sup_ticket_send_error_toast: {
    fr: "Erreur lors de l'envoi du signalement.",
    en: 'Error while sending the report.',
    ee: 'Vodada dzɔ esime wole nyagbɔgblɔ la ɖom.',
    kbp: 'Kɩdɛkɛdɩm kɩdɛkɛdɩm yɔɔdʋʋ tiyuu taa.'
  },

  // Marketplace.tsx
  mkt_status_contacted: {
    fr: 'Contacté',
    en: 'Contacted',
    ee: 'Woka Nu Kplii',
    kbp: 'Pɔyɔɔdɩnɩ-ɩ'
  },
  mkt_status_approved: {
    fr: 'Approuvé',
    en: 'Approved',
    ee: 'Woda Asi Ðe Edzi',
    kbp: 'Pɩ-wɛ ɖeu'
  },
  mkt_status_rejected: {
    fr: 'Refusé',
    en: 'Rejected',
    ee: 'Wogbe',
    kbp: 'Pɔlɔ'
  },
  mkt_enter_amount_toast: {
    fr: 'Veuillez indiquer le montant souhaité.',
    en: 'Please indicate the desired amount.',
    ee: 'Taflatse fia ga home si nèdi.',
    kbp: 'Taa yele liidiye ñɩma ŋga ŋ-sɔɔlaa yɔ.'
  },
  mkt_amount_exceeds_cap_prefix: {
    fr: 'Le montant demandé dépasse votre plafond indicatif de',
    en: 'The requested amount exceeds your indicative limit of',
    ee: 'Ga home si nèbia la wu wò numakpɔmakpɔ si nye',
    kbp: 'Liidiye ñɩma ŋga ŋ-pɔzɩ yɔ kɩ-kpaɖɩ ño-kɩlaʋ ŋga kɩ-kɛ'
  },
  mkt_send_request_error_toast: {
    fr: "Erreur lors de l'envoi de la demande.",
    en: 'Error while sending the request.',
    ee: 'Vodada dzɔ esime wole biabia la ɖom.',
    kbp: 'Kɩdɛkɛdɩm pɔzʋʋ tiyuu taa.'
  },
  mkt_enter_repay_amount_toast: {
    fr: 'Veuillez indiquer le montant à rembourser.',
    en: 'Please indicate the amount to repay.',
    ee: 'Taflatse fia ga home si nàxe.',
    kbp: 'Taa yele liidiye ñɩma ŋga ŋ-kaɣ kpɛɣʋʋ yɔ.'
  },
  mkt_amount_exceeds_remaining_prefix: {
    fr: 'Ce montant dépasse le solde restant dû',
    en: 'This amount exceeds the remaining balance due',
    ee: 'Ga home sia wu ga si susɔ be nàxee',
    kbp: 'Liidiye ñɩma yɔɔdʋʋ kɩ-kpaɖɩ liidiye ŋga kɩ-caɣ yɔ'
  },
  mkt_insufficient_wallet_toast: {
    fr: 'Solde du portefeuille insuffisant.',
    en: 'Insufficient wallet balance.',
    ee: 'Ga si le gaxɔ me la mede o.',
    kbp: 'Liidiye ɖɩŋ kpou taa fɛyɩ ɖeu.'
  },
  mkt_repayment_done_toast: {
    fr: 'Remboursement effectué !',
    en: 'Repayment completed!',
    ee: 'Woxe ga la vɔ!',
    kbp: 'Pɩ-kpɛɣ liidiye!'
  },
  mkt_repayment_error_toast: {
    fr: 'Erreur lors du remboursement.',
    en: 'Error during repayment.',
    ee: 'Vodada dzɔ le gaxexlẽ la me.',
    kbp: 'Kɩdɛkɛdɩm liidiye kpɛɣʋʋ taa.'
  },
  mkt_load_error_title: {
    fr: 'Impossible de charger le Marketplace',
    en: 'Unable to load the Marketplace',
    ee: 'Womate ŋu aɖe Marketplace la ɖe go o',
    kbp: 'Pɩ-fɛyɩ ɖeu se pɔlɔ Marketplace'
  },
  mkt_load_error_desc: {
    fr: 'Vérifiez votre connexion et réessayez.',
    en: 'Check your connection and try again.',
    ee: 'Kpɔ wò gebɔbɔ dzi eye nàgadze edzi.',
    kbp: 'Cɔnɩ ño-kpɛndʋʋ nɛ tasɩ ɖʋʋ.'
  },
  mkt_retry_cta: {
    fr: 'Réessayer',
    en: 'Retry',
    ee: 'Gadze Edzi',
    kbp: 'Tasɩ ɖʋʋ'
  },
  mkt_header_subtitle: {
    fr: "Profitez de votre score de réputation pour accéder à des services financiers exclusifs au Togo et en Afrique de l'Ouest.",
    en: 'Use your reputation score to access exclusive financial services in Togo and West Africa.',
    ee: 'Zã wò ŋkɔ nyui xexlẽme dze wò gadɔwɔna tɔxɛwo si li le Togo kple Afrika Ɣetoɖoƒe la me.',
    kbp: 'Tɩŋɩɣnɩ ño-ñɩm hɩɖɛ kɩlaʋ yɔɔ nɛ ŋ-kpaɣ liidiye lɩmaɣza ŋgʋ kɩ-fɛyɩ Togo nɛ Afrika ɖɩsɩ hɔɔlʋʋ taa yɔ.'
  },
  mkt_no_service_title: {
    fr: 'Aucun service disponible pour le moment',
    en: 'No service available at the moment',
    ee: 'Subɔsubɔdɔ aɖeke meli fifia o',
    kbp: 'Lɩmaɣza naɖɩyɛ fɛyɩ nabʋyʋ taa'
  },
  mkt_no_service_desc: {
    fr: 'Revenez bientôt : de nouveaux partenaires seront ajoutés régulièrement.',
    en: 'Check back soon: new partners will be added regularly.',
    ee: 'Gbugbɔ va kpuie: woatsɔ hadɔwɔla yeyewo akpe ɖe eŋu ɖaa.',
    kbp: 'Kpɛlɩkɩ lɔŋ: pakaɣ tasʋʋ liidiye taabalaa kɩfam ɖoŋ ɖoŋ.'
  },
  mkt_requirements_title: {
    fr: 'Pré-requis',
    en: 'Requirements',
    ee: 'Nudɔdzikpɔkpɔwo',
    kbp: 'Pɔzʋʋ tɔm'
  },
  mkt_credit_repaid_label: {
    fr: 'Crédit remboursé',
    en: 'Credit repaid',
    ee: 'Woxe Fenyila La',
    kbp: 'Pɩ-kpɛɣ fenaɣ ñɔɔzʋʋ'
  },
  mkt_balance_due_prefix: {
    fr: 'Solde dû :',
    en: 'Balance due:',
    ee: 'Ga si susɔ be woaxe :',
    kbp: 'Liidiye ŋga kɩ-caɣ :'
  },
  mkt_request_prefix: {
    fr: 'Demande :',
    en: 'Request:',
    ee: 'Biabia :',
    kbp: 'Pɔzʋʋ :'
  },
  mkt_borrowed_amount_label: {
    fr: 'Montant emprunté',
    en: 'Borrowed amount',
    ee: 'Ga Home Si Woɖo Nu',
    kbp: 'Liidiye ñɩma ŋga papɩsɩ yɔ'
  },
  mkt_already_repaid_label: {
    fr: 'Déjà remboursé',
    en: 'Already repaid',
    ee: 'Woxe Xoxo',
    kbp: 'Pɩ-kpɛɣ kɔyɔ'
  },
  mkt_remaining_balance_label: {
    fr: 'Solde restant dû',
    en: 'Remaining balance due',
    ee: 'Ga Si Susɔ Be Woaxe',
    kbp: 'Liidiye ŋga kɩ-caɣ yɔ'
  },
  mkt_amount_to_repay_label: {
    fr: 'Montant à rembourser',
    en: 'Amount to repay',
    ee: 'Ga Home Si Nàxe',
    kbp: 'Liidiye ñɩma ŋga ŋ-kaɣ kpɛɣʋʋ yɔ'
  },
  mkt_max_amount_prefix: {
    fr: 'Max',
    en: 'Max',
    ee: 'Ƒo Kɔ Wu',
    kbp: 'Pɩ-kpaɖɩ'
  },
  mkt_wallet_balance_prefix: {
    fr: 'Solde de votre portefeuille :',
    en: 'Your wallet balance:',
    ee: 'Ga si le wò gaxɔ me :',
    kbp: 'Ño-kpou taa liidiye ɖɩŋ :'
  },
  mkt_repay_multiple_times_suffix: {
    fr: 'Vous pouvez rembourser en plusieurs fois.',
    en: 'You can repay in multiple installments.',
    ee: 'Àte ŋu axe ga la zi geɖe.',
    kbp: 'N-pɩzɩɣ nɛ ŋ-kpɛɣ liidiye tam sakɩyɛ.'
  },
  mkt_processing_ellipsis: {
    fr: 'Traitement...',
    en: 'Processing...',
    ee: 'Wole Wɔwɔm...',
    kbp: 'Ka lakɩ tʋmɩyɛ...'
  },
  mkt_repay_cta: {
    fr: 'Rembourser',
    en: 'Repay',
    ee: 'Xe Ga La',
    kbp: 'Kpɛɣ liidiye'
  },
  mkt_credit_fully_repaid_message: {
    fr: 'Ce crédit a été intégralement remboursé. Bravo !',
    en: 'This credit has been fully repaid. Congratulations!',
    ee: 'Woxe fenyila sia katã vɔ. Nɔɔ dzidzɔ!',
    kbp: 'Pɔkpɛɣ fenaɣ ñɔɔzʋʋ ŋgʋ kɩ-tɩŋa. Wɛɛ leleŋ!'
  },
  mkt_request_of_prefix: {
    fr: 'Votre demande de',
    en: 'Your request for',
    ee: 'Wò biabia si nye',
    kbp: 'Ño-pɔzʋʋ ŋga kɩ-kɛ'
  },
  mkt_is_word: {
    fr: 'est',
    en: 'is',
    ee: 'nye',
    kbp: 'kɛ'
  },
  mkt_already_has_request_prefix: {
    fr: 'Vous avez déjà une demande',
    en: 'You already have a request',
    ee: 'Biabia aɖe li na wò xoxo si',
    kbp: 'N-wɛnɩ pɔzʋʋ nakʋyʋ kɔyɔ'
  },
  mkt_already_has_request_suffix: {
    fr: 'pour ce service.',
    en: 'for this service.',
    ee: 'na subɔsubɔdɔ sia.',
    kbp: 'lɩmaɣza ŋga kɩ-yɔɔ.'
  },
  mkt_requires_score_prefix: {
    fr: "Ce service nécessite un score de réputation d'au moins",
    en: 'This service requires a minimum reputation score of',
    ee: 'Subɔsubɔdɔ sia hiã ŋkɔ nyui xexlẽme si mele bu sue wu',
    kbp: 'Lɩmaɣza ŋga kɩ-pɔzʋʋ se ñɩm hɩɖɛ kɩlaʋ kɩ-taalɩ kɩ-kɛ nabʋyʋ tɛɛ'
  },
  mkt_your_score_is_suffix: {
    fr: 'Le vôtre est actuellement',
    en: 'Yours is currently',
    ee: 'Tɔwò la nye fifia',
    kbp: 'Ño-ñɩnɩ ka-kɛ ɖʋʋ alɩwaatʋ'
  },
  mkt_desired_amount_label: {
    fr: 'Montant souhaité (FCFA)',
    en: 'Desired amount (FCFA)',
    ee: 'Ga Home Si Nèdi (FCFA)',
    kbp: 'Liidiye ñɩma ŋga ŋ-sɔɔlaa yɔ (FCFA)'
  },
  mkt_up_to_prefix: {
    fr: "Jusqu'à",
    en: 'Up to',
    ee: 'Va Se Ɖe',
    kbp: 'Halɩ nɛ'
  },
  mkt_cap_info_prefix: {
    fr: 'Plafond indicatif basé sur votre épargne dans vos cercles',
    en: 'Indicative limit based on your savings in your circles',
    ee: 'Numakpɔmakpɔ si wobu ɖe wò gadzedze le wò habɔbɔwo me dzi',
    kbp: 'Kɩlaʋ ŋga kɩ-lɩnaa ño-liidiye kɩlaʋ tontinaa taa yɔ'
  },
  mkt_cap_info_suffix: {
    fr: 'Le montant final est confirmé par notre équipe.',
    en: 'The final amount is confirmed by our team.',
    ee: 'Míaƒe ekiplɔ ye ana kakaɖedzi ga home nyagbe la ŋu.',
    kbp: 'Ɖo-tʋmɩyɛ nzʋlʋmɩyɛ tɔzʋʋ liidiye ñɩma kɩ-tɛŋŋ.'
  },
  mkt_consent_disclaimer: {
    fr: 'En soumettant cette demande, vous autorisez notre partenaire à consulter votre score de réputation eganyé pour la traiter.',
    en: 'By submitting this request, you authorize our partner to review your eganyé reputation score in order to process it.',
    ee: 'Ne nètsɔ biabia sia la, èda mɔ na míaƒe hadɔwɔla be wòakpɔ wò eganyé ŋkɔ nyui xexlẽme be wòadzra ɖo.',
    kbp: 'Ye ŋ-tiyi pɔzʋʋ ŋga yɔ, ŋ-ha waɖɛ ɖo-taabalʋ se ɩ-cɔnɩ ño-eganyé ñɩm hɩɖɛ kɩlaʋ nɛ ɩ-lakɩ-kɩ tʋmɩyɛ.'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('egayne_lang');
    if (saved === 'fr' || saved === 'en' || saved === 'ee' || saved === 'kbp') {
      return saved as LanguageCode;
    }
    return 'fr';
  });

  // Sync with Firestore profile if logged in
  useEffect(() => {
    if (profile?.language) {
      const pLang = profile.language as LanguageCode;
      if (['fr', 'en', 'ee', 'kbp'].includes(pLang) && pLang !== language) {
        setLanguageState(pLang);
        localStorage.setItem('egayne_lang', pLang);
      }
    }
  }, [profile]);

  const setLanguage = async (newLang: LanguageCode) => {
    setLanguageState(newLang);
    localStorage.setItem('egayne_lang', newLang);

    if (profile?.uid) {
      try {
        const { error } = await supabase.from('profiles').update({ language: newLang }).eq('id', profile.uid);
        if (error) throw error;
      } catch (error) {
        console.error('Failed to save language preference', error);
      }
    }
  };

  const t = (key: string): string => {
    if (translations[key]) {
      return translations[key][language] || translations[key]['fr'];
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
