import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, createChannel } from '@/lib/supabase';
import { mapContributionRow, mapWalletTransactionRow } from '@/lib/mappers';
import { Group, UserProfile, WalletTransaction, Contribution } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, Wallet, Landmark, Calendar, ChevronDown } from 'lucide-react';
import { useLanguage, LanguageCode } from '@/contexts/LanguageContext';

interface DashboardChartsProps {
  user: UserProfile;
  groups: Group[];
}

const MONTHS_BY_LANG: Record<LanguageCode, string[]> = {
  fr: ['Janv', 'Févr', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ee: ['Dzv', 'Dzd', 'Ted', 'Afɔ', 'Dam', 'Mas', 'Sia', 'Deasi', 'Any', 'Kel', 'Ade', 'Dzm'],
  kbp: ['Oza', 'Ake', 'Maa', 'Ave', 'Mee', 'Zui', 'Zul', 'Aou', 'Sep', 'Okt', 'Noo', 'Dee'],
};

export function DashboardCharts({ user, groups }: DashboardChartsProps) {
  const { t, language } = useLanguage();
  const getMonthName = (dateString: string) => {
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return t('chart_none');
      return `${MONTHS_BY_LANG[language][d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return t('chart_none');
    }
  };
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('balance');

  // Load Wallet Transactions
  useEffect(() => {
    if (!user?.uid) return;

    const fetchTx = async () => {
      const { data, error } = await supabase.from('wallet_transactions').select('*').eq('user_id', user.uid);
      if (error) {
        console.error('Error fetching transactions:', error);
        return;
      }
      const completedTxs = (data ?? [])
        .map(mapWalletTransactionRow)
        .filter(t => t.status === 'completed')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setTransactions(completedTxs);
    };
    fetchTx();

    const channel = createChannel(`dashboard-tx-${user.uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${user.uid}` }, () => fetchTx())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.uid]);

  // Load Group Contributions (all groups the user is member of)
  useEffect(() => {
    if (!groups || groups.length === 0) {
      setContributions([]);
      return;
    }

    const groupIds = groups.map((g) => g.id);

    const fetchContributions = async () => {
      const { data, error } = await supabase.from('contributions').select('*').in('group_id', groupIds);
      if (error) {
        console.error('Error fetching contributions:', error);
        return;
      }
      setContributions((data ?? []).map(mapContributionRow));
    };
    fetchContributions();

    const channel = createChannel(`dashboard-contributions-${groupIds.join('-')}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contributions' }, () => fetchContributions())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groups]);

  // Set default selected group once groups are loaded
  useEffect(() => {
    if (groups.length > 0 && selectedGroupId === 'all') {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups]);

  // 1. Process overall balance evolution
  const balanceData = useMemo(() => {
    if (transactions.length === 0) {
      // Fallback: If no transactions yet, show starting from 0 to current balance
      const now = new Date();
      const past = new Date();
      past.setMonth(past.getMonth() - 2);
      const prev = new Date();
      prev.setMonth(prev.getMonth() - 1);

      return [
        { name: getMonthName(past.toISOString()), Balance: 0 },
        { name: getMonthName(prev.toISOString()), Balance: Math.round(user.walletBalance * 0.4) },
        { name: getMonthName(now.toISOString()), Balance: user.walletBalance }
      ];
    }

    const data: { name: string; Balance: number }[] = [];
    let runningBalance = 0;

    // Sort chronologically and accumulate
    transactions.forEach((tx) => {
      // amount can be positive or negative
      runningBalance += tx.amount;
      const monthName = getMonthName(tx.date);

      const existing = data.find(d => d.name === monthName);
      if (existing) {
        existing.Balance = runningBalance;
      } else {
        data.push({ name: monthName, Balance: runningBalance });
      }
    });

    // Verify if last point is current month, if not append current balance
    const currentMonth = getMonthName(new Date().toISOString());
    const lastPoint = data[data.length - 1];
    if (!lastPoint || lastPoint.name !== currentMonth) {
      data.push({ name: currentMonth, Balance: user.walletBalance });
    } else {
      lastPoint.Balance = user.walletBalance;
    }

    return data;
  }, [transactions, user.walletBalance, language]);

  const paidLabel = t('status_paid');
  const pendingLabel = t('status_pending');

  // 2. Process group monthly contributions
  const contributionData = useMemo(() => {
    const selectedGroupObj = groups.find(g => g.id === selectedGroupId);

    // Filter contributions by selected group
    const filtered = selectedGroupId === 'all'
      ? contributions
      : contributions.filter(c => c.groupId === selectedGroupId);

    if (filtered.length === 0) {
      // Return beautiful sample/empty state data based on group contribution amount
      const now = new Date();
      const baseAmount = selectedGroupObj ? selectedGroupObj.contributionAmount : 10000;
      return Array.from({ length: 3 }).map((_, i) => {
        const d = new Date();
        d.setMonth(now.getMonth() - (2 - i));
        const monthName = getMonthName(d.toISOString());
        return {
          name: monthName,
          [paidLabel]: 0,
          [pendingLabel]: baseAmount,
        };
      });
    }

    // Group by month
    const monthlyGroups: { [month: string]: { paid: number; pending: number } } = {};

    filtered.forEach((c) => {
      const monthName = getMonthName(c.date);
      if (!monthlyGroups[monthName]) {
        monthlyGroups[monthName] = { paid: 0, pending: 0 };
      }

      const amount = Number(c.amount) || 0;
      if (c.status === 'paid') {
        monthlyGroups[monthName].paid += amount;
      } else {
        monthlyGroups[monthName].pending += amount;
      }
    });

    // Convert to sorted array based on year-month order
    return Object.keys(monthlyGroups)
      .map(month => ({
        name: month,
        [paidLabel]: monthlyGroups[month].paid,
        [pendingLabel]: monthlyGroups[month].pending
      }));
  }, [contributions, selectedGroupId, groups, language, paidLabel, pendingLabel]);

  // Total calculated statistics
  const currentGroup = groups.find(g => g.id === selectedGroupId);

  const formatCurrency = (value: number) => {
    return `${value.toLocaleString()} FCFA`;
  };

  const tooltipStyle = {
    backgroundColor: 'var(--card)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
    fontFamily: 'Inter, sans-serif',
    color: 'var(--foreground)',
  };
  const labelStyle = { color: 'var(--foreground)', fontWeight: 700 };

  return (
    <Card className="bg-card border border-border shadow-sm rounded-3xl overflow-hidden animate-in fade-in duration-300">
      <CardHeader className="pb-4 bg-muted/40 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <CardTitle className="font-serif text-lg font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-secondary" />
            {t('chart_title')}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground font-medium">
            {t('chart_subtitle')}
          </CardDescription>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="bg-muted p-0.5 rounded-xl h-9">
            <TabsTrigger
              value="balance"
              className="rounded-lg text-xs font-bold px-3 py-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              {t('chart_tab_balance')}
            </TabsTrigger>
            <TabsTrigger
              value="contributions"
              className="rounded-lg text-xs font-bold px-3 py-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              {t('chart_tab_contributions')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

          {/* TAB 1: BALANCE EVOLUTION */}
          <TabsContent value="balance" className="mt-0 outline-none">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-muted border border-border rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">{t('chart_wallet_balance')}</p>
                  <p className="font-serif font-extrabold text-base text-foreground">{formatCurrency(user.walletBalance)}</p>
                </div>
              </div>
              <div className="p-4 bg-muted border border-border rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">{t('chart_total_saved')}</p>
                  <p className="font-serif font-extrabold text-base text-foreground">{formatCurrency(user.totalSaved)}</p>
                </div>
              </div>
              <div className="p-4 bg-muted border border-border rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-eganye-gold/10 flex items-center justify-center text-eganye-gold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">{t('chart_last_transaction')}</p>
                  <p className="font-serif font-bold text-sm text-foreground">
                    {transactions.length > 0
                      ? new Date(transactions[transactions.length - 1].date).toLocaleDateString(language === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })
                      : t('chart_none')}
                  </p>
                </div>
              </div>
            </div>

            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={balanceData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--ink-soft)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--ink-soft)"
                    fontSize={11}
                    tickFormatter={(val) => `${(val / 1000).toLocaleString()}k`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={labelStyle}
                    formatter={(value: any) => [formatCurrency(Number(value)), t('chart_tooltip_balance')]}
                  />
                  <Line
                    type="monotone"
                    dataKey="Balance"
                    stroke="var(--secondary)"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }}
                    activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--secondary)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            </motion.div>
          </TabsContent>

          {/* TAB 2: MONTHLY CONTRIBUTIONS */}
          <TabsContent value="contributions" className="mt-0 outline-none">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground uppercase">{t('chart_circle_label')}</span>
                <div className="relative inline-block">
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    aria-label={t('chart_circle_label')}
                    title={t('chart_circle_label')}
                    className="appearance-none bg-muted hover:bg-muted/70 transition-colors text-xs font-bold text-foreground pl-3 pr-8 py-1.5 rounded-xl border-none cursor-pointer focus:outline-none"
                  >
                    <option value="all">{t('chart_all_circles')}</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 pointer-events-none text-foreground" />
                </div>
              </div>

              {currentGroup && (
                <div className="text-xs font-semibold text-brand bg-brand/10 px-3 py-1 rounded-xl">
                  {t('chart_recurring_contribution')} {formatCurrency(currentGroup.contributionAmount)} ({currentGroup.frequency})
                </div>
              )}
            </div>

            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={contributionData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--ink-soft)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--ink-soft)"
                    fontSize={11}
                    tickFormatter={(val) => `${(val / 1000).toLocaleString()}k`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={labelStyle}
                    formatter={(value: any) => [formatCurrency(Number(value))]}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--foreground)' }}
                  />
                  <Bar dataKey={paidLabel} fill="var(--secondary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey={pendingLabel} fill="var(--brand)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            </motion.div>
          </TabsContent>

        </Tabs>
      </CardContent>
    </Card>
  );
}
