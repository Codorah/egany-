import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Gift,
  HandCoins,
  LockKeyhole,
  MessagesSquare,
  PiggyBank,
  Play,
  ShieldCheck,
  Smartphone,
  Trophy,
  Users,
} from 'lucide-react';
import { EganyeLogo } from './ui/EganyeLogo';
import { APK_DOWNLOAD_URL, PLAY_STORE_PUBLISHED, PLAY_STORE_URL } from '@/lib/links';

/**
 * Page d'accueil du site, pour les visiteurs sur ordinateur.
 *
 * Elle n'apparaît que dans un navigateur de bureau, à une personne non
 * connectée (voir shouldShowLanding dans App) : jamais dans l'application
 * Android, jamais sur téléphone, où l'on arrive directement sur l'accueil
 * de l'app. Les deux boutons mènent au même parcours d'inscription que
 * l'application.
 */
interface LandingProps {
  onStart: () => void;
  onLogin: () => void;
}

const ease = [0.16, 1, 0.3, 1] as const;

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

export function Landing({ onStart, onLogin }: LandingProps) {
  const reduce = useReducedMotion();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans">
      {/* ---------------------------------------------------- Navigation */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border/60">
        <nav className="max-w-7xl mx-auto px-8 h-[72px] flex items-center gap-10">
          <a href="/" className="flex items-center gap-2.5 shrink-0" aria-label="eganyé, accueil">
            <EganyeLogo size={36} />
            <span className="text-2xl font-heading font-black lowercase tracking-tight">eganyé</span>
          </a>
          <div className="flex items-center gap-8 text-sm font-semibold text-muted-foreground">
            <a href="#fonctionnement" className="hover:text-foreground transition-colors">Comment ça marche</a>
            <a href="#services" className="hover:text-foreground transition-colors">Services</a>
            <a href="#argent" className="hover:text-foreground transition-colors">Coup de pouce</a>
            <a href="#securite" className="hover:text-foreground transition-colors">Sécurité</a>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={onLogin}
              className="h-11 px-5 rounded-full text-sm font-bold text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={onStart}
              className="h-11 px-6 rounded-full text-sm font-bold text-white gradient-sunset hover:brightness-105 active:scale-[0.98] transition cursor-pointer"
            >
              Commencer
            </button>
          </div>
        </nav>
      </header>

      <main>
        {/* -------------------------------------------------------- Hero */}
        <section className="max-w-7xl mx-auto px-8 pt-16 pb-24 grid grid-cols-12 gap-10 items-center min-h-[calc(100dvh-72px)]">
          <motion.div
            className="col-span-6 space-y-8"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
          >
            <h1 className="text-5xl xl:text-6xl font-heading font-black tracking-tight leading-[1.05] text-balance">
              Vos tontines, enfin dans votre poche.
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-[46ch]">
              Créez votre cercle d'épargne, cotisez par Flooz ou Mixx et suivez chaque franc, en toute transparence.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onStart}
                className="h-14 px-8 rounded-full text-base font-bold text-white gradient-sunset glow-orange hover:brightness-105 active:scale-[0.98] transition flex items-center gap-2 cursor-pointer"
              >
                Commencer <ArrowRight className="w-5 h-5" />
              </button>
              <a
                href="#video"
                className="h-14 px-7 rounded-full text-base font-bold border-2 border-border bg-card hover:bg-muted transition flex items-center gap-2"
              >
                <Play className="w-5 h-5 fill-current" /> Voir la vidéo
              </a>
              {PLAY_STORE_PUBLISHED ? (
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener"
                  className="h-14 px-7 rounded-full text-base font-bold border-2 border-border bg-card hover:bg-muted transition flex items-center gap-2"
                >
                  <Smartphone className="w-5 h-5" /> Télécharger l'app
                </a>
              ) : (
                <a
                  href={APK_DOWNLOAD_URL}
                  download="eganye.apk"
                  className="h-14 px-7 rounded-full text-base font-bold border-2 border-border bg-card hover:bg-muted transition flex items-center gap-2"
                >
                  <Smartphone className="w-5 h-5" /> App Android (APK)
                </a>
              )}
            </div>
          </motion.div>

          <motion.div
            className="col-span-6 relative"
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.1, ease }}
          >
            <div className="relative ml-auto w-[88%] aspect-[4/5] rounded-[2rem] overflow-hidden shadow-[0_40px_80px_-30px_rgba(169,86,54,0.45)]">
              <img
                src="/onboarding/mamas.webp"
                alt="Commerçantes sur un marché ouest-africain"
                className="w-full h-full object-cover"
                fetchPriority="high"
              />
            </div>
            <div className="absolute -left-2 bottom-12 w-[46%] aspect-square rounded-[2rem] overflow-hidden border-[6px] border-background shadow-xl">
              <img
                src="/onboarding/young-savers.webp"
                alt="Deux jeunes femmes regardant un téléphone en souriant"
                className="w-full h-full object-cover object-top"
                loading="lazy"
              />
            </div>
          </motion.div>
        </section>

        {/* ------------------------------------------------------ Vidéo */}
        {/* Composition et rendu : video/promo.html, video/render.mjs. */}
        <section id="video" className="scroll-mt-20 max-w-6xl mx-auto px-8 pb-24 space-y-10">
          <Reveal>
            <h2 className="text-4xl font-heading font-black tracking-tight leading-tight text-center">
              eganyé en moins de deux minutes.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <video
              className="w-full aspect-video rounded-[2rem] bg-foreground shadow-[0_40px_80px_-30px_rgba(169,86,54,0.45)]"
              src="/video/eganye-presentation.mp4"
              poster="/video/eganye-presentation.jpg"
              controls
              playsInline
              preload="none"
            >
              Votre navigateur ne lit pas cette vidéo.
            </video>
          </Reveal>
        </section>

        {/* ---------------------------------------------- Comment ça marche */}
        <section id="fonctionnement" className="scroll-mt-20 bg-card border-y border-border">
          <div className="max-w-7xl mx-auto px-8 py-24 grid grid-cols-12 gap-16 items-center">
            <Reveal className="col-span-5">
              <div className="aspect-[3/4] rounded-[2rem] overflow-hidden">
                <img src="/onboarding/vendor.webp" alt="Commerçante souriante tenant un téléphone dans sa boutique" className="w-full h-full object-cover" loading="lazy" />
              </div>
            </Reveal>
            <div className="col-span-7 space-y-12">
              <Reveal>
                <h2 className="text-4xl font-heading font-black tracking-tight leading-tight max-w-[18ch]">
                  La tontine que vous connaissez, sans le cahier.
                </h2>
              </Reveal>
              <ol className="space-y-10">
                {[
                  { icon: Users, title: 'Créez ou rejoignez un cercle', body: 'Fixez le montant, la fréquence et l’ordre des tours. Invitez vos proches par lien, code ou QR code.' },
                  { icon: Smartphone, title: 'Cotisez depuis votre téléphone', body: 'Flooz ou Mixx, en quelques secondes. Chaque versement est enregistré et visible par tout le cercle.' },
                  { icon: HandCoins, title: 'Recevez le pot à votre tour', body: 'L’argent arrive sur votre portefeuille eganyé, et vous le retirez vers votre Mobile Money quand vous voulez.' },
                ].map((step, i) => (
                  <Reveal key={step.title} delay={i * 0.08}>
                    <li className="flex gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                        <step.icon className="w-7 h-7" />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-xl font-heading font-bold">{step.title}</h3>
                        <p className="text-muted-foreground leading-relaxed max-w-[52ch]">{step.body}</p>
                      </div>
                    </li>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- Bento */}
        <section id="services" className="scroll-mt-20 max-w-7xl mx-auto px-8 py-24 space-y-12">
          <Reveal>
            <h2 className="text-4xl font-heading font-black tracking-tight leading-tight max-w-[22ch]">
              Tout ce qu'il faut pour épargner ensemble.
            </h2>
          </Reveal>
          <div className="grid grid-cols-6 auto-rows-[220px] gap-5">
            <Reveal className="col-span-4 row-span-2">
              <div className="h-full rounded-[2rem] gradient-sunset text-white p-10 flex flex-col justify-between overflow-hidden relative">
                <img
                  src="/onboarding/mamas.webp"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity pointer-events-none"
                  loading="lazy"
                />
                <Trophy className="w-10 h-10 opacity-90 relative z-10" />
                <div className="space-y-3 relative z-10">
                  <h3 className="text-3xl font-heading font-black leading-tight max-w-[20ch]">Trois façons de choisir qui reçoit le pot</h3>
                  <p className="text-white/90 leading-relaxed max-w-[50ch]">Tour par tour dans l'ordre convenu, tirage au sort équitable, ou enchères pour celles qui en ont besoin plus tôt.</p>
                </div>
              </div>
            </Reveal>
            <Reveal className="col-span-2" delay={0.06}>
              <div className="h-full rounded-[2rem] bg-card border border-border p-7 flex flex-col justify-between">
                <PiggyBank className="w-8 h-8 text-brand" />
                <div className="space-y-1.5">
                  <h3 className="text-lg font-heading font-bold">Ma Banque</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">Des coffres personnels bloqués le temps que vous choisissez, pour ne pas toucher à votre épargne.</p>
                </div>
              </div>
            </Reveal>
            <Reveal className="col-span-2" delay={0.12}>
              <div className="h-full rounded-[2rem] bg-secondary/12 border border-secondary/20 p-7 flex flex-col justify-between">
                <BellRing className="w-8 h-8 text-secondary" />
                <div className="space-y-1.5">
                  <h3 className="text-lg font-heading font-bold">Rappels avant chaque échéance</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">Par notification, SMS ou WhatsApp. Plus personne n'oublie sa cotisation.</p>
                </div>
              </div>
            </Reveal>
            <Reveal className="col-span-3" delay={0.06}>
              <div className="h-full rounded-[2rem] bg-card border border-border p-7 flex items-end gap-6">
                <div className="space-y-1.5 flex-1">
                  <MessagesSquare className="w-8 h-8 text-brand mb-4" />
                  <h3 className="text-lg font-heading font-bold">Discussion et calendrier du cercle</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">Parlez entre membres et voyez d'un coup d'œil qui reçoit et quand.</p>
                </div>
                <CalendarDays className="w-20 h-20 text-brand/15 shrink-0" />
              </div>
            </Reveal>
            <Reveal className="col-span-3" delay={0.12}>
              <div className="h-full rounded-[2rem] overflow-hidden relative">
                <img src="/onboarding/young-savers.webp" alt="" className="absolute inset-0 w-full h-full object-cover object-[50%_40%]" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                <div className="absolute bottom-0 p-7 space-y-1.5 text-white">
                  <h3 className="text-lg font-heading font-bold">Un score qui récompense la régularité</h3>
                  <p className="text-sm text-white/85 leading-relaxed max-w-[40ch]">Chaque cotisation à l'heure fait monter votre réputation et vous ouvre de nouveaux services.</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------- Argent pour son activité */}
        <section id="argent" className="scroll-mt-20 max-w-7xl mx-auto px-8 pb-24">
          <div className="rounded-[2.5rem] bg-brand/[0.07] border border-brand/15 px-14 py-16 space-y-12">
            <Reveal>
              <h2 className="text-4xl font-heading font-black tracking-tight leading-tight max-w-[24ch]">
                Besoin d'argent pour votre activité ?
              </h2>
            </Reveal>
            <div className="grid grid-cols-2 gap-6">
              <Reveal>
                <article className="h-full rounded-[2rem] bg-card border border-border overflow-hidden flex flex-col">
                  <div className="h-56 w-full relative overflow-hidden">
                    <img
                      src="/onboarding/aid-shopkeeper.webp"
                      alt="Commerçante au comptoir de sa boutique"
                      className="w-full h-full object-cover object-center"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-4 left-6 w-12 h-12 rounded-2xl gradient-sunset text-white flex items-center justify-center shadow-elevated">
                      <Gift className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="p-8 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-heading font-black">Coup de pouce</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Dites combien il vous faut et présentez votre activité en vidéo. Notre équipe étudie votre dossier et peut vous offrir le montant : une aide, rien à rembourser.
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground pt-2">Frais d'étude du dossier : 1 000 FCFA.</p>
                  </div>
                </article>
              </Reveal>
              <Reveal delay={0.08}>
                <article className="h-full rounded-[2rem] bg-card border border-border overflow-hidden flex flex-col">
                  <div className="h-56 w-full relative overflow-hidden">
                    <img
                      src="/onboarding/credit-merchant.webp"
                      alt="Commerçant devant son étal de fruits"
                      className="w-full h-full object-cover object-center"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute bottom-4 left-6 w-12 h-12 rounded-2xl bg-secondary text-white flex items-center justify-center shadow-elevated">
                      <HandCoins className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="p-8 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-heading font-black">Microcrédit</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Une demande gratuite, une offre claire. Vous remboursez de 3 à 24 mois et voyez le coût total, au franc près, avant d'accepter.
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground pt-2">Taux annuel de 36 % au maximum, sans autres frais.</p>
                  </div>
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- Sécurité */}
        <section id="securite" className="scroll-mt-20 bg-card border-y border-border">
          <div className="max-w-5xl mx-auto px-8 py-24 space-y-14">
            <Reveal>
              <h2 className="text-4xl font-heading font-black tracking-tight leading-tight text-center max-w-[22ch] mx-auto">
                Votre argent est protégé à chaque étape.
              </h2>
            </Reveal>
            <div className="grid grid-cols-2 gap-x-16 gap-y-10">
              {[
                { icon: LockKeyhole, title: 'Code PIN et empreinte', body: 'Chaque opération sur votre argent est confirmée par vous, et seulement vous.' },
                { icon: ShieldCheck, title: 'Contrôlé côté serveur', body: 'Aucun solde ne peut être modifié depuis l’application : tout passe par des opérations vérifiées et enregistrées.' },
                { icon: Users, title: 'Transparent pour le cercle', body: 'Chaque membre voit qui a cotisé et qui a reçu. Vos coordonnées restent privées.' },
                { icon: Smartphone, title: 'Paiements Mobile Money', body: 'Les dépôts passent par PayDunya, avec Flooz et Mixx. Vos codes ne transitent jamais par eganyé.' },
              ].map((item, i) => (
                <Reveal key={item.title} delay={(i % 2) * 0.08}>
                  <div className="flex gap-5">
                    <item.icon className="w-7 h-7 text-brand shrink-0 mt-1" />
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-heading font-bold">{item.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- Appel final */}
        <section className="max-w-7xl mx-auto px-8 py-24">
          <Reveal>
            <div className="rounded-[2.5rem] gradient-sunset text-white px-16 py-16 flex items-center justify-between gap-10">
              <div className="space-y-3">
                <h2 className="text-4xl font-heading font-black tracking-tight leading-tight">Votre premier cercle en deux minutes.</h2>
                <p className="text-white/85 text-lg">Gratuit à l'inscription, sur téléphone comme sur ordinateur.</p>
              </div>
              <button
                type="button"
                onClick={onStart}
                className="h-14 px-8 rounded-full text-base font-bold bg-white text-brand-deep hover:bg-white/90 active:scale-[0.98] transition flex items-center gap-2 shrink-0 cursor-pointer"
              >
                Commencer <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </Reveal>
        </section>
      </main>

      {/* -------------------------------------------------------- Pied */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-8 py-10 flex items-center justify-between gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <EganyeLogo size={28} />
            <span className="font-heading font-black lowercase text-foreground">eganyé</span>
            <span>Épargner ensemble, au Togo.</span>
          </div>
          <nav className="flex items-center gap-6">
            <a href="/conditions" className="hover:text-foreground">Conditions</a>
            <a href="/confidentialite" className="hover:text-foreground">Confidentialité</a>
            <a href="/suppression-compte" className="hover:text-foreground">Supprimer mon compte</a>
            <a href="/mentions-legales" className="hover:text-foreground">Mentions légales</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
