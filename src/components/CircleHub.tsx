import React, { useState } from 'react';
import { motion, Variants } from 'motion/react';
import { Users, Search, KeyRound, ArrowRight } from 'lucide-react';
import { Group, UserProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreateGroupDialog } from './CreateGroupDialog';
import { TontineCard } from './ui/TontineCard';
import { EmptyState } from './ui/EmptyState';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

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

/**
 * Onglet « Cercle » — tout ce qui touche aux tontines de l'utilisatrice :
 * ses cercles, en créer un, en rejoindre un par code, ou en chercher un
 * public. Remplace l'ancien branchement de 'my-circles' sur SearchGroups,
 * qui ne montrait jamais les cercles de la personne (voir audit).
 */
export function CircleHub({ user, groups, onSelectGroup, onNavigateToVerification, onSearch, onJoinByCode }: CircleHubProps) {
  const { t } = useLanguage();
  const [joinCode, setJoinCode] = useState('');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim();
    if (!code) {
      toast.error(t('cir_join_empty_code_error'));
      return;
    }
    onJoinByCode(code);
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4 sm:space-y-5 pb-20">
      <motion.div variants={itemVariants} className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-serif font-black text-foreground tracking-tight">
            {t('active_circles')}
          </h1>
          <p className="text-[13px] text-muted-foreground font-medium">{t('cir_page_subtitle')}</p>
        </div>
        <CreateGroupDialog
          onNavigateToVerification={onNavigateToVerification}
          triggerIsNativeButton
          trigger={
            <Button
              size="sm"
              className="btn-shine gradient-sunset text-white font-bold rounded-xl shadow-xs text-xs h-9 px-3 flex items-center gap-1.5 cursor-pointer"
            >
              <span className="hidden sm:inline">{t('cgd_new_circle_button')}</span>
              <span className="sm:hidden">+</span>
            </Button>
          }
        />
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-2">
        {groups.length === 0 ? (
          <CreateGroupDialog
            onNavigateToVerification={onNavigateToVerification}
            trigger={
              <div>
                <EmptyState
                  icon={Users}
                  title={t('no_circle_title')}
                  description={t('no_circle_desc')}
                  actionText={t('create_first_circle')}
                  onAction={() => {}}
                />
              </div>
            }
          />
        ) : (
          groups.map((group) => (
            <TontineCard key={group.id} group={group} onClick={() => onSelectGroup(group.id)} />
          ))
        )}
      </motion.div>

      <motion.div variants={itemVariants} className="glass-card rounded-3xl shadow-soft border border-border/70 p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-serif font-black text-foreground flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-primary" />
          {t('cir_join_section_title')}
        </h2>
        <form onSubmit={handleJoinSubmit} className="flex gap-2">
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder={t('cir_join_code_placeholder')}
            className="rounded-xl flex-1"
          />
          <Button type="submit" className="btn-shine rounded-xl gap-1.5 shrink-0 cursor-pointer group/join">
            {t('cir_join_button')}
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover/join:translate-x-0.5" />
          </Button>
        </form>
        <button
          type="button"
          onClick={onSearch}
          className="w-full flex items-center justify-center gap-1.5 text-[13px] font-bold text-brand hover:underline cursor-pointer pt-1"
        >
          <Search className="w-3.5 h-3.5" />
          {t('cir_search_link')}
        </button>
      </motion.div>
    </motion.div>
  );
}
