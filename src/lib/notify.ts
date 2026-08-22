import { supabase } from './supabase';

export interface NotifyParams {
  userId: string;
  title: string;
  message: string;
  type: 'reminder' | 'payout' | 'system' | 'chat';
  link?: string;
}

/**
 * Records an in-app notification and best-effort delivers it by email too.
 * Delivery failures never throw - the in-app notification is the source of
 * truth and must always land.
 */
export async function notifyUser(params: NotifyParams): Promise<void> {
  const { userId, title, message, type, link } = params;

  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    read: false,
    ...(link ? { link } : {})
  });
  if (error) {
    console.error('Error creating notification:', error);
    return;
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('email_notifications_enabled, email, sms_notifications_enabled, whatsapp_notifications_enabled, phone')
      .eq('id', userId)
      .single();
    if (!profile) return;

    const deliveries: Promise<any>[] = [];
    if (profile.email_notifications_enabled && profile.email) {
      deliveries.push(
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: profile.email, subject: title, message })
        }).catch((err) => console.warn('Email delivery failed:', err))
      );
    }
    if (profile.sms_notifications_enabled && profile.phone) {
      deliveries.push(
        fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: profile.phone, message: `${title} - ${message}` })
        }).catch((err) => console.warn('SMS delivery failed:', err))
      );
    }
    if (profile.whatsapp_notifications_enabled && profile.phone) {
      deliveries.push(
        fetch('/api/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: profile.phone, message: `${title} - ${message}` })
        }).catch((err) => console.warn('WhatsApp delivery failed:', err))
      );
    }
    await Promise.allSettled(deliveries);
  } catch (err) {
    console.warn('Multi-channel notification delivery skipped:', err);
  }
}
