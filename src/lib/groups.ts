import { supabase } from './supabase';
import { mapGroupRow } from './mappers';
import { Group, UserProfile } from '@/types';
import { notifyUser } from './notify';
import { isKycVerified } from './kyc';

/**
 * Fetches every group_members row for the given group rows and hydrates each
 * into a full Group object (members[]/pendingMembers[]/memberRoles{}/
 * payoutOrder[] reconstructed from the join table) — shared by useGroups,
 * SearchGroups and JoinGroup so this logic lives in exactly one place.
 */
export async function hydrateGroups(groupRows: Record<string, any>[]): Promise<Group[]> {
  if (groupRows.length === 0) return [];

  const groupIds = groupRows.map((g) => g.id);
  const { data: allMembers, error } = await supabase
    .from('group_members')
    .select('*')
    .in('group_id', groupIds);

  if (error) {
    console.error('Error fetching group members:', error);
    return groupRows.map((row) => mapGroupRow(row, []));
  }

  const membersByGroup = new Map<string, any[]>();
  for (const m of allMembers ?? []) {
    if (!membersByGroup.has(m.group_id)) membersByGroup.set(m.group_id, []);
    membersByGroup.get(m.group_id)!.push(m);
  }

  return groupRows.map((row) => mapGroupRow(row, membersByGroup.get(row.id) ?? []));
}

export interface JoinRequestResult {
  success: boolean;
  alreadyMember: boolean;
  alreadyPending: boolean;
  message: string;
}

/**
 * Requests to join a group on behalf of a user: creates a pending membership
 * request (awaiting admin approval) and notifies the group's creator.
 * Used by both the join-by-code/QR flow and public group search.
 */
export async function requestToJoinGroup(group: Group, user: UserProfile): Promise<JoinRequestResult> {
  if (!navigator.onLine) {
    return {
      success: false,
      alreadyMember: false,
      alreadyPending: false,
      message: "Vous êtes hors-ligne. Rejoindre un cercle nécessite une connexion internet.",
    };
  }
  if (!isKycVerified(user)) {
    return {
      success: false,
      alreadyMember: false,
      alreadyPending: false,
      message: "Vérifiez votre identité (Profil > Vérification d'identité) avant de rejoindre un cercle.",
    };
  }
  if (group.members.includes(user.uid)) {
    return { success: false, alreadyMember: true, alreadyPending: false, message: "Vous êtes déjà membre de ce groupe." };
  }

  if (group.pendingMembers?.includes(user.uid)) {
    return { success: false, alreadyMember: false, alreadyPending: true, message: "Votre demande est déjà en attente de validation." };
  }

  if (group.maxMembers && group.members.length >= group.maxMembers) {
    return { success: false, alreadyMember: false, alreadyPending: false, message: "Ce cercle a atteint son nombre maximum de participants." };
  }

  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: user.uid, status: 'pending' });

  if (error) {
    return { success: false, alreadyMember: false, alreadyPending: false, message: `Erreur lors de la demande d'adhésion : ${error.message}` };
  }

  await notifyUser({
    userId: group.creatorId,
    title: `Nouvelle demande d'adhésion - ${group.name}`,
    message: `${user.displayName} souhaite rejoindre votre cercle "${group.name}". Rendez-vous dans la gestion des membres pour valider ou refuser.`,
    type: 'system',
    link: `/group/${group.id}`
  });

  return { success: true, alreadyMember: false, alreadyPending: false, message: "Votre demande d'adhésion a été envoyée !" };
}
