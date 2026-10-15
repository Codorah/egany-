/**
 * Dernières données connues, pour que l'application reste lisible sans
 * réseau — avec, toujours, l'heure à laquelle elles ont été reçues.
 *
 * Le service worker ne met volontairement PAS en cache les réponses de
 * Supabase (voir public/sw.js) : il servait un ancien solde comme s'il était
 * à jour. Ici, la copie n'est utilisée QUE si le chargement échoue, et
 * l'écran affiche « Données du … » : personne ne prend un vieux solde pour
 * le solde actuel.
 *
 * Stockage local à l'appareil, effacé à la déconnexion (appareils partagés).
 * Toute lecture/écriture est protégée : navigation privée ou stockage plein
 * ne doivent jamais casser l'application.
 */

const PREFIX = 'eganye:snapshot:';

export type SnapshotKey = 'profile' | 'groups';

export interface Snapshot<T> {
  savedAt: string;
  data: T;
}

const storageKey = (userId: string, key: SnapshotKey) => `${PREFIX}${userId}:${key}`;

export function saveSnapshot<T>(userId: string, key: SnapshotKey, data: T): void {
  try {
    const value: Snapshot<T> = { savedAt: new Date().toISOString(), data };
    localStorage.setItem(storageKey(userId, key), JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('eganye:snapshot'));
  } catch {
    // Stockage indisponible : on se passe simplement de copie.
  }
}

export function loadSnapshot<T>(userId: string, key: SnapshotKey): Snapshot<T> | null {
  try {
    const raw = localStorage.getItem(storageKey(userId, key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot<T>;
    return parsed && parsed.savedAt ? parsed : null;
  } catch {
    return null;
  }
}

/** Heure de la plus ancienne des copies : c'est elle qui borne la fraîcheur. */
export function oldestSnapshotDate(userId: string): Date | null {
  const dates = (['profile', 'groups'] as SnapshotKey[])
    .map((k) => loadSnapshot(userId, k)?.savedAt)
    .filter(Boolean)
    .map((d) => new Date(d as string));
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

export function clearSnapshots(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // rien à faire
  }
}
