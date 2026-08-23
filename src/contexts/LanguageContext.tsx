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
    fr: "Votre réputation est correcte (Tier B) mais perfectible. Astuce : Pour éviter les oublis, effectuez des recharges régulières de votre compte via Wave ou Orange Money.",
    en: 'Your reputation is correct (B-Tier) but could be improved. Tip: To avoid forgetting, recharge regularly via Wave or Orange Money.',
    ee: 'Wò ŋkɔ nyuie le eme (Tier B) gake wòate ŋu anyo wu. Aɖaŋuɖoɖo: Be maŋlɔ nu be o la, trɔ ga de wò akɔnta me edziedzi to Wave alo Orange Money dzi.',
    kbp: 'Ño-hɩɖɛ wɛ ɖeu (Tier B) piye pɩpɔzʋʋ se pɩ-cɛzɩɣ. Ñɩnɩ: Se n-ta pɩ-yɔɔ, sɔnzɩ liidiye tam-tam Wave yaa Orange Money yɔɔ.'
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
    fr: 'Ajouter des fonds par Paydunya (Wave, Orange Money...)',
    en: 'Add funds via Paydunya (Wave, Orange Money...)',
    ee: 'Tsɔ ga kpe ɖe eŋu to Paydunya dzi (Wave, Orange Money...)',
    kbp: 'Kpɛndɩ liidiye Paydunya yɔɔ (Wave, Orange Money...)'
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
    fr: 'Veuillez saisir une référence (ex: ID Orange Money, Wave...)',
    en: 'Please enter a reference (e.g. Orange Money ID, Wave...)',
    ee: 'Taflatse ŋlɔ dzesi aɖe (kpɔɖeŋu: Orange Money ID, Wave...)',
    kbp: 'Taa kalɩ tʋmɩyɛ nakʋyʋ (ɛzɩ: Orange Money ID, Wave...)'
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
    fr: 'Veuillez saisir un montant minimum de 100 FCFA.',
    en: 'Please enter a minimum amount of 100 FCFA.',
    ee: 'Taflatse ŋlɔ home si mede 100 FCFA.',
    kbp: 'Taa kalɩ liidiye ñɩma ŋgʋ kɩ-fɛyɩ 100 FCFA.'
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
    fr: 'Alimentez votre portefeuille virtuel via Paydunya (Wave, Orange Money, MTN, Carte Bancaire) pour automatiser vos cotisations quotidiennes de tontine.',
    en: 'Fund your virtual wallet via Paydunya (Wave, Orange Money, MTN, Bank Card) to automate your daily tontine contributions.',
    ee: 'Trɔ ga de wò komputa gaxɔ me to Paydunya dzi (Wave, Orange Money, MTN, Gakaɖi) be wò tontine gaxexlẽ gbesiagbe nàwɔ eɖokui.',
    kbp: 'Sɔnzɩ ño-kpou taa Paydunya yɔɔ (Wave, Orange Money, MTN, Banki kaatɩ) se ño-tontine liidiye haʋ kɩyakʋ kʋɖʋmaɣ ɩ-la ɩ-maɣmaɣ.'
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
