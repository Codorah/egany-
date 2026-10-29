import { useState, useEffect, useSyncExternalStore } from 'react';
import { toast } from 'sonner';

const ENROLLED_KEY = 'eganye_biometrics_enrolled';
const USER_ID_KEY = 'eganye_biometrics_user_id';

/**
 * L'état « biométrie activée » est partagé : l'interrupteur du profil, la
 * fenêtre d'enregistrement et l'écran de verrouillage le lisent tous. Avec un
 * useState par composant, l'interrupteur restait sur « off » après
 * l'activation tant qu'on ne quittait pas l'écran.
 */
const enrollListeners = new Set<() => void>();
const notifyEnrollChange = () => enrollListeners.forEach((l) => l());
const subscribeEnroll = (listener: () => void) => {
  enrollListeners.add(listener);
  return () => enrollListeners.delete(listener);
};
function readEnrolled(): boolean {
  try {
    return localStorage.getItem(ENROLLED_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Compte pour lequel l'empreinte a été enregistrée sur cet appareil. */
export function getBiometricsUserId(): string | null {
  try {
    return localStorage.getItem(USER_ID_KEY);
  } catch {
    return null;
  }
}

/** Verrouillage à activer pour ce compte, sur cet appareil ? */
export function isAppLockEnabledFor(userId: string): boolean {
  return readEnrolled() && getBiometricsUserId() === userId;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export interface BiometricResult {
  success: boolean;
  message: string;
  credentialId?: string;
  isSimulated: boolean;
}

export function useBiometrics() {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const isEnrolled = useSyncExternalStore(subscribeEnroll, readEnrolled, () => false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);

  useEffect(() => {
    // Check if biometric authentication (WebAuthn or Capacitor) is genuinely supported
    const hasWebAuthn = !!window.PublicKeyCredential;
    const hasCapacitor = !!(window as any).Capacitor?.Plugins?.BiometricAuth;
    setIsSupported(hasWebAuthn || hasCapacitor);
  }, []);

  const markEnrolled = (username: string, userId?: string) => {
    localStorage.setItem(ENROLLED_KEY, 'true');
    localStorage.setItem('eganye_biometrics_username', username);
    if (userId) localStorage.setItem(USER_ID_KEY, userId);
    notifyEnrollChange();
  };

  // Registers / Enrolls biometrics
  const registerBiometrics = async (username: string, userId?: string): Promise<BiometricResult> => {
    setIsAuthenticating(true);
    
    try {
      // 1. Try real native Capacitor plugin if available
      const Capacitor = (window as any).Capacitor;
      if (Capacitor?.Plugins?.BiometricAuth) {
        const BiometricAuth = Capacitor.Plugins.BiometricAuth;
        const available = await BiometricAuth.isAvailable();
        
        if (available.hasBiometrics) {
          const result = await BiometricAuth.verify({
            reason: "Associer votre empreinte ou FaceID à votre compte eganyé",
            title: "Enregistrement Biométrique"
          });
          
          if (result.verified) {
            markEnrolled(username, userId);
            setIsAuthenticating(false);
            return {
              success: true,
              message: "Empreinte/FaceID enregistrée via Capacitor !",
              isSimulated: false
            };
          }
        }
      }

      // 2. Try actual Web Biometrics (WebAuthn)
      if (window.PublicKeyCredential && navigator.credentials) {
        try {
          // A minimal valid WebAuthn publicKey options to trigger the browser's native touch/face scan popup
          // Only triggers if not in a restrictive sandboxed iframe without credentials permission
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);
          
          const userID = new Uint8Array(16);
          window.crypto.getRandomValues(userID);

          const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
            challenge,
            rp: {
              name: "eganye",
              id: window.location.hostname || "localhost"
            },
            user: {
              id: userID,
              name: username || "user@eganye.com",
              displayName: username || "Utilisateur eganyé"
            },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256
            authenticatorSelection: {
              authenticatorAttachment: "platform", // Enforce local biometrics (TouchID/FaceID)
              userVerification: "required"
            },
            timeout: 60000
          };

          // On typical desktop/mobile chrome/safari, this opens the authentic biometric sheet.
          // In sandboxed frames (like our development frame), it might fail/block, so we gracefully catch and offer the fallback.
          const credential = await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions
          });

          if (credential) {
            const pkCredential = credential as PublicKeyCredential;
            localStorage.setItem('eganye_biometrics_credential_id', bufferToBase64(pkCredential.rawId));
            markEnrolled(username, userId);
            setIsAuthenticating(false);
            return {
              success: true,
              message: "Biométrie activée avec succès !",
              credentialId: credential.id,
              isSimulated: false
            };
          }
        } catch (e: any) {
          console.warn("WebAuthn registration blocked or failed:", e.message);
          setIsAuthenticating(false);
          return {
            success: false,
            message: "Impossible d'activer la biométrie : votre navigateur ou appareil a refusé ou ne prend pas en charge cette fonctionnalité.",
            isSimulated: false
          };
        }
      }

      // No genuine biometric API available on this device/browser.
      setIsAuthenticating(false);
      return {
        success: false,
        message: "La biométrie n'est pas disponible sur cet appareil.",
        isSimulated: false
      };

    } catch (error: any) {
      setIsAuthenticating(false);
      return {
        success: false,
        message: error?.message || "Échec de l'association biométrique.",
        isSimulated: false
      };
    }
  };

  // Authenticate using biometrics
  const authenticate = async (): Promise<boolean> => {
    setIsAuthenticating(true);
    const username = localStorage.getItem('eganye_biometrics_username') || "Utilisateur";

    try {
      // 1. Capacitor Native authenticate
      const Capacitor = (window as any).Capacitor;
      if (Capacitor?.Plugins?.BiometricAuth) {
        const BiometricAuth = Capacitor.Plugins.BiometricAuth;
        const result = await BiometricAuth.verify({
          reason: "Connectez-vous à votre espace eganyé",
          title: "Connexion Biométrique"
        });
        setIsAuthenticating(false);
        return !!result.verified;
      }

      // 2. Web standard WebAuthn authenticator check — constrained to the
      // specific credential enrolled for this account, not "any platform
      // authenticator present on this device".
      if (window.PublicKeyCredential && navigator.credentials) {
        const storedCredentialId = localStorage.getItem('eganye_biometrics_credential_id');

        // Sans identifiant enrôlé pour CE compte, `allowCredentials` était
        // simplement omis — et le navigateur acceptait alors n'importe quel
        // capteur de l'appareil. Sur un téléphone partagé (cas courant),
        // l'empreinte d'un proche ouvrait donc la session. On refuse : la
        // saisie du mot de passe prend le relais.
        if (!storedCredentialId) {
          console.warn('Biometrics: aucun identifiant enrôlé pour ce compte sur cet appareil.');
          setIsAuthenticating(false);
          return false;
        }

        try {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);

          const credential = await navigator.credentials.get({
            publicKey: {
              challenge,
              userVerification: "required",
              timeout: 60000,
              allowCredentials: [
                { id: base64ToBuffer(storedCredentialId), type: 'public-key' as const },
              ],
            }
          });
          setIsAuthenticating(false);
          return !!credential;
        } catch (e) {
          console.warn("WebAuthn verification failed/blocked:", e);
          setIsAuthenticating(false);
          return false;
        }
      }

      // No genuine biometric API available on this device/browser.
      setIsAuthenticating(false);
      return false;

    } catch (err) {
      console.error(err);
      setIsAuthenticating(false);
      return false;
    }
  };

  const disableBiometrics = () => {
    localStorage.removeItem(ENROLLED_KEY);
    localStorage.removeItem('eganye_biometrics_username');
    localStorage.removeItem('eganye_biometrics_credential_id');
    localStorage.removeItem(USER_ID_KEY);
    notifyEnrollChange();
    toast.info("Authentification biométrique désactivée.");
  };

  return {
    isSupported,
    isEnrolled,
    isAuthenticating,
    registerBiometrics,
    authenticate,
    disableBiometrics
  };
}
