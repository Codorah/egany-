import React, { useMemo, useState } from 'react';
import { Group } from '@/types';
import { calculateNextPayoutDate } from '@/lib/disbursements';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CalendarDays, Gift } from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, format, addMonths, subMonths, parseISO, isAfter, isBefore
} from 'date-fns';
import { fr } from 'date-fns/locale';

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
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function CalendarView({ groups, onSelectGroup }: CalendarViewProps) {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-6 h-6" />
            Calendrier des échéances
          </h1>
          <p className="text-muted-foreground text-sm">Vos prochains tours de distribution et cotisations.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base capitalize">{format(currentMonth, 'MMMM yyyy', { locale: fr })}</CardTitle>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(new Date())}>
              <span className="text-[10px] font-bold">Auj.</span>
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted-foreground uppercase mb-1">
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
                  className={`aspect-square rounded-lg border p-1 flex flex-col items-center justify-start text-xs ${
                    inMonth ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-900/30 text-muted-foreground'
                  } ${isToday(day) ? 'border-[#2BB673] border-2' : 'border-slate-100 dark:border-slate-800'}`}
                >
                  <span className={`font-semibold ${isToday(day) ? 'text-[#2BB673]' : ''}`}>{format(day, 'd')}</span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                      {dayEvents.slice(0, 3).map((_, i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#E67E22]" />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Prochaines échéances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucune échéance à venir.</p>
          ) : (
            upcoming.map((event, i) => (
              <div
                key={`${event.groupId}-${i}`}
                onClick={() => onSelectGroup(event.groupId)}
                className="flex items-center justify-between p-3 rounded-xl border hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#2BB673]/10 text-[#2BB673]">
                    <Gift className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{event.groupName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{format(event.date, 'EEEE d MMMM yyyy', { locale: fr })}</p>
                  </div>
                </div>
                <Badge variant="outline">{event.amount.toLocaleString()} {event.currency}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
