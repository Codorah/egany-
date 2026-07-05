import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CustomAvatar, 
  AvatarConfig, 
  DEFAULT_AVATAR 
} from './CustomAvatar';
import { AvatarWorkshop } from './AvatarWorkshop';
import { BiometricPrompt } from './BiometricPrompt';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Users2, 
  TrendingUp, 
  Key, 
  User, 
  Globe2, 
  HelpCircle,
  Eye,
  EyeOff,
  Fingerprint
} from 'lucide-react';
import { signInWithGoogle, signUpWithEmail, signInWithEmail } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

interface OnboardingProps {
  onComplete: () => void;
  isLoading?: boolean;
}

export function Onboarding({ onComplete, isLoading = false }: OnboardingProps) {
  const [step, setStep] = useState(0); // 0: Welcome, 1: Slides, 2: Credentials, 3: Avatar Creator, 4: Finish
  const [slideIndex, setSlideIndex] = useState(0);
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Biometrics (enrollment only - never a substitute for signing in)
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [isBiometricPromptOpen, setIsBiometricPromptOpen] = useState(false);

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState('fr');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Avatar State
  const [avatar, setAvatar] = useState<AvatarConfig>({ ...DEFAULT_AVATAR });
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  const handleLogin = async () => {
    if (!email.includes('@')) {
      toast.error("Veuillez saisir un email valide.");
      return;
    }
    if (!password) {
      toast.error("Veuillez saisir votre mot de passe.");
      return;
    }
    setIsSubmittingAuth(true);
    try {
      await signInWithEmail(email, password);
      // App-level auth listener picks up the session automatically from here.
    } catch (err: any) {
      console.error("Email login error:", err);
      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password' || err?.code === 'auth/user-not-found') {
        toast.error("Email ou mot de passe incorrect.");
      } else {
        toast.error(`Erreur de connexion : ${err?.message || err}`);
      }
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleNextStep = () => {
    if (step === 2) {
      if (!displayName.trim()) {
        toast.error("Veuillez saisir un nom d'utilisateur.");
        return;
      }
      if (!email.includes('@')) {
        toast.error("Veuillez saisir un email valide.");
        return;
      }
      if (password.length < 6) {
        toast.error("Le mot de passe doit contenir au moins 6 caractères.");
        return;
      }
    }
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setStep(prev => prev - 1);
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      if (
        err?.code === 'auth/cancelled-popup-request' || 
        err?.code === 'auth/popup-closed-by-user' || 
        err?.code === 'auth/popup-blocked' ||
        err?.message?.includes('popup') ||
        err?.message?.includes('cancelled')
      ) {
        toast.error(
          "La connexion Google par pop-up a été annulée ou bloquée par votre navigateur (souvent dû aux restrictions d'iframe).",
          {
            duration: 8000,
            action: {
              label: "Créer un compte par email",
              onClick: () => {
                setStep(2); // Direct to step 2 for credentials setting
              }
            }
          }
        );
      } else {
        toast.error(`Erreur d'authentification: ${err?.message || err}`);
      }
    }
  };

  const slides = [
    {
      title: "Épargnez ensemble, sans tracas",
      description: "Digitalisez vos cercles d'épargne (tontines). Créez des groupes sécurisés et suivez les versements en temps réel.",
      icon: <Users2 className="w-12 h-12 text-[#E67E22]" />,
      color: "from-[#E67E22]/10 to-[#E67E22]/5"
    },
    {
      title: "Automatisation Paydunya",
      description: "Alimentez votre portefeuille virtuel avec Wave, Orange Money ou MTN, et laissez eganyé prélever automatiquement vos cotisations.",
      icon: <Zap className="w-12 h-12 text-[#2BB673]" />,
      color: "from-[#2BB673]/10 to-[#2BB673]/5"
    },
    {
      title: "Bâtissez votre Réputation",
      description: "Chaque versement à l'heure augmente votre Score de Réputation financière pour débloquer de plus grands financements.",
      icon: <TrendingUp className="w-12 h-12 text-[#D4A574]" />,
      color: "from-[#D4A574]/10 to-[#D4A574]/5"
    }
  ];

  const handleFinishOnboarding = async () => {
    setIsCreatingAccount(true);
    try {
      const credential = await signUpWithEmail(email, password);
      const uid = credential.user.uid;

      const newProfile = {
        uid,
        displayName,
        email,
        photoURL: JSON.stringify(avatar),
        language,
        theme,
        role: email === 'diditanael@gmail.com' ? 'admin' : 'user',
        walletBalance: 0,
        reputationScore: 75,
        totalSaved: 0,
        groupsJoined: 0,
        biometricsEnabled: !!biometricsEnabled,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', uid), newProfile);

      if (biometricsEnabled) {
        localStorage.setItem('eganye_biometrics_enrolled', 'true');
        localStorage.setItem('eganye_biometrics_username', displayName);
      }

      toast.success("Votre compte eganyé a été créé avec succès !");
      onComplete();
    } catch (err: any) {
      console.error("Signup error:", err);
      if (err?.code === 'auth/email-already-in-use') {
        toast.error("Cet email est déjà associé à un compte. Connectez-vous plutôt.", {
          action: { label: "Se connecter", onClick: () => { setAuthMode('login'); setStep(2); } }
        });
      } else if (err?.code === 'auth/weak-password') {
        toast.error("Le mot de passe est trop faible (minimum 6 caractères).");
      } else {
        toast.error(`Erreur lors de la création du compte : ${err?.message || err}`);
      }
    } finally {
      setIsCreatingAccount(false);
    }
  };

  return (
    <div className={`w-full mx-auto bg-white dark:bg-slate-950 min-h-[85vh] flex flex-col justify-between p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800/80 overflow-hidden relative transition-all duration-500 ${
      step === 3 ? 'max-w-3xl' : 'max-w-md'
    }`}>
      
      {/* Background aesthetic blobs */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[40%] bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[40%] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Progress Indicators */}
      {step > 0 && step < 4 && (
        <div className="flex items-center gap-1.5 px-2 mb-4 z-10">
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step >= s ? 'w-8 bg-amber-500' : 'w-2 bg-slate-200'
              }`}
            />
          ))}
        </div>
      )}

      {/* Top Bar for Nav */}
      <div className="z-10 flex items-center justify-between">
        {step > 0 && step < 4 ? (
          <Button variant="ghost" size="icon" onClick={handlePrevStep} className="rounded-full hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Button>
        ) : <div />}
        
        {step === 0 && (
          <div className="flex gap-1 bg-slate-100 p-0.5 rounded-full border border-slate-200">
            <button 
              type="button"
              className={`h-6 text-[10px] rounded-full px-2 font-bold cursor-pointer transition-all ${language === 'fr' ? 'bg-white text-[#4B2E05] shadow-xs' : 'text-slate-500'}`}
              onClick={() => setLanguage('fr')}
            >
              FR
            </button>
            <button 
              type="button"
              className={`h-6 text-[10px] rounded-full px-2 font-bold cursor-pointer transition-all ${language === 'en' ? 'bg-white text-[#4B2E05] shadow-xs' : 'text-slate-500'}`}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
            <button 
              type="button"
              className={`h-6 text-[10px] rounded-full px-2 font-bold cursor-pointer transition-all ${language === 'wo' ? 'bg-white text-[#4B2E05] shadow-xs' : 'text-slate-500'}`}
              onClick={() => setLanguage('wo')}
            >
              WO
            </button>
            <button 
              type="button"
              className={`h-6 text-[10px] rounded-full px-2 font-bold cursor-pointer transition-all ${language === 'bm' ? 'bg-white text-[#4B2E05] shadow-xs' : 'text-slate-500'}`}
              onClick={() => setLanguage('bm')}
            >
              BM
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center my-4 z-10">
        <AnimatePresence mode="wait">
          
          {/* Step 0: Main Welcome */}
          {step === 0 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="text-center space-y-6 py-4"
            >
              <div className="mx-auto w-20 h-20 bg-[#D4A574] rounded-3xl flex items-center justify-center shadow-lg rotate-12 transition-transform hover:rotate-6 duration-300">
                <Sparkles className="w-10 h-10 text-white animate-pulse" />
              </div>

              <div className="space-y-2">
                <h1 className="text-4xl font-serif font-extrabold text-[#4B2E05] tracking-wide lowercase">eganyé</h1>
                <p className="text-[#E67E22] font-sans font-bold tracking-widest text-xs uppercase">Épargner mieux, grandir ensemble.</p>
              </div>

              <p className="text-slate-500 text-sm max-w-sm mx-auto leading-relaxed">
                Gérez vos cercles d'épargne africains avec simplicité, automatisez vos cotisations via Wave, Orange Money, et augmentez votre score financier.
              </p>

              <div className="space-y-3 pt-4">
                <Button 
                  onClick={() => setStep(1)} 
                  className="w-full bg-[#E67E22] hover:bg-[#E67E22]/90 text-white font-bold rounded-2xl h-12 shadow-md transition-all flex items-center justify-center gap-2"
                >
                  Découvrir eganyé
                  <ArrowRight className="w-4 h-4" />
                </Button>
                
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-4 text-slate-400 text-xs">Ou continuer avec</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <Button 
                  onClick={handleGoogleSignIn} 
                  variant="outline" 
                  className="w-full border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-2xl h-12 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99c.92-2.75 3.51-4.51 6.76-4.51z"/>
                    <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.44c-.28 1.47-1.11 2.71-2.36 3.56l3.66 2.84c2.14-1.98 3.38-4.89 3.38-8.51z"/>
                    <path fill="#FBBC05" d="M5.24 10.55c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3L1.39 2.96C.5 4.77 0 6.83 0 9s.5 4.23 1.39 6.04l3.85-3.49z"/>
                    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-3.95 1.09-3.25 0-5.84-1.76-6.76-4.51L1.74 16.8C3.72 20.33 7.7 23 12 23z"/>
                  </svg>
                  Connexion via Google
                </Button>

                <Button
                  onClick={() => { setAuthMode('login'); setStep(2); }}
                  variant="outline"
                  className="w-full border-[#2BB673]/40 text-[#2BB673] dark:text-[#4ade80] hover:bg-emerald-500/5 font-bold rounded-2xl h-12 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
                >
                  <Key className="w-4 h-4" />
                  J'ai déjà un compte, me connecter
                </Button>

                <p className="text-[10px] text-slate-400 text-center px-4 leading-relaxed">
                  Note : Si le pop-up Google est bloqué par l'iframe de votre navigateur, cliquez sur <b>"Découvrir eganyé"</b> ci-dessus pour créer un compte par email.
                </p>
              </div>
            </motion.div>
          )}

          {/* Step 1: Slide Showcase */}
          {step === 1 && (
            <motion.div
              key="slides"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 py-2"
            >
              <div className="flex justify-center gap-2">
                {slides.map((_, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setSlideIndex(idx)}
                    className={`h-2 rounded-full transition-all ${slideIndex === idx ? 'w-6 bg-slate-800' : 'w-2 bg-slate-300'}`}
                  />
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={slideIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`p-8 rounded-3xl bg-gradient-to-br ${slides[slideIndex].color} border border-slate-100 flex flex-col items-center text-center space-y-4`}
                >
                  <div className="p-4 bg-white rounded-2xl shadow-sm">
                    {slides[slideIndex].icon}
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900">{slides[slideIndex].title}</h3>
                  <p className="text-slate-600 text-xs leading-relaxed max-w-xs">{slides[slideIndex].description}</p>
                </motion.div>
              </AnimatePresence>

              <div className="pt-4 flex gap-3">
                <Button 
                  variant="ghost" 
                  onClick={() => setStep(2)} 
                  className="w-1/3 text-slate-500 font-bold"
                >
                  Passer
                </Button>
                <Button 
                  onClick={() => {
                    if (slideIndex < slides.length - 1) {
                      setSlideIndex(prev => prev + 1);
                    } else {
                      setStep(2);
                    }
                  }} 
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl h-12 flex items-center justify-center gap-2"
                >
                  {slideIndex === slides.length - 1 ? "Compris !" : "Suivant"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Credentials & Local details */}
          {step === 2 && (
            <motion.div
              key="credentials"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {authMode === 'login' ? 'Connectez-vous' : 'Créez votre Compte'}
                </h2>
                <p className="text-slate-500 text-xs">
                  {authMode === 'login'
                    ? 'Entrez vos identifiants pour retrouver votre espace eganyé.'
                    : 'Définissez vos identifiants pour vous connecter en toute sécurité.'}
                </p>
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-[11px] font-bold text-[#2BB673] hover:underline cursor-pointer"
                >
                  {authMode === 'login' ? "Pas encore de compte ? Créez-en un" : "Vous avez déjà un compte ? Connectez-vous"}
                </button>
              </div>

              <div className="space-y-3 pt-2">
                {authMode === 'signup' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="ob_name" className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-amber-500" />
                      Nom d'utilisateur / Surnom
                    </Label>
                    <Input
                      id="ob_name"
                      placeholder="Ex: Fatou Sy"
                      className="rounded-xl h-11 border-slate-200 focus-visible:ring-amber-500"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="ob_email" className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    <Globe2 className="w-3.5 h-3.5 text-amber-500" />
                    Adresse Email
                  </Label>
                  <Input 
                    id="ob_email"
                    type="email"
                    placeholder="Ex: fatou@gmail.com" 
                    className="rounded-xl h-11 border-slate-200 focus-visible:ring-amber-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ob_pass" className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-500" />
                    Mot de passe
                  </Label>
                  <div className="relative">
                    <Input 
                      id="ob_pass"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 6 caractères" 
                      className="rounded-xl h-11 pr-10 border-slate-200 focus-visible:ring-amber-500"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {authMode === 'signup' && (
                <>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="space-y-1">
                    <Label className="font-bold text-slate-700 text-[10px] uppercase">Thème</Label>
                    <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setTheme('light')}
                        className={`flex-1 text-[10px] font-bold py-1 rounded-md ${theme === 'light' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
                      >
                        Clair
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme('dark')}
                        className={`flex-1 text-[10px] font-bold py-1 rounded-md ${theme === 'dark' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
                      >
                        Sombre
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="font-bold text-slate-700 text-[10px] uppercase">Langue</Label>
                    <div className="grid grid-cols-4 gap-1 bg-slate-100 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setLanguage('fr')}
                        className={`text-[9px] font-bold py-1 rounded-md transition-all ${language === 'fr' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Français
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguage('en')}
                        className={`text-[9px] font-bold py-1 rounded-md transition-all ${language === 'en' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        English
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguage('wo')}
                        className={`text-[9px] font-bold py-1 rounded-md transition-all ${language === 'wo' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Wolof
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguage('bm')}
                        className={`text-[9px] font-bold py-1 rounded-md transition-all ${language === 'bm' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Bambara
                      </button>
                    </div>
                  </div>
                </div>

                {/* Biometrics Activation Card */}
                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-[#2BB673]">
                        <Fingerprint className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">Accès Biométrique</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Face ID ou Empreinte Digitale</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!biometricsEnabled) {
                          setIsBiometricPromptOpen(true);
                        } else {
                          setBiometricsEnabled(false);
                          toast.info("Connexion biométrique désactivée.");
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        biometricsEnabled ? 'bg-[#2BB673]' : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          biometricsEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {biometricsEnabled && (
                    <div className="text-[10px] font-bold text-[#2BB673] flex items-center gap-1 bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/10">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Biométrie associée avec succès !</span>
                    </div>
                  )}
                </div>
                </>
                )}
              </div>

              <div className="pt-4">
                {authMode === 'login' ? (
                  <Button
                    onClick={handleLogin}
                    disabled={isSubmittingAuth}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-2xl h-12 flex items-center justify-center gap-2"
                  >
                    {isSubmittingAuth ? "Connexion..." : "Se connecter"}
                    {!isSubmittingAuth && <ArrowRight className="w-4 h-4" />}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNextStep}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-2xl h-12 flex items-center justify-center gap-2"
                  >
                    Étape Suivante
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 3: Interactive Reusable Avatar Workshop */}
          {step === 3 && (
            <motion.div
              key="avatar"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full"
            >
              <AvatarWorkshop 
                value={avatar} 
                onChange={setAvatar} 
                onSave={handleFinishOnboarding}
                isSaving={isCreatingAccount || isLoading} 
                saveLabel="Créer mon Compte eganyé !" 
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Biometric Scan Prompt Modal */}
      <BiometricPrompt
        isOpen={isBiometricPromptOpen}
        onClose={() => setIsBiometricPromptOpen(false)}
        username={displayName || "Utilisateur"}
        onSuccess={() => {
          setBiometricsEnabled(true);
          toast.success("Authentification biométrique activée avec succès !");
        }}
        mode="register"
      />

      {/* Footer Branding */}
      <div className="mt-auto text-center">
        <p className="text-[9px] text-slate-400 font-medium">
          Comptes sécurisés par Firebase Authentication. eganyé PWA v1.0.0
        </p>
      </div>
    </div>
  );
}
