export type JobType = 'standard' | 'courier' | 'marketplace_safebuy' | 'junk_removal';

export interface JobTypeInfo {
  label: string;
  shortLabel: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  iconName: 'Package' | 'Bike' | 'ShoppingBag' | 'Trash2';
}

const JOB_TYPE_MAP: Record<JobType, JobTypeInfo> = {
  standard: {
    label: 'Standard Delivery',
    shortLabel: 'Standard',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-700',
    badgeBorder: 'border-gray-300',
    iconName: 'Package',
  },
  courier: {
    label: 'Courier Mode',
    shortLabel: 'Courier',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-700',
    badgeBorder: 'border-teal-300',
    iconName: 'Bike',
  },
  marketplace_safebuy: {
    label: 'Marketplace Safe-Buy',
    shortLabel: 'Safe-Buy',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-300',
    iconName: 'ShoppingBag',
  },
  junk_removal: {
    label: 'Junk Removal',
    shortLabel: 'Junk Removal',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-300',
    iconName: 'Trash2',
  },
};

export function getJobTypeInfo(jobType: string | null | undefined): JobTypeInfo {
  const key = (jobType || 'standard') as JobType;
  return JOB_TYPE_MAP[key] || JOB_TYPE_MAP.standard;
}

export const ALL_JOB_TYPES: { id: JobType; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'courier', label: 'Courier' },
  { id: 'marketplace_safebuy', label: 'Safe-Buy' },
  { id: 'junk_removal', label: 'Junk Removal' },
];
