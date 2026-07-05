import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
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
        const userRef = doc(db, 'users', profile.uid);
        await updateDoc(userRef, { language: newLang });
      } catch (error) {
        console.error('Failed to save language in firestore', error);
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
