import { isRecoveryInProgress } from '@/lib/recoveryFlag';
import React, { useState, Suspense, lazy } from 'react';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { PaydunyaSimulator } from '@/components/PaydunyaSimulator';
import { Onboarding, type OnboardingIntent } from '@/components/Onboarding';
import { Landing } from '@/components/Landing';
import { useShowLanding } from '@/hooks/useShowLanding';
import { Toaster } from '@/components/ui/sonner';
import { InstallPrompt } from '@/components/ui/InstallPrompt';
import { AppLock } from '@/components/AppLock';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { EganyeIcon } from '@/components/ui/EganyeIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiUrl } from '@/lib/apiBase';
import { AdminGate } from '@/components/AdminGate';

// Lazy-loaded: kept out of the main bundle since Dashboard/Onboarding are
// the only screens needed for first paint (logged-in home, logged-out auth).
const GroupDetails = lazy(() => import('@/components/GroupDetails').then((m) => ({ default: m.GroupDetails })));
const Profile = lazy(() => import('@/components/Profile').then((m) => ({ default: m.Profile })));
const JoinGroup = lazy(() => import('@/components/JoinGroup').then((m) => ({ default: m.JoinGroup })));
const AdminDashboard = lazy(() => import('@/components/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const ContributionsManager = lazy(() => import('@/components/ContributionsManager').then((m) => ({ default: m.ContributionsManager })));
const SearchGroups = lazy(() => import('@/components/SearchGroups').then((m) => ({ default: m.SearchGroups })));
const CircleHub = lazy(() => import('@/components/CircleHub').then((m) => ({ default: m.CircleHub })));
const CalendarView = lazy(() => import('@/components/CalendarView').then((m) => ({ default: m.CalendarView })));
const Support = lazy(() => import('@/components/Support').then((m) => ({ default: m.Support })));
const Marketplace = lazy(() => import('@/components/Marketplace').then((m) => ({ default: m.Marketplace })));
const AIAssistant = lazy(() => import('@/components/AIAssistant').then((m) => ({ default: m.AIAssistant })));
const MyBank = lazy(() => import('@/components/MyBank').then((m) => ({ default: m.MyBank })));
const ActivityScreen = lazy(() => import('@/components/ActivityScreen').then((m) => ({ default: m.ActivityScreen })));
const ChooseCircleToPay = lazy(() => import('@/components/ChooseCircleToPay').then((m) => ({ default: m.ChooseCircleToPay })));
import { useAuthContext } from '@/contexts/AuthContext';
import { useGroups } from '@/hooks/useGroups';
import { useReminders } from '@/hooks/useReminders';
import { useWalletDebitor } from '@/hooks/useWalletDebitor';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { oldestSnapshotDate } from '@/lib/offlineCache';
import { logout } from '@/lib/supabase';
import { executeFinancialTransaction } from '@/lib/ledger';
import { notifyUser } from '@/lib/notify';
import { fetchPlatformSettings } from '@/lib/platformSettings';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { runBackHandlers } from '@/hooks/useBackHandler';

// Écrans qui ont leur propre barre sur téléphone : pas de seconde barre.
const VIEWS_WITH_OWN_BACK = new Set<string>(['search-groups', 'cotiser', 'contributions', 'join', 'group-details', 'support']);

// Onglets de la navigation principale : pas de retour.
const ROOT_VIEWS = new Set<string>(['dashboard', 'my-circles', 'ai-assistant', 'my-bank', 'profile']);

type View = 'dashboard' | 'profile' | 'group-details' | 'join' | 'admin' | 'contributions' | 'search-groups' | 'my-circles' | 'wallet-savings' | 'wallet-recharge' | 'wallet-withdraw' | 'calendar' | 'support' | 'marketplace' | 'ai-assistant' | 'my-bank' | 'cotiser' | 'activity';

export default function App() {
  const { t } = useLanguage();
  const { profile, loading: authLoading } = useAuthContext();
  const activeProfile = profile;

  // Light mode by default on all devices
  React.useEffect(() => {
    const defaultTheme = 'light';
    
    if (activeProfile) {
      if (!activeProfile.theme) {
        // First load, default to light mode in profile
        const updateThemeInDb = async () => {
          try {
            const { error } = await supabase.from('profiles').update({ theme: defaultTheme }).eq('id', activeProfile.uid);
            if (error) throw error;
          } catch (err) {
            console.error("Failed to sync default theme to Supabase:", err);
          }
        };
        updateThemeInDb();
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
        localStorage.setItem('eganye_theme', defaultTheme);
      } else {
        // Apply the saved theme preference if explicitly set
        const userTheme = activeProfile.theme || 'light';
        document.documentElement.classList.add(userTheme === 'dark' ? 'dark' : 'light');
        document.documentElement.classList.remove(userTheme === 'dark' ? 'light' : 'dark');
        localStorage.setItem('eganye_theme', userTheme);
      }
    } else {
      // Unauthenticated / Onboarding - use cached theme or default to 'light'
      const savedTheme = localStorage.getItem('eganye_theme') || defaultTheme;
      document.documentElement.classList.add(savedTheme === 'dark' ? 'dark' : 'light');
      document.documentElement.classList.remove(savedTheme === 'dark' ? 'light' : 'dark');
    }
  }, [activeProfile]);

  const { groups, loading: groupsLoading } = useGroups(activeProfile?.uid);
  useReminders(activeProfile, groups);
  useWalletDebitor(activeProfile, groups);
  const isOnline = useOnlineStatus();

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  React.useEffect(() => {
    fetchPlatformSettings()
      .then((s) => setMaintenanceMode(s.maintenanceMode))
      .catch(() => { /* réglages indisponibles : l'appli reste ouverte */ });
  }, []);
  
  const [view, setViewState] = useState<View>('dashboard');

  // Historique des écrans visités, pour que « Retour » ramène à l'écran
  // précédent plutôt qu'à un écran fixe. Revenir sur un écran déjà dans
  // l'historique le tronque (pas de boucle A → B → A → B) ; l'accueil le vide.
  const viewRef = React.useRef<View>('dashboard');
  const viewHistory = React.useRef<View[]>([]);
  const setView = React.useCallback((next: View) => {
    const current = viewRef.current;
    if (next === current) return;
    if (next === 'dashboard') {
      viewHistory.current = [];
    } else {
      const seen = viewHistory.current.indexOf(next);
      if (seen !== -1) viewHistory.current = viewHistory.current.slice(0, seen);
      else viewHistory.current = [...viewHistory.current, current].slice(-30);
    }
    viewRef.current = next;
    setViewState(next);
  }, []);
  const goBack = React.useCallback(() => {
    const previous = viewHistory.current.pop() ?? 'dashboard';
    viewRef.current = previous;
    setViewState(previous);
  }, []);

  // Android hardware back button (Play Store review expects it to navigate
  // within the app, not just exit): a nested screen (e.g. the admin
  // drill-down menu) gets first refusal via useBackHandler; otherwise this
  // falls back to the previous screen, then "exit the app" once already home.
  // No-op on web — the browser's own back button/history already works there.
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      if (runBackHandlers()) return;
      if (viewRef.current !== 'dashboard') goBack();
      else CapacitorApp.exitApp();
    });
    return () => { listenerPromise.then((l) => l.remove()); };
  }, [goBack]);

  // Même chose dans une PWA installée, où le retour Android passe par l'historique du
  // navigateur : une entrée de garde reste au sommet, et chaque retour revient ici. Sans
  // elle, le premier appui ferme l'application, quel que soit l'écran ouvert.
  React.useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const pushGuard = () => window.history.pushState({ eganyeGuard: true }, '', window.location.href);
    pushGuard();
    const onPopState = () => {
      // Un lien d'ancre (#video, #services…) déclenche aussi popstate : ce n'est pas un retour.
      if (window.location.hash) return;
      if (runBackHandlers()) {
        pushGuard();
      } else if (viewRef.current !== 'dashboard') {
        goBack();
        pushGuard();
      } else {
        window.history.back();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [goBack]);

  // Un nouvel écran commence en haut, sans hériter du défilement du précédent.
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);
  const [profileTab, setProfileTab] = useState<string>('contributions');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  // Service à ouvrir à l'arrivée sur Services annexes (choix fait à l'inscription).
  const [marketplaceIntent, setMarketplaceIntent] = useState<'aid' | 'credit' | undefined>(undefined);
  // Page d'accueil marketing : navigateur d'ordinateur, visiteur non connecté.
  const showLanding = useShowLanding();
  const [authEntry, setAuthEntry] = useState<'intent' | 'login' | null>(null);
  const [paydunyaSim, setPaydunyaSim] = useState<{ amount: number; netAmount: number; userId: string; userName: string; userEmail: string; phone: string; operator: string } | null>(null);

  // Handle URL parameters for joining and Paydunya recharges
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Hidden admin route detection (/admin or ?admin=true)
    const isAdminRoute = window.location.pathname.includes('/admin') || params.get('admin') === 'true';
    if (isAdminRoute && activeProfile) {
      if (activeProfile.role === 'admin') {
        setView('admin');
      }
    }

    // Join logic
    const code = params.get('join');
    if (code) {
      setJoinCode(code);
      setView('join');
    }

    // Paydunya Simulation Trigger
    const paySim = params.get('paydunya_sim');
    if (paySim === 'true') {
      // `amount` est le brut affiché à payer, `net` ce qui doit arriver sur le
      // portefeuille (la différence étant les frais du prestataire).
      const amount = parseFloat(params.get('amount') || '0');
      const netAmount = parseFloat(params.get('net') || '') || amount;
      const userId = params.get('userId') || '';
      const userName = params.get('userName') || '';
      const userEmail = params.get('userEmail') || '';
      const phone = params.get('phone') || '';
      const operator = params.get('operator') || '';
      if (amount && userId) {
        setPaydunyaSim({ amount, netAmount, userId, userName, userEmail, phone, operator });
      }
    }

    // Retour depuis Paydunya.
    //
    // Le retour de l'utilisatrice sur cette URL ne prouve RIEN : elle peut
    // avoir abandonné le paiement, ou taper l'adresse à la main. Le crédit
    // du portefeuille est donc décidé exclusivement côté serveur, par le
    // webhook du prestataire (api/paydunya-webhook). Ici on se contente
    // d'informer et de renvoyer vers le portefeuille, où le nouveau solde
    // apparaîtra dès que la confirmation sera arrivée.
    if (params.get('paydunya_success') === 'true' && activeProfile) {
      toast.success(
        "Paiement envoyé. Votre portefeuille sera crédité dès la confirmation de l'opérateur."
      );
      setProfileTab('wallet');
      setView('profile');
    } else if (params.get('paydunya_cancel') === 'true') {
      toast.error('Recharge de portefeuille annulée.');
    }

    // Raccourcis de l'icône PWA (manifest.json > shortcuts) : un appui long
    // sur l'icône d'accueil ouvre directement l'écran demandé.
    const shortcut = params.get('shortcut');
    if (shortcut) {
      if (shortcut === 'circles') setView('my-circles');
      else if (shortcut === 'bank') setView('my-bank');
      else if (shortcut === 'recharge') setView('wallet-recharge');
    }

    // Clear URL params without refreshing
    // Retour Paydunya : on garde l'adresse tant que le profil n'est pas chargé,
    // sinon le message et la redirection vers le portefeuille seraient perdus.
    const waitingForProfile = params.get('paydunya_success') === 'true' && !activeProfile;
    if (!waitingForProfile && (code || paySim || shortcut || params.get('paydunya_success') || params.get('paydunya_cancel'))) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [profile, groups]);

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  const handleSelectGroup = (id: string) => {
    setSelectedGroupId(id);
    setView('group-details');
  };

  // Saisie manuelle d'un code (onglet Cercle) — même mécanisme que le lien
  // d'invitation ?join=CODE, juste déclenché depuis l'UI plutôt que l'URL.
  const handleJoinByCode = (code: string) => {
    setJoinCode(code.trim().toUpperCase());
    setView('join');
  };

  const handleOnboardingComplete = (intent?: OnboardingIntent) => {
    // Account creation (Firebase Auth + Firestore profile) already happened inside <Onboarding>.
    // useAuth() picks up the new session automatically; we just reset the view.
    // L'intention choisie sur "Que veux-tu faire ?" évite un accueil vide :
    // un cercle mène à l'onglet Cercle (le + et le champ code), un besoin
    // d'argent ouvre directement le Coup de pouce ou le crédit.
    // Arrivé par un lien d'invitation : c'est ce cercle qu'on venait rejoindre.
    if (joinCode) {
      setView('join');
      return;
    }
    if (intent === 'aid' || intent === 'credit') {
      setMarketplaceIntent(intent);
      setView('marketplace');
      return;
    }
    setView(intent ? 'my-circles' : 'dashboard');
  };

  const handleLogout = async () => {
    await logout();
    setJoinCode(null);
    setView('dashboard');
  };

  const renderView = () => {
    if (!activeProfile) return null;

    const handleManageContributions = (id: string) => {
      setSelectedGroupId(id);
      setView('contributions');
    };

    switch (view) {
      case 'dashboard':
        return (
          <Dashboard
            user={activeProfile}
            groups={groups}
            onSelectGroup={handleSelectGroup}
            onManageContributions={handleManageContributions}
            onNavigateToProfileTab={(tab) => {
              setProfileTab(tab);
              setView('profile');
            }}
            onNavigate={(v) => setView(v as View)}
          />
        );
      case 'my-circles':
        return (
          <CircleHub
            user={activeProfile}
            groups={groups}
            onSelectGroup={handleSelectGroup}
            onNavigateToVerification={() => {
              setProfileTab('kyc');
              setView('profile');
            }}
            onSearch={() => setView('search-groups')}
            onJoinByCode={handleJoinByCode}
          />
        );
      case 'search-groups':
        return <SearchGroups user={activeProfile} onBack={goBack} />;
      case 'cotiser': {
        // L'onglet central mène droit au paiement. S'il n'y a qu'un cercle
        // actif, on ouvre directement ses cotisations ; sinon on laisse
        // choisir, plutôt que de deviner à sa place.
        const payable = groups.filter((g) => g.status === 'active');
        if (payable.length === 1) {
          return (
            <ContributionsManager
              group={payable[0]}
              user={activeProfile}
              onBack={goBack}
              onNavigateToVerification={() => {
                setProfileTab('kyc');
                setView('profile');
              }}
            />
          );
        }
        return (
          <ChooseCircleToPay
            groups={payable}
            onSelect={handleManageContributions}
            onBack={goBack}
          />
        );
      }
      case 'activity':
        return (
          <ActivityScreen
            userId={activeProfile.uid}
            onManageContributions={handleManageContributions}
            onSelectGroup={handleSelectGroup}
            onNavigateToProfileTab={(tab) => {
              setProfileTab(tab);
              setView('profile');
            }}
            onNavigate={(v) => setView(v as View)}
          />
        );
      case 'wallet-savings':
        return <Profile user={activeProfile} groups={groups} defaultTab="wallet" onLogout={handleLogout} onNavigate={(v) => setView(v as View)} />;
      case 'wallet-recharge':
        return <Profile user={activeProfile} groups={groups} defaultTab="wallet" focusCard="recharge" onLogout={handleLogout} onNavigate={(v) => setView(v as View)} />;
      case 'wallet-withdraw':
        return <Profile user={activeProfile} groups={groups} defaultTab="wallet" focusCard="withdraw" onLogout={handleLogout} onNavigate={(v) => setView(v as View)} />;
      case 'calendar':
        return <CalendarView groups={groups} onSelectGroup={handleSelectGroup} />;
      case 'support':
        return <Support user={activeProfile} onBack={goBack} />;
      case 'marketplace':
        return <Marketplace user={activeProfile} initialOpen={marketplaceIntent} />;
      case 'ai-assistant':
        return <AIAssistant user={activeProfile} groups={groups} />;
      case 'my-bank':
        return <MyBank user={activeProfile} groups={groups} onNavigate={(v) => setView(v as View)} />;
      case 'profile':
        return <Profile user={activeProfile} groups={groups} defaultTab={profileTab} onLogout={handleLogout} onNavigate={(v) => setView(v as View)} />;
      case 'admin':
        // Le rôle décide de l'accès ; la ré-authentification protège la
        // session laissée ouverte (voir AdminGate).
        return activeProfile.role === 'admin' ? (
          <AdminGate user={activeProfile} onCancel={goBack}>
            <AdminDashboard />
          </AdminGate>
        ) : <Dashboard user={activeProfile} groups={groups} onSelectGroup={handleSelectGroup} onManageContributions={handleManageContributions} />;
      case 'contributions':
        return selectedGroup ? (
          <ContributionsManager
            group={selectedGroup}
            user={activeProfile}
            onBack={goBack}
            onNavigateToVerification={() => {
              setProfileTab('kyc');
              setView('profile');
            }}
          />
        ) : <Dashboard user={activeProfile} groups={groups} onSelectGroup={handleSelectGroup} onManageContributions={handleManageContributions} />;
      case 'join':
        return joinCode ? (
          <JoinGroup 
            joinCode={joinCode} 
            user={activeProfile} 
            onJoined={(id) => {
              setJoinCode(null);
              setSelectedGroupId(id);
              setView('group-details');
            }}
            onCancel={() => {
              setJoinCode(null);
              goBack();
            }}
          />
        ) : <Dashboard user={activeProfile} groups={groups} onSelectGroup={handleSelectGroup} onManageContributions={handleManageContributions} />;
      case 'group-details':
        return selectedGroup ? (
          <GroupDetails
            group={selectedGroup}
            onBack={goBack}
            onNavigateToVerification={() => {
              setProfileTab('kyc');
              setView('profile');
            }}
          />
        ) : (
          <Dashboard user={activeProfile} groups={groups} onSelectGroup={handleSelectGroup} onManageContributions={handleManageContributions} />
        );
      default:
        return <Dashboard user={activeProfile} groups={groups} onSelectGroup={handleSelectGroup} onManageContributions={handleManageContributions} />;
    }
  };

  if (authLoading) {
    return <LoadingScreen message="Chargement de votre espace…" />;
  }

  const isAdminUser = activeProfile?.role === 'admin';
  // Visiteur déconnecté : on laisse l'écran de connexion, sinon l'équipe ne
  // pourrait plus se reconnecter pour lever la maintenance.
  if (maintenanceMode && activeProfile && !isAdminUser) {
    return (
      <div className="h-dvh w-full flex flex-col items-center justify-center bg-background text-foreground px-6 text-center gap-4">
        <img src="/icons/icon-128.png" alt="eganyé" className="w-16 h-16 rounded-2xl shadow-xl" />
        <h1 className="text-xl font-serif font-bold">Maintenance en cours</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          eganyé est temporairement indisponible pour une opération de maintenance. Revenez dans quelques instants.
        </p>
      </div>
    );
  }

  if (paydunyaSim) {
    return (
      <PaydunyaSimulator
        amount={paydunyaSim.amount}
        userId={paydunyaSim.userId}
        userName={paydunyaSim.userName}
        userEmail={paydunyaSim.userEmail}
        initialPhone={paydunyaSim.phone}
        initialOperator={paydunyaSim.operator}
        onSuccess={async () => {
          // Parcours simulé (développement uniquement) : c'est ici que le
          // crédit a lieu, via un endpoint qui refuse de s'exécuter dès qu'un
          // vrai paiement est possible. En production ce composant n'est
          // jamais monté — le crédit vient du webhook Paydunya.
          try {
            await fetch(apiUrl('/api/dev-simulate-payment'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: paydunyaSim.userId,
                amount: paydunyaSim.netAmount,
                reference: `${paydunyaSim.userId}_${paydunyaSim.amount}`,
              }),
            });
          } catch (err) {
            console.error('Crédit simulé impossible :', err);
          }
          window.location.href = `${window.location.origin}/?paydunya_success=true`;
        }}
        onCancel={() => {
          window.location.href = `${window.location.origin}/?paydunya_cancel=true`;
        }}
      />
    );
  }

  if (!activeProfile || isRecoveryInProgress()) {
    if (showLanding && authEntry === null) {
      return (
        <Landing
          onStart={() => setAuthEntry('intent')}
          onLogin={() => setAuthEntry('login')}
        />
      );
    }
    return (
      <>
        <Onboarding onComplete={handleOnboardingComplete} initialScreen={authEntry ?? 'welcome'} hasInvite={Boolean(joinCode)} />
        <Toaster />
      </>
    );
  }

  const firstName = activeProfile.displayName?.split(' ')[0] || '';
  const barTitles: Partial<Record<View, string>> = {
    dashboard: firstName ? `${t('dashboard_greeting')} ${firstName}` : 'eganyé',
    'my-circles': t('nav_circles'),
    'ai-assistant': t('nav_assistant'),
    'my-bank': t('my_bank'),
    profile: t('profile'),
    activity: t('nav_activity'),
    calendar: t('calendar'),
    marketplace: t('marketplace'),
    admin: t('admin_panel'),
    'wallet-savings': t('nav_wallet'),
    'wallet-recharge': t('recharge'),
    'wallet-withdraw': t('withdraw'),
  };

  return (
    <Layout
      title={barTitles[view]}
      onBack={ROOT_VIEWS.has(view) ? undefined : goBack}
      showLogo={view === 'dashboard'}
      hideBarOnMobile={VIEWS_WITH_OWN_BACK.has(view)}
      user={{
        uid: activeProfile.uid,
        displayName: activeProfile.displayName,
        email: activeProfile.email,
        photoURL: activeProfile.photoURL,
        role: activeProfile.role
      }}
      view={view}
      onNavigate={(v) => setView(v as View)}
      onLogout={handleLogout}
    >
      {!isOnline && (
        <div className="bg-warning-soft border-b border-warning/30 text-warning text-[13px] font-bold text-center py-2 px-4 flex items-center justify-center gap-1.5">
          <EganyeIcon name="warning" size={14} className="shrink-0" />
          <span>
            {t('offline_banner_title')} — {t('offline_banner_desc')}
            {(() => {
              // Toujours dire de quand datent les chiffres affichés : un
              // ancien solde ne doit jamais passer pour le solde actuel.
              const since = oldestSnapshotDate(activeProfile.uid);
              return since
                ? ` · ${t('offline_data_from')} ${since.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                : '';
            })()}
          </span>
        </div>
      )}
      <Suspense fallback={<LoadingScreen fullScreen={false} />}>
        {renderView()}
      </Suspense>
      <InstallPrompt />
      <AppLock
        userId={activeProfile.uid}
        displayName={activeProfile.displayName}
        photoURL={activeProfile.photoURL}
        onLogout={handleLogout}
      />
      <Toaster />
    </Layout>
  );
}
