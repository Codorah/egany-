import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { GroupDetails } from '@/components/GroupDetails';
import { Profile } from '@/components/Profile';
import { JoinGroup } from '@/components/JoinGroup';
import { AdminDashboard } from '@/components/AdminDashboard';
import { ContributionsManager } from '@/components/ContributionsManager';
import { SearchGroups } from '@/components/SearchGroups';
import { CalendarView } from '@/components/CalendarView';
import { Support } from '@/components/Support';
import { PaydunyaSimulator } from '@/components/PaydunyaSimulator';
import { Onboarding } from '@/components/Onboarding';
import { Marketplace } from '@/components/Marketplace';
import { AIAssistant } from '@/components/AIAssistant';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/hooks/useAuth';
import { useGroups } from '@/hooks/useGroups';
import { useReminders } from '@/hooks/useReminders';
import { useWalletDebitor } from '@/hooks/useWalletDebitor';
import { logout } from '@/lib/supabase';
import { executeFinancialTransaction } from '@/lib/ledger';
import { notifyUser } from '@/lib/notify';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type View = 'dashboard' | 'profile' | 'group-details' | 'join' | 'admin' | 'contributions' | 'search-groups' | 'my-circles' | 'wallet-savings' | 'calendar' | 'support' | 'marketplace' | 'ai-assistant';

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
        return <Profile user={activeProfile} groups={groups} defaultTab="wallet" onLogout={handleLogout} />;
      case 'calendar':
        return <CalendarView groups={groups} onSelectGroup={handleSelectGroup} />;
      case 'support':
        return <Support user={activeProfile} onBack={() => setView('dashboard')} />;
      case 'marketplace':
        return <Marketplace />;
      case 'ai-assistant':
        return <AIAssistant />;
      case 'profile':
        return <Profile user={activeProfile} groups={groups} defaultTab={profileTab} onLogout={handleLogout} />;
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
      {renderView()}
      <Toaster />
    </Layout>
  );
}
