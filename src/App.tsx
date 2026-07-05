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
import { PaydunyaSimulator } from '@/components/PaydunyaSimulator';
import { Onboarding } from '@/components/Onboarding';
import { Toaster } from '@/components/ui/sonner';
import { useAuth } from '@/hooks/useAuth';
import { useGroups } from '@/hooks/useGroups';
import { useReminders } from '@/hooks/useReminders';
import { useWalletDebitor } from '@/hooks/useWalletDebitor';
import { logout } from '@/lib/firebase';
import { executeFinancialTransaction } from '@/lib/ledger';
import { Loader2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

type View = 'dashboard' | 'profile' | 'group-details' | 'join' | 'admin' | 'contributions' | 'search-groups' | 'calendar';

export default function App() {
  const { profile, loading: authLoading } = useAuth();
  const activeProfile = profile;

  // Auto detect and synchronize system theme on first load
  React.useEffect(() => {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    
    if (activeProfile) {
      if (!activeProfile.theme) {
        // First load, theme not set in user profile yet
        const updateThemeInDb = async () => {
          try {
            const userRef = doc(db, 'users', activeProfile.uid);
            await updateDoc(userRef, { theme: systemTheme });
          } catch (err) {
            console.error("Failed to sync auto-detected theme to firestore:", err);
          }
        };
        updateThemeInDb();
        document.documentElement.classList.add(systemTheme === 'dark' ? 'dark' : 'light');
        document.documentElement.classList.remove(systemTheme === 'dark' ? 'light' : 'dark');
        localStorage.setItem('eganye_theme', systemTheme);
      } else {
        // Apply the saved theme preference
        const userTheme = activeProfile.theme;
        document.documentElement.classList.add(userTheme === 'dark' ? 'dark' : 'light');
        document.documentElement.classList.remove(userTheme === 'dark' ? 'light' : 'dark');
        localStorage.setItem('eganye_theme', userTheme);
      }
    } else {
      // Unauthenticated / Onboarding - use cached theme or default to system theme
      const savedTheme = localStorage.getItem('eganye_theme') || systemTheme;
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

          // Create matching subcollection transaction for user display
          await addDoc(collection(db, 'users', activeProfile.uid, 'walletTransactions'), {
            userId: activeProfile.uid,
            amount: amountNum,
            type: 'recharge',
            description: `Recharge de portefeuille via Paydunya`,
            date: new Date().toISOString(),
            status: 'completed',
            paymentMethod: 'paydunya',
            reference: ledgerResult.transactionId || rawRef
          });

          // Create Notification
          await addDoc(collection(db, 'notifications'), {
            userId: activeProfile.uid,
            title: 'Portefeuille rechargé !',
            message: `Votre portefeuille virtuel a été rechargé de ${amountNum.toLocaleString()} FCFA avec succès via Paydunya.`,
            type: 'system',
            read: false,
            createdAt: serverTimestamp()
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
      case 'search-groups':
        return <SearchGroups user={activeProfile} onBack={() => setView('dashboard')} />;
      case 'calendar':
        return <CalendarView groups={groups} onSelectGroup={handleSelectGroup} />;
      case 'profile':
        return <Profile user={activeProfile} groups={groups} defaultTab={profileTab} />;
      case 'admin':
        return activeProfile.role === 'admin' ? <AdminDashboard /> : <Dashboard user={activeProfile} groups={groups} onSelectGroup={handleSelectGroup} onManageContributions={handleManageContributions} />;
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
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F5E6D3]/40 text-[#4B2E05]">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-[#2BB673] p-3.5 rounded-2xl text-white shadow-md animate-bounce">
            <span className="font-serif font-black text-xl tracking-wide lowercase">eg</span>
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-[#E67E22]" />
          <span className="text-xs font-serif font-bold tracking-wide uppercase text-[#4B2E05]/60">chargement d'eganyé...</span>
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

  return (
    <Layout 
      user={activeProfile ? {
        uid: activeProfile.uid,
        displayName: activeProfile.displayName,
        email: activeProfile.email,
        photoURL: activeProfile.photoURL,
        role: activeProfile.role
      } : undefined} 
      view={view}
      onNavigate={(v) => setView(v as View)}
      onLogout={handleLogout}
    >
      {activeProfile ? (
        renderView()
      ) : (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}
      <Toaster />
    </Layout>
  );
}
