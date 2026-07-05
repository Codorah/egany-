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
        return <Clock className="w-4 h-4 text-[#E67E22]" />;
      case 'chat':
        return <MessageCircle className="w-4 h-4 text-sky-500" />;
      case 'payout':
        return <DollarSign className="w-4 h-4 text-[#2BB673]" />;
      default:
        return <Info className="w-4 h-4 text-[#D4A574]" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="ghost" size="icon" className="relative group cursor-pointer hover:bg-[#F5E6D3]/30">
          <Bell className="w-5 h-5 text-[#4B2E05] group-hover:scale-110 transition-transform" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600 text-white font-bold text-[10px] rounded-full animate-pulse border-2 border-white">
              {unreadCount}
            </Badge>
          )}
        </Button>
      } />
      <DropdownMenuContent align="end" className="w-[320px] p-0 overflow-hidden rounded-3xl bg-white shadow-xl border border-[#D4A574]/20">
        <div className="flex items-center justify-between p-4 bg-[#F5E6D3]/15">
          <h3 className="font-serif font-bold text-sm text-[#4B2E05]">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-[10px] bg-[#E67E22]/10 text-[#E67E22] px-2.5 py-0.5 rounded-full font-bold">
              {unreadCount} nouvelles
            </span>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <ScrollArea className="h-[350px]">
          {notifications.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
              <Bell className="w-8 h-8 opacity-25 text-[#4B2E05]" />
              <p className="font-medium text-xs">Pas encore de notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`relative p-4 transition-colors hover:bg-[#F5E6D3]/5 flex gap-3 ${
                    !notification.read ? 'bg-[#E67E22]/5' : ''
                  }`}
                >
                  <div className="mt-1 shrink-0">{getIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-snug mb-1 ${!notification.read ? 'font-bold text-[#4B2E05]' : 'font-semibold text-slate-700'}`}>
                      {notification.title}
                    </p>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mb-2 leading-relaxed">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-medium text-slate-400 flex items-center gap-1">
                        {notification.createdAt?.seconds 
                          ? formatDistanceToNow(new Date(notification.createdAt.seconds * 1000), { addSuffix: true, locale: fr })
                          : "À l'instant"}
                      </span>
                      <div className="flex items-center gap-1">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full hover:bg-[#2BB673]/10 text-[#2BB673] cursor-pointer"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check className="h-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full hover:bg-red-50 text-red-600 cursor-pointer"
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
