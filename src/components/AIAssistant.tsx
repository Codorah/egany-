import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Bot, Sparkles, Send, Activity, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
      text: 'Bonjour ! Je suis votre Copilote Financier (Bêta). Je peux analyser la santé de vos tontines ou vous conseiller sur la gestion de votre portefeuille. Comment puis-je vous aider ?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = () => {
    if (!input.trim()) return;

    const newMsg: Message = { id: Date.now().toString(), sender: 'user', text: input };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'ai',
        text: 'Ceci est une version bêta. Bientôt, je serai connecté à vos données réelles pour vous fournir une analyse personnalisée basée sur l\'IA. Pour l\'instant, consultez le widget d\'analyse prédictive ci-dessus pour une simulation.'
      }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      <div className="bg-gradient-to-r from-brand to-brand-deep p-6 rounded-3xl border border-brand-light/20 shadow-lg text-white shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            Copilote IA <span className="text-[10px] uppercase bg-white/20 px-2 py-0.5 rounded-full font-bold tracking-widest">Bêta</span>
          </h1>
        </div>
        <p className="text-white/80 text-sm">
          Assistante virtuelle et analyse prédictive des risques pour sécuriser vos investissements.
        </p>
      </div>

      {/* Widget Analyse Prédictive (Simulated) */}
      <div className="bg-card border border-border rounded-3xl p-5 shadow-sm shrink-0">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand" />
          Analyse Prédictive de vos Cercles
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-warning-soft/30 border border-warning/30 p-4 rounded-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-warning-deep">Risque de retard (Tontine Ramadan)</h4>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  D'après l'historique, 2 membres de ce groupe ont souvent des retards à cette période de l'année. Risque estimé : <strong>Moyen (45%)</strong>.
                </p>
                <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold border-warning text-warning-deep hover:bg-warning-soft">
                  Voir les détails
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-success-soft/30 border border-success/30 p-4 rounded-2xl">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-success shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-success-deep">Santé excellente (Projet Immo)</h4>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  Le score de confiance global du groupe est de 98%. Tous les versements sont anticipés. Continuité recommandée.
                </p>
                <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold border-success text-success-deep hover:bg-success-soft">
                  Féliciter le groupe
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 bg-card border border-border rounded-3xl shadow-sm flex flex-col overflow-hidden min-h-[300px]">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-bold text-foreground">Discuter avec l'IA</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                msg.sender === 'user' 
                  ? 'bg-brand text-white rounded-tr-sm' 
                  : 'bg-muted text-foreground border border-border rounded-tl-sm'
              }`}>
                {msg.text}
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted border border-border p-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-brand rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-background border-t border-border flex items-center gap-2">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Posez une question sur vos finances..."
            className="flex-1 rounded-full bg-muted border-border"
          />
          <Button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="rounded-full w-10 h-10 p-0 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
