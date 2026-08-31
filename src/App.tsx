import React, { useState, Suspense, lazy } from 'react';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { PaydunyaSimulator } from '@/components/PaydunyaSimulator';
import { Onboarding } from '@/components/Onboarding';
import { Toaster } from '@/components/ui/sonner';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

// Lazy-loaded: kept out of the main bundle since Dashboard/Onboarding are
// the only screens needed for first paint (logged-in home, logged-out auth).
const GroupDetails = lazy(() => import('@/components/GroupDetails').then((m) => ({ default: m.GroupDetails })));
const Profile = lazy(() => import('@/components/Profile').then((m) => ({ default: m.Profile })));
const JoinGroup = lazy(() => import('@/components/JoinGroup').then((m) => ({ default: m.JoinGroup })));
const AdminDashboard = lazy(() => import('@/components/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const ContributionsManager = lazy(() => import('@/components/ContributionsManager').then((m) => ({ default: m.ContributionsManager })));
const SearchGroups = lazy(() => import('@/components/SearchGroups').then((m) => ({ default: m.SearchGroups })));
const CalendarView = lazy(() => import('@/components/CalendarView').then((m) => ({ default: m.CalendarView })));
const Support = lazy(() => import('@/components/Support').then((m) => ({ default: m.Support })));
const Marketplace = lazy(() => import('@/components/Marketplace').then((m) => ({ default: m.Marketplace })));
const AIAssistant = lazy(() => import('@/components/AIAssistant').then((m) => ({ default: m.AIAssistant })));
const MyBank = lazy(() => import('@/components/MyBank').then((m) => ({ default: m.MyBank })));
const ActivityScreen = lazy(() => import('@/components/ActivityScreen').then((m) => ({ default: m.ActivityScreen })));
const ChooseCircleToPay = lazy(() => import('@/components/ChooseCircleToPay').then((m) => ({ default: m.ChooseCircleToPay })));
import { useAuth } from '@/hooks/useAuth';
import { useGroups } from '@/hooks/useGroups';
import { useReminders } from '@/hooks/useReminders';
import { useWalletDebitor } from '@/hooks/useWalletDebitor';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { logout } from '@/lib/supabase';
import { executeFinancialTransaction } from '@/lib/ledger';
import { notifyUser } from '@/lib/notify';
import { fetchPlatformSettings } from '@/lib/platformSettings';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { runBackHandlers } from '@/hooks/useBackHandler';

type View = 'dashboard' | 'profile' | 'group-details' | 'join' | 'admin' | 'contributions' | 'search-groups' | 'my-circles' | 'wallet-savings' | 'wallet-recharge' | 'wallet-withdraw' | 'calendar' | 'support' | 'marketplace' | 'ai-assistant' | 'my-bank' | 'cotiser' | 'activity';

export default function App() {
  const { profile, loading: authLoading } = useAuth();
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
    fetchPlatformSettings().then((s) => setMaintenanceMode(s.maintenanceMode));
  }, []);
  
  const [view, setView] = useState<View>('dashboard');

  // Android hardware back button (Play Store review expects it to navigate
  // within the app, not just exit): a nested screen (e.g. the admin
  // drill-down menu) gets first refusal via useBackHandler; otherwise this
  // falls back to "go to dashboard", then "exit the app" once already home.
  // No-op on web — the browser's own back button/history already works there.
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      if (runBackHandlers()) return;
      setView((current) => {
        if (current !== 'dashboard') return 'dashboard';
        CapacitorApp.exitApp();
        return current;
      });
    });
    return () => { listenerPromise.then((l) => l.remove()); };
  }, []);
  const [profileTab, setProfileTab] = useState<string>('contributions');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [paydunyaSim, setPaydunyaSim] = useState<{ amount: number; userId: string; userName: string; userEmail: string; phone: string; operator: string } | null>(null);

  // Handle URL parameters for joining and Paydunya recharges
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Hidden admin route detection (/admin or ?admin=true)
    const isAdminRoute = window.location.pathname.includes('/admin') || params.get('admin') === 'true';
    if (isAdminRoute && activeProfile) {
      if (activeProfile.role === 'admin' || activeProfile.email === 'codorah@hotmail.com') {
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
      const amount = parseFloat(params.get('amount') || '0');
      const userId = params.get('userId') || '';
      const userName = params.get('userName') || '';
      const userEmail = params.get('userEmail') || '';
      const phone = params.get('phone') || '';
      const operator = params.get('operator') || '';
      if (amount && userId) {
        setPaydunyaSim({ amount, userId, userName, userEmail, phone, operator });
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

    // Clear URL params without refreshing
    if (code || paySim || params.get('paydunya_success') || params.get('paydunya_cancel')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [profile, groups]);

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  const handleSelectGroup = (id: string) => {
    setSelectedGroupId(id);
    setView('group-details');
  };

  const handleOnboardingComplete = () => {
    // Account creation (Firebase Auth + Firestore profile) already happened inside <Onboarding>.
    // useAuth() picks up the new session automatically; we just reset the view.
    setView('dashboard');
  };

  const handleLogout = async () => {
    await logout();
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
      case 'search-groups':
        return <SearchGroups user={activeProfile} onBack={() => setView('dashboard')} />;
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
              onBack={() => setView('dashboard')}
            />
          );
        }
        return (
          <ChooseCircleToPay
            groups={payable}
            onSelect={handleManageContributions}
            onBack={() => setView('dashboard')}
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
        return <Support user={activeProfile} onBack={() => setView('dashboard')} />;
      case 'marketplace':
        return <Marketplace user={activeProfile} />;
      case 'ai-assistant':
        return <AIAssistant user={activeProfile} groups={groups} />;
      case 'my-bank':
        return <MyBank user={activeProfile} />;
      case 'profile':
        return <Profile user={activeProfile} groups={groups} defaultTab={profileTab} onLogout={handleLogout} onNavigate={(v) => setView(v as View)} />;
      case 'admin':
        return (activeProfile.role === 'admin' || activeProfile.email === 'codorah@hotmail.com') ? <AdminDashboard /> : <Dashboard user={activeProfile} groups={groups} onSelectGroup={handleSelectGroup} onManageContributions={handleManageContributions} />;
      case 'contributions':
        return selectedGroup ? (
          <ContributionsManager group={selectedGroup} user={activeProfile} onBack={() => setView('dashboard')} />
        ) : <Dashboard user={activeProfile} groups={groups} onSelectGroup={handleSelectGroup} onManageContributions={handleManageContributions} />;
      case 'join':
        return joinCode ? (
          <JoinGroup 
            joinCode={joinCode} 
            user={activeProfile} 
            onJoined={(id) => {
              setSelectedGroupId(id);
              setView('group-details');
            }}
            onCancel={() => setView('dashboard')}
          />
        ) : <Dashboard user={activeProfile} groups={groups} onSelectGroup={handleSelectGroup} onManageContributions={handleManageContributions} />;
      case 'group-details':
        return selectedGroup ? (
          <GroupDetails group={selectedGroup} onBack={() => setView('dashboard')} />
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

  const isAdminUser = activeProfile?.role === 'admin' || activeProfile?.email === 'codorah@hotmail.com';
  if (maintenanceMode && !isAdminUser) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground px-6 text-center gap-4">
        <img src="/icons/icon-128.png" alt="eganyé" className="w-16 h-16 rounded-2xl shadow-xl" />
        <h1 className="text-xl font-serif font-black">Maintenance en cours</h1>
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
        onSuccess={(amount) => {
          window.location.href = `${window.location.origin}/?paydunya_success=true&amount=${amount}`;
        }}
        onCancel={() => {
          window.location.href = `${window.location.origin}/?paydunya_cancel=true`;
        }}
      />
    );
  }

  if (!activeProfile) {
    return (
      <>
        <Onboarding onComplete={handleOnboardingComplete} />
        <Toaster />
      </>
    );
  }

  return (
    <Layout
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
        <div className="bg-amber-500 text-white text-xs font-bold text-center py-2 px-4">
          Vous êtes hors-ligne — les données affichées peuvent ne pas être à jour, et les actions financières (recharge, retrait, cotisation, création/adhésion de cercle) sont désactivées.
        </div>
      )}
      <Suspense fallback={<LoadingScreen fullScreen={false} />}>
        {renderView()}
      </Suspense>
      <Toaster />
    </Layout>
  );
}
