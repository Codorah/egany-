import React, { useState } from 'react';
import { motion, Variants } from 'motion/react';
import { Group, UserProfile } from '@/types';
import { EganyeIcon } from '@/components/ui/EganyeIcon';
import { CreateGroupDialog } from './CreateGroupDialog';
import { EmptyState } from './ui/EmptyState';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface CircleHubProps {
  user: UserProfile;
  groups: Group[];
  onSelectGroup: (id: string) => void;
  onNavigateToVerification: () => void;
  onSearch: () => void;
  onJoinByCode: (code: string) => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};

const itemVariants: Variants = {
  hidden: { y: 12, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 140, damping: 18 } },
};

export function CircleHub({
  user,
  groups,
  onSelectGroup,
  onNavigateToVerification,
  onSearch,
  onJoinByCode,
}: CircleHubProps) {
  const { t } = useLanguage();
  const [joinCode, setJoinCode] = useState('');
  const [showJoinPanel, setShowJoinPanel] = useState(false);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim();
    if (!code) {
      toast.error(t('cir_join_empty_code_error') || 'Veuillez saisir un code d’invitation valide.');
      return;
    }
    onJoinByCode(code);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4 sm:space-y-5 pb-20"
    >
      {/* ── 1. HEADER : Mes cercles + Créer un cercle ── */}
      <motion.div variants={itemVariants} className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-black text-foreground tracking-tight">
            {t('nav_circles') || 'Mes cercles'}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium">
            {t('cir_page_subtitle') || 'Épargne collective, solidarité et tontines.'}
          </p>
        </div>

        <CreateGroupDialog
          onNavigateToVerification={onNavigateToVerification}
          triggerIsNativeButton
          trigger={
            <button
              type="button"
              className="bg-gradient-to-r from-[#C96F4A] to-[#B8623E] hover:from-[#B8623E] hover:to-[#A95636] text-white font-bold text-xs sm:text-sm h-10 px-4 rounded-2xl shadow-sm flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95"
            >
              <EganyeIcon name="plus" size={16} strokeWidth={2.5} />
              <span>Créer un cercle</span>
            </button>
          }
        />
      </motion.div>

      {/* ── 2. ACTIONS BAR : Recherche & Rejoindre ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={onSearch}
          className="bg-white dark:bg-card border border-[#EFE2D0] dark:border-border/80 rounded-2xl p-3 shadow-soft flex items-center gap-2.5 text-left hover:border-[#C96F4A]/40 transition-colors cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#F8F0E4] dark:bg-muted text-[#C96F4A] flex items-center justify-center shrink-0">
            <EganyeIcon name="search" size={17} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-xs sm:text-sm text-foreground group-hover:text-[#C96F4A] transition-colors truncate">
              Rechercher
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              Découvrir des cercles
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setShowJoinPanel(!showJoinPanel)}
          className={`bg-white dark:bg-card border rounded-2xl p-3 shadow-soft flex items-center gap-2.5 text-left transition-colors cursor-pointer group ${
            showJoinPanel ? 'border-[#C96F4A] ring-2 ring-[#C96F4A]/15' : 'border-[#EFE2D0] dark:border-border/80 hover:border-[#C96F4A]/40'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-[#EBF5EA] text-[#718A68] flex items-center justify-center shrink-0">
            <EganyeIcon name="qr-code" size={17} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-xs sm:text-sm text-foreground group-hover:text-[#718A68] transition-colors truncate">
              Rejoindre
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              Par code ou QR
            </p>
          </div>
        </button>
      </motion.div>

      {/* ── 3. PANNEAU DE SAISIE DE CODE ── */}
      {showJoinPanel && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-white dark:bg-card border border-[#C96F4A]/30 rounded-2xl p-4 shadow-soft space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-sm text-foreground flex items-center gap-2">
              <EganyeIcon name="code" size={16} className="text-[#C96F4A]" />
              <span>{t('cir_join_section_title') || 'Rejoindre un cercle'}</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowJoinPanel(false)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Fermer
            </button>
          </div>
          <form onSubmit={handleJoinSubmit} className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Code (ex: A8F9K2)"
              className="flex-1 h-11 px-3.5 rounded-xl border border-border text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-[#C96F4A]/30"
              autoFocus
            />
            <button
              type="submit"
              className="h-11 px-4 rounded-xl bg-gradient-to-r from-[#C96F4A] to-[#B8623E] text-white font-bold text-xs cursor-pointer shadow-sm active:scale-95 transition-transform"
            >
              Valider
            </button>
          </form>
          <p className="text-[11px] text-muted-foreground">
            Vous avez reçu un code ou un lien d'invitation ? Entrez-le ici pour accéder au cercle.
          </p>
        </motion.div>
      )}

      {/* ── 4. LISTE DES CERCLES ── */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="font-serif font-black text-base sm:text-lg text-foreground tracking-tight">
            {t('active_circles') || 'Cercles actifs'} ({groups.length})
          </h2>
        </div>

        {groups.length === 0 ? (
          <CreateGroupDialog
            onNavigateToVerification={onNavigateToVerification}
            trigger={
              <div>
                <EmptyState
                  illustration="no-circles"
                  title={t('no_circle_title') || 'Aucun cercle pour le moment'}
                  description={t('no_circle_desc') || 'Créez votre première tontine pour épargner à plusieurs ou rejoignez un groupe existant.'}
                  actionText={t('create_first_circle') || 'Créer mon premier cercle'}
                  onAction={() => {}}
                />
              </div>
            }
          />
        ) : (
          <div className="space-y-2.5">
            {groups.map((group) => {
              const myPosition = group.payoutOrder.indexOf(user.uid);
              const isMyTurnNext = myPosition === group.currentPayoutIndex;

              return (
                <div
                  key={group.id}
                  onClick={() => onSelectGroup(group.id)}
                  className="bg-white dark:bg-card border border-[#EFE2D0] dark:border-border/80 rounded-2xl p-4 shadow-soft flex items-center justify-between gap-3 hover:border-[#C96F4A]/40 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F8F0E4] to-[#EFE2D0] text-[#718A68] flex items-center justify-center shrink-0 font-serif font-black text-base border border-[#EFE2D0]">
                      {group.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-foreground text-sm sm:text-base truncate group-hover:text-[#C96F4A] transition-colors">
                          {group.name}
                        </h3>
                        {group.isPrivate && (
                          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Privé
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        {group.members.length} membres · {group.contributionAmount.toLocaleString()} FCFA / {group.frequency === 'monthly' ? 'mois' : 'cycle'}
                      </p>
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5 flex items-center gap-1.5">
                        <span>Échéance : {format(new Date(group.nextPayoutDate), 'dd MMM yyyy', { locale: fr })}</span>
                        {isMyTurnNext && (
                          <span className="text-[#718A68] font-bold">· C'est votre tour !</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#EBF5EA] text-[#718A68] border border-[#718A68]/25">
                      Actif
                    </span>
                    <EganyeIcon
                      name="chevron-right"
                      size={16}
                      className="text-muted-foreground group-hover:text-[#C96F4A] transition-colors"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
