import { app, db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';

// Firebase project's Web Push certificate (VAPID) key, from
// Firebase Console > Project Settings > Cloud Messaging > Web configuration.
// Push notifications stay disabled until this is configured.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export interface PushEnableResult {
  success: boolean;
  message: string;
}

/**
 * Requests browser notification permission, registers the Firebase Messaging
 * service worker, retrieves an FCM token and stores it on the user's profile.
 * No-ops safely (with a clear message) when push isn't supported or configured.
 */
export async function enablePushNotifications(userId: string): Promise<PushEnableResult> {
  if (!VAPID_KEY) {
    return {
      success: false,
      message: "Les notifications push ne sont pas encore configurées côté serveur (clé VAPID manquante)."
    };
  }

  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return { success: false, message: "Les notifications push ne sont pas prises en charge par ce navigateur." };
  }

  try {
    const { isSupported, getMessaging, getToken } = await import('firebase/messaging');

    if (!(await isSupported())) {
      return { success: false, message: "Les notifications push ne sont pas prises en charge par ce navigateur." };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, message: "Vous avez refusé l'autorisation de recevoir des notifications." };
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });

    if (!token) {
      return { success: false, message: "Impossible d'obtenir un jeton de notification." };
    }

    await updateDoc(doc(db, 'users', userId), { fcmToken: token, pushEnabled: true });
    return { success: true, message: "Notifications push activées avec succès !" };
  } catch (error: any) {
    console.error('Error enabling push notifications:', error);
    return { success: false, message: error?.message || "Erreur lors de l'activation des notifications push." };
  }
}

export async function disablePushNotifications(userId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { pushEnabled: false });
}
