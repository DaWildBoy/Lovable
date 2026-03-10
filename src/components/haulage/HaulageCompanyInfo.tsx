import { useState, useEffect } from 'react';
import { Building2, Shield, Truck, Phone, Edit2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export default function HaulageCompanyInfo() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [companyData, setCompanyData] = useState<any>(null);

  useEffect(() => {
    if (profile?.id) {
      loadCompanyData();
    }
  }, [profile]);

  const loadCompanyData = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .single();

      if (error) throw error;
      if (data) {
        setCompanyData(data);
      }
    } catch (error) {
      console.error('Error loading company data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading company information...</div>
      </div>
    );
  }

  const formatRegions = (regions: string[] | null) => {
    if (!regions || regions.length === 0) return [];
    return regions;
  };

  const formatSpecialties = (specialties: string[] | null) => {
    if (!specialties || specialties.length === 0) return [];
    return specialties;
  };

  const formatEquipment = (equipment: string[] | null) => {
    if (!equipment || equipment.length === 0) return [];
    return equipment;
  };

  const operatingRegions = formatRegions(companyData?.haulage_operating_regions);
  const cargoSpecialties = formatSpecialties(companyData?.haulage_cargo_specialties);
  const equipmentTypes = formatEquipment(companyData?.haulage_equipment_types);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Business Information Card - Blue */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-blue-700">Business Information</span>
          </div>
          <button className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-all">
            <Edit2 className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-3 max-h-60 overflow-y-auto">
          <div className="bg-white rounded-lg p-2 border border-blue-200">
            <div className="text-xs text-blue-600 mb-0.5">Company Name</div>
            <div className="text-sm font-semibold text-blue-900">{companyData?.company_name || 'Not set'}</div>
          </div>

          <div className="bg-white rounded-lg p-2 border border-blue-200">
            <div className="text-xs text-blue-600 mb-0.5">Business Registration</div>
            <div className="text-sm font-semibold text-blue-900">{companyData?.haulage_business_registration || 'Not set'}</div>
          </div>

          <div className="bg-white rounded-lg p-2 border border-blue-200">
            <div className="text-xs text-blue-600 mb-0.5">Tax ID</div>
            <div className="text-sm font-semibold text-blue-900">{companyData?.haulage_tax_id || 'Not set'}</div>
          </div>

          <div className="bg-white rounded-lg p-2 border border-blue-200">
            <div className="text-xs text-blue-600 mb-0.5">Years in Operation</div>
            <div className="text-sm font-semibold text-blue-900">
              {companyData?.haulage_years_in_operation ? `${companyData.haulage_years_in_operation} years` : 'Not set'}
            </div>
          </div>

          {companyData?.haulage_service_highlights && (
            <div className="bg-white rounded-lg p-2 border border-blue-200">
              <div className="text-xs text-blue-600 mb-0.5">Service Highlights</div>
              <div className="text-sm text-blue-900">{companyData.haulage_service_highlights}</div>
            </div>
          )}
        </div>
      </div>

      {/* Insurance & Safety Card - Green */}
      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-green-700">Insurance & Safety</span>
          </div>
          <button className="p-1 text-green-600 hover:bg-green-100 rounded transition-all">
            <Edit2 className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-3 max-h-60 overflow-y-auto">
          <div className="bg-white rounded-lg p-2 border border-green-200">
            <div className="text-xs text-green-600 mb-0.5">Insurance Status</div>
            <div className="text-sm font-semibold text-green-900">{companyData?.haulage_insurance_status || 'Not set'}</div>
          </div>

          <div className="bg-white rounded-lg p-2 border border-green-200">
            <div className="text-xs text-green-600 mb-0.5">Cargo Insurance Coverage</div>
            <div className="text-sm font-semibold text-green-900">
              {companyData?.haulage_cargo_insurance_amount
                ? `TTD ${Number(companyData.haulage_cargo_insurance_amount).toLocaleString()}`
                : 'Not set'}
            </div>
          </div>

          <div className="bg-white rounded-lg p-2 border border-green-200">
            <div className="text-xs text-green-600 mb-0.5">Operating License</div>
            <div className="text-sm font-semibold text-green-900">{companyData?.haulage_operating_license_number || 'Not set'}</div>
          </div>

          <div className="bg-white rounded-lg p-2 border border-green-200">
            <div className="text-xs text-green-600 mb-0.5">DOT / Regulatory ID</div>
            <div className="text-sm font-semibold text-green-900">{companyData?.haulage_dot_number || 'Not set'}</div>
          </div>

          <div className="bg-white rounded-lg p-2 border border-green-200">
            <div className="text-xs text-green-600 mb-0.5">Safety Rating</div>
            <div className="text-sm font-semibold text-green-900">{companyData?.haulage_safety_rating || 'Not set'}</div>
          </div>
        </div>
      </div>

      {/* Operations Card - Indigo */}
      <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-indigo-700">Operations</span>
          </div>
          <button className="p-1 text-indigo-600 hover:bg-indigo-100 rounded transition-all">
            <Edit2 className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-3 max-h-60 overflow-y-auto">
          <div className="bg-white rounded-lg p-2 border border-indigo-200">
            <div className="text-xs text-indigo-600 mb-0.5">Service Hours</div>
            <div className="text-sm font-semibold text-indigo-900">{companyData?.haulage_service_hours || 'Not set'}</div>
          </div>

          <div className="bg-white rounded-lg p-2 border border-indigo-200">
            <div className="text-xs text-indigo-600 mb-0.5">Max Fleet Capacity</div>
            <div className="text-sm font-semibold text-indigo-900">
              {companyData?.haulage_max_fleet_capacity_kg
                ? `${Number(companyData.haulage_max_fleet_capacity_kg).toLocaleString()} kg`
                : 'Not set'}
            </div>
          </div>

          {operatingRegions.length > 0 && (
            <div className="bg-white rounded-lg p-2 border border-indigo-200">
              <div className="text-xs text-indigo-600 mb-1">Operating Regions</div>
              <div className="flex flex-wrap gap-1">
                {operatingRegions.map((region, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded">
                    {region}
                  </span>
                ))}
              </div>
            </div>
          )}

          {cargoSpecialties.length > 0 && (
            <div className="bg-white rounded-lg p-2 border border-indigo-200">
              <div className="text-xs text-indigo-600 mb-1">Cargo Specialties</div>
              <div className="flex flex-wrap gap-1">
                {cargoSpecialties.map((specialty, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded">
                    {specialty}
                  </span>
                ))}
              </div>
            </div>
          )}

          {equipmentTypes.length > 0 && (
            <div className="bg-white rounded-lg p-2 border border-indigo-200">
              <div className="text-xs text-indigo-600 mb-1">Equipment Types</div>
              <div className="flex flex-wrap gap-1">
                {equipmentTypes.map((equipment, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded">
                    {equipment}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contact Information Card - Orange */}
      <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center">
              <Phone className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-orange-700">Contact Information</span>
          </div>
          <button className="p-1 text-orange-600 hover:bg-orange-100 rounded transition-all">
            <Edit2 className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-3 max-h-60 overflow-y-auto">
          <div className="bg-white rounded-lg p-2 border border-orange-200">
            <div className="text-xs text-orange-600 mb-0.5">Emergency Contact (24/7)</div>
            <div className="text-sm font-semibold text-orange-900">{companyData?.haulage_emergency_contact || 'Not set'}</div>
          </div>

          <div className="bg-white rounded-lg p-2 border border-orange-200">
            <div className="text-xs text-orange-600 mb-0.5">Dispatch Phone</div>
            <div className="text-sm font-semibold text-orange-900">{companyData?.haulage_dispatch_phone || 'Not set'}</div>
          </div>

          <div className="bg-white rounded-lg p-2 border border-orange-200">
            <div className="text-xs text-orange-600 mb-0.5">Preferred Contact Method</div>
            <div className="text-sm font-semibold text-orange-900">{companyData?.haulage_preferred_contact_method || 'Not set'}</div>
          </div>

          <div className="bg-white rounded-lg p-2 border border-orange-200">
            <div className="text-xs text-orange-600 mb-0.5">Payment Terms</div>
            <div className="text-sm font-semibold text-orange-900">{companyData?.haulage_payment_terms || 'Not set'}</div>
          </div>

          <div className="bg-white rounded-lg p-2 border border-orange-200">
            <div className="text-xs text-orange-600 mb-0.5">Billing Email</div>
            <div className="text-sm font-semibold text-orange-900">{companyData?.haulage_billing_email || 'Not set'}</div>
          </div>

          <div className="bg-white rounded-lg p-2 border border-orange-200">
            <div className="text-xs text-orange-600 mb-0.5">Billing Phone</div>
            <div className="text-sm font-semibold text-orange-900">{companyData?.haulage_billing_phone || 'Not set'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
