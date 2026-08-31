import React from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Bell, Check, Trash2, Clock, MessageCircle, DollarSign, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const { notifications, unreadCount, markAsRead, deleteNotification } = useNotifications(userId);

  const getIcon = (type: string) => {
    switch (type) {
      case 'reminder':
        return <Clock className="w-4 h-4 text-brand" />;
      case 'chat':
        return <MessageCircle className="w-4 h-4 text-blue-500" />;
      case 'payout':
        return <DollarSign className="w-4 h-4 text-secondary" />;
      default:
        return <Info className="w-4 h-4 text-eganye-gold" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="ghost" size="icon" className="relative group cursor-pointer hover:bg-chip/30">
          <Bell className="w-5 h-5 text-foreground group-hover:scale-110 transition-transform" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-danger text-white font-bold text-[13px] rounded-full animate-pulse border-2 border-card">
              {unreadCount}
            </Badge>
          )}
        </Button>
      } />
      <DropdownMenuContent align="end" className="w-[320px] p-0 overflow-hidden rounded-3xl bg-card shadow-xl border border-border">
        <div className="flex items-center justify-between p-4 bg-chip/15">
          <h3 className="font-serif font-bold text-sm text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-[13px] bg-brand/10 text-brand px-2.5 py-0.5 rounded-full font-bold">
              {unreadCount} nouvelles
            </span>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <ScrollArea className="h-[350px]">
          {notifications.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <Bell className="w-8 h-8 opacity-25 text-foreground" />
              <p className="font-medium text-xs">Pas encore de notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`relative p-4 transition-colors hover:bg-chip/5 flex gap-3 ${
                    !notification.read ? 'bg-brand/5' : ''
                  }`}
                >
                  <div className="mt-1 shrink-0">{getIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug mb-1 text-foreground ${!notification.read ? 'font-bold' : 'font-semibold'}`}>
                      {notification.title}
                    </p>
                    <p className="text-[13px] text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-muted-foreground flex items-center gap-1">
                        {notification.createdAt
                          ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: fr })
                          : "À l'instant"}
                      </span>
                      <div className="flex items-center gap-1">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full hover:bg-success-soft text-secondary cursor-pointer"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check className="h-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full hover:bg-danger-soft text-danger cursor-pointer"
                          onClick={() => deleteNotification(notification.id)}
                        >
                          <Trash2 className="h-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
