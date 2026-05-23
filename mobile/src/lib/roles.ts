const ROLE_LABELS: Record<string, string> = {
  USER: '사용자',
  ORGANIZER: '주최자',
  ADMIN: '관리자',
  VALIDATOR: '검증자',
};

export function formatRole(role?: string | null) {
  const key = String(role ?? '').toUpperCase();
  return ROLE_LABELS[key] ?? role ?? '-';
}

export function formatRoles(roles?: string[] | null) {
  if (!roles?.length) return '사용자';
  return roles.map(formatRole).join(', ');
}

export function hasOrganizerAccess(roles?: string[] | null) {
  return Boolean(roles?.includes('ORGANIZER') || roles?.includes('ADMIN'));
}
