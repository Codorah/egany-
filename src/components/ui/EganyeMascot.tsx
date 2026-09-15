import React from 'react';
import { motion } from 'motion/react';

export type MascotVariant = 'loading' | 'success' | 'payment' | 'security' | 'empty' | 'saving';

interface EganyeMascotProps {
  variant?: MascotVariant;
  size?: number;
  className?: string;
  message?: string;
}

/**
 * Mascotte officielle de l'application : "Ganyé"
 * Un personnage fintech chaleureux, bienveillant et moderne qui accompagne
 * l'utilisateur à travers toutes les étapes clés (chargement, validation,
 * sécurité, cagnottes et états vides).
 */
export function EganyeMascot({
  variant = 'loading',
  size = 120,
  className = '',
  message,
}: EganyeMascotProps) {
  const renderMascotGraphic = () => {
    switch (variant) {
      case 'loading':
        return (
          <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg viewBox="0 0 100 100" className="w-full h-full select-none" fill="none">
              {/* Aura pulsante douce */}
              <circle cx="50" cy="50" r="44" fill="#F8EFE3" opacity="0.7" />
              <circle cx="50" cy="50" r="36" fill="#F3E2D0" opacity="0.5" />

              {/* Corps & Épaules */}
              <path d="M26 88C26 76 34 68 50 68C66 68 74 76 74 88V94H26V88Z" fill="#C96F4A" />
              {/* Col de chemise crème */}
              <path d="M44 68L50 76L56 68H44Z" fill="#FFFDF9" />

              {/* Cou */}
              <rect x="45" y="56" width="10" height="14" rx="2" fill="#6F472B" />

              {/* Tête */}
              <circle cx="50" cy="42" r="18" fill="#6F472B" />

              {/* Oreilles */}
              <circle cx="32" cy="42" r="3.5" fill="#6F472B" />
              <circle cx="68" cy="42" r="3.5" fill="#6F472B" />

              {/* Casquette / Béret moderne Terracotta */}
              <path d="M30 36C30 25 40 20 50 20C60 20 70 25 70 36C70 37 68 39 50 39C32 39 30 37 30 36Z" fill="#AB5837" />
              <path d="M30 36C34 38 42 39 50 39C58 39 66 38 70 36L72 38C66 41 58 42 50 42C42 42 34 41 28 38L30 36Z" fill="#C96F4A" />
              <circle cx="50" cy="20" r="2.5" fill="#E5A93C" />

              {/* Yeux concentrés / curieux */}
              <circle cx="44" cy="43" r="2" fill="#231710" />
              <circle cx="44.8" cy="42.2" r="0.7" fill="#FFFFFF" />
              <circle cx="56" cy="43" r="2" fill="#231710" />
              <circle cx="56.8" cy="42.2" r="0.7" fill="#FFFFFF" />

              {/* Sourire confiant */}
              <path d="M46 51C48.5 53 51.5 53 54 51" stroke="#231710" strokeWidth="1.6" strokeLinecap="round" />
            </svg>

            {/* Pièce d'or lévitant au-dessus avec animation spring */}
            <motion.div
              animate={{ y: [-4, 4, -4], rotate: [-6, 6, -6] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="absolute -top-1 w-8 h-8 rounded-full bg-gradient-to-tr from-[#E5A93C] to-[#FAD47A] border-2 border-white shadow-md flex items-center justify-center text-white font-serif font-black text-xs select-none"
            >
              E
            </motion.div>
          </div>
        );

      case 'success':
        return (
          <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg viewBox="0 0 100 100" className="w-full h-full select-none" fill="none">
              {/* Confettis festifs */}
              <circle cx="20" cy="22" r="2.5" fill="#E5A93C" />
              <circle cx="80" cy="25" r="2.5" fill="#718A68" />
              <rect x="22" y="40" width="3" height="3" rx="1" fill="#C96F4A" transform="rotate(25 22 40)" />
              <rect x="76" y="38" width="3" height="3" rx="1" fill="#E5A93C" transform="rotate(-30 76 38)" />

              {/* Aura de célébration */}
              <circle cx="50" cy="52" r="40" fill="#EBF5EA" opacity="0.8" />

              {/* Corps & Bras levés de victoire */}
              <path d="M26 88C26 76 34 68 50 68C66 68 74 76 74 88V94H26V88Z" fill="#718A68" />
              {/* Bras levé gauche */}
              <path d="M26 72C20 64 18 52 24 44C26 41 30 43 29 47C25 54 28 62 34 68" fill="#6F472B" />
              {/* Bras levé droit */}
              <path d="M74 72C80 64 82 52 76 44C74 41 70 43 71 47C75 54 72 62 66 68" fill="#6F472B" />

              {/* Cou & Tête */}
              <rect x="45" y="56" width="10" height="14" rx="2" fill="#6F472B" />
              <circle cx="50" cy="42" r="18" fill="#6F472B" />

              {/* Béret festif */}
              <path d="M30 36C30 25 40 20 50 20C60 20 70 25 70 36C70 37 68 39 50 39C32 39 30 37 30 36Z" fill="#C96F4A" />
              <circle cx="50" cy="20" r="2.5" fill="#E5A93C" />

              {/* Yeux rieurs (arcs joyeux) */}
              <path d="M42 43C43.5 40.5 46.5 40.5 48 43" stroke="#231710" strokeWidth="2" strokeLinecap="round" fill="none" />
              <path d="M52 43C53.5 40.5 56.5 40.5 58 43" stroke="#231710" strokeWidth="2" strokeLinecap="round" fill="none" />

              {/* Grand sourire ouvert */}
              <path d="M44 48C44 54 56 54 56 48Z" fill="#231710" />
              <path d="M46 51C47.5 53 52.5 53 54 51" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
            </svg>

            {/* Médaillon d'or victorieux en haut */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{ duration: 0.5, type: 'spring' }}
              className="absolute -top-1 w-9 h-9 rounded-full bg-gradient-to-tr from-[#E5A93C] to-[#FBE297] border-2 border-white shadow-lg flex items-center justify-center text-white font-serif font-black text-xs"
            >
              ✓
            </motion.div>
          </div>
        );

      case 'security':
        return (
          <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg viewBox="0 0 100 100" className="w-full h-full select-none" fill="none">
              <circle cx="50" cy="50" r="42" fill="#FFF7ED" opacity="0.9" />

              {/* Corps */}
              <path d="M26 88C26 76 34 68 50 68C66 68 74 76 74 88V94H26V88Z" fill="#2D1F17" />
              <rect x="45" y="56" width="10" height="14" rx="2" fill="#6F472B" />
              <circle cx="50" cy="42" r="18" fill="#6F472B" />

              {/* Casquette protectrice */}
              <path d="M30 36C30 25 40 20 50 20C60 20 70 25 70 36C70 37 68 39 50 39C32 39 30 37 30 36Z" fill="#C96F4A" />

              {/* Lunettes protectrices / regard sérieux et rassurant */}
              <rect x="40" y="40" width="8" height="6" rx="2" stroke="#231710" strokeWidth="1.6" fill="#FFFDF9" />
              <rect x="52" y="40" width="8" height="6" rx="2" stroke="#231710" strokeWidth="1.6" fill="#FFFDF9" />
              <path d="M48 43H52" stroke="#231710" strokeWidth="1.6" />
              <circle cx="44" cy="43" r="1.5" fill="#231710" />
              <circle cx="56" cy="43" r="1.5" fill="#231710" />

              {/* Sourire rassurant */}
              <path d="M46 51H54" stroke="#231710" strokeWidth="1.8" strokeLinecap="round" />

              {/* Bouclier doré tenu au premier plan */}
              <path d="M50 60L64 66V78C64 86 50 92 50 92C50 92 36 86 36 78V66L50 60Z" fill="#E5A93C" stroke="#FFFDF9" strokeWidth="2" />
              {/* Trou de serrure sur le bouclier */}
              <circle cx="50" cy="74" r="2.5" fill="#2D1F17" />
              <path d="M49 75L48 81H52L51 75Z" fill="#2D1F17" />
            </svg>
          </div>
        );

      case 'empty':
        return (
          <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg viewBox="0 0 100 100" className="w-full h-full select-none" fill="none">
              <circle cx="50" cy="50" r="42" fill="#F8EFE3" opacity="0.8" />
              <path d="M26 88C26 76 34 68 50 68C66 68 74 76 74 88V94H26V88Z" fill="#718A68" />
              <rect x="45" y="56" width="10" height="14" rx="2" fill="#6F472B" />
              <circle cx="50" cy="42" r="18" fill="#6F472B" />
              <path d="M30 36C30 25 40 20 50 20C60 20 70 25 70 36C70 37 68 39 50 39C32 39 30 37 30 36Z" fill="#C96F4A" />

              {/* Yeux curieux vers la droite */}
              <circle cx="45" cy="43" r="2.2" fill="#231710" />
              <circle cx="46" cy="42.5" r="0.8" fill="#FFFFFF" />
              <circle cx="57" cy="43" r="2.2" fill="#231710" />
              <circle cx="58" cy="42.5" r="0.8" fill="#FFFFFF" />

              {/* Petite bouche en "o" curieuse */}
              <circle cx="50" cy="51" r="1.8" stroke="#231710" strokeWidth="1.4" fill="none" />

              {/* Loupe ou carnet d'exploration */}
              <circle cx="68" cy="58" r="8" stroke="#C96F4A" strokeWidth="2.5" fill="#FFFDF9" />
              <path d="M74 64L82 72" stroke="#AB5837" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        );

      case 'payment':
      case 'saving':
      default:
        return (
          <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg viewBox="0 0 100 100" className="w-full h-full select-none" fill="none">
              <circle cx="50" cy="50" r="42" fill="#FFF7ED" opacity="0.8" />
              <path d="M26 88C26 76 34 68 50 68C66 68 74 76 74 88V94H26V88Z" fill="#C96F4A" />
              <rect x="45" y="56" width="10" height="14" rx="2" fill="#6F472B" />
              <circle cx="50" cy="42" r="18" fill="#6F472B" />
              <path d="M30 36C30 25 40 20 50 20C60 20 70 25 70 36C70 37 68 39 50 39C32 39 30 37 30 36Z" fill="#AB5837" />

              {/* Clin d'œil complice */}
              <circle cx="44" cy="43" r="2" fill="#231710" />
              <circle cx="44.8" cy="42.2" r="0.7" fill="#FFFFFF" />
              {/* Oeil droit qui cligne */}
              <path d="M54 44C55.5 42 58.5 42 60 44" stroke="#231710" strokeWidth="2" strokeLinecap="round" fill="none" />

              {/* Sourire éclatant */}
              <path d="M46 50C48 53 52 53 54 50" stroke="#231710" strokeWidth="1.8" strokeLinecap="round" />

              {/* Smartphone ou coffre d'épargne tenu fermement */}
              <rect x="42" y="66" width="16" height="24" rx="3" fill="#2D1F17" stroke="#FFFDF9" strokeWidth="1.5" />
              <circle cx="50" cy="84" r="1.5" fill="#E5A93C" />
              <rect x="45" y="70" width="10" height="10" rx="1" fill="#718A68" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
      {renderMascotGraphic()}
      {message && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-xs font-bold text-muted-foreground max-w-[200px]"
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}
