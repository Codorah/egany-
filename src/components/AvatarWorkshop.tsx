import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Eye, 
  RefreshCw, 
  Sliders, 
  Check, 
  Sparkle,
  Dribbble,
  Palette,
  Briefcase
} from 'lucide-react';
import { 
  CustomAvatar, 
  AvatarConfig, 
  SKIN_PALETTE, 
  ROLES,
  PRIMARY_COLORS,
  BACKGROUND_COLORS,
  DEFAULT_AVATAR 
} from './CustomAvatar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AvatarWorkshopProps {
  value: AvatarConfig;
  onChange: (config: AvatarConfig) => void;
  onSave?: () => void;
  isSaving?: boolean;
  saveLabel?: string;
}

type WorkshopCategory = 'role' | 'skin' | 'primaryColor' | 'background';

export function AvatarWorkshop({ 
  value, 
  onChange, 
  onSave, 
  isSaving = false,
  saveLabel = "Valider cet avatar" 
}: AvatarWorkshopProps) {
  const [activeCategory, setActiveCategory] = useState<WorkshopCategory>('role');
  const [zoom, setZoom] = useState<number>(1.1);
  const [rotation, setRotation] = useState<number>(0);
  const [showInCircle, setShowInCircle] = useState<boolean>(false);

  const handleReset = () => {
    onChange({ ...DEFAULT_AVATAR });
    setZoom(1.1);
    setRotation(0);
    toast.info("Avatar réinitialisé aux valeurs d'origine !");
  };

  const handleRandomize = () => {
    const randomSkin = SKIN_PALETTE[Math.floor(Math.random() * SKIN_PALETTE.length)].value;
    const randomRole = ROLES[Math.floor(Math.random() * ROLES.length)].id as AvatarConfig['role'];
    const randomColor = PRIMARY_COLORS[Math.floor(Math.random() * PRIMARY_COLORS.length)].value;
    const randomBg = BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)].value;

    onChange({
      skin: randomSkin,
      role: randomRole,
      primaryColor: randomColor,
      background: randomBg
    });

    setRotation(prev => prev + 360);
    toast.success("Nouveau profil généré !");
  };

  const updateField = (field: keyof AvatarConfig, val: any) => {
    onChange({
      ...value,
      [field]: val
    });
  };

  const categories: { id: WorkshopCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'role', label: 'Profil / Métier', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'skin', label: 'Teint Peau', icon: <Sparkle className="w-4 h-4" /> },
    { id: 'primaryColor', label: 'Couleur Habit', icon: <Palette className="w-4 h-4" /> },
    { id: 'background', label: 'Fond', icon: <Dribbble className="w-4 h-4" /> },
  ];

  return (
    <div className="w-full flex flex-col space-y-6 animate-in fade-in duration-300">
      
      {/* Header section with tools */}
      <div className="flex items-center justify-between border-b border-border dark:border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-success-soft dark:bg-success-soft rounded-xl">
            <Sparkles className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground dark:text-foreground tracking-tight">
              Mon Identité Visuelle
            </h3>
            <p className="text-[10px] text-muted-foreground dark:text-muted-foreground font-medium">
              Choisissez un avatar qui raconte votre histoire
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            type="button"
            onClick={handleRandomize}
            className="p-2 text-muted-foreground hover:text-brand rounded-xl bg-muted hover:bg-chip transition-all flex items-center gap-1 text-[11px] font-bold cursor-pointer border border-border"
            title="Aléatoire"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mixer</span>
          </button>
          
          <button 
            type="button"
            onClick={handleReset}
            className="p-2 text-muted-foreground hover:text-danger rounded-xl bg-muted hover:bg-chip transition-all flex items-center gap-1 text-[11px] font-bold cursor-pointer border border-border"
            title="Réinitialiser"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Large Centered Avatar Area */}
        <div className="md:col-span-5 flex flex-col items-center space-y-4">
          <div className="relative w-full max-w-[220px] aspect-square rounded-3xl bg-muted dark:bg-muted p-4 border border-border/40 dark:border-border shadow-md flex items-center justify-center overflow-hidden group">
            
            <div className="absolute inset-2 rounded-2xl border border-dashed border-border dark:border-border pointer-events-none" />
            
            <motion.div
              style={{ scale: zoom, rotate: rotation }}
              className="transition-transform duration-300 ease-out"
            >
              {showInCircle ? (
                <div className="relative p-2.5 rounded-full bg-brand/10 border-4 border-secondary shadow-lg">
                  <CustomAvatar config={value} size={140} />
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-secondary text-white text-[8px] font-black px-2 py-0.5 rounded-full tracking-wide uppercase shadow-xs">
                    Tontine
                  </div>
                </div>
              ) : (
                <CustomAvatar config={value} size={150} />
              )}
            </motion.div>

            <div className="absolute top-3 right-3 text-brand animate-pulse pointer-events-none">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>

          <div className="w-full max-w-[220px] bg-muted/80 dark:bg-muted rounded-2xl p-3 border border-border dark:border-border space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground dark:text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-brand" />
                <span>Angle & Zoom</span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setZoom(prev => Math.max(0.8, prev - 0.1))}
                  className="p-1 hover:bg-border dark:hover:bg-border rounded text-muted-foreground dark:text-foreground"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setZoom(prev => Math.min(1.4, prev + 0.1))}
                  className="p-1 hover:bg-border dark:hover:bg-border rounded text-muted-foreground dark:text-foreground"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground dark:text-muted-foreground font-bold uppercase min-w-[32px]">Incliner</span>
              <input 
                type="range" 
                min="-30" 
                max="30" 
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="flex-1 h-1 bg-border rounded-lg appearance-none cursor-pointer accent-brand"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowInCircle(!showInCircle)}
              className={`w-full py-1.5 px-3 rounded-xl border text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                showInCircle 
                  ? 'bg-success-soft dark:bg-success-soft border-secondary text-secondary' 
                  : 'bg-card border-border dark:border-border text-muted-foreground dark:text-foreground hover:bg-muted dark:hover:bg-muted'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {showInCircle ? "Aperçu standard" : "Aperçu profil"}
            </button>
          </div>
        </div>

        {/* Right Side: Options */}
        <div className="md:col-span-7 flex flex-col space-y-4">
          
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none snap-x max-w-full">
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full font-bold text-xs whitespace-nowrap snap-center transition-all duration-300 cursor-pointer border ${
                    isActive 
                      ? 'bg-gradient-to-r from-secondary to-success-deep text-white border-transparent shadow-md scale-102'
                      : 'bg-muted dark:bg-card border-border/50 dark:border-border text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="bg-muted/50 dark:bg-muted/50 rounded-2xl border border-border dark:border-border p-4 min-h-[160px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="w-full"
              >
                
                {/* 1. ROLES */}
                {activeCategory === 'role' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Profil Socio-Professionnel</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ROLES.map((item) => {
                        const isSel = value.role === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => updateField('role', item.id)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all duration-350 cursor-pointer ${
                              isSel 
                                ? 'bg-brand/10 border-brand text-brand font-extrabold shadow-sm scale-102' 
                                : 'bg-card border-border text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            <span>{item.name}</span>
                            {isSel && (
                              <motion.div layoutId="selRole" className="w-1.5 h-1.5 rounded-full bg-brand" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. SKIN */}
                {activeCategory === 'skin' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Teint de peau</span>
                    <div className="flex gap-3 flex-wrap">
                      {SKIN_PALETTE.map((item) => {
                        const isSel = value.skin === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => updateField('skin', item.value)}
                            className={`w-10 h-10 rounded-full border-2 transition-all relative flex items-center justify-center cursor-pointer ${
                              isSel ? 'border-brand scale-110 shadow-md' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: item.value }}
                            title={item.name}
                          >
                            {isSel && (
                              <div className="w-4 h-4 bg-white/90 rounded-full flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-foreground" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. CLOTHING COLORS */}
                {activeCategory === 'primaryColor' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Couleur Dominante</span>
                    <div className="flex gap-3 flex-wrap">
                      {PRIMARY_COLORS.map((item) => {
                        const isSel = value.primaryColor === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => updateField('primaryColor', item.value)}
                            className={`w-10 h-10 rounded-full border-2 transition-all relative flex items-center justify-center cursor-pointer ${
                              isSel ? 'border-brand scale-110 shadow-md' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: item.value }}
                            title={item.name}
                          >
                            {isSel && (
                              <div className="w-4 h-4 bg-white/90 rounded-full flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-foreground" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. BACKGROUND COLORS */}
                {activeCategory === 'background' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Couleur d'arrière-plan</span>
                    <div className="flex gap-3 flex-wrap">
                      {BACKGROUND_COLORS.map((item) => {
                        const isSel = value.background === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => updateField('background', item.value)}
                            className={`w-10 h-10 rounded-full border-2 transition-all relative flex items-center justify-center cursor-pointer ${
                              isSel ? 'border-brand scale-110 shadow-md' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: item.value }}
                            title={item.name}
                          >
                            {isSel && (
                              <div className="w-4 h-4 bg-white/90 rounded-full flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-foreground" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>

          {/* Validation trigger */}
          {onSave && (
            <div className="pt-3">
              <Button 
                onClick={onSave} 
                disabled={isSaving}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-2xl h-12 flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer transition-all hover:scale-[1.01]"
              >
                {isSaving ? "Enregistrement..." : saveLabel}
                <Check className="w-5 h-5 stroke-[2.5]" />
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
