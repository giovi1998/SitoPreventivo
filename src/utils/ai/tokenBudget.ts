import dataService from '../dataService';
import { isLocalhost } from '../env';

/** t16: guardia limite token condivisa (prima era duplicata in useAICard/useAIFlyer). */
export async function ensureTokenBudget(userEmail?: string): Promise<void> {
  if (userEmail && userEmail !== 'admin@gmail.com' && !isLocalhost()) {
    const profile = await dataService.getUserProfile(userEmail);
    if (profile.error) throw new Error(profile.error);
    if (profile.tokensUsed >= profile.tokenLimit) {
      throw new Error("Limite token AI raggiunto. Contatta l'amministratore.");
    }
  }
}
