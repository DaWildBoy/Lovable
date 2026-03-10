type ProfileLike = { role?: string } | null;

const ADMIN_ROLES = ['super_admin', 'support_admin', 'verification_admin'];

export function isAdminUser(profile: ProfileLike): boolean {
  if (!profile) return false;
  return ADMIN_ROLES.includes(profile.role || '');
}

export function isSuperAdmin(profile: ProfileLike): boolean {
  if (!profile) return false;
  return profile.role === 'super_admin';
}

export function isSupportAdmin(profile: ProfileLike): boolean {
  if (!profile) return false;
  return profile.role === 'support_admin';
}

export function isVerificationAdmin(profile: ProfileLike): boolean {
  if (!profile) return false;
  return profile.role === 'verification_admin';
}

export function canAccessUsers(profile: ProfileLike): boolean {
  return isAdminUser(profile);
}

export function canAccessJobs(profile: ProfileLike): boolean {
  if (!profile) return false;
  return profile.role === 'super_admin' || profile.role === 'support_admin';
}

export function canAccessCompanies(profile: ProfileLike): boolean {
  if (!profile) return false;
  return profile.role === 'super_admin' || profile.role === 'support_admin';
}

export function canAccessMessages(profile: ProfileLike): boolean {
  if (!profile) return false;
  return profile.role === 'super_admin' || profile.role === 'support_admin';
}

export function canAccessRevenue(profile: ProfileLike): boolean {
  return isSuperAdmin(profile);
}

export function canAccessSettings(profile: ProfileLike): boolean {
  return isSuperAdmin(profile);
}

export function canAccessInvoices(profile: ProfileLike): boolean {
  if (!profile) return false;
  return profile.role === 'super_admin' || profile.role === 'support_admin';
}

export function canAccessCompanySettings(profile: ProfileLike): boolean {
  return isSuperAdmin(profile);
}

export function canManageRoles(profile: ProfileLike): boolean {
  return isSuperAdmin(profile);
}

export function canCreateUsers(profile: ProfileLike): boolean {
  if (!profile) return false;
  return profile.role === 'super_admin' || profile.role === 'support_admin';
}

export function getAdminRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    super_admin: 'Super Admin',
    support_admin: 'Support Admin',
    verification_admin: 'Verification Admin',
  };
  return labels[role] || role;
}
