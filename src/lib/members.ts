import { supabase } from './supabase';
import { MEMBER_PROFILE_COLUMNS, mapProfileRow } from './mappers';
import { UserProfile } from '@/types';

/**
 * Profils publics (nom, avatar, score) d'une liste de membres.
 *
 * Passe par la fonction serveur get_member_profiles (migration 0024), qui ne
 * renvoie que les profils que l'appelant a le droit de voir. Repli sur
 * l'ancienne vue member_profiles tant que 0024 n'est pas appliquée : l'ordre
 * entre déploiement de l'app et migration n'a ainsi aucune importance.
 */
export async function fetchMemberProfiles(ids: string[]): Promise<UserProfile[]> {
  if (ids.length === 0) return [];

  const viaFunction = await supabase.rpc('get_member_profiles', { p_ids: ids });
  if (!viaFunction.error) return (viaFunction.data ?? []).map(mapProfileRow);

  const viaView = await supabase.from('member_profiles').select(MEMBER_PROFILE_COLUMNS).in('id', ids);
  if (viaView.error) {
    console.error('Error fetching member profiles:', viaFunction.error, viaView.error);
    return [];
  }
  return (viaView.data ?? []).map(mapProfileRow);
}
