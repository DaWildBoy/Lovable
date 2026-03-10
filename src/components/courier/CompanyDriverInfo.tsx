import { useState, useEffect } from 'react';
import { Building2, Truck, Phone, Shield, CheckCircle, Clock, Package, Star, FileText, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CompanyDriverInfoProps {
  courierId: string;
  onNavigate: (path: string) => void;
}

interface DriverStats {
  completedTotal: number;
  completedToday: number;
  activeJobs: number;
}

export function CompanyDriverInfo({ courierId, onNavigate }: CompanyDriverInfoProps) {
  const { profile, user } = useAuth();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<string | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState<string | null>(null);
  const [stats, setStats] = useState<DriverStats>({ completedTotal: 0, completedToday: 0, activeJobs: 0 });
  const [loading, setLoading] = useState(true);
  const [licenseStatus, setLicenseStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!user) return;
    try {
      const linkedCompanyId = (profile as any)?.linked_company_id;
      if (linkedCompanyId) {
        const { data: companyProfile } = await supabase
          .from('profiles')
          .select('company_name, full_name, haulage_company_logo_url')
          .eq('id', linkedCompanyId)
          .maybeSingle();

        setCompanyName(companyProfile?.company_name || companyProfile?.full_name || null);
        setCompanyLogoUrl(companyProfile?.haulage_company_logo_url || null);
      }

      const { data: courierData } = await supabase
        .from('couriers')
        .select('vehicle_type, vehicle_plate')
        .eq('id', courierId)
        .maybeSingle();

      if (courierData) {
        setVehicleType(courierData.vehicle_type);
        setVehiclePlate(courierData.vehicle_plate);
      }

      const { data: driverRecord } = await supabase
        .from('haulage_drivers')
        .select('id, license_type, license_document_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (driverRecord) {
        setLicenseStatus(driverRecord.license_document_url ? 'uploaded' : 'missing');
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [totalRes, todayRes, activeRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_courier_id', courierId)
          .eq('status', 'completed'),
        supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_courier_id', courierId)
          .eq('status', 'completed')
          .gte('updated_at', todayStart.toISOString()),
        supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_courier_id', courierId)
          .in('status', ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'delivered', 'returning']),
      ]);

      setStats({
        completedTotal: totalRes.count || 0,
        completedToday: todayRes.count || 0,
        activeJobs: activeRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching company driver info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4">
          <div className="flex items-center gap-3">
            {companyLogoUrl ? (
              <img src={companyLogoUrl} alt={companyName || ''} className="w-11 h-11 rounded-xl object-cover border-2 border-white/30" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center border border-white/20">
                <Building2 className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-base truncate">{companyName || 'Company'}</p>
              <p className="text-white/70 text-xs">Assigned Fleet Driver</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/15 rounded-lg border border-white/20">
              <Shield className="w-3.5 h-3.5 text-green-300" />
              <span className="text-xs text-white font-medium">Active</span>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {vehicleType && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="w-3.5 h-3.5 text-gray-400" />
                  <p className="text-xs text-gray-500 font-medium">Vehicle</p>
                </div>
                <p className="text-sm font-semibold text-gray-900 capitalize">{vehicleType}</p>
              </div>
            )}
            {vehiclePlate && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                  <p className="text-xs text-gray-500 font-medium">Plate</p>
                </div>
                <p className="text-sm font-semibold text-gray-900 uppercase">{vehiclePlate}</p>
              </div>
            )}
            {profile?.phone && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <p className="text-xs text-gray-500 font-medium">Phone</p>
                </div>
                <p className="text-sm font-semibold text-gray-900">{profile.phone}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <Package className="w-4 h-4 text-blue-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{stats.activeJobs}</p>
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Active</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{stats.completedToday}</p>
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Today</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <Star className="w-4 h-4 text-amber-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-gray-900">{stats.completedTotal}</p>
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Total</p>
            </div>
          </div>
        </div>
      </div>

      {licenseStatus && (
        <button
          onClick={() => onNavigate('/profile/edit')}
          className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            licenseStatus === 'uploaded' ? 'bg-green-100' : 'bg-amber-100'
          }`}>
            <FileText className={`w-5 h-5 ${
              licenseStatus === 'uploaded' ? 'text-green-600' : 'text-amber-600'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900">Driver License</p>
            <p className="text-sm text-gray-500">
              {licenseStatus === 'uploaded' ? 'Document on file' : 'Upload required'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {licenseStatus === 'uploaded' ? (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                Uploaded
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                <Clock className="w-3.5 h-3.5" />
                Required
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        </button>
      )}
    </div>
  );
}
