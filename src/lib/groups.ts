import { db } from './firebase';
import { doc, updateDoc, arrayUnion, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Group, UserProfile } from '@/types';

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
  if (group.members.includes(user.uid)) {
    return { success: false, alreadyMember: true, alreadyPending: false, message: "Vous êtes déjà membre de ce groupe." };
  }

  if (group.pendingMembers?.includes(user.uid)) {
    return { success: false, alreadyMember: false, alreadyPending: true, message: "Votre demande est déjà en attente de validation." };
  }

  if (group.maxMembers && group.members.length >= group.maxMembers) {
    return { success: false, alreadyMember: false, alreadyPending: false, message: "Ce cercle a atteint son nombre maximum de participants." };
  }

  await updateDoc(doc(db, 'groups', group.id), {
    pendingMembers: arrayUnion(user.uid)
  });

  await addDoc(collection(db, 'notifications'), {
    userId: group.creatorId,
    title: `Nouvelle demande d'adhésion - ${group.name}`,
    message: `${user.displayName} souhaite rejoindre votre cercle "${group.name}". Rendez-vous dans la gestion des membres pour valider ou refuser.`,
    type: 'system',
    read: false,
    createdAt: serverTimestamp(),
    link: `/group/${group.id}`
  });

  return { success: true, alreadyMember: false, alreadyPending: false, message: "Votre demande d'adhésion a été envoyée !" };
}
