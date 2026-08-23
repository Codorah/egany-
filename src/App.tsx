import React, { useState, Suspense, lazy } from 'react';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { PaydunyaSimulator } from '@/components/PaydunyaSimulator';
import { Onboarding } from '@/components/Onboarding';
import { Toaster } from '@/components/ui/sonner';

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
import { useAuth } from '@/hooks/useAuth';
import { useGroups } from '@/hooks/useGroups';
import { useReminders } from '@/hooks/useReminders';
import { useWalletDebitor } from '@/hooks/useWalletDebitor';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { logout } from '@/lib/supabase';
import { executeFinancialTransaction } from '@/lib/ledger';
import { notifyUser } from '@/lib/notify';
import { fetchPlatformSettings } from '@/lib/platformSettings';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type View = 'dashboard' | 'profile' | 'group-details' | 'join' | 'admin' | 'contributions' | 'search-groups' | 'my-circles' | 'wallet-savings' | 'calendar' | 'support' | 'marketplace' | 'ai-assistant' | 'my-bank';

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
  const [profileTab, setProfileTab] = useState<string>('contributions');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [paydunyaSim, setPaydunyaSim] = useState<{ amount: number; userId: string; userName: string; userEmail: string } | null>(null);

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
      if (amount && userId) {
        setPaydunyaSim({ amount, userId, userName, userEmail });
      }
    }

    // Paydunya Success callback logic
    const paydunyaSuccess = params.get('paydunya_success');
    const rechargeAmount = params.get('amount');
    
    if (paydunyaSuccess === 'true' && rechargeAmount && activeProfile) {
      const amountNum = parseFloat(rechargeAmount);
      const handlePaydunyaRecharge = async () => {
        try {
          const rawRef = params.get('paydunya_ref') || `sim_ref_${Date.now()}`;
          const idempotencyKey = `recharge_${activeProfile.uid}_${rawRef}`;

          // Execute safe double-entry ledger financial transaction
          const ledgerResult = await executeFinancialTransaction({
            idempotencyKey,
            userId: activeProfile.uid,
            amount: amountNum,
            currency: 'FCFA',
            description: 'Recharge de portefeuille via Paydunya',
            actionType: 'wallet_recharge',
            debitAccount: 'psp_paydunya',
            creditAccount: `user_wallet:${activeProfile.uid}`
          });

          if (!ledgerResult.success) {
            throw new Error(ledgerResult.message);
          }

          // Create matching wallet transaction record for user display
          await supabase.from('wallet_transactions').insert({
            user_id: activeProfile.uid,
            amount: amountNum,
            type: 'recharge',
            description: `Recharge de portefeuille via Paydunya`,
            status: 'completed',
            payment_method: 'paydunya',
            reference: ledgerResult.transactionId || rawRef
          });

          // Create Notification
          await notifyUser({
            userId: activeProfile.uid,
            title: 'Portefeuille rechargé !',
            message: `Votre portefeuille virtuel a été rechargé de ${amountNum.toLocaleString()} FCFA avec succès via Paydunya.`,
            type: 'system'
          });

          toast.success(`Votre portefeuille a été crédité de ${amountNum.toLocaleString()} FCFA !`);
          setProfileTab('wallet');
          setView('profile');
        } catch (error: any) {
          console.error("Error recording wallet recharge:", error);
          toast.error(error.message || "Erreur lors de l'enregistrement de la recharge.");
        }
      };
      handlePaydunyaRecharge();
    } else if (params.get('paydunya_cancel') === 'true') {
      toast.error("Recharge de portefeuille annulée.");
    }

    // Clear URL params without refreshing
    if (code || paySim || paydunyaSuccess || params.get('paydunya_cancel')) {
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
      case 'wallet-savings':
        return <Profile user={activeProfile} groups={groups} defaultTab="wallet" onLogout={handleLogout} onNavigate={(v) => setView(v as View)} />;
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
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-6">
          <img 
            src="/logo-emblem.png" 
            alt="eganyé" 
            className="w-20 h-20 rounded-2xl shadow-xl animate-spin" 
            style={{ animationDuration: '2s' }} 
          />
          <span className="text-xs font-sans font-bold tracking-[0.2em] uppercase text-muted-foreground/60">chargement...</span>
        </div>
      </div>
    );
  }

  const isAdminUser = activeProfile?.role === 'admin' || activeProfile?.email === 'codorah@hotmail.com';
  if (maintenanceMode && !isAdminUser) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground px-6 text-center gap-4">
        <img src="/logo-emblem.png" alt="eganyé" className="w-16 h-16 rounded-2xl shadow-xl" />
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
      <Suspense fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      }>
        {renderView()}
      </Suspense>
      <Toaster />
    </Layout>
  );
}
