import { db } from '../firebaseConfig';
import { ref, get, set, push } from 'firebase/database';

export async function logAudit(action: string, entity: string, details: string, userId: string = '', userName: string = '', storeId: string = 'all', reason: string = '') {
  try {
    const auditRef = ref(db, 'audit_logs');
    const newAuditRef = push(auditRef);
    await set(newAuditRef, {
      action,
      entity,
      details,
      user_id: userId,
      user_name: userName || 'Inconnu',
      store: storeId || 'all',
      reason: reason || '',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('Erreur logAudit:', e);
  }
}

export async function getAuditLogs(): Promise<any[]> {
  try {
    const auditRef = ref(db, 'audit_logs');
    const snapshot = await get(auditRef);
    if (!snapshot.exists()) return [];
    const data = snapshot.val();
    return Object.keys(data)
      .map(k => ({ id: k, ...data[k] }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (e) {
    console.error('Erreur getAuditLogs:', e);
    return [];
  }
}
