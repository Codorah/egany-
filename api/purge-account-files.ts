import { handleCors } from './_cors.js';
import { createClient } from '@supabase/supabase-js';
import { requireUserOr401 } from './_requireUser.js';

/**
 * Efface les fichiers d'un compte fermé, et permet à un admin de finaliser
 * la suppression.
 *
 * POURQUOI
 * --------
 * request_account_deletion (migration 0008) anonymise le profil et efface les
 * lignes kyc_submissions, mais pas les fichiers : la photo de la pièce
 * d'identité, l'avatar et les vidéos Coup de pouce restaient dans le stockage.
 * Supabase interdit de supprimer un fichier par SQL (il faut passer par l'API
 * Storage), et le compte de connexion ne peut être supprimé qu'avec la clé de
 * service : les deux passent donc par ici.
 *
 * DEUX USAGES
 * -----------
 * - Sans corps : la personne efface ses propres fichiers, juste après que la
 *   base a accepté sa suppression (Profil).
 * - { userId } par un admin : efface les fichiers de ce compte, supprime son
 *   compte de connexion et clôt la demande (file « Suppressions » de l'admin).
 *   Suppression « douce » : la personne ne peut plus se connecter et son
 *   e-mail est brouillé, mais la ligne auth.users reste. Une suppression
 *   définitive effacerait le profil en cascade, et avec lui l'historique
 *   financier que la loi impose de garder.
 *
 * GARDE-FOU
 * ---------
 * Rien n'est effacé tant que la base n'a pas accepté la suppression (ligne dans
 * account_deletion_requests) : un compte avec un solde ou un cercle actif se
 * voit refuser la suppression, et ne doit pas perdre sa pièce d'identité.
 * Ce endpoint occupe une seule fonction Vercel pour les deux usages (plafond de
 * 12 fonctions sur l'offre gratuite).
 *
 * Tous les buckets rangent les fichiers sous `<user_id>/…`.
 */

const USER_BUCKETS = ['kyc-documents', 'avatars', 'credit-videos'];

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const caller = await requireUserOr401(req, res);
  if (!caller) return;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ error: 'Stockage non configuré.' });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const requestedUserId: unknown = req.body?.userId;
  const finalize = typeof requestedUserId === 'string' && requestedUserId.length > 0;
  const targetId = finalize ? (requestedUserId as string) : caller.id;

  if (finalize) {
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle();
    if (callerProfile?.role !== 'admin') {
      return res.status(403).json({ error: 'Réservé aux administrateurs.' });
    }
  }

  const { data: request, error: requestError } = await supabase
    .from('account_deletion_requests')
    .select('id, status')
    .eq('user_id', targetId)
    .maybeSingle();
  if (requestError) {
    console.error('[purge-account-files] Lecture de la demande impossible :', requestError);
    return res.status(500).json({ error: 'Vérification impossible.' });
  }
  if (!request) {
    return res.status(403).json({ error: "Aucune suppression de compte n'a été acceptée pour ce compte." });
  }

  const removed: Record<string, number> = {};
  for (const bucket of USER_BUCKETS) {
    let count = 0;
    // list() pagine : on reprend tant qu'il reste des fichiers dans le dossier.
    for (;;) {
      const { data: files, error: listError } = await supabase.storage
        .from(bucket)
        .list(targetId, { limit: 100 });
      if (listError) {
        console.error(`[purge-account-files] Liste ${bucket} impossible :`, listError);
        return res.status(500).json({ error: 'Effacement des fichiers incomplet.', removed });
      }
      if (!files || files.length === 0) break;

      const paths = files.map((f) => `${targetId}/${f.name}`);
      const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
      if (removeError) {
        console.error(`[purge-account-files] Effacement ${bucket} impossible :`, removeError);
        return res.status(500).json({ error: 'Effacement des fichiers incomplet.', removed });
      }
      count += paths.length;
      if (files.length < 100) break;
    }
    removed[bucket] = count;
  }

  if (!finalize) {
    return res.status(200).json({ success: true, removed });
  }

  if (request.status !== 'completed') {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(targetId, true);
    // Un compte déjà supprimé côté auth ne doit pas bloquer la clôture.
    if (deleteError && deleteError.status !== 404) {
      console.error('[purge-account-files] Suppression du compte impossible :', deleteError);
      return res.status(500).json({ error: 'Fichiers effacés, mais suppression du compte de connexion impossible.', removed });
    }

    const { error: closeError } = await supabase
      .from('account_deletion_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', request.id);
    if (closeError) {
      console.error('[purge-account-files] Clôture de la demande impossible :', closeError);
      return res.status(500).json({ error: 'Compte supprimé, mais la demande n’a pas pu être clôturée.', removed });
    }

    await supabase.from('audit_logs').insert({
      user_id: targetId,
      action: 'account_deletion_completed',
      details: `Suppression finalisée par un admin (${caller.id}) : fichiers effacés, compte de connexion supprimé.`,
      ip: '0.0.0.0',
      device: 'Système',
      status: 'success',
    });
  }

  return res.status(200).json({ success: true, removed });
}
