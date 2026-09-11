import React, { useMemo, useState } from 'react';
import { Group } from '@/types';
import { calculateNextPayoutDate } from '@/lib/disbursements';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CalendarDays, Gift } from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, format, addMonths, subMonths, parseISO, isAfter, isBefore
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

interface CalendarEvent {
  date: Date;
  groupId: string;
  groupName: string;
  amount: number;
  currency: string;
}

interface CalendarViewProps {
  groups: Group[];
  onSelectGroup: (id: string) => void;
}

const PROJECTED_CYCLES = 6;

export function CalendarView({ groups, onSelectGroup }: CalendarViewProps) {
  const { t } = useLanguage();
  const WEEKDAY_LABELS = [
    t('cal_weekday_mon'),
    t('cal_weekday_tue'),
    t('cal_weekday_wed'),
    t('cal_weekday_thu'),
    t('cal_weekday_fri'),
    t('cal_weekday_sat'),
    t('cal_weekday_sun'),
  ];
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const events = useMemo<CalendarEvent[]>(() => {
    const result: CalendarEvent[] = [];
    for (const group of groups) {
      if (group.status !== 'active') continue;
      let date = group.nextPayoutDate;
      for (let i = 0; i < PROJECTED_CYCLES; i++) {
        result.push({
          date: parseISO(date),
          groupId: group.id,
          groupName: group.name,
          amount: group.contributionAmount * group.members.length,
          currency: group.currency
        });
        if (group.endDate && isAfter(parseISO(date), parseISO(group.endDate))) break;
        date = calculateNextPayoutDate(date, group.frequency);
      }
    }
    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [groups]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = format(event.date, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const upcoming = useMemo(
    () => events.filter((e) => !isBefore(e.date, new Date(new Date().setHours(0, 0, 0, 0)))).slice(0, 10),
    [events]
  );

  return (
    <div className="space-y-4 sm:space-y-5 pb-20">
      <div>
        <h1 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-foreground flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          {t('cal_page_title')}
        </h1>
        <p className="text-[13px] text-muted-foreground font-medium">{t('cal_page_subtitle')}</p>
      </div>

      <div className="glass-card rounded-3xl shadow-soft border border-border/70 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-serif font-black text-foreground capitalize">{format(currentMonth, 'MMMM yyyy', { locale: fr })}</h2>
          <div className="flex gap-1.5">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl cursor-pointer" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-xl text-[13px] font-bold cursor-pointer" onClick={() => setCurrentMonth(new Date())}>
              {t('cal_today_short')}
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl cursor-pointer" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">
          {WEEKDAY_LABELS.map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDay.get(key) || [];
            const inMonth = isSameMonth(day, currentMonth);
            return (
              <div
                key={key}
                className={`aspect-square rounded-xl border p-1 flex flex-col items-center justify-start text-xs transition-colors ${
                  inMonth ? 'bg-card border-border/70' : 'bg-transparent border-transparent text-muted-foreground/60'
                } ${isToday(day) ? 'border-primary border-2' : ''}`}
              >
                <span className={`font-bold ${isToday(day) ? 'text-primary' : ''}`}>{format(day, 'd')}</span>
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                    {dayEvents.slice(0, 3).map((_, i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-brand" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="glass-card rounded-3xl shadow-soft border border-border/70 p-4 sm:p-5 space-y-2">
        <h2 className="text-base font-serif font-black text-foreground">{t('cal_upcoming_title')}</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t('cal_no_upcoming')}</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((event, i) => (
              <div
                key={`${event.groupId}-${i}`}
                onClick={() => onSelectGroup(event.groupId)}
                className="flex items-center justify-between p-3 rounded-2xl border border-border/70 hover:border-brand/40 hover:bg-muted/50 cursor-pointer transition-all active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                    <Gift className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{event.groupName}</p>
                    <p className="text-[12px] text-muted-foreground capitalize">{format(event.date, 'EEEE d MMMM yyyy', { locale: fr })}</p>
                  </div>
                </div>
                <Badge variant="outline" className="rounded-full shrink-0">{event.amount.toLocaleString()} {event.currency}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
