// Firebase Cloud Messaging background handler.
// This file must live at the site root (not under /src) so the browser can
// register it with the exact scope Firebase Messaging expects.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  projectId: "gen-lang-client-0485966805",
  appId: "1:834429515279:web:54ee78615dfa47a1aa157a",
  apiKey: "AIzaSyAVlyV-rAUBaMunrGBKg5glM_pIbjVF8ZA",
  authDomain: "gen-lang-client-0485966805.firebaseapp.com",
  messagingSenderId: "834429515279"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'eganyé';
  const body = payload.notification?.body || payload.data?.message || '';
  self.registration.showNotification(title, {
    body,
    icon: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=192&h=192&fit=crop&q=80',
    data: payload.data
  });
});
