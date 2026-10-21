import { createClient } from '@supabase/supabase-js';
import { requireUserOr401 } from './_requireUser';

/**
 * Efface les fichiers d'une personne qui vient de fermer son compte.
 *
 * POURQUOI
 * --------
 * request_account_deletion (migration 0008) anonymise le profil et efface les
 * lignes kyc_submissions, mais pas les fichiers : la photo de la pièce
 * d'identité, l'avatar et les vidéos Coup de pouce restaient dans le stockage.
 * Supabase interdit de supprimer un fichier par SQL (il faut passer par l'API
 * Storage), d'où cet endpoint avec la clé de service.
 *
 * GARDE-FOU
 * ---------
 * On n'efface rien tant que la base n'a pas accepté la suppression (ligne dans
 * account_deletion_requests) : un compte avec un solde ou un cercle actif se
 * voit refuser la suppression, et ne doit pas perdre sa pièce d'identité.
 *
 * Tous les buckets rangent les fichiers sous `<user_id>/…`.
 */

const USER_BUCKETS = ['kyc-documents', 'avatars', 'credit-videos'];

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUserOr401(req, res);
  if (!user) return;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ error: 'Stockage non configuré.' });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: request, error: requestError } = await supabase
    .from('account_deletion_requests')
    .select('id')
    .eq('user_id', user.id)
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
        .list(user.id, { limit: 100 });
      if (listError) {
        console.error(`[purge-account-files] Liste ${bucket} impossible :`, listError);
        return res.status(500).json({ error: 'Effacement incomplet.', removed });
      }
      if (!files || files.length === 0) break;

      const paths = files.map((f) => `${user.id}/${f.name}`);
      const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
      if (removeError) {
        console.error(`[purge-account-files] Effacement ${bucket} impossible :`, removeError);
        return res.status(500).json({ error: 'Effacement incomplet.', removed });
      }
      count += paths.length;
      if (files.length < 100) break;
    }
    removed[bucket] = count;
  }

  return res.status(200).json({ success: true, removed });
}
