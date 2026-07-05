import React, { useState, useEffect } from 'react';
import { Navbar } from './Navbar';
import { BottomNav } from './BottomNav';
import { 
  Smartphone, 
  Tv, 
  Wifi, 
  Battery, 
  Signal, 
  Sparkles, 
  Activity, 
  HelpCircle,
  Globe,
  Bell,
  CheckCircle,
  RefreshCw,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface LayoutProps {
  children: React.ReactNode;
  user?: {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
    role?: string;
  };
  view?: string;
  onNavigate?: (view: string) => void;
  onLogout?: () => void;
}

export function Layout({ children, user, view, onNavigate, onLogout }: LayoutProps) {
  const [isMobileSimulated, setIsMobileSimulated] = useState(true);
  const [currentTime, setCurrentTime] = useState('12:00');
  const [activeTab, setActiveTab] = useState<'info' | 'logs'>('info');
  const [isResetting, setIsResetting] = useState(false);

  // Simple clock effect for simulated status bar
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hrs = now.getHours().toString().padStart(2, '0');
      const mins = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hrs}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleResetDatabase = async () => {
    if (!confirm("⚠️ ATTENTION : Êtes-vous sûr de vouloir EFFACER TOUTES les données de la base (utilisateurs, groupes, cotisations, messages, notifications) ? Cette opération est irréversible !")) {
      return;
    }
    
    setIsResetting(true);
    const toastId = toast.loading("Réinitialisation de la base de données en cours...");
    try {
      // 1. Clear invitations
      const invitationsSnap = await getDocs(collection(db, 'invitations'));
      for (const d of invitationsSnap.docs) {
        await deleteDoc(doc(db, 'invitations', d.id));
      }

      // 2. Clear notifications
      const notificationsSnap = await getDocs(collection(db, 'notifications'));
      for (const d of notificationsSnap.docs) {
        await deleteDoc(doc(db, 'notifications', d.id));
      }

      // 3. Clear groups, messages and contributions
      const groupsSnap = await getDocs(collection(db, 'groups'));
      for (const gDoc of groupsSnap.docs) {
        // Subcollection contributions
        const contSnap = await getDocs(collection(db, 'groups', gDoc.id, 'contributions'));
        for (const cDoc of contSnap.docs) {
          await deleteDoc(doc(db, 'groups', gDoc.id, 'contributions', cDoc.id));
        }
        
        // Subcollection messages
        const msgSnap = await getDocs(collection(db, 'groups', gDoc.id, 'messages'));
        for (const mDoc of msgSnap.docs) {
          await deleteDoc(doc(db, 'groups', gDoc.id, 'messages', mDoc.id));
        }

        await deleteDoc(doc(db, 'groups', gDoc.id));
      }

      // 4. Clear users and walletTransactions
      const usersSnap = await getDocs(collection(db, 'users'));
      for (const uDoc of usersSnap.docs) {
        const transSnap = await getDocs(collection(db, 'users', uDoc.id, 'walletTransactions'));
        for (const tDoc of transSnap.docs) {
          await deleteDoc(doc(db, 'users', uDoc.id, 'walletTransactions', tDoc.id));
        }
        await deleteDoc(doc(db, 'users', uDoc.id));
      }

      toast.success("La base de données a été réinitialisée avec succès !", { id: toastId });
      
      // Refresh to onboarding screen
      setTimeout(() => {
        window.location.reload();
      }, 1200);

    } catch (error) {
      console.error("Error resetting database:", error);
      toast.error("Une erreur s'est produite lors de la réinitialisation.", { id: toastId });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5E6D3]/40 text-[#4B2E05] flex flex-col justify-between">
      
      {/* Simulation Header control bar on Desktop */}
      <header className="bg-[#4B2E05] border-b border-[#D4A574]/30 px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-[#D4A574] text-white p-1.5 rounded-lg font-serif font-black text-sm tracking-wide">
            eg
          </div>
          <div>
            <h1 className="font-serif font-extrabold text-sm tracking-wide text-[#F5E6D3] flex items-center gap-1.5">
              Émulateur Mobile eganyé
              <span className="text-[10px] font-sans font-medium bg-[#2BB673]/20 text-[#2BB673] border border-[#2BB673]/30 px-2 py-0.5 rounded-full">PWA & Capacitor ready</span>
            </h1>
            <p className="text-[10px] text-[#F5E6D3]/70 font-sans">Mobile-First Tontine Engineering Workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileSimulated(!isMobileSimulated)}
            className="hidden md:flex items-center gap-2 text-xs font-bold bg-[#D4A574]/20 hover:bg-[#D4A574]/30 text-[#F5E6D3] px-3 py-1.5 rounded-xl border border-[#D4A574]/30 transition-all"
          >
            {isMobileSimulated ? (
              <>
                <Tv className="w-3.5 h-3.5 text-[#E67E22]" />
                Mode Plein Écran Web
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-[#E67E22]" />
                Mode Smartphone Simulé
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col md:flex-row items-center justify-center p-4 md:p-8 gap-8 overflow-x-hidden">
        
        {isMobileSimulated ? (
          <>
            {/* Left Hand-Side Desktop Simulation Control Panel */}
            <div className="hidden lg:flex flex-col w-[320px] max-w-full space-y-4 self-center animate-in fade-in duration-500">
              <div className="bg-[#4B2E05] border border-[#D4A574]/30 rounded-3xl p-5 space-y-4 shadow-xl text-white">
                <div className="flex justify-between items-center border-b border-[#D4A574]/20 pb-3">
                  <h4 className="font-serif font-bold text-xs uppercase tracking-wider text-[#D4A574] flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-[#E67E22]" />
                    Console eganyé PWA
                  </h4>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2BB673] animate-pulse" />
                </div>

                <div className="space-y-2 text-xs text-[#F5E6D3]/90 leading-relaxed font-sans">
                  <p>
                    Pour respecter pleinement votre exigence de projet <strong>Mobile-First</strong>, l'application s'affiche au format smartphone idéal (iPhone 15 Pro).
                  </p>
                  <p className="text-[#F5E6D3]/70 text-[11px]">
                    L'onboarding interactif, le configurateur d'avatar dessiné et le QR code d'invitation sont entièrement fonctionnels à l'intérieur de l'émulateur.
                  </p>
                </div>

                <div className="border-t border-[#D4A574]/20 pt-3 space-y-2">
                  <span className="text-[10px] font-bold text-[#D4A574] block uppercase">Statut des API Natives :</span>
                  <div className="grid grid-cols-2 gap-1.5 text-[9px] font-bold">
                    <div className="bg-[#4B2E05]/60 border border-[#D4A574]/20 p-1.5 rounded-lg flex items-center gap-1.5 text-[#F5E6D3]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2BB673]" />
                      Capacitor Core
                    </div>
                    <div className="bg-[#4B2E05]/60 border border-[#D4A574]/20 p-1.5 rounded-lg flex items-center gap-1.5 text-[#F5E6D3]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2BB673]" />
                      Paydunya API
                    </div>
                    <div className="bg-[#4B2E05]/60 border border-[#D4A574]/20 p-1.5 rounded-lg flex items-center gap-1.5 text-[#F5E6D3]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2BB673]" />
                      Local Database
                    </div>
                    <div className="bg-[#4B2E05]/60 border border-[#D4A574]/20 p-1.5 rounded-lg flex items-center gap-1.5 text-[#F5E6D3]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2BB673]" />
                      PWA Manifest
                    </div>
                  </div>
                </div>

                {/* Developer Reset Database Section - admin only, this is destructive and irreversible */}
                {user?.role === 'admin' && (
                  <div className="border-t border-[#D4A574]/20 pt-3 space-y-2">
                    <span className="text-[10px] font-bold text-[#D4A574] block uppercase">Contrôles de Test (Dev) :</span>
                    <button
                      onClick={handleResetDatabase}
                      disabled={isResetting}
                      className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-300 hover:text-red-200 border border-red-600/30 font-sans font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                      {isResetting ? 'Réinitialisation...' : 'Effacer toutes les données'}
                    </button>
                    <p className="text-[9px] text-[#F5E6D3]/50 italic text-center leading-tight">
                      Efface de Firestore les utilisateurs, groupes, cotisations, messages et notifications pour recommencer l'onboarding à blanc.
                    </p>
                  </div>
                )}

                <div className="border-t border-[#D4A574]/20 pt-3 flex items-center justify-between text-xs">
                  <span className="text-[#F5E6D3]/70">Émuler rotation (PWA) :</span>
                  <span className="text-[#F5E6D3]/50 italic">Portrait uniquement</span>
                </div>
              </div>

              {/* Quick helper tip */}
              <div className="bg-[#E67E22]/10 border border-[#E67E22]/20 rounded-2xl p-4 flex gap-3 text-xs text-[#4B2E05]/80">
                <Sparkles className="w-5 h-5 text-[#E67E22] shrink-0" />
                <p>
                  Vous pouvez copier le lien ou flasher le Code QR d'un groupe avec votre vrai téléphone pour simuler l'accès de nouveaux membres !
                </p>
              </div>
            </div>

            {/* Simulated Phone Frame Container */}
            <div className="relative flex-1 max-w-[410px] aspect-[9/19.2] bg-[#4B2E05] border-[10px] border-[#4B2E05]/90 rounded-[55px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-500 ring-4 ring-[#D4A574]/20">
              
              {/* Phone Speaker Notch / Island */}
              <div className="absolute top-2.5 left-1/2 transform -translate-x-1/2 w-28 h-5 bg-slate-950 rounded-full z-50 flex items-center justify-center border border-slate-900/60 shadow-inner">
                <div className="w-12 h-1 bg-slate-800/60 rounded-full" />
              </div>

              {/* Simulated Status Bar */}
              <div className="h-10 bg-white px-6 pt-2 flex items-center justify-between text-[#4B2E05] font-bold text-xs z-40 select-none border-b border-[#F5E6D3]/30">
                <span>{currentTime}</span>
                <div className="flex items-center gap-1.5">
                  <Signal className="w-3.5 h-3.5 text-[#4B2E05] fill-[#4B2E05]" />
                  <Wifi className="w-3.5 h-3.5 text-[#4B2E05]" />
                  <Battery className="w-4 h-4 text-[#4B2E05]" />
                </div>
              </div>

              {/* Inner screen content */}
              <div className="flex-1 overflow-y-auto bg-[#FBF8F3] flex flex-col relative text-[#4B2E05] scrollbar-none">
                <Navbar user={user} onNavigate={onNavigate} onLogout={onLogout} />
                <div className="flex-1 p-4 pb-8 overflow-y-auto">
                  {children}
                </div>
                {user && (
                  <BottomNav user={user} currentView={view} onNavigate={onNavigate} isSimulated={true} />
                )}
              </div>

              {/* Phone Home Bar Indicator */}
              <div className="h-6 bg-white flex items-center justify-center z-40 select-none pb-1 border-t border-[#F5E6D3]/30">
                <div className="w-24 h-1 bg-slate-300 rounded-full" />
              </div>
            </div>
          </>
        ) : (
          /* Wide Screen Plain Mode */
          <div className="w-full bg-[#FBF8F3] text-[#4B2E05] rounded-3xl min-h-[80vh] flex flex-col overflow-hidden animate-in fade-in duration-500 shadow-xl border border-[#D4A574]/20 relative">
            <Navbar user={user} onNavigate={onNavigate} onLogout={onLogout} />
            <div className="flex-1 p-6 md:p-8 pb-20 md:pb-8">
              {children}
            </div>
            {user && (
              <BottomNav user={user} currentView={view} onNavigate={onNavigate} isSimulated={false} />
            )}
          </div>
        )}

      </main>

      {/* Footer System Branding */}
      <footer className="bg-[#4B2E05] border-t border-[#D4A574]/20 py-3 text-center text-[10px] text-[#F5E6D3]/60 font-sans">
        eganyé Core v1.0.0 © 2026. Épargner mieux, grandir ensemble.
      </footer>
    </div>
  );
}
