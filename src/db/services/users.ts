import { db } from '../firebaseConfig';
import { ref, get, set, push, update } from 'firebase/database';
import { getLocalCache, setLocalCache } from './cache';
import { DEFAULT_USERS, isUserAdmin } from './roles';

export async function initDB() {
  try {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) {
      for (const u of DEFAULT_USERS) {
        await set(ref(db, `users/${u.id}`), {
          name: u.name,
          role: u.role,
          pin: u.pin,
          store: u.store,
        }).catch(() => {});
      }
    } else {
      const data = snapshot.val();
      const hasBoss = Object.keys(data).some(k => k === 'boss' || data[k]?.id === 'boss' || isUserAdmin(data[k]));
      if (!hasBoss) {
        await set(ref(db, `users/boss`), DEFAULT_USERS[0]).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('initDB background handled:', e);
  }
}

export async function addUser(name: string, role: string, pin: string, store: string) {
  const usersRef = ref(db, 'users');
  const newUserRef = push(usersRef);
  const userObj = { name, role, pin, store };
  await set(newUserRef, userObj);
  return { id: newUserRef.key, ...userObj };
}

export async function updateUser(userId: string, data: { name?: string; role?: string; pin?: string; store?: string; photo?: string }) {
  const updates: any = {};
  if (data.name !== undefined) updates[`users/${userId}/name`] = data.name;
  if (data.role !== undefined) updates[`users/${userId}/role`] = data.role;
  if (data.pin !== undefined) updates[`users/${userId}/pin`] = data.pin;
  if (data.store !== undefined) updates[`users/${userId}/store`] = data.store;
  if (data.photo !== undefined) updates[`users/${userId}/photo`] = data.photo;
  await update(ref(db), updates);
}

export async function getUsers() {
  try {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    if (!snapshot.exists()) {
      const cached = getLocalCache('loreal_cached_users');
      return cached || DEFAULT_USERS;
    }
    const data = snapshot.val();
    const users = Object.keys(data).map(key => {
      const u = { id: key, ...data[key] };
      if (isUserAdmin(u) && u.role !== 'admin') {
        u.role = 'admin';
      }
      return u;
    });
    setLocalCache('loreal_cached_users', users);
    return users;
  } catch (e) {
    const cached = getLocalCache('loreal_cached_users');
    return cached || DEFAULT_USERS;
  }
}

export async function deleteUser(userId: string) {
  const userRef = ref(db, `users/${userId}`);
  await set(userRef, null);
  // Met à jour le cache
  const cached = getLocalCache('loreal_cached_users');
  if (Array.isArray(cached)) {
    setLocalCache('loreal_cached_users', cached.filter((u: any) => u.id !== userId));
  }
}

export async function logIntrusion(userName: string, locationData: any, type: string = 'login_failed') {
  const logsRef = ref(db, 'security_logs');
  const newLogRef = push(logsRef);
  await set(newLogRef, {
    timestamp: new Date().toISOString(),
    userName,
    location: locationData,
    type,
    resolved: false
  });
}

export async function deleteSecurityLog(logId: string) {
  const logRef = ref(db, `security_logs/${logId}`);
  await set(logRef, null);
}

export async function getSecurityLogs() {
  const logsRef = ref(db, 'security_logs');
  const snapshot = await get(logsRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.val();
  const logs = Object.keys(data).map(key => ({ id: key, ...data[key] }));
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function changeUserPin(userId: string, newPin: string) {
  const userPinRef = ref(db, `users/${userId}/pin`);
  await set(userPinRef, newPin);
}

export async function updateUserProfile(userId: string, data: { name?: string; photo?: string }) {
  const updates: any = {};
  if (data.name) updates[`users/${userId}/name`] = data.name;
  if (data.photo) updates[`users/${userId}/photo`] = data.photo;
  await update(ref(db), updates);
}
