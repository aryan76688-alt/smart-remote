export const webauthn = {
  isSupported: (): boolean => {
    return typeof window !== 'undefined' && !!window.PublicKeyCredential;
  },

  registerPasskey: async (username = 'kali-user'): Promise<{ success: boolean; id?: string; error?: string }> => {
    if (!webauthn.isSupported()) {
      return { success: false, error: 'WebAuthn / Passkeys not supported on this browser' };
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Smart Remote Kali', id: window.location.hostname },
          user: {
            id: userId,
            name: username,
            displayName: username,
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },  // ES256
            { type: 'public-key', alg: -257 } // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'preferred',
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential;

      if (credential) {
        localStorage.setItem('smart_remote_passkey_id', credential.id);
        return { success: true, id: credential.id };
      }
      return { success: false, error: 'Registration cancelled' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Passkey registration failed' };
    }
  },

  verifyPasskey: async (): Promise<{ success: boolean; error?: string }> => {
    if (!webauthn.isSupported()) {
      return { success: false, error: 'WebAuthn not supported' };
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const savedId = localStorage.getItem('smart_remote_passkey_id');
      const allowCredentials = savedId ? [{
        id: Uint8Array.from(atob(savedId), c => c.charCodeAt(0)),
        type: 'public-key' as const
      }] : undefined;

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials,
          userVerification: 'required',
          timeout: 60000,
        }
      });

      if (assertion) {
        return { success: true };
      }
      return { success: false, error: 'Authentication cancelled' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Passkey verification failed' };
    }
  },

  hasRegisteredPasskey: (): boolean => {
    return !!localStorage.getItem('smart_remote_passkey_id');
  },

  removePasskey: (): void => {
    localStorage.removeItem('smart_remote_passkey_id');
  }
};
