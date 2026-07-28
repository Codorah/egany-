import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Bot, Sparkles, Send, Activity, AlertTriangle, ShieldCheck, ArrowRight, MessageSquare, Bell, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

export function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'Bonjour ! Je suis votre Copilote IA Eganyé 🤖. J\'analyse vos cercles de tontine en temps réel et je vous aide à gérer la caisse, rappeler les cotisations en retard et préparer le prochain tour de distribution.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const newMsg: Message = { id: Date.now().toString(), sender: 'user', text: query };
    setMessages(prev => [...prev, newMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    setTimeout(() => {
      let responseText = "Je viens d'analyser vos cercles. La santé globale de vos tontines est excellente à 92%.";

      if (query.toLowerCase().includes('rappel') || query.toLowerCase().includes('retard')) {
        responseText = "📩 Les rappels intelligents ont été générés. Vous pouvez cliquer pour envoyer un SMS/WhatsApp direct aux membres en retard :\n'👋 Bonjour, votre cotisation de 5 000 FCFA pour le Cercle est en attente. Réglez maintenant ou declarez votre paiement en espèces.'";
      } else if (query.toLowerCase().includes('caisse') || query.toLowerCase().includes('bilan')) {
        responseText = "📊 Bilan de Caisse Consolidated :\n- Total Cotisé : 450 000 FCFA\n- Total Distribué : 300 000 FCFA\n- Solde disponible : 150 000 FCFA\n- Taux de ponctualité : 95%";
      } else if (query.toLowerCase().includes('tour') || query.toLowerCase().includes('prochain')) {
        responseText = "🎁 Le prochain tour de décaissement (Tour 3) est prévu pour le 15 du mois d'un montant de 120 000 FCFA.";
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: responseText
      }]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto flex flex-col min-h-[calc(100vh-140px)]">
      {/* Copilote Header */}
      <div className="gradient-sunset p-6 rounded-3xl border border-amber-900/20 shadow-elevated text-white shrink-0 flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-xs">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-serif font-black flex items-center gap-2">
              Copilote IA Eganyé <span className="text-[10px] uppercase bg-white/20 px-2 py-0.5 rounded-full font-bold tracking-widest">Opérationnel</span>
            </h1>
          </div>
          <p className="text-white/80 text-xs font-medium">
            Assistant trésorerie, rappels intelligents et analyse prédictive de risque.
          </p>
        </div>
      </div>

      {/* Operational Treasury Alerts */}
      <div className="bg-card border border-border/80 rounded-3xl p-5 shadow-soft space-y-4 shrink-0">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Détection & Santé des Cercles
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl space-y-2">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-foreground">1 Cotisation en attente (Cercle des Mamans)</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  1 membre n'a pas encore cotisé pour ce cycle. Échéance dans 2 jours.
                </p>
                <Button
                  onClick={() => handleSend('Envoyer un rappel de cotisation')}
                  size="sm"
                  className="mt-2.5 h-8 text-[11px] font-bold gradient-sunset text-white rounded-xl shadow-xs"
                >
                  <Bell className="w-3.5 h-3.5 mr-1" /> Relancer le membre
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl space-y-2">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-foreground">Santé de caisse excellente (98%)</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Tous les autres versements sont validés. Continuité recommandée.
                </p>
                <Button
                  onClick={() => handleSend('Générer le bilan de caisse')}
                  variant="outline"
                  size="sm"
                  className="mt-2.5 h-8 text-[11px] font-bold border-border text-foreground rounded-xl"
                >
                  <FileText className="w-3.5 h-3.5 mr-1" /> Générer le Bilan
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => handleSend('Envoyer les rappels de cotisation')}
          className="px-3.5 py-2 rounded-2xl bg-card border border-border text-xs font-bold text-foreground hover:bg-muted/50 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <Bell className="w-3.5 h-3.5 text-primary" /> Rappels Intelligents
        </button>
        <button
          onClick={() => handleSend('Générer le bilan de caisse')}
          className="px-3.5 py-2 rounded-2xl bg-card border border-border text-xs font-bold text-foreground hover:bg-muted/50 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5 text-emerald-500" /> Bilan de Caisse
        </button>
        <button
          onClick={() => handleSend('Préparer le prochain tour')}
          className="px-3.5 py-2 rounded-2xl bg-card border border-border text-xs font-bold text-foreground hover:bg-muted/50 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Prochain Tour
        </button>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 bg-card border border-border/80 rounded-3xl shadow-soft flex flex-col overflow-hidden min-h-[300px]">
        <div className="p-4 border-b border-border/60 bg-muted/20 flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Conversation Copilote IA</span>
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-3.5 rounded-2xl text-xs whitespace-pre-line leading-relaxed ${
                  m.sender === 'user'
                    ? 'gradient-sunset text-white rounded-br-none font-medium'
                    : 'bg-muted/40 text-foreground border border-border/60 rounded-bl-none font-normal'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted/40 text-muted-foreground p-3 rounded-2xl text-xs animate-pulse">
                Le Copilote IA analyse les données...
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border/60 bg-card flex gap-2">
          <Input
            placeholder="Posez une question sur la caisse ou les cotisations..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="rounded-2xl h-11 text-xs border-border/80 focus-visible:ring-primary"
          />
          <Button onClick={() => handleSend()} className="gradient-sunset text-white rounded-2xl h-11 px-4 cursor-pointer">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
