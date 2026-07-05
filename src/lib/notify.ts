import { db } from './firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

export interface NotifyParams {
  userId: string;
  title: string;
  message: string;
  type: 'reminder' | 'payout' | 'system' | 'chat';
  link?: string;
}

/**
 * Records an in-app notification and best-effort delivers it over the
 * user's enabled channels (push, email). Delivery failures never throw -
 * the in-app notification is the source of truth and must always land.
 */
export async function notifyUser(params: NotifyParams): Promise<void> {
  const { userId, title, message, type, link } = params;

  await addDoc(collection(db, 'notifications'), {
    userId,
    title,
    message,
    type,
    read: false,
    createdAt: serverTimestamp(),
    ...(link ? { link } : {})
  });

  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) return;
    const user = userSnap.data();

    const deliveries: Promise<any>[] = [];
    if (user.pushEnabled && user.fcmToken) {
      deliveries.push(
        fetch('/api/send-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: user.fcmToken, title, message })
        }).catch((err) => console.warn('Push delivery failed:', err))
      );
    }
    if (user.emailNotificationsEnabled && user.email) {
      deliveries.push(
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: user.email, subject: title, message })
        }).catch((err) => console.warn('Email delivery failed:', err))
      );
    }
    await Promise.allSettled(deliveries);
  } catch (err) {
    console.warn('Multi-channel notification delivery skipped:', err);
  }
}
