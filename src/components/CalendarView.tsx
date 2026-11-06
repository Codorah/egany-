import React, { useMemo, useState } from 'react';
import { Group } from '@/types';
import { calculateNextPayoutDate } from '@/lib/disbursements';
import { EganyeIcon } from '@/components/ui/EganyeIcon';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isToday, format, addMonths, subMonths, parseISO, isAfter, isBefore
} from 'date-fns';
import { enUS, fr } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

interface CalendarEvent {
  date: Date;
  groupId: string;
  groupName: string;
  /** Ma cotisation pour cette échéance, pas la cagnotte du cercle. */
  amount: number;
  currency: string;
}

interface CalendarViewProps {
  groups: Group[];
  onSelectGroup: (id: string) => void;
}

const PROJECTED_CYCLES = 6;

export function CalendarView({ groups, onSelectGroup }: CalendarViewProps) {
  const { t, language } = useLanguage();
  const locale = language === 'en' ? enUS : fr;
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
          amount: group.contributionAmount,
          currency: group.currency,
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
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  });

  const upcoming = useMemo(
    () => events.filter((e) => !isBefore(e.date, new Date(new Date().setHours(0, 0, 0, 0)))).slice(0, 10),
    [events]
  );

  const monthButton = 'w-11 h-11 rounded-xl flex items-center justify-center text-foreground cursor-pointer transition-colors duration-150 hover:bg-muted';

  return (
    <div className="space-y-6 pb-4 max-w-lg mx-auto">
      {/* La question de cet écran : quelle est la prochaine date, et combien ? */}
      <section className="space-y-2">
        <h2 className="text-base font-bold text-foreground">{t('cal_upcoming_title')}</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t('cal_no_upcoming')}</p>
        ) : (
          <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
            {upcoming.map((event, i) => (
              <button
                key={`${event.groupId}-${i}`}
                type="button"
                onClick={() => onSelectGroup(event.groupId)}
                className="w-full min-h-[60px] px-4 py-3 flex items-center justify-between gap-3 text-left cursor-pointer transition-colors duration-150 active:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-foreground capitalize">{format(event.date, 'EEEE d MMMM', { locale })}</span>
                  <span className="block text-[13px] text-muted-foreground truncate">{event.groupName}</span>
                </span>
                <span className="text-sm font-bold text-foreground tabular-nums shrink-0">
                  {event.amount.toLocaleString('fr-FR')} {event.currency}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground capitalize">{format(currentMonth, 'MMMM yyyy', { locale })}</h2>
          <div className="flex items-center -mr-2">
            <button type="button" className={monthButton} onClick={() => setCurrentMonth((m) => subMonths(m, 1))} aria-label={t('cal_prev_month')}>
              <EganyeIcon name="chevron-left" size={20} />
            </button>
            <button type="button" className="h-11 px-2 text-[13px] font-bold text-primary-ink cursor-pointer" onClick={() => setCurrentMonth(new Date())}>
              {t('cal_today_short')}
            </button>
            <button type="button" className={monthButton} onClick={() => setCurrentMonth((m) => addMonths(m, 1))} aria-label={t('cal_next_month')}>
              <EganyeIcon name="chevron-right" size={20} />
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-2">
          <div className="grid grid-cols-7 text-center text-[13px] font-semibold text-muted-foreground mb-1">
            {WEEKDAY_LABELS.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDay.get(key) || [];
              const inMonth = isSameMonth(day, currentMonth);
              return (
                <div key={key} className={`h-11 flex flex-col items-center justify-center text-[13px] ${inMonth ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                  <span className={isToday(day) ? 'font-bold text-primary-ink' : ''}>{format(day, 'd')}</span>
                  <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${dayEvents.length > 0 ? 'bg-primary' : 'bg-transparent'}`} />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
