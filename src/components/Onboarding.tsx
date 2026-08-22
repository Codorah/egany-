import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AvatarWorkshop } from './AvatarWorkshop';
import { BiometricPrompt } from './BiometricPrompt';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Zap,
  Users2,
  TrendingUp,
  Key,
  User,
  Globe2,
  Eye,
  EyeOff,
  Fingerprint,
  MailCheck
} from 'lucide-react';
import { signInWithGoogle, signInWithEmail, supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { language, setLanguage, t } = useLanguage();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(newTheme);
    localStorage.setItem('eganye_theme', newTheme);
  };

  // Avatar State
  const [avatar, setAvatar] = useState<string>('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  // Email OTP verification (step 4) — Supabase sends a code via the
  // "Confirm signup" template's {{ .Token }} instead of a magic link.
  // Length is set by this project's Auth config (currently 8 digits).
  const OTP_LENGTH = 8;
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
      const { error } = await signInWithEmail(email, password);
      if (error) throw error;
      // App-level auth listener (useAuth) picks up the session automatically from here.
    } catch (err: any) {
      console.error("Email login error:", err);
      if (err?.message?.toLowerCase().includes('invalid login credentials')) {
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
      // Supabase uses a full-page redirect flow (not a popup like Firebase),
      // so it navigates away to Google and back via the OAuth callback URL —
      // useAuth's onAuthStateChange picks up the session on return.
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      toast.error(`Erreur d'authentification: ${err?.message || err}`);
    }
  };

  const slides = [
    {
      title: "La Tontine des Mamans & Commerçantes",
      description: "Digitalisez vos cercles d'épargne en toute sécurité. Cotisez ensemble et suivez chaque versement en toute transparence depuis votre téléphone.",
      image: "/onboarding-mamas.png",
      color: "from-amber-500/15 to-orange-500/5"
    },
    {
      title: "Une Jeunesse Prospère qui Épargne",
      description: "Étudiants, jeunes entrepreneurs et travailleurs : créez des cercles d'épargne flexibles, suivez vos cotisations et réalisez vos projets.",
      image: "/young-savers.png",
      color: "from-emerald-500/15 to-teal-500/5"
    },
    {
      title: "Encaissez par Mobile Money (Wave, Orange, MTN)",
      description: "Recevez directement l'intégralité du pot de tontine sur votre compte dès votre tour venu sans tracas.",
      image: "/vendor-success.png",
      color: "from-orange-500/15 to-amber-500/5"
    }
  ];

  const handleFinishOnboarding = async () => {
    setIsCreatingAccount(true);
    try {
      // The bootstrap admin email + base profile row are handled server-side
      // by the on_auth_user_created trigger (supabase/migrations/0001_init.sql) —
      // we only need to fill in what onboarding itself collected.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } }
      });
      if (error) throw error;

      if (!data.session) {
        // Email confirmation is on: no session yet, Supabase has emailed a
        // 6-digit code. Move to the verification step instead of failing.
        setOtpDigits(Array(OTP_LENGTH).fill(''));
        setStep(4);
        toast.success(`Un code à ${OTP_LENGTH} chiffres a été envoyé à ${email}.`);
        return;
      }

      await finalizeAccountSetup(data.user!.id);
    } catch (err: any) {
      console.error("Signup error:", err);
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        toast.error("Cet email est déjà associé à un compte. Connectez-vous plutôt.", {
          action: { label: "Se connecter", onClick: () => { setAuthMode('login'); setStep(2); } }
        });
      } else if (msg.includes('password')) {
        toast.error("Le mot de passe est trop faible (minimum 6 caractères).");
      } else {
        toast.error(`Erreur lors de la création du compte : ${err?.message || err}`);
      }
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const finalizeAccountSetup = async (userId: string) => {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        avatar_url: avatar || null,
        language,
        theme,
        biometrics_enabled: !!biometricsEnabled,
      })
      .eq('id', userId);
    if (updateError) throw updateError;

    if (biometricsEnabled) {
      localStorage.setItem('eganye_biometrics_enrolled', 'true');
      localStorage.setItem('eganye_biometrics_username', displayName);
    }

    toast.success("Votre compte eganyé a été créé avec succès !");
    onComplete();
  };

  const handleVerifyOtp = async () => {
    const code = otpDigits.join('');
    if (code.length !== OTP_LENGTH) {
      toast.error(`Veuillez saisir les ${OTP_LENGTH} chiffres du code.`);
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
      if (error) throw error;
      await finalizeAccountSetup(data.user!.id);
    } catch (err: any) {
      console.error("OTP verification error:", err);
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('expired') || msg.includes('invalid')) {
        toast.error("Code incorrect ou expiré. Vérifiez le code ou renvoyez-en un nouveau.");
      } else {
        toast.error(`Erreur de vérification : ${err?.message || err}`);
      }
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      otpInputRefs.current[0]?.focus();
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    setIsResendingOtp(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      toast.success("Nouveau code envoyé !");
    } catch (err: any) {
      console.error("OTP resend error:", err);
      toast.error(`Impossible de renvoyer le code : ${err?.message || err}`);
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleOtpDigitChange = (index: number, rawValue: string) => {
    const value = rawValue.replace(/\D/g, '').slice(-1);
    setOtpDigits(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    if (value && index < OTP_LENGTH - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    setOtpDigits(Array(OTP_LENGTH).fill('').map((_, i) => pasted[i] || ''));
    otpInputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  return (
    <div className={`w-full min-h-screen md:min-h-0 md:my-10 md:mx-auto flex flex-col justify-between bg-background px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:px-10 md:pt-10 md:pb-10 relative overflow-hidden md:rounded-2xl md:shadow-elevated transition-all duration-500 ${
      step === 3 ? 'md:max-w-4xl' : 'md:max-w-xl'
    }`}>

      {/* Subtle background accent — very light, not distracting */}
      <div className="absolute top-[-30%] right-[-20%] w-[50%] h-[40%] bg-primary/[0.04] rounded-full blur-3xl pointer-events-none" />

      {/* Progress Indicators */}
      {step > 0 && step < 4 && (
        <div className="flex items-center gap-1.5 px-2 mb-4 z-10">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step >= s ? 'w-8 bg-brand' : 'w-2 bg-border'
              }`}
            />
          ))}
        </div>
      )}

      {/* Top Bar for Nav */}
      <div className="z-10 flex items-center justify-between">
        {step > 0 && step < 5 ? (
          <Button variant="ghost" size="icon" onClick={handlePrevStep} className="rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Button>
        ) : <div />}

        {step === 0 && (
          <div className="flex gap-1 bg-muted p-1 rounded-full border border-border">
            <button
              type="button"
              className={`h-8 text-xs rounded-full px-3 font-bold cursor-pointer transition-all ${language === 'fr' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
              onClick={() => setLanguage('fr')}
            >
              FR
            </button>
            <button
              type="button"
              className={`h-8 text-xs rounded-full px-3 font-bold cursor-pointer transition-all ${language === 'en' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={`h-8 text-xs rounded-full px-3 font-bold cursor-pointer transition-all ${language === 'wo' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
              onClick={() => setLanguage('wo')}
            >
              WO
            </button>
            <button
              type="button"
              className={`h-8 text-xs rounded-full px-3 font-bold cursor-pointer transition-all ${language === 'bm' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
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
              <img
                src="/logo-emblem.png"
                alt="eganyé"
                className="mx-auto w-20 h-20 rounded-2xl shadow-soft"
              />

              <div className="space-y-2">
                <h1 className="text-3xl font-serif font-black text-foreground tracking-wide lowercase">eganyé</h1>
                <p className="text-brand font-sans font-bold tracking-widest text-[11px] uppercase">{t('onboarding_subtitle') || 'Épargner mieux, grandir ensemble.'}</p>
              </div>

              <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
                Gérez vos cercles d'épargne africains avec simplicité, automatisez vos cotisations via Wave, Orange Money, et augmentez votre score financier.
              </p>

              <div className="space-y-3 pt-4">
                <Button
                  onClick={() => setStep(1)}
                  className="w-full gradient-sunset text-white font-bold rounded-2xl h-12 glow-orange transition-all flex items-center justify-center gap-2"
                >
                  Découvrir eganyé
                  <ArrowRight className="w-4 h-4" />
                </Button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-border"></div>
                  <span className="flex-shrink mx-4 text-muted-foreground text-xs">Ou continuer avec</span>
                  <div className="flex-grow border-t border-border"></div>
                </div>

                <Button
                  onClick={handleGoogleSignIn}
                  variant="outline"
                  className="w-full border-border hover:bg-muted text-foreground font-semibold rounded-2xl h-12 flex items-center justify-center gap-2 cursor-pointer"
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
                  className="w-full border-secondary/40 text-secondary hover:bg-secondary/10 font-bold rounded-2xl h-12 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
                >
                  <Key className="w-4 h-4" />
                  J'ai déjà un compte, me connecter
                </Button>

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
                    className={`h-2 rounded-full transition-all ${slideIndex === idx ? 'w-6 bg-foreground' : 'w-2 bg-border'}`}
                  />
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={slideIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`p-5 rounded-2xl bg-card border border-border flex flex-col items-center text-center space-y-4 overflow-hidden shadow-soft`}
                >
                  <div className="w-full h-44 sm:h-52 rounded-xl overflow-hidden shadow-soft relative">
                    <img
                      src={slides[slideIndex].image}
                      alt={slides[slideIndex].title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="text-lg sm:text-xl font-serif font-black text-foreground">{slides[slideIndex].title}</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed max-w-sm font-medium">{slides[slideIndex].description}</p>
                </motion.div>
              </AnimatePresence>

              <div className="pt-4 flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setStep(2)}
                  className="w-1/3 text-muted-foreground font-bold"
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
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl h-12 flex items-center justify-center gap-2"
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
                <h2 className="text-2xl font-black text-foreground tracking-tight">
                  {authMode === 'login' ? 'Connectez-vous' : 'Créez votre Compte'}
                </h2>
                <p className="text-muted-foreground text-xs">
                  {authMode === 'login'
                    ? 'Entrez vos identifiants pour retrouver votre espace eganyé.'
                    : 'Définissez vos identifiants pour vous connecter en toute sécurité.'}
                </p>
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                  className="text-[11px] font-bold text-secondary hover:underline cursor-pointer"
                >
                  {authMode === 'login' ? "Pas encore de compte ? Créez-en un" : "Vous avez déjà un compte ? Connectez-vous"}
                </button>
              </div>

              <div className="space-y-3 pt-2">
                {authMode === 'signup' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="ob_name" className="font-bold text-foreground text-xs flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-brand" />
                      Nom d'utilisateur / Surnom
                    </Label>
                    <Input
                      id="ob_name"
                      placeholder="Ex: Fatou Sy"
                      className="rounded-xl h-12 border-border focus-visible:ring-primary text-sm"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="ob_email" className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <Globe2 className="w-3.5 h-3.5 text-brand" />
                    Adresse Email
                  </Label>
                  <Input
                    id="ob_email"
                    type="email"
                    placeholder="Ex: fatou@gmail.com"
                    className="rounded-xl h-11 border-border focus-visible:ring-primary"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ob_pass" className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-brand" />
                    Mot de passe
                  </Label>
                  <div className="relative">
                    <Input
                      id="ob_pass"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min. 6 caractères"
                      className="rounded-xl h-12 pr-10 border-border focus-visible:ring-primary text-sm"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {authMode === 'signup' && (
                <>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="space-y-1">
                    <Label className="font-bold text-foreground text-[10px] uppercase">Thème</Label>
                    <div className="flex gap-1 bg-muted p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => handleThemeChange('light')}
                        className={`flex-1 text-xs font-bold py-2 rounded-md ${theme === 'light' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
                      >
                        {t('light_mode') || 'Clair'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleThemeChange('dark')}
                        className={`flex-1 text-xs font-bold py-2 rounded-md ${theme === 'dark' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
                      >
                        {t('dark_mode') || 'Sombre'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="font-bold text-foreground text-[10px] uppercase">Langue</Label>
                    <div className="grid grid-cols-4 gap-1 bg-muted p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setLanguage('fr')}
                        className={`text-[10px] font-bold py-2 rounded-md transition-all ${language === 'fr' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        FR
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguage('en')}
                        className={`text-[10px] font-bold py-2 rounded-md transition-all ${language === 'en' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        EN
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguage('wo')}
                        className={`text-[10px] font-bold py-2 rounded-md transition-all ${language === 'wo' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        WO
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguage('bm')}
                        className={`text-[10px] font-bold py-2 rounded-md transition-all ${language === 'bm' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        BM
                      </button>
                    </div>
                  </div>
                </div>

                {/* Biometrics Activation Card */}
                <div className="bg-muted p-4 rounded-2xl border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-success-soft rounded-xl text-secondary">
                        <Fingerprint className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-foreground">Accès Biométrique</h4>
                        <p className="text-[10px] text-muted-foreground font-medium">Face ID ou Empreinte Digitale</p>
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
                        biometricsEnabled ? 'bg-secondary' : 'bg-border'
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
                    <div className="text-[10px] font-bold text-secondary flex items-center gap-1 bg-secondary/10 p-2 rounded-xl border border-secondary/20">
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
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl h-12 flex items-center justify-center gap-2"
                  >
                    {isSubmittingAuth ? "Connexion..." : "Se connecter"}
                    {!isSubmittingAuth && <ArrowRight className="w-4 h-4" />}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNextStep}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl h-12 flex items-center justify-center gap-2"
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
              <div className="space-y-6">
                <AvatarWorkshop
                  value={avatar}
                  onChange={setAvatar}
                  name={displayName}
                  allowPhotoUpload={false}
                />
                
                <div className="pt-4">
                  <Button
                    onClick={handleFinishOnboarding}
                    disabled={isCreatingAccount || isLoading}
                    className="w-full gradient-sunset text-white font-bold rounded-2xl h-12 flex items-center justify-center gap-2 glow-orange"
                  >
                    {isCreatingAccount || isLoading ? "Création en cours..." : "Créer mon Compte eganyé !"}
                    {!(isCreatingAccount || isLoading) && <ArrowRight className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Email OTP Verification */}
          {step === 4 && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="space-y-2 text-center">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-success-soft text-secondary flex items-center justify-center">
                  <MailCheck className="w-7 h-7" />
                </div>
                <h2 className="text-2xl font-black text-foreground tracking-tight">Vérifiez votre email</h2>
                <p className="text-muted-foreground text-xs px-4">
                  Entrez le code à {OTP_LENGTH} chiffres envoyé à <span className="font-bold text-foreground">{email}</span>
                </p>
              </div>

              <div className="flex items-center justify-center gap-1.5">
                {otpDigits.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => { otpInputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    className="w-8 h-10 text-center text-base font-black rounded-lg focus-visible:ring-primary"
                  />
                ))}
              </div>

              <div className="space-y-3 pt-2">
                <Button
                  onClick={handleVerifyOtp}
                  disabled={isVerifyingOtp || isCreatingAccount}
                  className="w-full gradient-sunset text-white font-bold rounded-2xl h-12 flex items-center justify-center gap-2 glow-orange"
                >
                  {isVerifyingOtp ? "Vérification..." : "Vérifier le code"}
                  {!isVerifyingOtp && <ArrowRight className="w-4 h-4" />}
                </Button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResendingOtp}
                  className="w-full text-center text-xs font-bold text-secondary hover:underline disabled:opacity-50 cursor-pointer"
                >
                  {isResendingOtp ? "Envoi en cours..." : "Je n'ai pas reçu de code — Renvoyer"}
                </button>
              </div>
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
    </div>
  );
}
