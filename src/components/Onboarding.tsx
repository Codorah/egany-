import { AID_ENABLED } from '@/lib/features';
import { setRecoveryInProgress } from '@/lib/recoveryFlag';
import React, { useCallback, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { LanguageSwitcher } from './ui/LanguageSwitcher';
import { EganyeLogo } from './ui/EganyeLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LegalDocumentDialog from './LegalDocumentDialog';
import type { LegalDocId } from '@/lib/legalDocuments';
import {
  ArrowLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Gift,
  HandCoins,
  Link2,
  Users,
} from 'lucide-react';
import {
  signInWithEmail,
  sendPasswordResetCode,
  verifyPasswordResetCode,
  changePassword,
  supabase
} from '@/lib/supabase';
import { fetchPlatformSettings } from '@/lib/platformSettings';
import { notifyUser } from '@/lib/notify';
import { useBackHandler } from '@/hooks/useBackHandler';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

/** Ce que la personne veut faire en arrivant : un cercle, ou de l'argent pour son activité. */
export type OnboardingIntent = 'create' | 'join' | 'aid' | 'credit';

interface OnboardingProps {
  /** L'intention choisie après la création du compte est renvoyée à la fin, pour que
   * l'app ouvre directement le bon endroit plutôt qu'un accueil vide. */
  onComplete: (intent?: OnboardingIntent) => void;
  isLoading?: boolean;
  /** Écran d'ouverture : depuis la page d'accueil web, « Commencer » mène à
   * l'inscription (« intent », conservé pour App) et « Se connecter » à la connexion. */
  initialScreen?: 'welcome' | 'intent' | 'login';
}

/**
 * Inscription : accueil, compte, code, intention. La photo se choisit plus tard dans le
 * Profil. L'intention vient après le compte : on ne pose pas de question à quelqu'un qui
 * n'est pas encore entré.
 */
type Screen =
  | 'welcome'
  | 'intent'
  | 'login'
  | 'register'
  | 'otp-signup'
  | 'forgot'
  | 'otp-recovery'
  | 'reset';

// Longueur fixée par la configuration Auth du projet Supabase (templates
// « Confirm signup » et « Reset password » qui utilisent {{ .Token }}).
const OTP_LENGTH = 8;

const BACK_TARGET: Partial<Record<Screen, Screen>> = {
  login: 'welcome',
  register: 'welcome',
  forgot: 'login',
  'otp-signup': 'register',
  'otp-recovery': 'forgot',
  reset: 'login',
};

const PRIMARY = 'w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-[15px] hover:bg-primary/90';
const TEXT_LINK = 'w-full min-h-11 inline-flex items-center justify-center text-[15px] font-bold text-primary-ink cursor-pointer disabled:opacity-50';

/* -------------------------------------------------------------------- */
/* Fragments d'écran                                                     */
/*                                                                       */
/* Ils vivent au niveau du module, pas dans Onboarding : un composant    */
/* défini dans le corps d'un autre est recréé à chaque rendu, ce qui     */
/* démonte puis remonte ses <input> : le champ perdrait le focus à       */
/* chaque lettre tapée.                                                  */
/* -------------------------------------------------------------------- */

/** Barre plate, titre, formulaire, lien en bas. Sur ordinateur : colonne de la largeur d'un téléphone. */
function AuthLayout({
  onBack, backLabel, title, desc, children, footer,
}: {
  onBack?: () => void;
  backLabel: string;
  title: string;
  desc?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full min-h-dvh md:flex md:items-center md:justify-center md:py-8 md:bg-muted/50">
      <div className="w-full min-h-dvh md:min-h-[640px] md:max-w-[440px] md:rounded-2xl md:border md:border-border bg-background flex flex-col pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <header className="h-14 shrink-0 px-2 flex items-center">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={backLabel}
              className="w-11 h-11 rounded-xl flex items-center justify-center text-foreground hover:bg-muted cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-11 h-11" />
          )}
          <span className="flex-1 text-center text-[15px] font-bold text-foreground">eganyé</span>
          <div className="w-11 h-11" />
        </header>

        <main className="flex-1 flex flex-col px-5 pt-4">
          <h1 className="text-2xl leading-tight font-bold text-foreground text-balance">{title}</h1>
          {desc && <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{desc}</p>}
          <div className="mt-6 space-y-4">{children}</div>
          {footer && <div className="mt-auto pt-6">{footer}</div>}
        </main>
      </div>
    </div>
  );
}

function Field({
  id, label, type = 'text', value, onChange, autoComplete, inputMode, enterKeyHint, trailing,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  enterKeyHint?: React.InputHTMLAttributes<HTMLInputElement>['enterKeyHint'];
  trailing?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-bold text-foreground">{label}</label>
      <div className="relative">
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          autoCapitalize={type === 'email' ? 'none' : undefined}
          autoCorrect={type === 'email' ? 'off' : undefined}
          className={`h-12 rounded-xl bg-card text-base px-4 ${trailing ? 'pr-12' : ''}`}
        />
        {trailing}
      </div>
    </div>
  );
}

export function Onboarding({ onComplete, isLoading = false, initialScreen = 'welcome' }: OnboardingProps) {
  const { language, setLanguage, t } = useLanguage();

  const reduceMotion = useReducedMotion();
  const [screen, setScreen] = useState<Screen>(initialScreen === 'intent' ? 'register' : initialScreen);
  // Lien d'invitation : App affiche déjà l'écran « rejoindre » ; on ne pose aucune
  // question et on n'appelle pas onComplete, qui changerait de vue.
  const [hasInvite] = useState(() => Boolean(new URLSearchParams(window.location.search).get('join')));

  // Champs partagés par les différents écrans
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [legalModal, setLegalModal] = useState<LegalDocId | null>(null);

  const [otpCode, setOtpCode] = useState('');

  const passwordChecks = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const isPasswordStrongEnough = Object.values(passwordChecks).every(Boolean);

  const missingRules = ([
    ['length', 'onb_pw_req_length'],
    ['uppercase', 'onb_pw_req_uppercase'],
    ['lowercase', 'onb_pw_req_lowercase'],
    ['digit', 'onb_pw_req_digit'],
    ['special', 'onb_pw_req_special'],
  ] as const).filter(([key]) => !passwordChecks[key]).map(([, label]) => t(label));

  const goTo = (next: Screen) => {
    setOtpCode('');
    setScreen(next);
  };

  // Le compte existe dès la validation du code : App ouvrirait alors l'application.
  // Ce drapeau, déjà utilisé pour le mot de passe oublié, garde cet écran monté le temps
  // de poser la dernière question.
  const holdForIntent = () => {
    if (!hasInvite) setRecoveryInProgress(true);
  };

  const finishWithIntent = (chosen: OnboardingIntent) => {
    setRecoveryInProgress(false);
    onComplete(chosen);
  };

  const goBack = useCallback(() => {
    const target = BACK_TARGET[screen];
    if (!target) return false;
    if (screen === 'reset') {
      // On quitte la réinitialisation : la session temporaire n'a plus lieu d'être.
      setRecoveryInProgress(false);
      void supabase.auth.signOut();
    }
    setOtpCode('');
    setScreen(target);
    return true;
  }, [screen]);
  useBackHandler(goBack, Boolean(BACK_TARGET[screen]));

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */

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
    void handleFinishOnboarding();
  };

  const finalizeAccountSetup = async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        language,
        theme: (localStorage.getItem('eganye_theme') as 'light' | 'dark') || 'light',
      })
      .eq('id', userId);
    if (error) throw error;

    // Première entrée du fil d'activité : sans elle, un compte tout neuf
    // ouvre un écran Activité vide, ce qui donne l'impression que rien n'a
    // fonctionné. L'échec d'envoi n'est pas bloquant, le compte existe déjà.
    notifyUser({
      userId,
      title: 'Bienvenue sur eganyé',
      message: 'Votre compte est créé. Rejoignez un cercle ou créez le vôtre pour commencer à épargner.',
      type: 'system',
    }).catch((err) => console.warn('Welcome notification skipped:', err));

    toast.success(t('onb_account_created_success'));
    if (!hasInvite) goTo('intent');
  };

  const handleFinishOnboarding = async () => {
    setIsCreatingAccount(true);
    try {
      holdForIntent();
      const { allowSignups } = await fetchPlatformSettings();
      if (!allowSignups) {
        setRecoveryInProgress(false);
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

      // Adresse déjà inscrite et confirmée : Supabase ne renvoie pas d'erreur
      // (pour ne pas révéler quels e-mails ont un compte), mais un utilisateur
      // factice sans identité, et n'envoie AUCUN code. Sans ce contrôle, la
      // personne attendait sur l'écran du code et « Renvoyer » ne faisait rien.
      if (data.user && (data.user.identities ?? []).length === 0) {
        toast.error(t('onb_email_already_registered'), {
          action: { label: t('nav_login'), onClick: () => goTo('login') }
        });
        setRecoveryInProgress(false);
        goTo('login');
        return;
      }

      if (!data.session) {
        // Confirmation email active : Supabase a envoyé un code, pas de session.
        setRecoveryInProgress(false);
        toast.success(`${t('onb_otp_sent_prefix')} ${OTP_LENGTH} ${t('onb_otp_sent_mid')} ${email}.`);
        goTo('otp-signup');
        return;
      }

      await finalizeAccountSetup(data.user!.id);
    } catch (err: any) {
      console.error('Signup error:', err);
      setRecoveryInProgress(false);
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
    const code = otpCode;
    if (code.length !== OTP_LENGTH) {
      toast.error(`${t('onb_enter_otp_digits_prefix')} ${OTP_LENGTH} ${t('onb_enter_otp_digits_suffix')}`);
      return;
    }
    setIsVerifyingOtp(true);
    try {
      holdForIntent();
      const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
      if (error) throw error;
      await finalizeAccountSetup(data.user!.id);
    } catch (err: any) {
      console.error('OTP verification error:', err);
      setRecoveryInProgress(false);
      toast.error(t('onb_otp_invalid'));
      setOtpCode('');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    setIsResendingOtp(true);
    try {
      const { error } =
        screen === 'otp-recovery'
          ? await sendPasswordResetCode(email)
          : await supabase.auth.resend({ type: 'signup', email });
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
    const code = otpCode;
    if (code.length !== OTP_LENGTH) {
      toast.error(`${t('onb_enter_otp_digits_prefix')} ${OTP_LENGTH} ${t('onb_enter_otp_digits_suffix')}`);
      return;
    }
    setIsVerifyingOtp(true);
    try {
      // Le code échange contre une session ; c'est elle qui autorise ensuite
      // l'écriture du nouveau mot de passe.
      setRecoveryInProgress(true);
      const { error } = await verifyPasswordResetCode(email, code);
      if (error) throw error;
      setPassword('');
      setConfirmPassword('');
      setScreen('reset');
    } catch (err: any) {
      setRecoveryInProgress(false);
      console.error('Recovery OTP error:', err);
      toast.error(t('onb_otp_invalid'));
      setOtpCode('');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSaveNewPassword = async () => {
    // Même règle qu'à l'inscription.
    if (!isPasswordStrongEnough) {
      toast.error(t('onb_pw_not_strong_enough'));
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
      setRecoveryInProgress(false);
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
  /* Fragments réutilisés                                                */
  /* ------------------------------------------------------------------ */

  const eyeToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      aria-label={showPassword ? t('a11y_hide_password') : t('a11y_show_password')}
      className="absolute right-0.5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
    >
      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
    </button>
  );

  const passwordRules = missingRules.length > 0 && (
    <p className="text-[13px] leading-snug text-muted-foreground" aria-live="polite">
      {t('onb_pw_missing')} {missingRules.join(' · ')}
    </p>
  );

  const onSubmit = (action: () => void) => (e: React.FormEvent) => {
    e.preventDefault();
    action();
  };

  const legalLink = (doc: LegalDocId, label: string) => (
    <button
      type="button"
      onClick={() => setLegalModal(doc)}
      className="font-bold text-foreground underline underline-offset-2 cursor-pointer"
    >
      {label}
    </button>
  );

  /* ------------------------------------------------------------------ */
  /* Écrans                                                              */
  /* ------------------------------------------------------------------ */

  const renderScreen = () => {
    if (screen === 'login') {
      return (
        <AuthLayout
          onBack={goBack}
          backLabel={t('a11y_back')}
          title={t('onb_login_title')}
          footer={
            <button type="button" onClick={() => goTo('register')} className={TEXT_LINK}>
              {t('onb_no_account_yet')}
            </button>
          }
        >
          <form noValidate onSubmit={onSubmit(handleLogin)} className="space-y-4">
            <Field id="lg_email" type="email" inputMode="email" autoComplete="email" enterKeyHint="next" label={t('prof_email_address_label')} value={email} onChange={setEmail} />
            <Field id="lg_pass" type={showPassword ? 'text' : 'password'} autoComplete="current-password" enterKeyHint="go" label={t('onb_password_label')} value={password} onChange={setPassword} trailing={eyeToggle} />
            <Button type="submit" disabled={isSubmittingAuth} className={PRIMARY}>
              {isSubmittingAuth ? t('onb_connecting_ellipsis') : t('nav_login')}
            </Button>
            <button type="button" onClick={() => goTo('forgot')} className={TEXT_LINK}>
              {t('onb_forgot_title')}
            </button>
          </form>
        </AuthLayout>
      );
    }

    if (screen === 'register') {
      const busy = isCreatingAccount || isLoading;
      return (
        <AuthLayout
          onBack={goBack}
          backLabel={t('a11y_back')}
          title={t('onb_signup_title')}
          footer={
            <button type="button" onClick={() => goTo('login')} className={TEXT_LINK}>
              {t('onb_already_account_login')}
            </button>
          }
        >
          <form noValidate onSubmit={onSubmit(handleRegisterNext)} className="space-y-4">
            <Field id="rg_name" autoComplete="name" enterKeyHint="next" label={t('prof_username_nickname')} value={displayName} onChange={setDisplayName} />
            <Field id="rg_email" type="email" inputMode="email" autoComplete="email" enterKeyHint="next" label={t('prof_email_address_label')} value={email} onChange={setEmail} />
            <div className="space-y-1.5">
              <Field id="rg_pass" type={showPassword ? 'text' : 'password'} autoComplete="new-password" enterKeyHint="go" label={t('onb_password_label')} value={password} onChange={setPassword} trailing={eyeToggle} />
              {passwordRules}
            </div>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {t('onb_terms_prefix')} {legalLink('cgu', t('onb_terms_link'))} {t('onb_terms_and')} {legalLink('confidentialite', t('onb_privacy_link'))}.
            </p>
            <Button type="submit" disabled={busy} className={PRIMARY}>
              {busy ? t('onb_creating_account') : t('onb_create_account_cta')}
            </Button>
          </form>
        </AuthLayout>
      );
    }

    if (screen === 'forgot') {
      return (
        <AuthLayout
          onBack={goBack}
          backLabel={t('a11y_back')}
          title={t('onb_forgot_title')}
          desc={t('onb_forgot_desc')}
        >
          <form noValidate onSubmit={onSubmit(handleSendResetCode)} className="space-y-4">
            <Field id="fp_email" type="email" inputMode="email" autoComplete="email" enterKeyHint="send" label={t('prof_email_address_label')} value={email} onChange={setEmail} />
            <Button type="submit" disabled={isSendingReset} className={PRIMARY}>
              {isSendingReset ? t('onb_sending_in_progress') : t('onb_send_code')}
            </Button>
          </form>
        </AuthLayout>
      );
    }

    if (screen === 'otp-signup' || screen === 'otp-recovery') {
      const isRecovery = screen === 'otp-recovery';
      return (
        <AuthLayout
          onBack={goBack}
          backLabel={t('a11y_back')}
          title={t('onb_verify_email_title')}
          desc={`${t('onb_code_received_prefix')} ${email}`}
          footer={
            <button type="button" onClick={handleResendOtp} disabled={isResendingOtp} className={TEXT_LINK}>
              {isResendingOtp ? t('onb_sending_in_progress') : t('onb_resend_code')}
            </button>
          }
        >
          <form noValidate onSubmit={onSubmit(isRecovery ? handleVerifyRecoveryOtp : handleVerifySignupOtp)} className="space-y-4">
            <Input
              id="otp_code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              enterKeyHint="go"
              aria-label={t('onb_verify_email_title')}
              maxLength={OTP_LENGTH}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
              className="h-14 rounded-xl bg-card text-center text-2xl font-bold tabular-nums tracking-[0.3em]"
            />
            <Button type="submit" disabled={isVerifyingOtp || isCreatingAccount} className={PRIMARY}>
              {isVerifyingOtp ? t('onb_verifying_ellipsis') : t('onb_verify_code_button')}
            </Button>
          </form>
        </AuthLayout>
      );
    }

    if (screen === 'reset') {
      return (
        <AuthLayout
          onBack={goBack}
          backLabel={t('a11y_back')}
          title={t('onb_reset_title')}
          desc={t('onb_reset_desc')}
        >
          <form noValidate onSubmit={onSubmit(handleSaveNewPassword)} className="space-y-4">
            <div className="space-y-1.5">
              <Field id="np_pass" type={showPassword ? 'text' : 'password'} autoComplete="new-password" enterKeyHint="next" label={t('onb_password_label')} value={password} onChange={setPassword} trailing={eyeToggle} />
              {passwordRules}
            </div>
            <Field id="np_confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" enterKeyHint="go" label={t('onb_confirm_password_label')} value={confirmPassword} onChange={setConfirmPassword} />
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-[13px] font-bold text-destructive">{t('onb_passwords_dont_match')}</p>
            )}
            <Button type="submit" disabled={isSavingPassword} className={PRIMARY}>
              {isSavingPassword ? t('onb_sending_in_progress') : t('onb_reset_password_button')}
            </Button>
          </form>
        </AuthLayout>
      );
    }

    if (screen === 'intent') {
      const rows: { key: OnboardingIntent; icon: typeof Users; title: string; desc: string }[] = [
        { key: 'create', icon: Users, title: t('onb_intent_create_title'), desc: t('onb_intent_create_desc') },
        { key: 'join', icon: Link2, title: t('onb_intent_join_title'), desc: t('onb_intent_join_desc') },
        ...(AID_ENABLED ? [{ key: 'aid' as const, icon: Gift, title: t('onb_intent_aid_title'), desc: t('onb_intent_aid_desc') }] : []),
        { key: 'credit', icon: HandCoins, title: t('onb_intent_credit_title'), desc: t('onb_intent_credit_desc') },
      ];
      return (
        <AuthLayout
          backLabel={t('a11y_back')}
          title={t('onb_intent_title')}
          footer={
            // L'onglet Cercles montre le + et le champ code : une bonne entrée sans choix précis.
            <button type="button" onClick={() => finishWithIntent('join')} className={TEXT_LINK}>
              {t('onb_intent_later')}
            </button>
          }
        >
          <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
            {rows.map(({ key, icon: Icon, title, desc }) => (
              <button
                key={key}
                type="button"
                onClick={() => finishWithIntent(key)}
                className="w-full min-h-16 flex items-center gap-3.5 px-4 py-3 text-left cursor-pointer hover:bg-muted/60 active:bg-muted transition-colors duration-150"
              >
                <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-bold text-foreground">{title}</span>
                  <span className="block text-[13px] text-muted-foreground">{desc}</span>
                </span>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </AuthLayout>
      );
    }

    /* Accueil */
    return (
      <div className="w-full min-h-dvh md:flex md:items-center md:justify-center md:py-8 md:bg-muted/50">
        <div className="w-full min-h-dvh md:min-h-[720px] md:max-w-[440px] md:rounded-2xl md:border md:border-border bg-background flex flex-col px-5 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <EganyeLogo size={32} />
              <span className="text-lg font-bold text-foreground">eganyé</span>
            </div>
            <LanguageSwitcher value={language} onChange={setLanguage} variant="pill" />
          </header>

          <main className="flex-1 flex flex-col justify-center py-5">
            <img
              src="/onboarding/vendor.webp"
              alt=""
              draggable={false}
              className="w-full aspect-[4/3] rounded-2xl object-cover object-center"
            />
            <h1 className="mt-6 text-[28px] leading-tight font-bold text-foreground text-balance">{t('onb_welcome_title')}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t('onb_welcome_desc')}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground">{t('onb_welcome_assistant')}</p>
          </main>

          <div className="space-y-2.5">
            <Button onClick={() => goTo('register')} className={PRIMARY}>
              {t('onb_signup_title')}
            </Button>
            <Button
              onClick={() => goTo('login')}
              variant="outline"
              className="w-full h-12 rounded-xl border-border bg-card text-foreground font-bold text-[15px] hover:bg-muted"
            >
              {t('onb_already_have_account')}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <motion.div
        key={screen}
        initial={reduceMotion ? false : { opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {renderScreen()}
      </motion.div>
      {/* Documents légaux, accessibles avant l'inscription (exigé par les stores). */}
      <LegalDocumentDialog docId={legalModal} onClose={() => setLegalModal(null)} />
    </>
  );
}
