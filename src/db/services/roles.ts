export const DEFAULT_USERS = [
  { id: 'boss', name: 'Boss', role: 'admin', pin: 'B000000.', store: 'all' },
  { id: 'yaya', name: 'Yaya', role: 'caissiere', pin: 'Y000000.', store: 'falaise' },
  { id: 'maya', name: 'Maya', role: 'caissiere', pin: 'M000000.', store: 'falaise' },
  { id: 'angele', name: 'Angèle', role: 'caissiere', pin: 'A000000.', store: 'tougou' },
  { id: 'ivy', name: 'Ivy', role: 'caissiere', pin: 'I000000.', store: 'tougou' },
  { id: 'esther', name: 'Esther', role: 'admin', pin: 'E000000.', store: 'tougou' },
];

export function isUserAdmin(u: any): boolean {
  if (!u) return false;
  const role = (u.role || '').toLowerCase();
  const name = (u.name || '').trim().toLowerCase();
  const id = (u.id || '').toLowerCase();
  return role === 'admin' || role === 'boss' || id === 'boss' || name === 'boss' || u.store === 'all';
}

export function isSuperBoss(u: any): boolean {
  if (!u) return false;
  const role = (u.role || '').toLowerCase();
  const name = (u.name || '').trim().toLowerCase();
  const id = (u.id || '').toLowerCase();
  return id === 'boss' || name === 'boss' || role === 'boss' || u.store === 'all';
}
