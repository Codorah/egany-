import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { EganyeIcon } from './ui/EganyeIcon';
import { UserProfile } from '@/types';

/**
 * Ré-authentification avant l'administration.
 *
 * Le panneau était déjà réservé au rôle `admin`, côté écran comme côté base
 * (toutes les policies passent par is_admin()). Ce qui manquait, c'est une
 * seconde barrière contre le cas le plus banal : un téléphone déverrouillé,
 * une session laissée ouverte sur un poste partagé. La session suffisait
 * alors à ajuster des soldes et à promouvoir des administrateurs.
 *
 * Volontairement, ce n'est PAS un second couple identifiant/mot de passe.
 * Un deuxième jeu de secrets se stocke mal, se partage, ne se révoque pas et
 * finit en dur quelque part. On redemande donc le mot de passe du compte,
 * vérifié par Supabase — l'autorité reste la même, et la révocation aussi.
 *
 * Le déverrouillage vaut pour l'onglet courant seulement : `sessionStorage`
 * disparaît à sa fermeture, là où `localStorage` survivrait des semaines.
 */

const UNLOCK_KEY = 'eganye_admin_unlocked';

interface AdminGateProps {
  user: UserProfile;
  children: React.ReactNode;
  onCancel: () => void;
}

export function AdminGate({ user, children, onCancel }: AdminGateProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(UNLOCK_KEY) === user.uid) setUnlocked(true);
    } catch {
      // Navigation privée ou stockage bloqué : on redemande, simplement.
    }
  }, [user.uid]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // L'adresse doit être celle du compte déjà connecté. Sans ce contrôle,
    // saisir les identifiants d'un autre compte changerait de session en
    // douce depuis cet écran.
    if (email.trim().toLowerCase() !== (user.email || '').toLowerCase()) {
      setError('Ces identifiants ne correspondent pas au compte connecté.');
      return;
    }

    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError('Mot de passe incorrect.');
        return;
      }

      // Le rôle est relu en base, jamais déduit de l'écran : une valeur
      // héritée d'un ancien chargement ne doit pas ouvrir l'administration.
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.uid)
        .single();

      if (profile?.role !== 'admin') {
        setError('Ce compte n’a pas les droits d’administration.');
        return;
      }

      try {
        sessionStorage.setItem(UNLOCK_KEY, user.uid);
      } catch {
        // Sans stockage, l'accès reste valable le temps de l'affichage.
      }
      setPassword('');
      setUnlocked(true);
    } catch {
      setError('Vérification impossible. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-5 py-10">
      <motion.form
        onSubmit={handleUnlock}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white dark:bg-card rounded-3xl p-6 border border-[#EFE2D0] dark:border-border/80 shadow-soft space-y-5"
      >
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-[#FFF4E5] text-[#C96F4A] flex items-center justify-center">
            <EganyeIcon name="shield" size={24} />
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <h2 className="text-base font-serif font-black text-foreground">Espace d’administration</h2>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Confirmez votre identité pour continuer.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-foreground">Adresse e-mail</Label>
          <Input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl h-11 text-sm"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-foreground">Mot de passe</Label>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl h-11 text-sm"
            required
          />
        </div>

        {error && (
          <p className="text-[13px] text-danger font-medium text-center" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <Button
            type="submit"
            disabled={busy}
            className="btn-shine gradient-sunset w-full h-11 rounded-2xl font-bold text-sm text-white cursor-pointer"
          >
            {busy ? 'Vérification...' : 'Déverrouiller'}
          </Button>
          <Button
            type="button"
            onClick={onCancel}
            variant="ghost"
            className="w-full h-10 rounded-2xl font-bold text-xs text-muted-foreground cursor-pointer"
          >
            Retour
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
