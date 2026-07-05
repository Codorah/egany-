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
  Smile, 
  User, 
  Sparkle,
  Dribbble,
  Palette,
  Briefcase
} from 'lucide-react';
import { 
  CustomAvatar, 
  AvatarConfig, 
  SKIN_PALETTE, 
  HAIR_TYPES, 
  HAIR_COLORS, 
  EYE_TYPES, 
  CLOTHING_TYPES, 
  CLOTHING_COLORS, 
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

type WorkshopCategory = 'skin' | 'hair' | 'hairColor' | 'eyes' | 'clothing' | 'clothingColor' | 'background' | 'accessories';

export function AvatarWorkshop({ 
  value, 
  onChange, 
  onSave, 
  isSaving = false,
  saveLabel = "Valider cet avatar" 
}: AvatarWorkshopProps) {
  const [activeCategory, setActiveCategory] = useState<WorkshopCategory>('hair');
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
    const randomHair = HAIR_TYPES[Math.floor(Math.random() * HAIR_TYPES.length)].id as AvatarConfig['hair'];
    const randomHairColor = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].value;
    const randomEyes = EYE_TYPES[Math.floor(Math.random() * EYE_TYPES.length)].id as AvatarConfig['eyes'];
    const randomClothing = CLOTHING_TYPES[Math.floor(Math.random() * CLOTHING_TYPES.length)].id as AvatarConfig['clothing'];
    const randomClothingColor = CLOTHING_COLORS[Math.floor(Math.random() * CLOTHING_COLORS.length)].value;
    const randomBg = BACKGROUND_COLORS[Math.floor(Math.random() * BACKGROUND_COLORS.length)].value;
    const randomGlasses = Math.random() > 0.6;
    const randomEarrings = Math.random() > 0.4;

    onChange({
      skin: randomSkin,
      hair: randomHair,
      hairColor: randomHairColor,
      eyes: randomEyes,
      clothing: randomClothing,
      clothingColor: randomClothingColor,
      glasses: randomGlasses,
      earrings: randomEarrings,
      background: randomBg
    });

    // Add a fun rotating animation for randomize feedback
    setRotation(prev => prev + 360);
    toast.success("Nouveau design d'avatar généré !");
  };

  const updateField = (field: keyof AvatarConfig, val: any) => {
    onChange({
      ...value,
      [field]: val
    });
  };

  // List of tabs for customization
  const categories: { id: WorkshopCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'hair', label: 'Coiffure / Foulard', icon: <User className="w-4 h-4" /> },
    { id: 'hairColor', label: 'Teinte Cheveux', icon: <Palette className="w-4 h-4" /> },
    { id: 'skin', label: 'Teint Peau', icon: <Sparkle className="w-4 h-4" /> },
    { id: 'eyes', label: 'Expression', icon: <Smile className="w-4 h-4" /> },
    { id: 'clothing', label: 'Vêtements', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'clothingColor', label: 'Couleur Habit', icon: <Palette className="w-4 h-4" /> },
    { id: 'background', label: 'Fond', icon: <Dribbble className="w-4 h-4" /> },
    { id: 'accessories', label: 'Accessoires', icon: <Sparkles className="w-4 h-4" /> },
  ];

  return (
    <div className="w-full flex flex-col space-y-6 animate-in fade-in duration-300">
      
      {/* Header section with tools */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl">
            <Sparkles className="w-5 h-5 text-[#2BB673] dark:text-[#4ade80]" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">
              Atelier de Dessin d’Avatar
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              Créez votre illustration unique et culturelle
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            type="button"
            onClick={handleRandomize}
            className="p-2 text-slate-500 hover:text-[#E67E22] dark:text-slate-400 dark:hover:text-[#f97316] rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 transition-all flex items-center gap-1 text-[11px] font-bold cursor-pointer border border-slate-200/40 dark:border-slate-800"
            title="Aléatoire"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mixer</span>
          </button>
          
          <button 
            type="button"
            onClick={handleReset}
            className="p-2 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 transition-all flex items-center gap-1 text-[11px] font-bold cursor-pointer border border-slate-200/40 dark:border-slate-800"
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
          <div className="relative w-full max-w-[220px] aspect-square rounded-3xl bg-slate-50 dark:bg-slate-900/60 p-4 border border-slate-200/40 dark:border-slate-800/80 shadow-md flex items-center justify-center overflow-hidden group">
            
            {/* Soft decorative ring */}
            <div className="absolute inset-2 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800/80 pointer-events-none" />
            
            {/* The SVG Avatar wrapper with active zoom & rotation */}
            <motion.div
              style={{ 
                scale: zoom,
                rotate: rotation,
              }}
              className="transition-transform duration-300 ease-out"
            >
              {showInCircle ? (
                // Typical Tontine circle badge preview layout
                <div className="relative p-2.5 rounded-full bg-amber-500/10 border-4 border-[#2BB673] shadow-lg">
                  <CustomAvatar config={value} size={140} />
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#2BB673] text-white text-[8px] font-black px-2 py-0.5 rounded-full tracking-wide uppercase shadow-xs">
                    Tontine
                  </div>
                </div>
              ) : (
                <CustomAvatar config={value} size={150} />
              )}
            </motion.div>

            {/* Sparkles on top */}
            <div className="absolute top-3 right-3 text-amber-500 animate-pulse pointer-events-none">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>

          {/* Interactive controls: zoom, tilt, circle preview */}
          <div className="w-full max-w-[220px] bg-slate-50/80 dark:bg-slate-900/40 rounded-2xl p-3 border border-slate-100 dark:border-slate-800/60 space-y-3">
            
            {/* Zoom / rotation controls */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#E67E22]" />
                <span>Angle & Zoom</span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setZoom(prev => Math.max(0.8, prev - 0.1))}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setZoom(prev => Math.min(1.4, prev + 0.1))}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tilt Slider */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase min-w-[32px]">Incliner</span>
              <input 
                type="range" 
                min="-30" 
                max="30" 
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="flex-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#E67E22]"
              />
            </div>

            {/* Toggle Circle Preview button */}
            <button
              type="button"
              onClick={() => setShowInCircle(!showInCircle)}
              className={`w-full py-1.5 px-3 rounded-xl border text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                showInCircle 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-[#2BB673] text-[#2BB673] dark:text-[#4ade80]' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {showInCircle ? "Aperçu standard" : "Aperçu dans le cercle"}
            </button>
          </div>
        </div>

        {/* Right Side: Options and Customization Grid */}
        <div className="md:col-span-7 flex flex-col space-y-4">
          
          {/* Scrollable Horizontal Categories Tabs */}
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
                      ? 'bg-gradient-to-r from-[#2BB673] to-emerald-600 text-white border-transparent shadow-md scale-102' 
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200/50 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Options Display Container */}
          <div className="bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-slate-100 dark:border-slate-800/60 p-4 min-h-[160px] flex flex-col justify-center">
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="w-full"
              >
                
                {/* 1. HAIR TYPES */}
                {activeCategory === 'hair' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Coupes de Cheveux & Coiffes</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {HAIR_TYPES.map((item) => {
                        const isSel = value.hair === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => updateField('hair', item.id)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all duration-350 cursor-pointer ${
                              isSel 
                                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-500 text-amber-800 dark:text-amber-400 font-extrabold shadow-sm scale-102' 
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span>{item.name}</span>
                            {isSel && (
                              <motion.div layoutId="selHair" className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. HAIR COLORS */}
                {activeCategory === 'hairColor' && (
                  <div className="space-y-3">
                    {['none', 'headwrap', 'hijab'].indexOf(value.hair) !== -1 ? (
                      <div className="text-center py-6">
                        <p className="text-xs text-slate-400 font-medium italic">
                          Cette coiffure (ou couvre-chef) n'affiche pas de couleur de cheveux.
                        </p>
                      </div>
                    ) : (
                      <>
                        <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Teinte de Cheveux</span>
                        <div className="flex gap-3 flex-wrap">
                          {HAIR_COLORS.map((item) => {
                            const isSel = value.hairColor === item.value;
                            return (
                              <button
                                key={item.value}
                                type="button"
                                onClick={() => updateField('hairColor', item.value)}
                                className={`w-10 h-10 rounded-full border-2 transition-all relative flex items-center justify-center cursor-pointer ${
                                  isSel ? 'border-amber-500 scale-110 shadow-md' : 'border-transparent hover:scale-105'
                                }`}
                                style={{ backgroundColor: item.value }}
                                title={item.name}
                              >
                                {isSel && (
                                  <div className="w-4 h-4 bg-white/90 rounded-full flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 text-[#4B2E05]" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium italic mt-2">
                          Sélection actuelle : {HAIR_COLORS.find(c => c.value === value.hairColor)?.name || "Personnalisé"}
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* 3. SKIN PALETTE */}
                {activeCategory === 'skin' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Teint de peau</span>
                    <div className="flex gap-3 flex-wrap">
                      {SKIN_PALETTE.map((item) => {
                        const isSel = value.skin === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => updateField('skin', item.value)}
                            className={`w-10 h-10 rounded-full border-2 transition-all relative flex items-center justify-center cursor-pointer ${
                              isSel ? 'border-amber-500 scale-110 shadow-md' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: item.value }}
                            title={item.name}
                          >
                            {isSel && (
                              <div className="w-4 h-4 bg-white/90 rounded-full flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 text-[#4B2E05]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium italic mt-2">
                      Sélection actuelle : {SKIN_PALETTE.find(c => c.value === value.skin)?.name || "Personnalisé"}
                    </p>
                  </div>
                )}

                {/* 4. EYE TYPES */}
                {activeCategory === 'eyes' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Regard & Expression</span>
                    <div className="grid grid-cols-2 gap-2">
                      {EYE_TYPES.map((item) => {
                        const isSel = value.eyes === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => updateField('eyes', item.id)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all duration-350 cursor-pointer ${
                              isSel 
                                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-500 text-amber-800 dark:text-amber-400 font-extrabold shadow-sm scale-102' 
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span>{item.name}</span>
                            {isSel && (
                              <motion.div layoutId="selEyes" className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 5. CLOTHING TYPES */}
                {activeCategory === 'clothing' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Style Vestimentaire</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {CLOTHING_TYPES.map((item) => {
                        const isSel = value.clothing === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => updateField('clothing', item.id)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all duration-350 cursor-pointer ${
                              isSel 
                                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-500 text-amber-800 dark:text-amber-400 font-extrabold shadow-sm scale-102' 
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span>{item.name}</span>
                            {isSel && (
                              <motion.div layoutId="selClothing" className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 6. CLOTHING COLORS */}
                {activeCategory === 'clothingColor' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Teinte de l'Habit</span>
                    <div className="flex gap-3 flex-wrap">
                      {CLOTHING_COLORS.map((item) => {
                        const isSel = value.clothingColor === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => updateField('clothingColor', item.value)}
                            className={`w-10 h-10 rounded-full border-2 transition-all relative flex items-center justify-center cursor-pointer ${
                              isSel ? 'border-amber-500 scale-110 shadow-md' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: item.value }}
                            title={item.name}
                          >
                            {isSel && (
                              <div className="w-4 h-4 bg-white/90 rounded-full flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 text-[#4B2E05]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium italic mt-2">
                      Sélection actuelle : {CLOTHING_COLORS.find(c => c.value === value.clothingColor)?.name || "Personnalisé"}
                    </p>
                  </div>
                )}

                {/* 7. BACKGROUND COLORS */}
                {activeCategory === 'background' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Couleur d'arrière-plan</span>
                    <div className="flex gap-3 flex-wrap">
                      {BACKGROUND_COLORS.map((item) => {
                        const isSel = value.background === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => updateField('background', item.value)}
                            className={`w-10 h-10 rounded-full border-2 transition-all relative flex items-center justify-center cursor-pointer ${
                              isSel ? 'border-amber-500 scale-110 shadow-md' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: item.value }}
                            title={item.name}
                          >
                            {isSel && (
                              <div className="w-4 h-4 bg-white/90 rounded-full flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 text-[#4B2E05]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium italic mt-2">
                      Sélection actuelle : {BACKGROUND_COLORS.find(c => c.value === value.background)?.name || "Personnalisé"}
                    </p>
                  </div>
                )}

                {/* 8. ACCESSORIES */}
                {activeCategory === 'accessories' && (
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Bijoux & Accessoires</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      
                      {/* Glasses */}
                      <label className="flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 select-none">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            checked={value.glasses} 
                            onChange={(e) => updateField('glasses', e.target.checked)}
                            className="w-4.5 h-4.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500/50"
                          />
                          <span>Lunettes de vue</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">Style moderne</span>
                      </label>

                      {/* Earrings */}
                      <label className="flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 select-none">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            checked={value.earrings} 
                            onChange={(e) => updateField('earrings', e.target.checked)}
                            className="w-4.5 h-4.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500/50"
                          />
                          <span>Boucles d'oreilles dorées</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">Or d'Afrique</span>
                      </label>

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
                className="w-full bg-[#E67E22] hover:bg-[#E67E22]/90 text-white font-black rounded-2xl h-12 flex items-center justify-center gap-2 text-sm shadow-md cursor-pointer transition-all hover:scale-[1.01]"
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
