export interface AdminProfile {
  id: string;
  email: string | null;
  role: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string | null;
  business_type: string | null;
  company_name: string | null;
  company_email: string | null;
  company_address: string | null;
  business_verification_status: string | null;
  business_verified: boolean | null;
  business_verified_at: string | null;
  rating_average: number | null;
  rating_count: number | null;
  completed_deliveries_count: number | null;
  customer_payment_method: string | null;
  customer_payment_last4: string | null;
  customer_payment_verified: boolean | null;
  courier_bank_name: string | null;
  courier_bank_account_name: string | null;
  courier_bank_account_number: string | null;
  courier_bank_routing_number: string | null;
  courier_bank_verified: boolean | null;
  courier_bank_verified_at: string | null;
  courier_bank_added_at: string | null;
  home_base_location_text: string | null;
  haulage_company_logo_url: string | null;
  haulage_business_registration: string | null;
  haulage_years_in_operation: number | null;
  haulage_insurance_status: string | null;
  haulage_insurance_expiry: string | null;
  haulage_operating_regions: string[] | null;
  haulage_cargo_specialties: string[] | null;
  haulage_insurance_certificate_url: string | null;
  haulage_cargo_insurance_amount: number | null;
  haulage_operating_license_number: string | null;
  haulage_operating_license_expiry: string | null;
  haulage_dot_number: string | null;
  haulage_safety_rating: string | null;
  haulage_service_hours: string | null;
  haulage_max_fleet_capacity_kg: number | null;
  haulage_equipment_types: string[] | null;
  haulage_payment_terms: string | null;
  haulage_tax_id: string | null;
  haulage_billing_email: string | null;
  haulage_dispatch_phone: string | null;
  haulage_emergency_contact: string | null;
  haulage_on_time_delivery_rate: number | null;
  haulage_onboarding_completed: boolean | null;
}

export interface CourierRecord {
  id: string;
  user_id: string;
  verified: boolean | null;
  verification_status: string | null;
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_plate: string | null;
  total_earnings_ttd: number | null;
  rating_average: number | null;
  rating_count: number | null;
  completed_deliveries_count: number | null;
  is_online: boolean | null;
  last_online_at: string | null;
  created_at: string | null;
}

export interface HaulageDriver {
  id: string;
  full_name: string;
  phone: string | null;
  license_type: string | null;
  is_active: boolean;
}

export interface HaulageVehicle {
  id: string;
  vehicle_name: string;
  plate_number: string | null;
  vehicle_type: string;
  capacity_kg: number | null;
  special_equipment: string | null;
  is_active: boolean;
}

export interface BusinessSubscription {
  id: string;
  plan_type: string;
  status: string;
  trial_end_date: string | null;
  current_period_end: string | null;
  monthly_amount_ttd: number;
  last_payment_date: string | null;
  next_billing_date: string | null;
}

export type AdminTab = 'all' | 'pending' | 'verified' | 'retail' | 'haulage';

export const ROLE_COLORS: Record<string, string> = {
  customer: 'bg-moveme-blue-50 text-moveme-blue-700',
  courier: 'bg-moveme-teal-50 text-moveme-teal-700',
  business: 'bg-warning-50 text-warning-700',
  admin: 'bg-gray-100 text-gray-700',
  verification_admin: 'bg-amber-50 text-amber-700',
  support_admin: 'bg-sky-50 text-sky-700',
  super_admin: 'bg-error-50 text-error-700',
};

export const VERIFICATION_COLORS: Record<string, string> = {
  approved: 'bg-success-50 text-success-700',
  verified: 'bg-success-50 text-success-700',
  rejected: 'bg-error-50 text-error-700',
  pending: 'bg-warning-50 text-warning-700',
  unverified: 'bg-gray-100 text-gray-500',
};
