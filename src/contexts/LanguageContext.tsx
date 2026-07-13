import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type LanguageCode = 'fr' | 'en' | 'wo' | 'bm';

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
    wo: 'égané',
    bm: 'égané'
  },
  dashboard: {
    fr: 'Tableau de bord',
    en: 'Dashboard',
    wo: 'Tablo bi',
    bm: 'Baara kɛyoro'
  },
  profile: {
    fr: 'Mon Profil',
    en: 'My Profile',
    wo: 'Sama Jëmm',
    bm: 'Ne yɛrɛ lajo'
  },
  create_group: {
    fr: 'Créer une Tontine',
    en: 'Create a Tontine',
    wo: 'Sòkk Tontine',
    bm: 'Tɔntini kura sigi'
  },
  join_group: {
    fr: 'Rejoindre un Cercle',
    en: 'Join a Circle',
    wo: 'Mokkool Reen',
    bm: 'Don Tɔntini kɔnɔ'
  },
  admin_panel: {
    fr: 'Administration',
    en: 'Administration',
    wo: 'Saytu bi',
    bm: 'Kunbaga kɛyoro'
  },
  calendar: {
    fr: 'Calendrier',
    en: 'Calendar',
    wo: 'Calendrier bi',
    bm: 'Kalandiye'
  },
  search_circles: {
    fr: 'Rechercher un cercle',
    en: 'Search for a circle',
    wo: 'Seet reen',
    bm: 'Tɔntini nyini'
  },
  marketplace: {
    fr: 'Services Annexes',
    en: 'Ancillary Services',
    wo: 'Ndimbal yi',
    bm: 'Dɛmɛnɲɔgɔnya'
  },
  ai_assistant: {
    fr: 'Copilote IA',
    en: 'AI Copilot',
    wo: 'Xel mu rafet',
    bm: 'Hakili nyuman'
  },
  support: {
    fr: 'Support',
    en: 'Support',
    wo: 'Ndimbal',
    bm: 'Dɛmɛni'
  },
  logout: {
    fr: 'Se déconnecter',
    en: 'Sign Out',
    wo: 'Gënnu',
    bm: 'Bɔ a kɔnɔ'
  },
  
  // Dashboard & Wallet
  welcome: {
    fr: 'Bienvenue',
    en: 'Welcome',
    wo: 'Dalal jamm',
    bm: 'I ni ce'
  },
  my_wallet: {
    fr: 'Mon Portefeuille',
    en: 'My Wallet',
    wo: 'Sama Porsot',
    bm: 'Ne ka bɔrɔ'
  },
  balance: {
    fr: 'Solde',
    en: 'Balance',
    wo: 'Koppar yi',
    bm: 'Dankunu'
  },
  recharge: {
    fr: 'Recharger',
    en: 'Recharge',
    wo: 'Doli porsot',
    bm: 'Doli kɛ'
  },
  withdraw: {
    fr: 'Retirer',
    en: 'Withdraw',
    wo: 'Wàcci koppar',
    bm: 'Koppar bɔ'
  },
  reputation_score: {
    fr: 'Score de Réputation',
    en: 'Reputation Score',
    wo: 'Wóolu bi',
    bm: 'Danbe sɔrɔ'
  },
  score_formula: {
    fr: 'Formule du Score',
    en: 'Score Formula',
    wo: 'Saytu wóolu',
    bm: 'Danbe fura'
  },
  calculated_realtime: {
    fr: 'Calculé en temps réel',
    en: 'Calculated in real-time',
    wo: 'Mise à jour en direct',
    bm: 'A jate sisan na'
  },
  
  // Alerts & Notifications Center
  alerts_activities: {
    fr: "Centre d'Alertes & Activités",
    en: 'Alerts & Activities Center',
    wo: 'Yegle yi',
    bm: 'Kibaruw'
  },
  active_circles: {
    fr: 'Mes Cercles Actifs',
    en: 'My Active Circles',
    wo: 'Sama Reen yi dox',
    bm: 'Ne ka tɔntini dɔx'
  },
  all: {
    fr: 'Tous',
    en: 'All',
    wo: 'Ñépp',
    bm: 'Bɛɛ'
  },
  late_alerts: {
    fr: 'Alertes Retard',
    en: 'Late Alerts',
    wo: 'Yex cotis',
    bm: 'Koppar bilasɔ'
  },
  contributions: {
    fr: 'Versements',
    en: 'Contributions',
    wo: 'Cotis yi',
    bm: 'Sɔrɔw'
  },
  no_alert_found: {
    fr: 'Aucune alerte trouvée',
    en: 'No alerts found',
    wo: 'Benn yegle amul',
    bm: 'Kibaru si tɛ'
  },
  no_alert_desc_late: {
    fr: "Aucun retard de paiement n'est signalé sur vos cercles d'épargne actifs.",
    en: 'No late payments reported on your active savings circles.',
    wo: "Aucun retard de paiement n'est signalé sur vos cercles d'épargne actifs.",
    bm: 'Koppar bila yex si ma sɔrɔ e ka tɔntini dɔx la.'
  },
  no_alert_desc_payout: {
    fr: "Aucun encaissement ou payout n'a encore été enregistré.",
    en: 'No cash-outs or payouts have been recorded yet.',
    wo: 'Muck koppa do soti kook.',
    bm: 'Payout si ma dɔn jona.'
  },
  no_alert_desc_all: {
    fr: "Votre historique d'alertes est vierge pour le moment.",
    en: 'Your alert history is empty at the moment.',
    wo: 'Sa yegle neen la téy.',
    bm: 'E ka kibaru tariki tɛ fɔyi la sisan.'
  },
  settle_my_contribution: {
    fr: 'Régler ma cotisation',
    en: 'Settle my contribution',
    wo: 'Fajj sama cotis',
    bm: 'Ne ka cotis bɔ'
  },
  view_details: {
    fr: 'Voir le détail',
    en: 'View detail',
    wo: 'Gis dëgg',
    bm: 'A kɔnɔ fɛn filɛ'
  },
  read: {
    fr: 'Lu',
    en: 'Read',
    wo: 'Gis naa ko',
    bm: 'A kalan na'
  },
  dismiss: {
    fr: 'Supprimer',
    en: 'Dismiss',
    wo: 'Far',
    bm: 'A jɔsi'
  },

  // Onboarding & Language Selector Settings
  onboarding_title: {
    fr: 'Bienvenue sur égané',
    en: 'Welcome to égané',
    wo: 'Dalal jamm ci égané',
    bm: "I ni ce k'an bɛn égané"
  },
  onboarding_subtitle: {
    fr: 'La tontine africaine moderne sécurisée par la réputation.',
    en: 'Modern African tontine secured by reputation.',
    wo: 'Tontine bu bess bi woyofté ak wóolu.',
    bm: 'Tɔntini kura naza sɔgɔsɔgɔ tanyɛ dɔn.'
  },
  onboarding_step_lang: {
    fr: 'Étape 1 : Choisissez votre langue',
    en: 'Step 1: Choose your language',
    wo: 'Étape 1 : Tann say lakk',
    bm: 'Don fɔlɔ : E ka kan sɔgɔ'
  },
  next_step: {
    fr: 'Continuer',
    en: 'Continue',
    wo: 'Weuy',
    bm: 'Taga fɛ'
  },
  app_language: {
    fr: "Langue de l'app",
    en: 'App Language',
    wo: 'Lakku app bi',
    bm: 'Kan kura'
  },
  visual_theme: {
    fr: 'Thème Visuel',
    en: 'Visual Theme',
    wo: 'Melokaan Theme',
    bm: 'Ye-cogo Theme'
  },
  light_mode: {
    fr: 'Clair',
    en: 'Light',
    wo: 'Leer',
    bm: 'Tile'
  },
  dark_mode: {
    fr: 'Sombre',
    en: 'Dark',
    wo: 'Lëndëm',
    bm: 'Diby'
  },
  save_preferences: {
    fr: 'Enregistrer les préférences',
    en: 'Save preferences',
    wo: 'Denc say bëgg-bëgg',
    bm: 'A sigicogo denc'
  },
  profile_information: {
    fr: 'Informations du Profil',
    en: 'Profile Information',
    wo: 'Mbindu Sama Jëmm',
    bm: 'Lajo Kibaruw'
  },
  display_preferences: {
    fr: "Préférences d'Affichage",
    en: 'Display Preferences',
    wo: 'Gongolu Gissin',
    bm: 'Ye-cogo Sigi-cogo'
  },
  full_name: {
    fr: 'Nom complet',
    en: 'Full Name',
    wo: 'Turr ak Sant',
    bm: 'Tɔgɔ dafa'
  },
  edit_profile: {
    fr: 'Modifier le profil',
    en: 'Edit Profile',
    wo: 'Soppi Sama Jëmm',
    bm: 'Lajo yɛlɛma'
  },
  cancel: {
    fr: 'Annuler',
    en: 'Cancel',
    wo: 'Baayi',
    bm: 'A bila'
  },
  save: {
    fr: 'Sauvegarder',
    en: 'Save',
    wo: 'Denc',
    bm: 'A denc'
  },

  // Score Reputation Details
  reputation_tip_s: {
    fr: 'Félicitations ! Votre score exemplaire (Tier S) vous confère la priorité absolue pour être désigné premier bénéficiaire des fonds des tontines auxquelles vous postulez.',
    en: 'Congratulations! Your exemplary score (S-Tier) gives you absolute priority to be designated as the first beneficiary of funds in tontines you apply to.',
    wo: 'Mbecté ! Sa wóolu reuy na (Tier S), yay jiitu ci payouts yi.',
    bm: 'I ni ce! E ka danbe ka sɔrɔ ka bon (Tier S), i bɛn jiitu furan fɔlɔ na.'
  },
  reputation_tip_a: {
    fr: "Excellent ! Vous êtes un membre de confiance (Tier A). Pour passer au Tier S, assurez-vous d'anticiper le rechargement de votre portefeuille virtuel 24h avant chaque échéance.",
    en: 'Excellent! You are a trusted member (A-Tier). To reach S-Tier, make sure to recharge your virtual wallet 24h before each deadline.',
    wo: 'Wóolu bu baax (Tier A). Bo bëggé eg Tier S, féxél doli sa porsot 24h avant échéance.',
    bm: 'I ka tɔmɔ (Tier A). N\'i bɛ bɛgɛ don Tier S kɔnɔ, i ka bɔrɔ doli kɛ u tula laro tɛmɛn kabanni na.'
  },
  reputation_tip_b: {
    fr: "Votre réputation est correcte (Tier B) mais perfectible. Astuce : Pour éviter les oublis, effectuez des recharges régulières de votre compte via Wave ou Orange Money.",
    en: 'Your reputation is correct (B-Tier) but could be improved. Tip: To avoid forgetting, recharge regularly via Wave or Orange Money.',
    wo: 'Sa wóolu baax na mé doli koo (Tier B). Féxél doli say koppar ci Wave wala Orange Money.',
    bm: 'E ka danbe bɛn (Tier B) nka i bɛse k\'a naza. I ka doli dɔn Wave wala Orange Money fɛ.'
  },
  reputation_tip_c: {
    fr: "Attention ! Votre score est critique (Tier C) à cause de retards répétés. Pour restaurer votre réputation, alimentez immédiatement votre solde de portefeuille et réglez vos cotisations en attente.",
    en: 'Warning! Your score is critical (C-Tier) due to repeated late payments. To restore your reputation, immediately fund your wallet and settle pending contributions.',
    wo: 'Moytul ! Sa wóolu néew na (Tier C). Fajjall say cotis té doli sa porsot sisan.',
    bm: 'I kɔlɔsi! E ka danbe fɛy fɛy tɛ mɛn (Tier C). Sisan na i ka bɔrɔ doli kɛ nka cotis dɔn.'
  },

  // Dashboard (home screen)
  dashboard_greeting: {
    fr: 'Bonjour',
    en: 'Hello',
    wo: 'Salaamaalekum',
    bm: 'I ni ce'
  },
  dashboard_subtitle: {
    fr: "Heureux de vous revoir ! Voici l'aperçu de vos cercles d'épargne.",
    en: 'Glad to see you again! Here is an overview of your savings circles.',
    wo: 'Bég naa la gis! Lii mooy njumtukaay bu sa reen yi.',
    bm: 'An ka nyɔgɔn ye tugun! E ka tɔntiniw kunnafoni filɛ.'
  },
  quick_actions: {
    fr: 'Actions rapides',
    en: 'Quick Actions',
    wo: 'Jëf yu gaaw',
    bm: 'Baara teliw'
  },
  recharge_wallet_title: {
    fr: 'Recharger mon portefeuille',
    en: 'Recharge my wallet',
    wo: 'Doli sama porsot',
    bm: 'Ne ka bɔrɔ doli'
  },
  recharge_wallet_desc: {
    fr: 'Ajouter des fonds par Paydunya (Wave, Orange Money...)',
    en: 'Add funds via Paydunya (Wave, Orange Money...)',
    wo: 'Yokk koppar ci Paydunya (Wave, Orange Money...)',
    bm: 'Wari fara Paydunya (Wave, Orange Money...) fɛ'
  },
  create_new_circle: {
    fr: 'Créer un nouveau cercle',
    en: 'Create a new circle',
    wo: 'Sòkk benn reen bu bees',
    bm: 'Tɔntini kura sigi'
  },
  create_circle_desc: {
    fr: 'Lancer une tontine digitale avec vos proches',
    en: 'Start a digital tontine with your loved ones',
    wo: 'Tàmbali tontine bu digital ak sa mbokk yi',
    bm: 'Tɔntini sigi i somɔgɔw fɛ'
  },
  search_circle_desc: {
    fr: 'Trouver une tontine publique à rejoindre',
    en: 'Find a public tontine to join',
    wo: 'Gis tontine bu ubbeeku ngir bokk ci',
    bm: 'Tɔntini foroba nyini ka don a la'
  },
  excellent_reliability: {
    fr: 'Fiabilité financière excellente.',
    en: 'Excellent financial reliability.',
    wo: 'Sa kóllëre koppar baax na lool.',
    bm: 'Wari kow la danaya ka nyi kosɛbɛ.'
  },
  total_saved: {
    fr: 'Total Épargné',
    en: 'Total Saved',
    wo: 'Koppar yi ñu denc',
    bm: 'Wari maraninw'
  },
  savings_accumulated: {
    fr: "d'épargne accumulée",
    en: 'savings accumulated',
    wo: 'ci koppar yu dolliku',
    bm: 'marali fara ninnu'
  },
  active_groups: {
    fr: 'Groupes Actifs',
    en: 'Active Groups',
    wo: 'Kurél yu dox',
    bm: 'Jɛkulu baaralamaw'
  },
  circles_unit: {
    fr: 'cercles',
    en: 'circles',
    wo: 'reen',
    bm: 'tɔntiniw'
  },
  circles_joined: {
    fr: 'cercles rejoints',
    en: 'circles joined',
    wo: 'reen yu nga bokk',
    bm: 'tɔntini donninw'
  },
  no_circle_title: {
    fr: "Aucun cercle d'épargne",
    en: 'No savings circle',
    wo: 'Amul benn reen',
    bm: 'Tɔntini si tɛ yen'
  },
  no_circle_desc: {
    fr: "Vous ne faites partie d'aucun cercle d'épargne pour le moment. Créez votre propre tontine ou rejoignez un cercle existant !",
    en: 'You are not part of any savings circle yet. Create your own tontine or join an existing circle!',
    wo: 'Bokkuloo ci benn reen ba tey. Sòkkal sa bopp tontine walla bokk ci bu am!',
    bm: 'I tɛ tɔntini si la fɔlɔ. I yɛrɛ ka tɔntini sigi walla i ka don min bɛ yen!'
  },
  create_first_circle: {
    fr: 'Créer mon premier cercle',
    en: 'Create my first circle',
    wo: 'Sòkk sama reen bu njëkk',
    bm: 'Ne ka tɔntini fɔlɔ sigi'
  },
  status_active: {
    fr: 'En cours',
    en: 'Active',
    wo: 'Ci biir',
    bm: 'A bɛ senɛ na'
  },
  status_completed: {
    fr: 'Terminé',
    en: 'Completed',
    wo: 'Jeex na',
    bm: 'A banna'
  },
  contribution_label: {
    fr: 'Cotisation',
    en: 'Contribution',
    wo: 'Cotisation',
    bm: 'Sɔrɔ'
  },
  members: {
    fr: 'Membres',
    en: 'Members',
    wo: 'Way-bokk yi',
    bm: 'Tɔndenw'
  },
  participants: {
    fr: 'participants',
    en: 'participants',
    wo: 'ñi bokk',
    bm: 'tɔndenw'
  },
  cycle_progress: {
    fr: 'Progression du cycle',
    en: 'Cycle progress',
    wo: 'Doxinu cycle bi',
    bm: 'Cikili ka taabolo'
  },
  manage: {
    fr: 'Gérer',
    en: 'Manage',
    wo: 'Saytu',
    bm: 'Ladon'
  },
  my_contributions: {
    fr: 'Mes versements',
    en: 'My contributions',
    wo: 'Sama cotis yi',
    bm: 'Ne ka sɔrɔw'
  },
  details: {
    fr: 'Détails',
    en: 'Details',
    wo: 'Xibaar yi',
    bm: 'Kunnafoniw'
  },
  freq_daily: {
    fr: 'Quotidien',
    en: 'Daily',
    wo: 'Bés bu nekk',
    bm: 'Don o don'
  },
  freq_weekly: {
    fr: 'Hebdomadaire',
    en: 'Weekly',
    wo: 'Ayu-bés',
    bm: 'Dɔgɔkun o dɔgɔkun'
  },
  'freq_bi-weekly': {
    fr: 'Bi-hebdomadaire',
    en: 'Bi-weekly',
    wo: 'Ñaari yoon ci ayu-bés',
    bm: 'Dɔgɔkun fila o dɔgɔkun fila'
  },
  freq_monthly: {
    fr: 'Mensuel',
    en: 'Monthly',
    wo: 'Weer wu nekk',
    bm: 'Kalo o kalo'
  },

  // Contributions - circle accounting (Sprint 6)
  circle_accounting: {
    fr: 'Comptabilité du cercle',
    en: 'Circle accounting',
    wo: 'Kontabilite reen bi',
    bm: 'Tɔntini ka jatebɔ'
  },
  total_collected_in: {
    fr: 'Total collecté (entrées)',
    en: 'Total collected (in)',
    wo: 'Koppar yi ñu jot (dugg)',
    bm: 'Wari lajɛlen (donni)'
  },
  total_distributed_out: {
    fr: 'Total distribué (sorties)',
    en: 'Total distributed (out)',
    wo: 'Koppar yi ñu séddale (génn)',
    bm: 'Wari tilalen (bɔli)'
  },
  available_funds: {
    fr: 'Fonds disponibles',
    en: 'Available funds',
    wo: 'Koppar yu jàppandi',
    bm: 'Wari sɔrɔtaw'
  },
  export_excel: {
    fr: 'Exporter en Excel',
    en: 'Export to Excel',
    wo: 'Génne ci Excel',
    bm: 'A bɔ Excel na'
  },
  excel_generated: {
    fr: 'Export Excel généré !',
    en: 'Excel export generated!',
    wo: 'Excel bi génn na!',
    bm: 'Excel bɔra!'
  },

  // Contributions - full screen (Sprint 6)
  contributions_management: {
    fr: 'Gestion des Cotisations',
    en: 'Contributions Management',
    wo: 'Saytu Cotis yi',
    bm: 'Cotisw ladonni'
  },
  my_contributions_title: {
    fr: 'Mes Cotisations',
    en: 'My Contributions',
    wo: 'Sama Cotis yi',
    bm: 'Ne ka cotisw'
  },
  payment_history: {
    fr: 'Historique des Paiements',
    en: 'Payment History',
    wo: 'Taariixu Feyyu yi',
    bm: 'Saraw tariki'
  },
  my_payments: {
    fr: 'Mes Paiements',
    en: 'My Payments',
    wo: 'Sama Feyyu yi',
    bm: 'Ne ka saraw'
  },
  contributions_list_desc: {
    fr: 'Liste de toutes les cotisations enregistrées pour ce groupe.',
    en: 'List of all contributions recorded for this group.',
    wo: 'Limu cotis yépp yu ñu dugal ci kurél gii.',
    bm: 'Nin jɛkulu ka cotisw bɛɛ sɛbɛnnenw.'
  },
  my_contributions_desc: {
    fr: 'Historique de vos versements pour ce cercle.',
    en: 'History of your contributions for this circle.',
    wo: 'Taariixu say feyyu ci reen bii.',
    bm: 'I ka saraw tariki nin tɔntini na.'
  },
  search_member: {
    fr: 'Rechercher un membre...',
    en: 'Search a member...',
    wo: 'Seet ab way-bokk...',
    bm: 'Tɔnden dɔ nyini...'
  },
  member: {
    fr: 'Membre',
    en: 'Member',
    wo: 'Way-bokk',
    bm: 'Tɔnden'
  },
  period: {
    fr: 'Période',
    en: 'Period',
    wo: 'Jamono',
    bm: 'Waati'
  },
  amount: {
    fr: 'Montant',
    en: 'Amount',
    wo: 'Njëg',
    bm: 'Hakɛ'
  },
  penalty: {
    fr: 'Pénalité',
    en: 'Penalty',
    wo: 'Alamaan',
    bm: 'Ɲangili'
  },
  status: {
    fr: 'Statut',
    en: 'Status',
    wo: 'Naka mu mel',
    bm: 'Cogoya'
  },
  actions: {
    fr: 'Actions',
    en: 'Actions',
    wo: 'Jëf',
    bm: 'Baaraw'
  },
  date: {
    fr: 'Date',
    en: 'Date',
    wo: 'Bés',
    bm: 'Don'
  },
  penalty_status_col: {
    fr: 'Statut pénalité',
    en: 'Penalty status',
    wo: 'Naka la alamaan bi',
    bm: 'Ɲangili cogoya'
  },
  no_contribution_found: {
    fr: 'Aucune cotisation trouvée.',
    en: 'No contribution found.',
    wo: 'Amul cotis.',
    bm: 'Cotis si ma sɔrɔ.'
  },
  status_paid: {
    fr: 'Payé',
    en: 'Paid',
    wo: 'Fey na',
    bm: 'A sarala'
  },
  status_pending: {
    fr: 'En attente',
    en: 'Pending',
    wo: 'Ci xaar',
    bm: 'Makɔnɔni na'
  },
  status_late: {
    fr: 'En retard',
    en: 'Late',
    wo: 'Yeex na',
    bm: 'A tɛmɛna'
  },
  status_verifying: {
    fr: 'En vérification',
    en: 'Verifying',
    wo: 'Ci xool',
    bm: 'Sɛgɛsɛgɛli la'
  },
  status_verification_short: {
    fr: 'Vérification',
    en: 'Verification',
    wo: 'Xool',
    bm: 'Sɛgɛsɛgɛli'
  },
  due: {
    fr: 'Due',
    en: 'Due',
    wo: 'War',
    bm: 'Ka kan'
  },
  penalty_paid_short: {
    fr: '(payée)',
    en: '(paid)',
    wo: '(fey na)',
    bm: '(sarala)'
  },
  penalty_due_short: {
    fr: '(due)',
    en: '(due)',
    wo: '(war)',
    bm: '(ka kan)'
  },
  approve_payment: {
    fr: 'Approuver le paiement',
    en: 'Approve payment',
    wo: 'Nangu feyyu bi',
    bm: 'Sara sɔn'
  },
  reject_proof: {
    fr: 'Rejeter la preuve',
    en: 'Reject proof',
    wo: 'Bañ firndeel bi',
    bm: 'Dalilu ban'
  },
  ref_label: {
    fr: 'Réf:',
    en: 'Ref:',
    wo: 'Réf:',
    bm: 'Ref:'
  },
  circle_members: {
    fr: 'Membres du Cercle',
    en: 'Circle Members',
    wo: 'Way-bokki Reen bi',
    bm: 'Tɔntini tɔndenw'
  },
  init_contribution_desc: {
    fr: 'Initialiser une nouvelle cotisation pour un membre.',
    en: 'Initialize a new contribution for a member.',
    wo: 'Tàmbali benn cotis bu bees ci ab way-bokk.',
    bm: 'Cotis kura daminɛ tɔnden dɔ ye.'
  },
  score_label: {
    fr: 'Score:',
    en: 'Score:',
    wo: 'Wóolu:',
    bm: 'Danbe:'
  },
  call_contribution: {
    fr: 'Appel',
    en: 'Call',
    wo: 'Woo',
    bm: 'Weele'
  },
  pay: {
    fr: 'Payer',
    en: 'Pay',
    wo: 'Fey',
    bm: 'Sara'
  },
  contribution_call_created_for: {
    fr: 'Demande de cotisation créée pour',
    en: 'Contribution request created for',
    wo: 'Ñu sos cotis ci',
    bm: 'Cotis daminɛna'
  },
  payment_registered_for: {
    fr: 'Paiement enregistré pour',
    en: 'Payment registered for',
    wo: 'Ñu dugal feyyu ci',
    bm: 'Sara sɛbɛnna'
  },
  proof_submitted: {
    fr: 'Preuve de paiement soumise ! En attente de validation.',
    en: 'Payment proof submitted! Awaiting validation.',
    wo: 'Firndeel feyyu yónnee na! Ci xaar validation.',
    bm: 'Sara dalilu cira! A makɔnɔ ka sɔn.'
  },
  error_submitting: {
    fr: 'Erreur lors de la soumission.',
    en: 'Error while submitting.',
    wo: 'Am na njumte ci yónnee bi.',
    bm: 'Filɛli kɛra cili la.'
  },
  error_creating: {
    fr: 'Erreur lors de la création.',
    en: 'Error while creating.',
    wo: 'Am na njumte ci sos bi.',
    bm: 'Filɛli kɛra dilanni na.'
  },
  error_registering_payment: {
    fr: "Erreur lors de l'enregistrement du paiement.",
    en: 'Error while registering the payment.',
    wo: 'Am na njumte ci dugal feyyu bi.',
    bm: 'Filɛli kɛra sara sɛbɛnni na.'
  },
  declare: {
    fr: 'Déclarer',
    en: 'Declare',
    wo: 'Yégle',
    bm: 'Fɔ'
  },
  declare_payment: {
    fr: 'Déclarer un paiement',
    en: 'Declare a payment',
    wo: 'Yégle ab feyyu',
    bm: 'Sara dɔ fɔ'
  },
  declare_payment_desc: {
    fr: "Saisissez la référence du transfert (Mobile Money, Virement, etc.) pour que l'administrateur puisse valider votre cotisation.",
    en: 'Enter the transfer reference (Mobile Money, bank transfer, etc.) so the administrator can validate your contribution.',
    wo: 'Bindal référence transfert bi (Mobile Money, Virement, aji...) ngir admin bi mana validé sa cotis.',
    bm: 'Transfert ka ref sɛbɛn (Mobile Money, Virement, ...) walasa admin ka se ka i ka cotis sɔn.'
  },
  transaction_reference: {
    fr: 'Référence de transaction',
    en: 'Transaction reference',
    wo: 'Référence transaction bi',
    bm: 'Transaction ka ref'
  },
  enter_reference_error: {
    fr: 'Veuillez saisir une référence (ex: ID Orange Money, Wave...)',
    en: 'Please enter a reference (e.g. Orange Money ID, Wave...)',
    wo: 'Bindal ab référence (misaal: ID Orange Money, Wave...)',
    bm: 'Ref dɔ sɛbɛn (misali: Orange Money ID, Wave...)'
  },
  send_proof: {
    fr: 'Envoyer le justificatif',
    en: 'Send proof',
    wo: 'Yónnee firndeel bi',
    bm: 'Dalilu ci'
  },
  reference_placeholder: {
    fr: 'Ex: OM-20230512-8271, WAVE-...',
    en: 'e.g. OM-20230512-8271, WAVE-...',
    wo: 'Misaal: OM-20230512-8271, WAVE-...',
    bm: 'Misali: OM-20230512-8271, WAVE-...'
  },

  // Shared / previously missing
  settings: {
    fr: 'Paramètres',
    en: 'Settings',
    wo: 'Paramétar yi',
    bm: 'Labɛnw'
  },
  frequency: {
    fr: 'Fréquence',
    en: 'Frequency',
    wo: 'Yoonu jaar',
    bm: 'Senya'
  },

  // Admin dashboard (Sprint 6)
  admin_loading: {
    fr: "Chargement de l'Administration...",
    en: 'Loading Administration...',
    wo: 'Yebu Saytukaay bi...',
    bm: 'Kunbaga yɔrɔ dontɔ...'
  },
  admin_super_admin_space: {
    fr: 'Espace Super-Admin',
    en: 'Super-Admin Space',
    wo: 'Barab Super-Admin',
    bm: 'Super-Admin yɔrɔ'
  },
  admin_panel_title: {
    fr: 'Panneau de Contrôle Admin',
    en: 'Admin Control Panel',
    wo: 'Panno Kontaroolu Admin',
    bm: 'Admin kɔlɔsili yɔrɔ'
  },
  admin_panel_subtitle: {
    fr: "Supervisez les statistiques globales des cercles d'épargne (tontines), modifiez la réputation des membres et gérez l'ensemble des transactions du système.",
    en: 'Oversee global statistics of savings circles (tontines), edit member reputation, and manage all system transactions.',
    wo: "Saytul statistiques yépp yu reen yi, soppi wóolu way-bokk yi te toppatoo transactions yépp yu système bi.",
    bm: 'Tɔntiniw ka jatew bɛɛ kɔlɔsi, tɔndenw ka danbe yɛlɛma, ani sistɛmu ka transactionw bɛɛ ladon.'
  },
  admin_refresh_data: {
    fr: 'Rafraîchir les données',
    en: 'Refresh data',
    wo: 'Yeesal données yi',
    bm: 'Kunnafoniw kura'
  },
  admin_registered_members: {
    fr: 'Membres Inscrits',
    en: 'Registered Members',
    wo: 'Way-bokk yu ñu bind',
    bm: 'Tɔnden sɛbɛnnenw'
  },
  admin_users_word: {
    fr: 'Utilisateurs',
    en: 'Users',
    wo: 'Jëfandikukat',
    bm: 'Baarakɛlaw'
  },
  admin_admins_word: {
    fr: 'Admins',
    en: 'Admins',
    wo: 'Admins',
    bm: 'Adminw'
  },
  admin_tontine_circles: {
    fr: 'Cercles de Tontine',
    en: 'Tontine Circles',
    wo: 'Reeni Tontine',
    bm: 'Tɔntini kuluw'
  },
  admin_active_word: {
    fr: 'Actifs',
    en: 'Active',
    wo: 'Yu dox',
    bm: 'Baaralamaw'
  },
  admin_cumulative_volume: {
    fr: 'Volume Cumulé',
    en: 'Cumulative Volume',
    wo: 'Volume bu ñu boole',
    bm: 'Hakɛ lajɛlen'
  },
  admin_total_savings_goals: {
    fr: "Total des objectifs d'épargne",
    en: 'Total savings goals',
    wo: 'Njëkk yépp yu denc',
    bm: 'Marali laɲiniw bɛɛ'
  },
  admin_reputation_health: {
    fr: 'Santé de Réputation',
    en: 'Reputation Health',
    wo: 'Wér-gu-yaramu Wóolu',
    bm: 'Danbe kɛnɛya'
  },
  admin_member_config_console: {
    fr: 'Console de Configuration Membre',
    en: 'Member Configuration Console',
    wo: 'Console Config Way-bokk',
    bm: 'Tɔnden labɛnni console'
  },
  admin_adjustment_of: {
    fr: 'Ajustement de',
    en: 'Adjustment of',
    wo: 'Jubbantig',
    bm: 'A labɛnni:'
  },
  admin_reputation_score_range: {
    fr: 'Score de Réputation (0 - 100)',
    en: 'Reputation Score (0 - 100)',
    wo: 'Wóolu (0 - 100)',
    bm: 'Danbe (0 - 100)'
  },
  admin_virtual_wallet_balance: {
    fr: 'Solde Portefeuille Virtuel (FCFA)',
    en: 'Virtual Wallet Balance (FCFA)',
    wo: 'Solde Porsot Virtuel (FCFA)',
    bm: 'Bɔrɔ balima wari (FCFA)'
  },
  admin_applying: {
    fr: 'Application...',
    en: 'Applying...',
    wo: 'Ñu koy def...',
    bm: 'A bɛ kɛ...'
  },
  admin_apply: {
    fr: 'Appliquer',
    en: 'Apply',
    wo: 'Def ko',
    bm: 'A kɛ'
  },
  admin_toggle_role_title: {
    fr: 'Inverser le rôle (Admin <-> User)',
    en: 'Toggle role (Admin <-> User)',
    wo: 'Soppi wàll bi (Admin <-> User)',
    bm: 'Jɔyɔrɔ falen (Admin <-> User)'
  },
  admin_tab_groups: {
    fr: 'Cercles (Tontines)',
    en: 'Circles (Tontines)',
    wo: 'Reen (Tontines)',
    bm: 'Kuluw (Tɔntiniw)'
  },
  admin_tab_ledger: {
    fr: 'Ledger & Sécurité',
    en: 'Ledger & Security',
    wo: 'Ledger & Kaaraange',
    bm: 'Ledger & Lakana'
  },
  admin_member_directory_mgmt: {
    fr: "Gestion de l'Annuaire des Membres",
    en: 'Member Directory Management',
    wo: 'Saytu Ana way-bokk yi',
    bm: 'Tɔndenw tɔgɔsɛbɛn ladonni'
  },
  admin_member_directory_desc: {
    fr: "Recherchez des tontiniers, modifiez les scores d'évaluation pour tester les priorités de payout ou modifiez les privilèges administratifs.",
    en: 'Search members, edit reputation scores to test payout priorities, or change administrative privileges.',
    wo: "Seet way-bokk yi, soppi wóolu yi ngir seetlu priorités payout walla soppi wàll admin.",
    bm: "Tɔnden nyini, danbe hakɛ yɛlɛma ka payout priyorite kɔlɔsi, walla admin jɔyɔrɔ yɛlɛma.'"
  },
  admin_search_name_email: {
    fr: 'Chercher nom/email...',
    en: 'Search name/email...',
    wo: 'Seet tur/email...',
    bm: 'Tɔgɔ/email nyini...'
  },
  admin_profil_col: {
    fr: 'Profil',
    en: 'Profile',
    wo: 'Profil',
    bm: 'Lajo'
  },
  admin_role_col: {
    fr: 'Rôle',
    en: 'Role',
    wo: 'Wàll',
    bm: 'Jɔyɔrɔ'
  },
  admin_reputation_col: {
    fr: 'Réputation',
    en: 'Reputation',
    wo: 'Wóolu',
    bm: 'Danbe'
  },
  admin_wallet_col: {
    fr: 'Portefeuille',
    en: 'Wallet',
    wo: 'Porsot',
    bm: 'Bɔrɔ'
  },
  admin_no_member_found: {
    fr: 'Aucun membre correspondant trouvé.',
    en: 'No matching member found.',
    wo: 'Amul way-bokk bu ñeel.',
    bm: 'Tɔnden bɛnnen si ma sɔrɔ.'
  },
  admin_administrator: {
    fr: 'Administrateur',
    en: 'Administrator',
    wo: 'Admin',
    bm: 'Admin'
  },
  admin_adjust: {
    fr: 'Ajuster',
    en: 'Adjust',
    wo: 'Jubbanti',
    bm: 'A labɛn'
  },
  admin_demote_user: {
    fr: 'Rétrograder en utilisateur standard',
    en: 'Demote to standard user',
    wo: 'Wàññi ci jëfandikukat bu baax',
    bm: 'A lajigin baarakɛla gansan ma'
  },
  admin_promote_admin: {
    fr: 'Promouvoir en administrateur',
    en: 'Promote to administrator',
    wo: 'Yëkkati ci admin',
    bm: 'A kɔrɔta admin ma'
  },
  admin_delete_user: {
    fr: "Supprimer l'utilisateur",
    en: 'Delete user',
    wo: 'Far jëfandikukat bi',
    bm: 'Baarakɛla jɔsi'
  },
  admin_active_circles_mgmt: {
    fr: 'Gestion des Cercles Actifs',
    en: 'Active Circles Management',
    wo: 'Saytu Reen yu dox',
    bm: 'Kulu baaralamaw ladonni'
  },
  admin_active_circles_desc: {
    fr: "Visualisez les cotisations globales, l'état d'avancement des payouts des bénéficiaires et supprimez les groupes inactifs de test.",
    en: 'View global contributions, beneficiary payout progress, and delete inactive test groups.',
    wo: "Xool cotis yépp, doxinu payout benefisiyeer yi te far kurél yu test yu dee.",
    bm: 'Cotisw bɛɛ filɛ, benefisiyɛ payout taabolo, ani kulu baarabaliw jɔsi.'
  },
  admin_search_group: {
    fr: 'Chercher groupe/tontine...',
    en: 'Search group/tontine...',
    wo: 'Seet kurél/tontine...',
    bm: 'Jɛkulu/tɔntini nyini...'
  },
  admin_circle_name: {
    fr: 'Nom du Cercle',
    en: 'Circle Name',
    wo: 'Turu Reen bi',
    bm: 'Kulu tɔgɔ'
  },
  admin_installment_amount: {
    fr: 'Montant Échéance',
    en: 'Installment Amount',
    wo: 'Njëgu Échéance',
    bm: 'Waati sara hakɛ'
  },
  admin_payout_cycle: {
    fr: 'Cycle de Payout',
    en: 'Payout Cycle',
    wo: 'Cycle Payout',
    bm: 'Payout cikili'
  },
  admin_no_group_found: {
    fr: 'Aucun groupe ou cercle de tontine trouvé.',
    en: 'No group or tontine circle found.',
    wo: 'Amul kurél walla reen tontine.',
    bm: 'Jɛkulu walla tɔntini kulu si ma sɔrɔ.'
  },
  admin_invite_code: {
    fr: 'Code invitation',
    en: 'Invite code',
    wo: 'Kód woote',
    bm: 'Weele kode'
  },
  admin_none_word: {
    fr: 'aucun',
    en: 'none',
    wo: 'benn',
    bm: 'foyi'
  },
  admin_payouts_word: {
    fr: 'payouts',
    en: 'payouts',
    wo: 'payouts',
    bm: 'payouts'
  },
  admin_status_active: {
    fr: 'En Cours',
    en: 'Active',
    wo: 'Ci biir',
    bm: 'A bɛ senɛ na'
  },
  admin_status_init: {
    fr: 'Initialisation',
    en: 'Initializing',
    wo: 'Tàmbali',
    bm: 'Daminɛni'
  },
  admin_status_closed: {
    fr: 'Clôturé',
    en: 'Closed',
    wo: 'Tëj',
    bm: 'Datugulen'
  },
  admin_delete_group_perm: {
    fr: 'Supprimer définitivement le groupe',
    en: 'Permanently delete the group',
    wo: 'Far kurél bi ba fàww',
    bm: 'Jɛkulu jɔsi pewu'
  },
  admin_global_settings: {
    fr: 'Paramètres Système Globaux',
    en: 'Global System Settings',
    wo: 'Paramétar Système yépp',
    bm: 'Sistɛmu labɛnw bɛɛ'
  },
  admin_global_settings_desc: {
    fr: "Configurez les modes de simulation pour les démonstrations de l'application eganyé.",
    en: 'Configure simulation modes for eganyé app demonstrations.',
    wo: "Configuré modes simulation yi ngir démonstrations app eganyé.",
    bm: 'Simulation cogow labɛn eganyé porogaramu jirali kama.'
  },
  admin_maintenance_sim: {
    fr: 'Simulation de Maintenance',
    en: 'Maintenance Simulation',
    wo: 'Simulation Maintenance',
    bm: 'Maintenance simulation'
  },
  admin_maintenance_sim_desc: {
    fr: 'Mettre la plateforme en maintenance pour simuler les interruptions techniques.',
    en: 'Put the platform in maintenance to simulate technical interruptions.',
    wo: 'Def plateforme bi ci maintenance ngir simulé interruptions techniques.',
    bm: 'Porogaramu bila maintenance la ka tekiniki tigɛli simulé.'
  },
  admin_maintenance_mode: {
    fr: 'Mode maintenance',
    en: 'Maintenance mode',
    wo: 'Mode maintenance',
    bm: 'Maintenance cogo'
  },
  admin_enabled: {
    fr: 'Activé',
    en: 'Enabled',
    wo: 'Ubbi',
    bm: 'A dara'
  },
  admin_disabled: {
    fr: 'Désactivé',
    en: 'Disabled',
    wo: 'Tëj',
    bm: 'A fagara'
  },
  admin_mode_enabled: {
    fr: 'Mode Activé',
    en: 'Mode Enabled',
    wo: 'Mode Ubbi',
    bm: 'Cogo dara'
  },
  admin_allow_signups: {
    fr: 'Autoriser les Nouvelles Inscriptions',
    en: 'Allow New Signups',
    wo: 'May ndaje yu bees yi',
    bm: 'Sɛbɛnni kuraw sɔn'
  },
  admin_allow_signups_desc: {
    fr: "Bloquer la création de nouveaux profils sur l'onboarding si la limite de test est atteinte.",
    en: 'Block new profile creation on onboarding if the test limit is reached.',
    wo: "Téye sos profils yu bees ci onboarding su limite test bi agsi.",
    bm: 'Lajo kura dabɔli bali onboarding la ni test dan sera.'
  },
  admin_signups_word: {
    fr: 'Inscriptions',
    en: 'Signups',
    wo: 'Ndaje',
    bm: 'Sɛbɛnniw'
  },
  admin_open_fem: {
    fr: 'Ouvertes',
    en: 'Open',
    wo: 'Ubbeeku',
    bm: 'Dabɔlen'
  },
  admin_closed_fem: {
    fr: 'Fermées',
    en: 'Closed',
    wo: 'Tëju',
    bm: 'Datugulen'
  },
  admin_signups_active: {
    fr: 'Inscriptions Actives',
    en: 'Signups Active',
    wo: 'Ndaje yu ubbeeku',
    bm: 'Sɛbɛnni dalen'
  },
  admin_blocked: {
    fr: 'Bloqué',
    en: 'Blocked',
    wo: 'Téye',
    bm: 'Balilen'
  },
  admin_reputation_control: {
    fr: 'Contrôle de réputation eganyé :',
    en: 'eganyé reputation control:',
    wo: 'Kontaroolu wóolu eganyé :',
    bm: 'eganyé danbe kɔlɔsili :'
  },
  admin_recontrol_before: {
    fr: "Les cotes de confiance des tontiniers influent directement sur l'ordonnancement de leur payout. Augmentez ou réduisez les réputations dans l'onglet",
    en: 'Trust ratings of members directly affect their payout ordering. Increase or decrease reputations in the',
    wo: "Wóolu way-bokk yi dañuy jëfe ci toftalug payout bi. Yokk walla wàññi wóolu ci onglet",
    bm: 'Tɔndenw ka danbe bɛ payout labɛnni nyɛ. Danbe yɛlɛma onglet'
  },
  admin_recontrol_after: {
    fr: "pour voir instantanément le calculateur de Profile s'adapter en direct dans la console utilisateur.",
    en: 'tab to instantly see the Profile calculator adapt live in the user console.',
    wo: "ngir gis ci saa si calculateur Profile bi di jubbanti ci console jëfandikukat bi.",
    bm: 'kɔnɔ ka Profile jatebɔlan yɛlɛma yɛlɛma ye baarakɛla console la.'
  },
  admin_integrity_report: {
    fr: "Rapport d'Intégrité",
    en: 'Integrity Report',
    wo: 'Rapoor Intégrité',
    bm: 'Tilennenya rapɔɔri'
  },
  admin_ledger_reconciled: {
    fr: 'Ledger Intègre & Réconcilié',
    en: 'Ledger Sound & Reconciled',
    wo: 'Ledger bu Dëggu & Réconcilié',
    bm: 'Ledger tilennen & bɛnnen'
  },
  admin_no_discrepancy: {
    fr: 'Aucun écart détecté. Les écritures de débit/crédit correspondent exactement aux balances des portefeuilles virtuels.',
    en: 'No discrepancy detected. Debit/credit entries exactly match virtual wallet balances.',
    wo: 'Amul wute. Écritures débit/crédit yi ñeel na ak balances porsot virtuels yi.',
    bm: 'Danfaralen si ma ye. Debi/kiridi sɛbɛnniw bɛnnen bɔrɔ balimaw ma.'
  },
  admin_total_accounts: {
    fr: 'Total Comptes :',
    en: 'Total Accounts:',
    wo: 'Kont yépp :',
    bm: 'Jatew bɛɛ :'
  },
  admin_ledger_entries_label: {
    fr: 'Écritures Ledger :',
    en: 'Ledger Entries:',
    wo: 'Écritures Ledger :',
    bm: 'Ledger sɛbɛnniw :'
  },
  admin_accounting_gaps: {
    fr: 'Écarts Comptables :',
    en: 'Accounting Gaps:',
    wo: 'Wute Comptable :',
    bm: 'Jatebɔ danfaraw :'
  },
  admin_recon_status: {
    fr: 'Statut Réconciliation :',
    en: 'Reconciliation Status:',
    wo: 'Statut Réconciliation :',
    bm: 'Bɛnni cogoya :'
  },
  admin_reconciling: {
    fr: 'Réconciliation en cours...',
    en: 'Reconciliation in progress...',
    wo: 'Réconciliation ci biir...',
    bm: 'Bɛnni bɛ senɛ na...'
  },
  admin_run_reconciliation: {
    fr: 'Lancer la Réconciliation',
    en: 'Run Reconciliation',
    wo: 'Tàmbali Réconciliation',
    bm: 'Bɛnni daminɛ'
  },
  admin_reports_history: {
    fr: 'Historique des Rapports',
    en: 'Reports History',
    wo: 'Taariixu Rapoor yi',
    bm: 'Rapɔɔriw tariki'
  },
  admin_no_report: {
    fr: 'Aucun rapport disponible. Cliquez sur Lancer ci-dessus.',
    en: 'No report available. Click Run above.',
    wo: 'Amul rapoor. Bësal Tàmbali ci kaw.',
    bm: 'Rapɔɔri si tɛ. Daminɛ digi sanfɛ.'
  },
  admin_report_word: {
    fr: 'Rapport',
    en: 'Report',
    wo: 'Rapoor',
    bm: 'Rapɔɔri'
  },
  admin_success_upper: {
    fr: 'RÉUSSI',
    en: 'SUCCESS',
    wo: 'JËM',
    bm: 'A NANA'
  },
  admin_entries_checked: {
    fr: 'entrées vérifiées',
    en: 'entries checked',
    wo: 'écritures yu ñu xool',
    bm: 'sɛbɛnniw sɛgɛsɛgɛlen'
  },
  admin_gaps_short: {
    fr: 'Écarts:',
    en: 'Gaps:',
    wo: 'Wute:',
    bm: 'Danfaraw:'
  },
  admin_accounts_short: {
    fr: 'Comptes:',
    en: 'Accounts:',
    wo: 'Kont:',
    bm: 'Jatew:'
  },
  admin_ledger_double: {
    fr: 'Grand Livre (Partie Double)',
    en: 'General Ledger (Double Entry)',
    wo: 'Téereb Kont (Partie Double)',
    bm: 'Jatebɔ kunba (Fila Fila)'
  },
  admin_audit_immutable: {
    fr: "Journaux d'Audit Immuables",
    en: 'Immutable Audit Logs',
    wo: "Journaux Audit yu sax",
    bm: 'Audit sɛbɛnw banbaliw'
  },
  admin_account_col: {
    fr: 'Compte',
    en: 'Account',
    wo: 'Kont',
    bm: 'Jate'
  },
  admin_type_col: {
    fr: 'Type',
    en: 'Type',
    wo: 'Xeet',
    bm: 'Suguya'
  },
  admin_counterparty_col: {
    fr: 'Contrepartie',
    en: 'Counterparty',
    wo: 'Contrepartie',
    bm: 'Fan wɛrɛ'
  },
  admin_no_ledger_entry: {
    fr: 'Aucune écriture de ledger enregistrée. Alimentez un portefeuille ou payez une cotisation pour initier les transactions.',
    en: 'No ledger entry recorded. Fund a wallet or pay a contribution to initiate transactions.',
    wo: 'Amul écriture ledger. Doli ab porsot walla fey ab cotis ngir tàmbali transactions yi.',
    bm: 'Ledger sɛbɛnni si tɛ. Bɔrɔ doli walla cotis sara ka transactionw daminɛ.'
  },
  admin_wallet_prefix: {
    fr: 'Portefeuille:',
    en: 'Wallet:',
    wo: 'Porsot:',
    bm: 'Bɔrɔ:'
  },
  admin_circle_prefix: {
    fr: 'Cercle:',
    en: 'Circle:',
    wo: 'Reen:',
    bm: 'Kulu:'
  },
  admin_credit: {
    fr: 'CRÉDIT',
    en: 'CREDIT',
    wo: 'KREDI',
    bm: 'KIRIDI'
  },
  admin_debit: {
    fr: 'DÉBIT',
    en: 'DEBIT',
    wo: 'DEBI',
    bm: 'DEBI'
  },
  admin_no_audit_log: {
    fr: "Aucun log d'audit disponible.",
    en: 'No audit log available.',
    wo: "Amul log audit.",
    bm: 'Audit sɛbɛn si tɛ.'
  },
  admin_device: {
    fr: 'Périphérique:',
    en: 'Device:',
    wo: 'Aparëy:',
    bm: 'Minɛn:'
  },
  admin_recon_success: {
    fr: 'Réconciliation terminée avec succès ! Le système est intègre.',
    en: 'Reconciliation completed successfully! The system is sound.',
    wo: 'Réconciliation jeex na ! Système bi dëgg na.',
    bm: 'Bɛnni banna ka nyɛ ! Sistɛmu tilennen don.'
  },
  admin_recon_failed: {
    fr: 'La réconciliation a échoué.',
    en: 'Reconciliation failed.',
    wo: 'Réconciliation bi antuwul.',
    bm: 'Bɛnni ma se.'
  },
  admin_recon_error: {
    fr: 'Erreur critique de réconciliation.',
    en: 'Critical reconciliation error.',
    wo: 'Njumte bu réew ci réconciliation bi.',
    bm: 'Bɛnni filɛli juguman.'
  },
  admin_role_updated: {
    fr: 'Rôle mis à jour',
    en: 'Role updated',
    wo: 'Wàll bi soppiku na',
    bm: 'Jɔyɔrɔ yɛlɛmana'
  },
  admin_role_error: {
    fr: 'Erreur lors de la mise à jour du rôle.',
    en: 'Error while updating the role.',
    wo: 'Njumte ci soppi wàll bi.',
    bm: 'Filɛli jɔyɔrɔ yɛlɛma tuma.'
  },
  admin_user_deleted: {
    fr: 'Utilisateur supprimé',
    en: 'User deleted',
    wo: 'Jëfandikukat far na',
    bm: 'Baarakɛla jɔsira'
  },
  admin_user_delete_error: {
    fr: "Erreur lors de la suppression de l'utilisateur.",
    en: 'Error while deleting the user.',
    wo: 'Njumte ci far jëfandikukat bi.',
    bm: 'Filɛli baarakɛla jɔsi tuma.'
  },
  admin_group_deleted: {
    fr: 'Cercle supprimé',
    en: 'Circle deleted',
    wo: 'Reen bi far na',
    bm: 'Kulu jɔsira'
  },
  admin_group_delete_error: {
    fr: 'Erreur lors de la suppression du groupe.',
    en: 'Error while deleting the group.',
    wo: 'Njumte ci far kurél bi.',
    bm: 'Filɛli jɛkulu jɔsi tuma.'
  },
  admin_profile_adjusted: {
    fr: 'Profil ajusté',
    en: 'Profile adjusted',
    wo: 'Profil jubbanti na',
    bm: 'Lajo labɛnna'
  },
  admin_save_error: {
    fr: 'Échec de la sauvegarde des modifications.',
    en: 'Failed to save changes.',
    wo: 'Denc modifications yi antuwul.',
    bm: 'Yɛlɛmaw mara ma se.'
  },
  admin_recon_starting: {
    fr: 'Lancement de la réconciliation comptable en partie double...',
    en: 'Starting double-entry accounting reconciliation...',
    wo: 'Tàmbalig réconciliation comptable partie double...',
    bm: 'Jatebɔ fila fila bɛnni daminɛna...'
  },
  admin_confirm_delete_user: {
    fr: "⚠️ Êtes-vous sûr de vouloir SUPPRIMER cet utilisateur ? Cette action effacera ses accès et données.",
    en: '⚠️ Are you sure you want to DELETE this user? This action will erase their access and data.',
    wo: "⚠️ Ndax wóor na la ni danga bëgg FAR jëfandikukat bii ? Loolu dina far ay accès ak ay données.",
    bm: '⚠️ I dalen don ka nin baarakɛla JƆSI ? Nin bɛ a ka donni ni kunnafoniw jɔsi.'
  },
  admin_confirm_delete_group: {
    fr: '⚠️ Êtes-vous sûr de vouloir supprimer ce cercle de tontine ? Les contributions associées seront perdues.',
    en: '⚠️ Are you sure you want to delete this tontine circle? Associated contributions will be lost.',
    wo: '⚠️ Ndax wóor na la ni danga bëgg far reen tontine bii ? Cotis yi ci ëmb dinañu réer.',
    bm: '⚠️ I dalen don ka nin tɔntini kulu jɔsi ? A ka cotisw bɛ tunun.'
  },

  // Profile - toasts, CSV & PDF statement (Sprint 6)
  prof_no_tx_export: {
    fr: "Aucune transaction disponible pour l'export.",
    en: 'No transaction available for export.',
    wo: 'Amul transaction bu ñu man a export.',
    bm: 'Transaction si tɛ ka bɔ.'
  },
  prof_csv_exported: {
    fr: 'Historique exporté au format CSV !',
    en: 'History exported to CSV!',
    wo: 'Taariix bi génn na ci CSV!',
    bm: 'Tariki bɔra CSV la!'
  },
  prof_allow_popups: {
    fr: 'Veuillez autoriser les popups pour pouvoir exporter en PDF.',
    en: 'Please allow popups to export as PDF.',
    wo: 'Maylu popups yi ngir man a génne ci PDF.',
    bm: 'Popups sɔn walasa ka bɔ PDF la.'
  },
  prof_pdf_generated: {
    fr: "Document PDF généré ! Lancez l'impression ou enregistrez au format PDF.",
    en: 'PDF document generated! Print or save as PDF.',
    wo: 'PDF bi génn na! Móol walla denc ci PDF.',
    bm: 'PDF sɛbɛn dilanna! A gafe walla a mara PDF la.'
  },
  prof_push_disabled: {
    fr: 'Notifications push désactivées.',
    en: 'Push notifications disabled.',
    wo: 'Yégle push yi tëj nañu.',
    bm: 'Push kibaruw fagara.'
  },
  prof_push_error: {
    fr: 'Erreur lors de la mise à jour des notifications push.',
    en: 'Error while updating push notifications.',
    wo: 'Njumte ci soppi yégle push yi.',
    bm: 'Filɛli push kibaruw yɛlɛma tuma.'
  },
  prof_email_error: {
    fr: 'Erreur lors de la mise à jour des préférences email.',
    en: 'Error while updating email preferences.',
    wo: 'Njumte ci soppi bëgg-bëggu email yi.',
    bm: 'Filɛli email sigicogo yɛlɛma tuma.'
  },
  prof_min_100: {
    fr: 'Veuillez saisir un montant minimum de 100 FCFA.',
    en: 'Please enter a minimum amount of 100 FCFA.',
    wo: 'Bindal njëg bu néew 100 FCFA.',
    bm: 'Hakɛ dɔɔni sɛbɛn 100 FCFA.'
  },
  prof_valid_amount: {
    fr: 'Veuillez entrer un montant valide.',
    en: 'Please enter a valid amount.',
    wo: 'Bindal njëg bu baax.',
    bm: 'Hakɛ nyuman sɛbɛn.'
  },
  prof_min_withdraw_500: {
    fr: 'Le montant minimum de retrait est de 500 FCFA.',
    en: 'The minimum withdrawal amount is 500 FCFA.',
    wo: 'Njëg bu gën a néew ci wàcci mooy 500 FCFA.',
    bm: 'Bɔli hakɛ dɔɔni ye 500 FCFA ye.'
  },
  prof_insufficient_balance: {
    fr: 'Solde insuffisant dans votre portefeuille virtuel.',
    en: 'Insufficient balance in your virtual wallet.',
    wo: 'Sa solde doyul ci sa porsot virtuel.',
    bm: 'Wari man a tɛmɛ i ka bɔrɔ balima la.'
  },
  prof_enter_pin_4: {
    fr: 'Veuillez entrer un code PIN à 4 chiffres.',
    en: 'Please enter a 4-digit PIN.',
    wo: 'Bindal ab kód PIN bu am 4 chiffres.',
    bm: 'PIN kode sɛbɛn min bɛ jate 4 ye.'
  },
  prof_withdraw_success: {
    fr: 'Retrait effectué avec succès !',
    en: 'Withdrawal completed successfully!',
    wo: 'Wàcci bi def na ci jàmm!',
    bm: 'Bɔli kɛra ka nyɛ!'
  },
  prof_withdraw_error: {
    fr: "Une erreur est survenue lors de l'enregistrement de votre retrait.",
    en: 'An error occurred while recording your withdrawal.',
    wo: 'Am na njumte ci dugal sa wàcci.',
    bm: 'Filɛli kɛra i ka bɔli sɛbɛnni na.'
  },
  prof_redirect_paydunya: {
    fr: 'Redirection vers le portail sécurisé Paydunya...',
    en: 'Redirecting to the secure Paydunya portal...',
    wo: 'Ñuy la yóbbu ci portail Paydunya bu wóor...',
    bm: 'I bɛ taga Paydunya da lakananen na...'
  },
  prof_recharge_error: {
    fr: "Erreur lors de l'initiation de la recharge.",
    en: 'Error while initiating the top-up.',
    wo: 'Njumte ci tàmbali recharge bi.',
    bm: 'Filɛli doli daminɛni na.'
  },
  prof_valid_username: {
    fr: "Veuillez entrer un nom d'utilisateur valide.",
    en: 'Please enter a valid username.',
    wo: "Bindal ab tur bu baax.",
    bm: 'Baarakɛla tɔgɔ nyuman sɛbɛn.'
  },
  prof_pin_exactly_4: {
    fr: 'Le code PIN de retrait doit comporter exactement 4 chiffres.',
    en: 'The withdrawal PIN must be exactly 4 digits.',
    wo: 'Kód PIN wàcci bi war na am 4 chiffres rekk.',
    bm: 'Bɔli PIN ka kan ka kɛ jate 4 ye tigitigi.'
  },
  prof_pw_min_6: {
    fr: 'Le nouveau mot de passe doit contenir au moins 6 caractères.',
    en: 'The new password must contain at least 6 characters.',
    wo: 'Baatu-jàll bu bees bi war na am lu néewul 6 caractères.',
    bm: 'Tɛmɛnsira kura ka kan ka kɛ sɛbɛnni 6 ye dɔɔni.'
  },
  prof_pw_relogin: {
    fr: 'Pour changer votre mot de passe, veuillez vous déconnecter puis vous reconnecter, et réessayez.',
    en: 'To change your password, please log out and log back in, then try again.',
    wo: 'Ngir soppi sa baatu-jàll, génnal te dellu ci, te jéemaat.',
    bm: 'Ka i ka tɛmɛnsira yɛlɛma, bɔ a kɔnɔ ka don tugun, ka a lajɛ kokura.'
  },
  prof_pw_change_failed: {
    fr: "Le mot de passe n'a pas pu être modifié : ",
    en: 'The password could not be changed: ',
    wo: 'Baatu-jàll bi mënul soppiku : ',
    bm: 'Tɛmɛnsira ma se ka yɛlɛma : '
  },
  prof_settings_saved: {
    fr: 'Paramètres enregistrés avec succès !',
    en: 'Settings saved successfully!',
    wo: 'Paramétar yi denc nañu ci jàmm!',
    bm: 'Labɛnw marala ka nyɛ!'
  },
  prof_settings_error: {
    fr: 'Erreur lors de la sauvegarde des paramètres.',
    en: 'Error while saving settings.',
    wo: 'Njumte ci denc paramétar yi.',
    bm: 'Filɛli labɛnw marani na.'
  },
  prof_type: {
    fr: 'Type',
    en: 'Type',
    wo: 'Xeet',
    bm: 'Suguya'
  },
  prof_description: {
    fr: 'Description',
    en: 'Description',
    wo: 'Melokaan',
    bm: 'Bayɛlɛmali'
  },
  prof_method: {
    fr: 'Méthode',
    en: 'Method',
    wo: 'Anam',
    bm: 'Fɛɛrɛ'
  },
  prof_credit: {
    fr: 'Crédit',
    en: 'Credit',
    wo: 'Kredi',
    bm: 'Kiridi'
  },
  prof_debit: {
    fr: 'Débit',
    en: 'Debit',
    wo: 'Debi',
    bm: 'Debi'
  },
  prof_completed: {
    fr: 'Complété',
    en: 'Completed',
    wo: 'Jeex na',
    bm: 'A dafara'
  },
  prof_date_time: {
    fr: 'Date & Heure',
    en: 'Date & Time',
    wo: 'Bés & Waxtu',
    bm: 'Don & Waati'
  },
  prof_wallet_statement: {
    fr: 'Relevé de Portefeuille',
    en: 'Wallet Statement',
    wo: 'Relewe Porsot',
    bm: 'Bɔrɔ jatebɔ'
  },
  prof_account_holder: {
    fr: 'Titulaire du compte',
    en: 'Account holder',
    wo: 'Boroom kont bi',
    bm: 'Jate tigi'
  },
  prof_statement_period: {
    fr: 'Période du Relevé',
    en: 'Statement Period',
    wo: 'Jamonoy Relewe bi',
    bm: 'Jatebɔ waati'
  },
  prof_up_to: {
    fr: "Jusqu'au",
    en: 'Up to',
    wo: 'Ba',
    bm: 'Fo'
  },
  prof_total_credited: {
    fr: 'Total Crédité',
    en: 'Total Credited',
    wo: 'Kredi bépp',
    bm: 'Kiridi bɛɛ'
  },
  prof_total_debited: {
    fr: 'Total Débité',
    en: 'Total Debited',
    wo: 'Debi bépp',
    bm: 'Debi bɛɛ'
  },
  prof_current_balance: {
    fr: 'Solde Actuel',
    en: 'Current Balance',
    wo: 'Solde bi léegi',
    bm: 'Dankunu sisan'
  },
  prof_movement: {
    fr: 'Mouvement',
    en: 'Movement',
    wo: 'Yëngu',
    bm: 'Lamini'
  },
  prof_pdf_footer: {
    fr: 'Document généré électroniquement par eganyé - Votre tontine numérique fiable et solidaire.',
    en: 'Document generated electronically by eganyé - Your reliable and united digital tontine.',
    wo: 'Dokima bi ñu jëfe ci mànd ci eganyé - Sa tontine numérique bu wóor te booloo.',
    bm: 'Sɛbɛn dilanna ɛntɛrɛnɛti fɛ eganyé barika la - I ka tɔntini nafama ni jɛɲɔgɔnya.'
  },
  prof_rights_reserved: {
    fr: 'Tous droits réservés.',
    en: 'All rights reserved.',
    wo: 'Sañ-sañ yépp ñu leen denc.',
    bm: 'Josira bɛɛ mabɔra.'
  },

  // Profile - score section, header & tiers (Sprint 6)
  prof_score_calculator: {
    fr: 'Calculateur de Score de Réputation en Temps Réel',
    en: 'Real-Time Reputation Score Calculator',
    wo: 'Kalkilekaay Wóolu ci Saa si',
    bm: 'Danbe hakɛ jatelan sisan na'
  },
  prof_score_calc_desc: {
    fr: "Le score récompense la rigueur de vos dépôts pour sécuriser le cercle d'épargne.",
    en: 'The score rewards the discipline of your deposits to secure the savings circle.',
    wo: 'Wóolu bi dafay yókk sa góor-góorlu ci sa depó yi ngir aar reen bi.',
    bm: 'Danbe bɛ i ka wari donni cɛsiri sara ka tɔntini lakana.'
  },
  prof_trust_score: {
    fr: 'Score de Confiance',
    en: 'Trust Score',
    wo: 'Wóolu Kóllëre',
    bm: 'Danaya hakɛ'
  },
  prof_initial_capital: {
    fr: 'Capital initial octroyé',
    en: 'Initial capital granted',
    wo: 'Alal ju njëkk ju ñu jox',
    bm: 'Wari fɔlɔ dilen'
  },
  prof_payment_bonus: {
    fr: 'Bonus Versements',
    en: 'Payment Bonus',
    wo: 'Bonус Feyyu',
    bm: 'Sara bonisi'
  },
  prof_payments_paid_label: {
    fr: 'versement(s) payé(s)',
    en: 'payment(s) made',
    wo: 'feyyu bu ñu fey',
    bm: 'sara saralenw'
  },
  prof_late_penalties: {
    fr: 'Pénalités Retards',
    en: 'Late Penalties',
    wo: 'Alamaani Yex',
    bm: 'Kɔfɛ ɲangiliw'
  },
  prof_lates_noted: {
    fr: 'retard(s) constaté(s)',
    en: 'late(s) recorded',
    wo: 'yex bu ñu gis',
    bm: 'kɔfɛtaw kɔlɔsilen'
  },
  prof_current_score: {
    fr: 'Score Actuel',
    en: 'Current Score',
    wo: 'Wóolu bi léegi',
    bm: 'Danbe sisan'
  },
  prof_live_updated: {
    fr: 'Cliqué & mis à jour en direct',
    en: 'Clicked & updated live',
    wo: 'Bësal & yeesal ci saa si',
    bm: 'Digilen & kɛra kura sisan'
  },
  prof_improve_tip: {
    fr: "Conseil d'amélioration personnalisé",
    en: 'Personalized improvement tip',
    wo: 'Digganteb njublaŋ bu la jëm',
    bm: 'I yɛrɛ ka nyɛtaa ladili'
  },
  prof_global_reliability: {
    fr: 'Fiabilité Globale',
    en: 'Overall Reliability',
    wo: 'Kóllëre gu mat',
    bm: 'Danaya kuluyalen'
  },
  prof_instant_treasury: {
    fr: 'Performance instantanée de trésorerie',
    en: 'Instant treasury performance',
    wo: 'Doxalinu koppar ci saa si',
    bm: 'Wari mara taabolo sisan'
  },
  prof_tier_s_name: {
    fr: 'Fiabilité Exemplaire',
    en: 'Exemplary Reliability',
    wo: 'Kóllëre gu rafet',
    bm: 'Danaya ɲumanba'
  },
  prof_tier_s_desc: {
    fr: 'Excellent gestionnaire. Vos cotisations sont toujours payées à temps ou en avance.',
    en: 'Excellent manager. Your contributions are always paid on time or early.',
    wo: 'Saytukat bu baax. Sa cotis yi dañuy fey ci jamono walla ci jiitu.',
    bm: 'Ladonbaga ɲuman. I ka cotisw bɛ sara a waati la walla ka kɔn.'
  },
  prof_tier_a_name: {
    fr: 'Membre de Confiance',
    en: 'Trusted Member',
    wo: 'Way-bokk bu Kóllëre',
    bm: 'Tɔnden danamalen'
  },
  prof_tier_a_desc: {
    fr: 'Trésorier et adhérent performant. Vous honorez vos échéances avec régularité.',
    en: 'High-performing treasurer and member. You meet your deadlines regularly.',
    wo: 'Trésorier ak way-bokk bu baax. Yaa ngi fey say échéances ci yoon.',
    bm: 'Waribɔla ni tɔnden ɲuman. I bɛ i ka waatiw sara tuma bɛɛ.'
  },
  prof_tier_b_name: {
    fr: 'Profil Régulier',
    en: 'Regular Profile',
    wo: 'Profil bu Yoon',
    bm: 'Lajo bɛrɛbɛrɛ'
  },
  prof_tier_b_desc: {
    fr: 'Membre correct. Essayez de régler vos cotisations un peu plus tôt pour remonter de Tier.',
    en: 'Fair member. Try to pay your contributions a bit earlier to move up a Tier.',
    wo: 'Way-bokk bu baax. Jéemal fey sa cotis yi ci jiitu ngir yéeg Tier.',
    bm: 'Tɔnden bɛrɛ. A ɲini ka i ka cotisw sara joona walasa ka yɛlɛn Tier na.'
  },
  prof_tier_c_name: {
    fr: 'Score Fragile',
    en: 'Fragile Score',
    wo: 'Wóolu bu Woyof',
    bm: 'Danbe barajalen'
  },
  prof_tier_c_desc: {
    fr: 'Des retards répétés ont affecté votre fiabilité financière. Réglez les cotisations en suspens.',
    en: 'Repeated delays have affected your financial reliability. Settle the pending contributions.',
    wo: 'Yex yu bare jóge nañu ci sa kóllëre koppar. Fajjal say cotis yu des.',
    bm: 'Kɔfɛta caman ye i ka wari danaya tiɲɛ. Cotis tolenw sara.'
  },
  prof_unknown_circle: {
    fr: 'Cercle inconnu',
    en: 'Unknown circle',
    wo: 'Reen bu ñu xamul',
    bm: 'Kulu dɔnbali'
  },
  prof_registered_on: {
    fr: 'Inscrit le',
    en: 'Registered on',
    wo: 'Bind ci',
    bm: 'Sɛbɛnna'
  },

  // Profile - wallet cards, recharge/withdraw dialogs & stats (Sprint 6)
  prof_virtual_wallet: {
    fr: 'Portefeuille Virtuel Tontine',
    en: 'Virtual Tontine Wallet',
    wo: 'Porsot Virtuel Tontine',
    bm: 'Tɔntini bɔrɔ balima'
  },
  prof_secured_paydunya: {
    fr: 'Sécurisé par Paydunya',
    en: 'Secured by Paydunya',
    wo: 'Paydunya moo ko aar',
    bm: 'Paydunya lakananen'
  },
  prof_balance_available_desc: {
    fr: 'Solde disponible pour vos prélèvements et versements automatiques.',
    en: 'Balance available for your automatic debits and payments.',
    wo: 'Solde bu jàppandi ngir say prélèvements ak feyyu automatique.',
    bm: 'Wari sɔrɔta i ka bɔli ni sara otomatiw kama.'
  },
  prof_recharge_via_paydunya: {
    fr: 'Recharger via Paydunya',
    en: 'Recharge via Paydunya',
    wo: 'Doli ci Paydunya',
    bm: 'Doli Paydunya fɛ'
  },
  prof_recharge_dialog_desc: {
    fr: 'Alimentez votre portefeuille virtuel via Paydunya (Wave, Orange Money, MTN, Carte Bancaire) pour automatiser vos cotisations quotidiennes de tontine.',
    en: 'Fund your virtual wallet via Paydunya (Wave, Orange Money, MTN, Bank Card) to automate your daily tontine contributions.',
    wo: 'Doli sa porsot virtuel ci Paydunya (Wave, Orange Money, MTN, Kart Bànk) ngir sa cotis bés bu nekk yi doon automatique.',
    bm: 'I ka bɔrɔ balima doli Paydunya (Wave, Orange Money, MTN, Banki karti) fɛ ka i ka don o don tɔntini cotisw otomatize.'
  },
  prof_recharge_amount: {
    fr: 'Montant de la recharge (FCFA)',
    en: 'Top-up amount (FCFA)',
    wo: 'Njëgu recharge bi (FCFA)',
    bm: 'Doli hakɛ (FCFA)'
  },
  prof_ex_5000: {
    fr: 'Ex: 5000',
    en: 'e.g. 5000',
    wo: 'Misaal: 5000',
    bm: 'Misali: 5000'
  },
  prof_min_amount_100: {
    fr: 'Montant minimum : 100 FCFA',
    en: 'Minimum amount: 100 FCFA',
    wo: 'Njëg bu gën a néew : 100 FCFA',
    bm: 'Hakɛ dɔɔni : 100 FCFA'
  },
  prof_redirecting: {
    fr: 'Redirection...',
    en: 'Redirecting...',
    wo: 'Ñuy la yóbbu...',
    bm: 'Tagabɔ...'
  },
  prof_proceed_payment: {
    fr: 'Procéder au paiement',
    en: 'Proceed to payment',
    wo: 'Dem ci feyyu bi',
    bm: 'Taga sara la'
  },
  prof_withdraw_funds: {
    fr: 'Retirer mes fonds',
    en: 'Withdraw my funds',
    wo: 'Wàcci sama koppar',
    bm: 'Ne ka wari bɔ'
  },
  prof_withdraw_money: {
    fr: "Retirer de l'argent",
    en: 'Withdraw money',
    wo: 'Wàcci koppar',
    bm: 'Wari bɔ'
  },
  prof_withdraw_dialog_desc: {
    fr: 'Transférez vos gains ou fonds disponibles de votre portefeuille virtuel vers votre compte externe (Mobile Money ou Carte Bancaire).',
    en: 'Transfer your gains or available funds from your virtual wallet to your external account (Mobile Money or Bank Card).',
    wo: 'Yóbbu say ngéney walla koppar yu jàppandi ci sa porsot virtuel jëm ci sa kont bitim (Mobile Money walla Kart Bànk).',
    bm: 'I ka tɔnɔ walla wari sɔrɔtaw lasɛgin i ka bɔrɔ balima na ka taga i ka jate wɛrɛ la (Mobile Money walla Banki karti).'
  },
  prof_amount_to_withdraw: {
    fr: 'Montant à retirer (FCFA)',
    en: 'Amount to withdraw (FCFA)',
    wo: 'Njëg bu ñuy wàcci (FCFA)',
    bm: 'Wari bɔta hakɛ (FCFA)'
  },
  prof_available_balance: {
    fr: 'Solde disponible',
    en: 'Available balance',
    wo: 'Solde bu jàppandi',
    bm: 'Wari sɔrɔta'
  },
  prof_withdraw_method: {
    fr: 'Moyen de retrait',
    en: 'Withdrawal method',
    wo: 'Anamu wàcci',
    bm: 'Bɔli fɛɛrɛ'
  },
  prof_card: {
    fr: 'Carte',
    en: 'Card',
    wo: 'Kart',
    bm: 'Karti'
  },
  prof_dest_details: {
    fr: 'Numéro de téléphone / Coordonnées de destination',
    en: 'Phone number / Destination details',
    wo: 'Numéro telefon / Coordonnées destination',
    bm: 'Telefɔni nimɔrɔ / Taayɔrɔ kunnafoni'
  },
  prof_ex_phone: {
    fr: 'Ex: +221 77 123 45 67',
    en: 'e.g. +221 77 123 45 67',
    wo: 'Misaal: +221 77 123 45 67',
    bm: 'Misali: +221 77 123 45 67'
  },
  prof_2fa_pin: {
    fr: '2FA : Entrez votre code PIN de Retrait',
    en: '2FA: Enter your Withdrawal PIN',
    wo: '2FA : Bindal sa kód PIN Wàcci',
    bm: '2FA : I ka Bɔli PIN sɛbɛn'
  },
  prof_wrong_pin_blocks: {
    fr: "Un code PIN incorrect bloquera l'opération (Par défaut: 0000).",
    en: 'An incorrect PIN will block the operation (Default: 0000).',
    wo: 'Kód PIN bu jubadi dina téye jëf bi (Ci défaut: 0000).',
    bm: 'PIN jugu bɛ baara bali (A gansan: 0000).'
  },
  prof_secure_withdrawing: {
    fr: 'Retrait sécurisé...',
    en: 'Secure withdrawal...',
    wo: 'Wàcci bu wóor...',
    bm: 'Bɔli lakananen...'
  },
  prof_confirm_withdraw: {
    fr: 'Confirmer le retrait',
    en: 'Confirm withdrawal',
    wo: 'Dëggal wàcci bi',
    bm: 'Bɔli dafalen'
  },
  prof_total_capital_saved: {
    fr: 'Capital Total Épargné',
    en: 'Total Capital Saved',
    wo: 'Alal ju ñu denc jépp',
    bm: 'Wari maralen bɛɛ'
  },
  prof_all_circles_combined: {
    fr: "Tous les cercles d'épargne confondus",
    en: 'All savings circles combined',
    wo: 'Reen yépp yu booloo',
    bm: 'Tɔntiniw bɛɛ lajɛlen'
  },
  prof_punctuality_rate: {
    fr: 'Taux de Ponctualité',
    en: 'Punctuality Rate',
    wo: 'Taawu Jub ci Waxtu',
    bm: 'Waati tiimɛ hakɛ'
  },
  prof_punctuality_desc: {
    fr: 'Mesure la part de paiements faits à temps sans dépassement ou pénalités de retard.',
    en: 'Measures the share of payments made on time without overrun or late penalties.',
    wo: 'Dafay natt feyyu yu ñu def ci jamono te amul yex walla alamaan.',
    bm: 'A bɛ saraw hakɛ suman minnu kɛra a waati la kɔfɛta walla ɲangili tɛ.'
  },
  prof_active_circles_joined: {
    fr: 'Cercles Actifs Rejoints',
    en: 'Active Circles Joined',
    wo: 'Reen yu dox yu ñu bokk',
    bm: 'Kulu baaralama donninw'
  },
  prof_member_of_prefix: {
    fr: 'Vous êtes membre de',
    en: 'You are a member of',
    wo: 'Yaa ngi bokk ci',
    bm: 'I ye tɔnden ye'
  },
  prof_member_of_suffix: {
    fr: "différents cercles d'épargne tontine actifs.",
    en: 'different active tontine savings circles.',
    wo: 'reen tontine yu wuute yu dox.',
    bm: 'tɔntini kulu baaralama suguya caman na.'
  },
  prof_contributions_dashboard: {
    fr: 'Tableau de bord des cotisations',
    en: 'Contributions dashboard',
    wo: 'Tablóo cotis yi',
    bm: 'Cotisw baarayɔrɔ'
  },
  prof_paid_plural: {
    fr: 'Payés',
    en: 'Paid',
    wo: 'Yu fey',
    bm: 'Saralenw'
  },
  prof_lates: {
    fr: 'Retards',
    en: 'Late',
    wo: 'Yex yi',
    bm: 'Kɔfɛtaw'
  },
  prof_to_pay: {
    fr: 'À payer',
    en: 'To pay',
    wo: 'Ñu war a fey',
    bm: 'Ka sara'
  },

  // Profile - tabs, tables, empty states (Sprint 6)
  prof_contributions_registry: {
    fr: 'Registre des Contributions',
    en: 'Contributions Registry',
    wo: 'Registre Cotis yi',
    bm: 'Cotisw sɛbɛnni'
  },
  prof_contributions_registry_desc: {
    fr: 'Historique complet de toutes vos transactions et justificatifs de versement',
    en: 'Full history of all your transactions and payment proofs',
    wo: 'Taariixu transactions ak firndeel yi yépp',
    bm: 'I ka transactionw ni sara dalilu tariki bɛɛ'
  },
  prof_in_verification: {
    fr: 'En vérification',
    en: 'Under verification',
    wo: 'Ci xool',
    bm: 'Sɛgɛsɛgɛli la'
  },
  prof_fetching_ledger: {
    fr: 'Récupération du registre de trésorerie...',
    en: 'Fetching treasury registry...',
    wo: 'Ñuy jël registre koppar bi...',
    bm: 'Wari sɛbɛnni bɛ tafɔ...'
  },
  prof_no_contribution: {
    fr: 'Aucune contribution',
    en: 'No contribution',
    wo: 'Amul cotis',
    bm: 'Cotis si tɛ'
  },
  prof_no_contribution_desc: {
    fr: "Aucune contribution n'a été enregistrée dans cette catégorie pour le moment. Vos cotisations s'afficheront ici automatiquement.",
    en: 'No contribution has been recorded in this category yet. Your contributions will appear here automatically.',
    wo: 'Amul cotis bu ñu dugal ci catégorie bii. Say cotis dinañu feeñ fii ci seen bopp.',
    bm: 'Cotis si ma sɛbɛn nin suguya la fɔlɔ. I ka cotisw bɛ na yen yɛrɛ la.'
  },
  prof_circle_col: {
    fr: "Cercle d'épargne",
    en: 'Savings circle',
    wo: 'Reen épargne',
    bm: 'Marali kulu'
  },
  prof_call_period_col: {
    fr: "Période d'appel",
    en: 'Call period',
    wo: 'Jamonoy woote',
    bm: 'Weele waati'
  },
  prof_due_date_col: {
    fr: "Date d'échéance",
    en: 'Due date',
    wo: 'Bésu échéance',
    bm: 'Waati ban don'
  },
  prof_id_ref_col: {
    fr: 'Identifiant / Réf de transaction',
    en: 'ID / Transaction reference',
    wo: 'Idantite / Réf transaction',
    bm: 'Idantifiyan / Transaction ref'
  },
  prof_direct_validation: {
    fr: 'Validation direct',
    en: 'Direct validation',
    wo: 'Validation direct',
    bm: 'Sɔnni cɛnɲɛ'
  },
  prof_wallet_transactions: {
    fr: 'Transactions du Portefeuille',
    en: 'Wallet Transactions',
    wo: 'Transactions Porsot bi',
    bm: 'Bɔrɔ transactionw'
  },
  prof_wallet_transactions_desc: {
    fr: 'Historique complet de vos recharges Paydunya, prélèvements automatiques et payouts de tontine.',
    en: 'Full history of your Paydunya top-ups, automatic debits and tontine payouts.',
    wo: 'Taariixu say recharge Paydunya, prélèvements automatique ak payouts tontine.',
    bm: 'I ka Paydunya dolili, bɔli otomatiw ni tɔntini payoutw tariki bɛɛ.'
  },
  prof_export_csv: {
    fr: 'Export CSV',
    en: 'Export CSV',
    wo: 'Génne CSV',
    bm: 'CSV bɔ'
  },
  prof_statement_pdf: {
    fr: 'Statement PDF',
    en: 'PDF Statement',
    wo: 'Statement PDF',
    bm: 'PDF sɛbɛn'
  },
  prof_fetching_wallet: {
    fr: "Récupération de l'historique du portefeuille...",
    en: 'Fetching wallet history...',
    wo: 'Ñuy jël taariixu porsot bi...',
    bm: 'Bɔrɔ tariki bɛ tafɔ...'
  },
  prof_no_transaction: {
    fr: 'Aucune transaction',
    en: 'No transaction',
    wo: 'Amul transaction',
    bm: 'Transaction si tɛ'
  },
  prof_no_transaction_desc: {
    fr: "Votre portefeuille virtuel n'a encore enregistré aucun mouvement financier. Effectuez un rechargement pour commencer !",
    en: 'Your virtual wallet has not recorded any financial movement yet. Make a top-up to get started!',
    wo: 'Sa porsot virtuel dugalul benn yëngu-yëngu koppar. Def ab recharge ngir tàmbali!',
    bm: 'I ka bɔrɔ balima ma wari lamini si sɛbɛn fɔlɔ. Doli kɛ ka daminɛ!'
  },

  // Profile - settings tab (Sprint 6)
  prof_general_settings: {
    fr: "Paramètres généraux d'eganyé",
    en: 'eganyé general settings',
    wo: 'Paramétar yu eganyé',
    bm: 'eganyé labɛnw'
  },
  prof_general_settings_desc: {
    fr: "Personnalisez vos identifiants de connexion, la langue de l'application, et dessinez votre avatar vectoriel unique.",
    en: 'Customize your login credentials, the app language, and design your unique vector avatar.',
    wo: 'Soppi say identifiant connexion, lakku app bi, te dessiné sa avatar vectoriel bu bees.',
    bm: 'I ka don kunnafoniw, porogaramu kan, ani i ka avatar kɛnɛma yɛlɛma.'
  },
  prof_security_identity: {
    fr: 'Sécurité & Identité',
    en: 'Security & Identity',
    wo: 'Kaaraange & Idantite',
    bm: 'Lakana & Idantite'
  },
  prof_username_nickname: {
    fr: "Nom d'utilisateur / Surnom",
    en: 'Username / Nickname',
    wo: 'Tur jëfandikukat / Laa',
    bm: 'Baarakɛla tɔgɔ / Tɔgɔmasɔ'
  },
  prof_ex_name: {
    fr: 'Ex: Fatou Sy',
    en: 'e.g. Fatou Sy',
    wo: 'Misaal: Fatou Sy',
    bm: 'Misali: Fatou Sy'
  },
  prof_new_password: {
    fr: 'Nouveau mot de passe',
    en: 'New password',
    wo: 'Baatu-jàll bu bees',
    bm: 'Tɛmɛnsira kura'
  },
  prof_leave_blank: {
    fr: 'Laisser vide pour ne pas changer',
    en: 'Leave blank to keep unchanged',
    wo: 'Bàyyi ko neen bu nga bëggul soppi',
    bm: 'A bila lakolen ni i tɛ a yɛlɛma'
  },
  prof_leave_blank_pw_desc: {
    fr: 'Laissé vide si vous ne voulez pas changer votre mot de passe. Minimum 6 caractères.',
    en: 'Leave blank if you do not want to change your password. Minimum 6 characters.',
    wo: 'Bàyyi ko neen su bëggoo soppi sa baatu-jàll. 6 caractères yu néew.',
    bm: 'A to lakolen ni i tɛ i ka tɛmɛnsira yɛlɛma. Sɛbɛnni 6 dɔɔni.'
  },
  prof_withdrawal_pin: {
    fr: 'Code PIN de Retrait Sécurisé (4 chiffres)',
    en: 'Secure Withdrawal PIN (4 digits)',
    wo: 'Kód PIN Wàcci bu wóor (4 chiffres)',
    bm: 'Bɔli PIN lakananen (jate 4)'
  },
  prof_pin_placeholder_set: {
    fr: '••••',
    en: '••••',
    wo: '••••',
    bm: '••••'
  },
  prof_pin_placeholder_define: {
    fr: 'Définir un code PIN',
    en: 'Set a PIN code',
    wo: 'Sos ab kód PIN',
    bm: 'PIN kode dilan'
  },
  prof_pin_desc: {
    fr: "Sert d'authentification pour toutes vos actions de retrait. Laissé vide pour ne pas changer.",
    en: 'Used to authenticate all your withdrawal actions. Leave blank to keep unchanged.',
    wo: 'Dafay authentification ngir say jëf yu wàcci. Bàyyi ko neen bu nga bëggul soppi.',
    bm: 'A bɛ baara kɛ i ka bɔli baaraw bɛɛ authentifikasiyɔn na. A to lakolen ni i tɛ a yɛlɛma.'
  },
  prof_notifications_section: {
    fr: 'Notifications',
    en: 'Notifications',
    wo: 'Yégle yi',
    bm: 'Kibaruw'
  },
  prof_push_notif: {
    fr: 'Notifications push',
    en: 'Push notifications',
    wo: 'Yégle push',
    bm: 'Push kibaruw'
  },
  prof_push_notif_desc: {
    fr: 'Recevoir des alertes même app fermée',
    en: 'Receive alerts even when the app is closed',
    wo: 'Jot yégle yi it su app bi tëju',
    bm: 'Kibaru sɔrɔ hali porogaramu tugulen'
  },
  prof_enable_push: {
    fr: 'Activer les notifications push',
    en: 'Enable push notifications',
    wo: 'Ubbil yégle push yi',
    bm: 'Push kibaruw dabɔli'
  },
  prof_disable_push: {
    fr: 'Désactiver les notifications push',
    en: 'Disable push notifications',
    wo: 'Tëjal yégle push yi',
    bm: 'Push kibaruw fagali'
  },
  prof_email_notif: {
    fr: 'Notifications par email',
    en: 'Email notifications',
    wo: 'Yégle ci email',
    bm: 'Email kibaruw'
  },
  prof_email_notif_desc: {
    fr: 'Recevoir un résumé par email',
    en: 'Receive a summary by email',
    wo: 'Jot ab résumé ci email',
    bm: 'Kunnafoni surun sɔrɔ email na'
  },
  prof_enable_email: {
    fr: 'Activer les notifications par email',
    en: 'Enable email notifications',
    wo: 'Ubbil yégle email yi',
    bm: 'Email kibaruw dabɔli'
  },
  prof_disable_email: {
    fr: 'Désactiver les notifications par email',
    en: 'Disable email notifications',
    wo: 'Tëjal yégle email yi',
    bm: 'Email kibaruw fagali'
  },
  prof_save_settings: {
    fr: 'Enregistrer les paramètres',
    en: 'Save settings',
    wo: 'Denc paramétar yi',
    bm: 'Labɛnw mara'
  },
  prof_confirm_recharge_title: {
    fr: 'Confirmer la recharge',
    en: 'Confirm top-up',
    wo: 'Dëggal recharge bi',
    bm: 'Doli dafalen'
  },
  prof_confirm_recharge_desc: {
    fr: "Vous allez être redirigé vers l'interface de paiement sécurisée Paydunya afin d'approvisionner votre portefeuille virtuel d'un montant de :",
    en: 'You will be redirected to the secure Paydunya payment interface to fund your virtual wallet with an amount of:',
    wo: 'Dinañu la yóbbu ci interface feyyu bu wóor Paydunya ngir alimenter sa porsot virtuel ak njëg mii :',
    bm: 'I bɛna taga Paydunya sara ɲɛda lakananen na walasa ka i ka bɔrɔ balima doli nin hakɛ ye :'
  },
  status_updated: {
    fr: 'Statut mis à jour !',
    en: 'Status updated!',
    wo: 'Naka mu mel bi soppiku na!',
    bm: 'Cogoya yɛlɛmana!'
  },
  status_update_error: {
    fr: 'Erreur lors de la mise à jour.',
    en: 'Error while updating.',
    wo: 'Njumte ci soppi bi.',
    bm: 'Filɛli yɛlɛmani na.'
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('egayne_lang');
    if (saved === 'fr' || saved === 'en' || saved === 'wo' || saved === 'bm') {
      return saved as LanguageCode;
    }
    return 'fr';
  });

  // Sync with Firestore profile if logged in
  useEffect(() => {
    if (profile?.language) {
      const pLang = profile.language as LanguageCode;
      if (['fr', 'en', 'wo', 'bm'].includes(pLang) && pLang !== language) {
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
