import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AvatarWorkshop } from './AvatarWorkshop';
import { LanguageSwitcher } from './ui/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowRight,
  ArrowLeft,
  Key,
  User,
  Mail,
  Eye,
  EyeOff,
  LockKeyhole,
  Check
} from 'lucide-react';
import {
  signInWithGoogle,
  signInWithEmail,
  sendPasswordResetCode,
  verifyPasswordResetCode,
  changePassword,
  supabase
} from '@/lib/supabase';
import { fetchPlatformSettings } from '@/lib/platformSettings';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface OnboardingProps {
  onComplete: () => void;
  isLoading?: boolean;
}

/**
 * Un écran = une décision. Le formulaire d'inscription ne porte plus que le
 * nom, l'email et le mot de passe : le thème, la langue et la biométrie ont
 * été déplacés dans le Profil, où l'utilisatrice les trouvera une fois entrée.
 */
type Screen =
  | 'welcome'
  | 'slides'
  | 'login'
  | 'register'
  | 'avatar'
  | 'otp-signup'
  | 'forgot'
  | 'otp-recovery'
  | 'reset';

// Longueur fixée par la configuration Auth du projet Supabase (templates
// « Confirm signup » et « Reset password » qui utilisent {{ .Token }}).
const OTP_LENGTH = 8;

/* -------------------------------------------------------------------- */
/* Fragments d'écran                                                     */
/*                                                                       */
/* Ils vivent au niveau du module, pas dans Onboarding : un composant    */
/* défini dans le corps d'un autre est recréé à chaque rendu, ce qui     */
/* démonte puis remonte ses <input> — le champ perdrait le focus à       */
/* chaque lettre tapée.                                                  */
/* -------------------------------------------------------------------- */

/**
 * Coque des écrans d'authentification : bandeau terre cuite en haut, coupé par
 * une courbe organique, puis la zone de saisie sur fond ivoire. La courbe est
 * un SVG étiré (preserveAspectRatio="none") pour épouser n'importe quelle
 * largeur d'écran sans se déformer verticalement.
 */
function AuthLayout({
  onBack, backLabel, title, desc, children, footer, compact = false,
}: {
  onBack?: () => void;
  backLabel: string;
  title: string;
  desc: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="relative w-full min-h-screen md:min-h-[860px] bg-background overflow-hidden flex flex-col">

      {/* Bandeau coloré + courbe */}
      <div
        className={`relative shrink-0 gradient-sunset ${compact ? 'h-[248px]' : 'h-[300px]'}`}
      >
        <svg
          viewBox="0 0 390 96"
          preserveAspectRatio="none"
          className="absolute -bottom-px left-0 w-full h-[96px]"
          aria-hidden="true"
        >
          <path d="M0,34 C118,96 250,4 390,52 L390,96 L0,96 Z" fill="var(--background)" />
        </svg>

        <div className="relative z-10 flex items-center px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={backLabel}
              className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/25 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="relative z-10 flex flex-col items-center gap-3 pt-2">
          <div className="w-[86px] h-[86px] rounded-full bg-white/95 shadow-elevated flex items-center justify-center">
            <img src="/logo-mark.png" alt="eganyé" className="w-14 h-14 object-contain" />
          </div>
          <span className="text-2xl font-serif font-bold text-white lowercase tracking-tight drop-shadow-sm">
            eganyé
          </span>
        </div>
      </div>

      {/* Zone de saisie */}
      <div className="relative z-10 flex-1 flex flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] -mt-4">
        <div className="space-y-2 text-right">
          <h1 className="text-[30px] leading-tight font-serif font-bold text-foreground tracking-tight text-balance">
            {title}
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground font-medium">{desc}</p>
        </div>

        <div className="mt-6 space-y-5">{children}</div>

        {footer && <div className="mt-auto pt-6">{footer}</div>}
      </div>
    </div>
  );
}

/** Champ en pilule avec capsule d'icône, façon maquette de référence. */
function PillField({
  id, type = 'text', icon: Icon, placeholder, value, onChange, trailing,
}: {
  id: string;
  type?: string;
  icon: typeof Mail;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full gradient-sunset flex items-center justify-center text-white shadow-soft pointer-events-none z-10">
        <Icon className="w-5 h-5" />
      </div>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-15 rounded-full border-transparent bg-card shadow-soft pl-16 ${trailing ? 'pr-14' : 'pr-6'}`}
      />
      {trailing}
    </div>
  );
}

function OtpBoxes({
  digits, inputRefs, onDigitChange, onKeyDown, onPaste, digitLabel,
}: {
  digits: string[];
  inputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onDigitChange: (index: number, value: string) => void;
  onKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  digitLabel: string;
}) {
  return (
    <div className="grid grid-cols-4 gap-3 max-w-[320px] mx-auto">
      {digits.map((digit, index) => (
        <Input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`${digitLabel} ${index + 1}`}
          maxLength={1}
          value={digit}
          onChange={(e) => onDigitChange(index, e.target.value)}
          onKeyDown={(e) => onKeyDown(index, e)}
          onPaste={onPaste}
          className="h-16 px-0 text-center text-2xl font-serif font-bold"
        />
      ))}
    </div>
  );
}

function GoogleBlock({
  onGoogle, dividerLabel, buttonLabel,
}: {
  onGoogle: () => void;
  dividerLabel: string;
  buttonLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-grow h-px bg-border" />
        <span className="text-sm font-semibold text-muted-foreground">{dividerLabel}</span>
        <div className="flex-grow h-px bg-border" />
      </div>
      <Button
        onClick={onGoogle}
        variant="outline"
        size="lg"
        className="w-full rounded-2xl border-border bg-card hover:bg-muted text-foreground gap-3"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99c.92-2.75 3.51-4.51 6.76-4.51z" />
          <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.44c-.28 1.47-1.11 2.71-2.36 3.56l3.66 2.84c2.14-1.98 3.38-4.89 3.38-8.51z" />
          <path fill="#FBBC05" d="M5.24 10.55c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3L1.39 2.96C.5 4.77 0 6.83 0 9s.5 4.23 1.39 6.04l3.85-3.49z" />
          <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-3.95 1.09-3.25 0-5.84-1.76-6.76-4.51L1.74 16.8C3.72 20.33 7.7 23 12 23z" />
        </svg>
        {buttonLabel}
      </Button>
    </div>
  );
}

export function Onboarding({ onComplete, isLoading = false }: OnboardingProps) {
  const { language, setLanguage, t } = useLanguage();

  const [screen, setScreen] = useState<Screen>('welcome');
  const [slideIndex, setSlideIndex] = useState(0);

  // Champs partagés par les différents écrans
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatar, setAvatar] = useState<string>('');

  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const passwordChecks = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const isPasswordStrongEnough = Object.values(passwordChecks).every(Boolean);

  const goTo = (next: Screen) => {
    setOtpDigits(Array(OTP_LENGTH).fill(''));
    setScreen(next);
  };

  const slides = [
    {
      title: t('banner_mamas_title'),
      description: t('onb_slide1_desc'),
      image: '/onboarding-mamas.png',
    },
    {
      title: t('onb_slide2_title'),
      description: t('onb_slide2_desc'),
      image: '/young-savers.png',
    },
    {
      title: t('onb_slide3_title'),
      description: t('onb_slide3_desc'),
      image: '/vendor-success.png',
    }
  ];

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */

  const handleGoogleSignIn = async () => {
    try {
      // Supabase redirige toute la page vers Google puis revient sur l'URL de
      // callback — c'est useAuth qui récupère la session au retour.
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (err: any) {
      console.error('Google auth error:', err);
      toast.error(t('onb_auth_error_prefix'));
    }
  };

  const handleLogin = async () => {
    if (!email.includes('@')) {
      toast.error(t('onb_enter_valid_email'));
      return;
    }
    if (!password) {
      toast.error(t('onb_enter_password'));
      return;
    }
    setIsSubmittingAuth(true);
    try {
      const { error } = await signInWithEmail(email, password);
      if (error) throw error;
      // useAuth prend le relais dès que la session existe.
    } catch (err: any) {
      console.error('Email login error:', err);
      const msg = (err?.message || '').toLowerCase();
      toast.error(
        msg.includes('invalid login credentials')
          ? t('onb_invalid_credentials')
          : t('onb_login_error_prefix')
      );
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleRegisterNext = () => {
    if (!displayName.trim()) {
      toast.error(t('onb_enter_username'));
      return;
    }
    if (!email.includes('@')) {
      toast.error(t('onb_enter_valid_email'));
      return;
    }
    if (!isPasswordStrongEnough) {
      toast.error(t('onb_pw_not_strong_enough'));
      return;
    }
    goTo('avatar');
  };

  const finalizeAccountSetup = async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        avatar_url: avatar || null,
        language,
        theme: (localStorage.getItem('eganye_theme') as 'light' | 'dark') || 'light',
      })
      .eq('id', userId);
    if (error) throw error;

    toast.success(t('onb_account_created_success'));
    onComplete();
  };

  const handleFinishOnboarding = async () => {
    setIsCreatingAccount(true);
    try {
      const { allowSignups } = await fetchPlatformSettings();
      if (!allowSignups) {
        toast.error(t('onb_signups_suspended'));
        return;
      }

      // Le profil de base est créé côté serveur par le trigger
      // on_auth_user_created ; on n'écrit ici que ce que l'onboarding a collecté.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } }
      });
      if (error) throw error;

      if (!data.session) {
        // Confirmation email active : Supabase a envoyé un code, pas de session.
        toast.success(`${t('onb_otp_sent_prefix')} ${OTP_LENGTH} ${t('onb_otp_sent_mid')} ${email}.`);
        goTo('otp-signup');
        return;
      }

      await finalizeAccountSetup(data.user!.id);
    } catch (err: any) {
      console.error('Signup error:', err);
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        toast.error(t('onb_email_already_registered'), {
          action: { label: t('nav_login'), onClick: () => goTo('login') }
        });
      } else if (msg.includes('password')) {
        toast.error(t('onb_password_too_weak'));
      } else {
        toast.error(t('onb_account_creation_error_prefix'));
      }
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleVerifySignupOtp = async () => {
    const code = otpDigits.join('');
    if (code.length !== OTP_LENGTH) {
      toast.error(`${t('onb_enter_otp_digits_prefix')} ${OTP_LENGTH} ${t('onb_enter_otp_digits_suffix')}`);
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
      if (error) throw error;
      await finalizeAccountSetup(data.user!.id);
    } catch (err: any) {
      console.error('OTP verification error:', err);
      toast.error(t('onb_otp_invalid'));
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
      toast.success(t('onb_new_code_sent'));
    } catch (err: any) {
      console.error('OTP resend error:', err);
      toast.error(t('onb_resend_code_error_prefix'));
    } finally {
      setIsResendingOtp(false);
    }
  };

  const handleSendResetCode = async () => {
    if (!email.includes('@')) {
      toast.error(t('onb_enter_valid_email'));
      return;
    }
    setIsSendingReset(true);
    try {
      const { error } = await sendPasswordResetCode(email);
      if (error) throw error;
      toast.success(t('onb_code_sent_toast'));
      goTo('otp-recovery');
    } catch (err: any) {
      console.error('Password reset request error:', err);
      toast.error(t('onb_send_code_error'));
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleVerifyRecoveryOtp = async () => {
    const code = otpDigits.join('');
    if (code.length !== OTP_LENGTH) {
      toast.error(`${t('onb_enter_otp_digits_prefix')} ${OTP_LENGTH} ${t('onb_enter_otp_digits_suffix')}`);
      return;
    }
    setIsVerifyingOtp(true);
    try {
      // Le code échange contre une session ; c'est elle qui autorise ensuite
      // l'écriture du nouveau mot de passe.
      const { error } = await verifyPasswordResetCode(email, code);
      if (error) throw error;
      setPassword('');
      setConfirmPassword('');
      setScreen('reset');
    } catch (err: any) {
      console.error('Recovery OTP error:', err);
      toast.error(t('onb_otp_invalid'));
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      otpInputRefs.current[0]?.focus();
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSaveNewPassword = async () => {
    if (password.length < 6) {
      toast.error(t('onb_pw_min_6'));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t('onb_passwords_dont_match'));
      return;
    }
    setIsSavingPassword(true);
    try {
      const { error } = await changePassword(password);
      if (error) throw error;
      // On repart d'une session propre : l'utilisatrice se reconnecte avec son
      // nouveau mot de passe, ce qui confirme qu'elle l'a bien mémorisé.
      await supabase.auth.signOut();
      setPassword('');
      setConfirmPassword('');
      toast.success(t('onb_reset_success'));
      goTo('login');
    } catch (err: any) {
      console.error('Password reset error:', err);
      toast.error(t('onb_reset_error'));
    } finally {
      setIsSavingPassword(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Saisie du code                                                      */
  /* ------------------------------------------------------------------ */

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

  /* ------------------------------------------------------------------ */
  /* Fragments réutilisés                                                */
  /* ------------------------------------------------------------------ */

  const backButton = (to: Screen) => (
    <button
      type="button"
      onClick={() => goTo(to)}
      aria-label={t('a11y_back')}
      className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center text-foreground hover:bg-muted cursor-pointer shrink-0"
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
  );

  const googleBlock = (
    <GoogleBlock
      onGoogle={handleGoogleSignIn}
      dividerLabel={t('onb_or_continue_with')}
      buttonLabel={t('onb_google_signin')}
    />
  );

  const otpBoxes = (
    <OtpBoxes
      digits={otpDigits}
      inputRefs={otpInputRefs}
      onDigitChange={handleOtpDigitChange}
      onKeyDown={handleOtpKeyDown}
      onPaste={handleOtpPaste}
      digitLabel={t('a11y_otp_digit')}
    />
  );

  const fade = {
    initial: { opacity: 0, x: 18 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -18 },
  };


  const eyeToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      aria-label={showPassword ? t('a11y_hide_password') : t('a11y_show_password')}
      className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
    >
      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
    </button>
  );

  const primaryButtonClass =
    'w-full rounded-full gradient-sunset text-white glow-orange gap-2';

  /* ---------------- Écrans d'authentification (coque graphique) ------- */

  if (screen === 'login') {
    return (
      <AuthLayout
        onBack={() => goTo('welcome')}
        backLabel={t('a11y_back')}
        title={t('onb_login_title')}
        desc={t('onb_login_desc')}
        footer={
          <button
            type="button"
            onClick={() => goTo('register')}
            className="w-full text-center text-[15px] font-bold text-brand hover:underline cursor-pointer py-2"
          >
            {t('onb_no_account_yet')}
          </button>
        }
      >
        <PillField
          id="lg_email"
          type="email"
          icon={Mail}
          placeholder={t('prof_email_address_label')}
          value={email}
          onChange={setEmail}
        />
        <PillField
          id="lg_pass"
          type={showPassword ? 'text' : 'password'}
          icon={Key}
          placeholder={t('onb_password_label')}
          value={password}
          onChange={setPassword}
          trailing={eyeToggle}
        />

        <div className="flex justify-end -mt-1">
          <button
            type="button"
            onClick={() => goTo('forgot')}
            className="text-[15px] font-bold text-brand hover:underline cursor-pointer py-1"
          >
            {t('onb_forgot_title')}
          </button>
        </div>

        <Button
          onClick={handleLogin}
          disabled={isSubmittingAuth}
          size="lg"
          className={primaryButtonClass}
        >
          {isSubmittingAuth ? t('onb_connecting_ellipsis') : t('nav_login')}
          {!isSubmittingAuth && <ArrowRight className="w-5 h-5" />}
        </Button>

        {googleBlock}
      </AuthLayout>
    );
  }

  if (screen === 'register') {
    return (
      <AuthLayout
        compact
        onBack={() => goTo('welcome')}
        backLabel={t('a11y_back')}
        title={t('onb_signup_title')}
        desc={t('onb_signup_desc')}
        footer={
          <button
            type="button"
            onClick={() => goTo('login')}
            className="w-full text-center text-[15px] font-bold text-brand hover:underline cursor-pointer py-2"
          >
            {t('onb_already_account_login')}
          </button>
        }
      >
        <PillField
          id="rg_name"
          icon={User}
          placeholder={t('prof_username_nickname')}
          value={displayName}
          onChange={setDisplayName}
        />
        <PillField
          id="rg_email"
          type="email"
          icon={Mail}
          placeholder={t('prof_email_address_label')}
          value={email}
          onChange={setEmail}
        />
        <PillField
          id="rg_pass"
          type={showPassword ? 'text' : 'password'}
          icon={Key}
          placeholder={t('onb_password_label')}
          value={password}
          onChange={setPassword}
          trailing={eyeToggle}
        />

        {password.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-2">
            {([
              ['length', 'onb_pw_req_length'],
              ['uppercase', 'onb_pw_req_uppercase'],
              ['lowercase', 'onb_pw_req_lowercase'],
              ['digit', 'onb_pw_req_digit'],
              ['special', 'onb_pw_req_special'],
            ] as const).map(([key, labelKey]) => {
              const met = passwordChecks[key];
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 text-[13px] font-semibold transition-colors ${
                    met ? 'text-secondary' : 'text-muted-foreground'
                  }`}
                >
                  {met
                    ? <Check className="w-4 h-4 shrink-0" />
                    : <div className="w-3.5 h-3.5 shrink-0 rounded-full border-[1.5px] border-current" />}
                  {t(labelKey)}
                </div>
              );
            })}
          </div>
        )}

        <Button onClick={handleRegisterNext} size="lg" className={primaryButtonClass}>
          {t('onb_next_step_button')}
          <ArrowRight className="w-5 h-5" />
        </Button>

        {googleBlock}
      </AuthLayout>
    );
  }

  if (screen === 'forgot') {
    return (
      <AuthLayout
        onBack={() => goTo('login')}
        backLabel={t('a11y_back')}
        title={t('onb_forgot_title')}
        desc={t('onb_forgot_desc')}
        footer={
          <button
            type="button"
            onClick={() => goTo('login')}
            className="w-full text-center text-[15px] font-bold text-brand hover:underline cursor-pointer py-2"
          >
            {t('onb_back_to_login')}
          </button>
        }
      >
        <PillField
          id="fp_email"
          type="email"
          icon={Mail}
          placeholder={t('prof_email_address_label')}
          value={email}
          onChange={setEmail}
        />
        <Button
          onClick={handleSendResetCode}
          disabled={isSendingReset}
          size="lg"
          className={primaryButtonClass}
        >
          {isSendingReset ? t('onb_sending_in_progress') : t('onb_send_code')}
          {!isSendingReset && <ArrowRight className="w-5 h-5" />}
        </Button>
      </AuthLayout>
    );
  }

  if (screen === 'otp-signup' || screen === 'otp-recovery') {
    const isRecovery = screen === 'otp-recovery';
    return (
      <AuthLayout
        onBack={() => goTo(isRecovery ? 'forgot' : 'avatar')}
        backLabel={t('a11y_back')}
        title={t('onb_verify_email_title')}
        desc={`${t('onb_enter_code_prefix')} ${OTP_LENGTH} ${t('onb_enter_code_suffix')} ${email}`}
        footer={
          !isRecovery ? (
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={isResendingOtp}
              className="w-full text-center text-[15px] font-bold text-brand hover:underline disabled:opacity-50 cursor-pointer py-2"
            >
              {isResendingOtp ? t('onb_sending_in_progress') : t('onb_resend_code')}
            </button>
          ) : undefined
        }
      >
        {otpBoxes}
        <Button
          onClick={isRecovery ? handleVerifyRecoveryOtp : handleVerifySignupOtp}
          disabled={isVerifyingOtp || isCreatingAccount}
          size="lg"
          className={primaryButtonClass}
        >
          {isVerifyingOtp ? t('onb_verifying_ellipsis') : t('onb_verify_code_button')}
          {!isVerifyingOtp && <ArrowRight className="w-5 h-5" />}
        </Button>
      </AuthLayout>
    );
  }

  if (screen === 'reset') {
    return (
      <AuthLayout
        onBack={() => goTo('login')}
        backLabel={t('a11y_back')}
        title={t('onb_reset_title')}
        desc={t('onb_reset_desc')}
      >
        <PillField
          id="np_pass"
          type={showPassword ? 'text' : 'password'}
          icon={Key}
          placeholder={t('onb_password_label')}
          value={password}
          onChange={setPassword}
          trailing={eyeToggle}
        />
        <PillField
          id="np_confirm"
          type={showPassword ? 'text' : 'password'}
          icon={LockKeyhole}
          placeholder={t('onb_confirm_password_label')}
          value={confirmPassword}
          onChange={setConfirmPassword}
        />

        {confirmPassword.length > 0 && password !== confirmPassword && (
          <p className="text-[15px] font-bold text-destructive px-2">{t('onb_passwords_dont_match')}</p>
        )}

        <Button
          onClick={handleSaveNewPassword}
          disabled={isSavingPassword}
          size="lg"
          className={primaryButtonClass}
        >
          {isSavingPassword ? t('onb_sending_in_progress') : t('onb_reset_password_button')}
          {!isSavingPassword && <ArrowRight className="w-5 h-5" />}
        </Button>
      </AuthLayout>
    );
  }

  /* ---------------- Slides plein écran -------------------------------- */

  if (screen === 'slides') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <AnimatePresence mode="wait">
          <motion.div
            key={slideIndex}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            <img
              src={slides[slideIndex].image}
              alt={slides[slideIndex].title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
          </motion.div>
        </AnimatePresence>

        <div className="relative z-10 flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <button
            type="button"
            onClick={() => goTo('welcome')}
            aria-label={t('a11y_back')}
            className="w-12 h-12 rounded-2xl text-white hover:bg-white/15 backdrop-blur-sm flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex gap-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSlideIndex(idx)}
                aria-label={`${idx + 1}`}
                className={`h-2.5 rounded-full transition-all ${
                  slideIndex === idx ? 'w-8 bg-white' : 'w-2.5 bg-white/45'
                }`}
              />
            ))}
          </div>

          <div className="w-12" />
        </div>

        <div className="relative z-10 mt-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] space-y-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={`text-${slideIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: 0.15, duration: 0.35 }}
              className="space-y-3"
            >
              <h2 className="text-3xl font-serif font-bold text-white leading-tight drop-shadow-lg text-balance">
                {slides[slideIndex].title}
              </h2>
              <p className="text-white/85 text-base leading-relaxed max-w-sm font-medium drop-shadow-md">
                {slides[slideIndex].description}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => goTo('register')}
              className="text-white/85 hover:text-white hover:bg-white/10 rounded-full"
            >
              {t('onb_skip')}
            </Button>
            <Button
              size="lg"
              onClick={() => {
                if (slideIndex < slides.length - 1) setSlideIndex(prev => prev + 1);
                else goTo('register');
              }}
              className="flex-1 bg-white hover:bg-white/90 text-brand-deep rounded-full gap-2"
            >
              {slideIndex === slides.length - 1 ? t('onb_got_it') : t('onb_next')}
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- Bienvenue & avatar -------------------------------- */

  return (
    <div
      className={`w-full min-h-screen md:min-h-0 md:my-10 md:mx-auto flex flex-col justify-between bg-background px-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] md:px-10 md:pt-10 md:pb-10 relative overflow-hidden md:rounded-3xl md:shadow-elevated transition-all duration-500 ${
        screen === 'avatar' ? 'md:max-w-4xl' : 'md:max-w-xl'
      }`}
    >
      <div className="z-10 flex items-center justify-between gap-3">
        {screen === 'welcome' ? (
          <>
            <div />
            <LanguageSwitcher value={language} onChange={setLanguage} variant="pill" />
          </>
        ) : (
          backButton('register')
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center my-4 z-10">
        <AnimatePresence mode="wait">

          {screen === 'welcome' && (
            <motion.div key="welcome" {...fade} className="text-center space-y-8 py-4">
              <div className="relative mx-auto w-44 h-44 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-eganye-beige" />
                <motion.div
                  className="absolute inset-6 rounded-full border-[1.5px] border-dashed border-brand/25"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 46, repeat: Infinity, ease: 'linear' }}
                />
                <motion.img
                  src="/logo-mark.png"
                  alt="eganyé"
                  className="relative w-24 h-24 object-contain"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                />
              </div>

              <div className="space-y-3">
                <h1 className="text-5xl font-serif font-bold text-foreground tracking-tight lowercase">eganyé</h1>
                <p className="text-base leading-relaxed text-muted-foreground font-medium max-w-sm mx-auto">
                  {t('onb_welcome_desc')}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <Button
                  onClick={() => goTo('slides')}
                  size="lg"
                  className="w-full rounded-full gradient-sunset text-white glow-orange gap-2"
                >
                  {t('onb_discover_eganye')}
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <Button
                  onClick={() => goTo('login')}
                  variant="outline"
                  size="lg"
                  className="w-full rounded-full border-border bg-card text-foreground hover:bg-muted"
                >
                  {t('onb_already_have_account')}
                </Button>
              </div>
            </motion.div>
          )}

          {screen === 'avatar' && (
            <motion.div key="avatar" {...fade} className="w-full space-y-7">
              <AvatarWorkshop
                value={avatar}
                onChange={setAvatar}
                name={displayName}
                allowPhotoUpload={false}
              />
              <Button
                onClick={handleFinishOnboarding}
                disabled={isCreatingAccount || isLoading}
                size="lg"
                className="w-full rounded-full gradient-sunset text-white glow-orange gap-2"
              >
                {isCreatingAccount || isLoading ? t('onb_creating_account') : t('onb_create_account_cta')}
                {!(isCreatingAccount || isLoading) && <ArrowRight className="w-5 h-5" />}
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
