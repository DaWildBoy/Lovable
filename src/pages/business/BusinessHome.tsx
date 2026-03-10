import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Package,
  DollarSign,
  CheckCircle,
  Plus,
  Loader2,
  Truck,
  Users,
  Clock,
  MapPin,
  Box,
  FileText,
  ArrowRight
} from 'lucide-react';
import { Database } from '../../lib/database.types';
import { DispatchAlerts } from '../../components/haulage/DispatchAlerts';
import { DispatchFleetMap } from '../../components/haulage/DispatchFleetMap';
import { DispatchVehicleStatus } from '../../components/haulage/DispatchVehicleStatus';
import { DispatchEarnings } from '../../components/haulage/DispatchEarnings';
import { DispatchPerformanceMetrics } from '../../components/haulage/DispatchPerformanceMetrics';
import { DispatchUpcomingJobs } from '../../components/haulage/DispatchUpcomingJobs';
import { DispatchActivityFeed } from '../../components/haulage/DispatchActivityFeed';
import { DispatchCustomerInsights } from '../../components/haulage/DispatchCustomerInsights';
import { AnnouncementsBanner } from '../../components/customer/AnnouncementsBanner';
import { RetailActiveDeliveries } from '../../components/retail/RetailActiveDeliveries';
import { RetailPendingActions } from '../../components/retail/RetailPendingActions';
import { RetailSpendingBreakdown } from '../../components/retail/RetailSpendingBreakdown';
import { RetailDeliveryChart } from '../../components/retail/RetailDeliveryChart';
import { RetailQuickLocations } from '../../components/retail/RetailQuickLocations';
import { RetailQuickTemplates } from '../../components/retail/RetailQuickTemplates';
import { RetailQuickCouriers } from '../../components/retail/RetailQuickCouriers';
import { RetailProfileCard } from '../../components/retail/RetailProfileCard';
import { GuidedTour } from '../../components/GuidedTour';
import { retailTourSteps, haulageTourSteps } from '../../lib/tourSteps';

type Job = Database['public']['Tables']['jobs']['Row'];
type HaulageDriver = Database['public']['Tables']['haulage_drivers']['Row'];
type HaulageVehicle = Database['public']['Tables']['haulage_vehicles']['Row'];

interface BusinessStats {
  activeShipments: number;
  monthlySpend: number;
  completedJobs: number;
}

interface HaulageStats {
  jobsInProgress: number;
  driversAvailable: number;
  vehiclesAvailable: number;
  driversOnJob: number;
  driversOffDuty: number;
}

interface BusinessHomeProps {
  onNavigate: (path: string) => void;
}

export function BusinessHome({ onNavigate }: BusinessHomeProps) {
  const { profile, user } = useAuth();
  const [stats, setStats] = useState<BusinessStats>({ activeShipments: 0, monthlySpend: 0, completedJobs: 0 });
  const [haulageStats, setHaulageStats] = useState<HaulageStats>({
    jobsInProgress: 0,
    driversAvailable: 0,
    vehiclesAvailable: 0,
    driversOnJob: 0,
    driversOffDuty: 0
  });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [dispatchQueue, setDispatchQueue] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);

  const isHaulage = profile?.business_type === 'haulage';

  useEffect(() => {
    if (isHaulage) {
      fetchHaulageData();
    } else {
      fetchRetailData();
    }
  }, [isHaulage]);

  useEffect(() => {
    if (!loading && profile && !profile.has_seen_tutorial) {
      const timer = setTimeout(() => setShowTour(true), 800);
      return () => clearTimeout(timer);
    }
  }, [loading, profile]);

  const completeTour = async () => {
    setShowTour(false);
    if (user) {
      await supabase.from('profiles').update({ has_seen_tutorial: true }).eq('id', user.id);
    }
  };

  const fetchRetailData = async () => {
    try {
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_user_id', profile!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const active = jobs?.filter(j => ['assigned', 'in_progress', 'returning'].includes(j.status)).length || 0;
      const completed = jobs?.filter(j => j.status === 'completed').length || 0;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const monthlySpend = jobs
        ?.filter(j => new Date(j.created_at) >= thirtyDaysAgo)
        .reduce((sum, j) => sum + ((j as any).customer_total || Math.round((j.customer_offer_ttd || 0) * 1.225 * 100) / 100), 0) || 0;

      setStats({ activeShipments: active, monthlySpend, completedJobs: completed });
      setRecentJobs(jobs?.slice(0, 3) || []);
    } catch (error) {
      console.error('Error fetching retail data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHaulageData = async () => {
    try {
      const [jobsCountResult, driversResult, vehiclesResult] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, status, assigned_driver_id, assigned_vehicle_id')
          .eq('assigned_company_id', profile!.id)
          .in('status', ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'returning', 'delivered']),
        supabase
          .from('haulage_drivers')
          .select('id, is_active')
          .eq('company_id', profile!.id),
        supabase
          .from('haulage_vehicles')
          .select('id, is_active')
          .eq('company_id', profile!.id)
      ]);

      if (jobsCountResult.error) throw jobsCountResult.error;
      if (driversResult.error) throw driversResult.error;
      if (vehiclesResult.error) throw vehiclesResult.error;

      const activeJobs = jobsCountResult.data || [];
      const drivers = driversResult.data || [];
      const vehicles = vehiclesResult.data || [];

      const jobsInProgress = activeJobs.length;

      const dispatchJobs = activeJobs.filter(j =>
        j.status === 'assigned' && !j.assigned_driver_id
      );

      // Get drivers and vehicles currently assigned to active jobs
      const busyDriverIds = new Set(
        activeJobs
          .filter(j => j.assigned_driver_id)
          .map(j => j.assigned_driver_id)
      );

      const busyVehicleIds = new Set(
        activeJobs
          .filter(j => j.assigned_vehicle_id)
          .map(j => j.assigned_vehicle_id)
      );

      const activeDrivers = drivers.filter(d => d.is_active);
      const driversOnJob = activeDrivers.filter(d => busyDriverIds.has(d.id)).length;
      const driversAvailable = activeDrivers.filter(d => !busyDriverIds.has(d.id)).length;
      const driversOffDuty = drivers.filter(d => !d.is_active).length;

      const activeVehicles = vehicles.filter(v => v.is_active);
      const vehiclesAvailable = activeVehicles.filter(v => !busyVehicleIds.has(v.id)).length;

      setHaulageStats({
        jobsInProgress,
        driversAvailable,
        vehiclesAvailable,
        driversOnJob,
        driversOffDuty
      });
      setDispatchQueue(dispatchJobs as any);

    } catch (error) {
      console.error('Error fetching haulage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVehicleTypeFromJob = (job: Job): string => {
    if (job.cargo_category?.toLowerCase().includes('flatbed')) return 'Flatbed';
    if (job.cargo_size_category === 'Large') return 'Lorry';
    if (job.cargo_size_category === 'Medium') return 'Van';
    return 'Van';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-16">
        <Loader2 className="w-8 h-8 text-moveme-blue-600 animate-spin" />
      </div>
    );
  }

  if (isHaulage) {
    const hasPendingAssignments = dispatchQueue.length > 0;

    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-8 animate-fade-in-up">
        <div className="gradient-header px-4 pt-8 pb-12">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-1">Dispatch Control</h1>
            <p className="text-white/70 text-sm">Fleet Operations Dashboard</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 -mt-6">
          <div className="hidden md:grid md:grid-cols-3 gap-3 mb-6">
            <div className="stat-card">
              <div className="flex items-center justify-center w-10 h-10 bg-warning-100 rounded-lg mb-3 mx-auto">
                <Package className="w-5 h-5 text-warning-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900 text-center">{haulageStats.jobsInProgress}</p>
              <p className="text-xs text-gray-500 text-center mt-1">Jobs In Progress</p>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-center w-10 h-10 bg-success-100 rounded-lg mb-3 mx-auto">
                <Users className="w-5 h-5 text-success-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900 text-center">{haulageStats.driversAvailable}</p>
              <p className="text-xs text-gray-500 text-center mt-1">Drivers Available</p>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-center w-10 h-10 bg-moveme-blue-100 rounded-lg mb-3 mx-auto">
                <Truck className="w-5 h-5 text-moveme-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900 text-center">{haulageStats.vehiclesAvailable}</p>
              <p className="text-xs text-gray-500 text-center mt-1">Vehicles Available</p>
            </div>
          </div>

          <div data-tour="fleet-overview" className="md:hidden card p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Operations Today</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-warning-500"></span>
                <span className="text-gray-600">{haulageStats.jobsInProgress} jobs active</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success-500"></span>
                <span className="text-gray-600">{haulageStats.driversAvailable} drivers available</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-moveme-blue-500"></span>
                <span className="text-gray-600">{haulageStats.vehiclesAvailable} vehicles available</span>
              </div>
            </div>
          </div>

          <div className="card p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-900">Driver Availability</h3>
              </div>
              <button
                onClick={() => onNavigate('/business/profile?tab=drivers')}
                className="text-sm text-moveme-blue-600 hover:text-moveme-blue-700 font-medium"
              >
                View Drivers
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div className="text-xl font-bold text-success-600">{haulageStats.driversAvailable}</div>
                <div className="text-xs text-gray-500">Available</div>
              </div>
              <div>
                <div className="text-xl font-bold text-warning-600">{haulageStats.driversOnJob}</div>
                <div className="text-xs text-gray-500">On Job</div>
              </div>
              <div>
                <div className="text-xl font-bold text-gray-400">{haulageStats.driversOffDuty}</div>
                <div className="text-xs text-gray-500">Off Duty</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('/business/jobs?tab=active')}
            className="btn-success w-full py-4 text-base mb-4 shadow-glow-teal"
          >
            <Truck className="w-5 h-5" />
            <span>Active Jobs</span>
            {haulageStats.jobsInProgress > 0 && (
              <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm font-bold">
                {haulageStats.jobsInProgress}
              </span>
            )}
          </button>

          {hasPendingAssignments ? (
            <button
              onClick={() => onNavigate('/business/jobs?filter=pending_assignment')}
              className="w-full bg-warning-600 text-white rounded-xl shadow-lg py-4 px-6 mb-4 flex items-center justify-center gap-3 hover:bg-warning-700 transition-all active:scale-[0.98] font-semibold"
            >
              <Clock className="w-5 h-5" />
              <span>Assign Drivers ({dispatchQueue.length} pending)</span>
            </button>
          ) : (
            <button
              onClick={() => onNavigate('/business/jobs?tab=available')}
              className="btn-primary w-full py-4 text-base mb-4 shadow-glow-blue"
            >
              <Package className="w-5 h-5" />
              <span>Browse Available Jobs</span>
            </button>
          )}

          <div className="mb-4">
            <DispatchAlerts onNavigate={onNavigate} />
          </div>

          {dispatchQueue.length > 0 && (
            <div className="card p-4 mb-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-warning-600" />
                  <h2 className="section-title !mb-0">Dispatch Queue</h2>
                </div>
                <span className="badge bg-warning-100 text-warning-700">
                  {dispatchQueue.length} Unassigned
                </span>
              </div>

              <div className="space-y-3">
                {dispatchQueue.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => onNavigate(`/job/${job.id}`)}
                    className="w-full border-2 border-warning-200 bg-warning-50 rounded-xl p-3.5 hover:bg-warning-100 cursor-pointer transition-all text-left hover:shadow-md active:scale-[0.99]"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{job.pickup_location_text}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{job.dropoff_location_text}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <Box className="w-3 h-3" />
                      <span className="font-medium">{job.cargo_size_category || 'Standard'}</span>
                      <span className="text-gray-300">|</span>
                      <span>{getVehicleTypeFromJob(job)}</span>
                      <span className="text-gray-300">|</span>
                      <span>{job.distance_km?.toFixed(1)} km</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="badge bg-moveme-blue-100 text-moveme-blue-700">
                        {job.delivery_type === 'scheduled' ? 'Scheduled' : 'ASAP'}
                      </span>
                      <span className="font-bold text-gray-900">TTD ${job.customer_offer_ttd}</span>
                    </div>
                    <div className="mt-2.5 pt-2.5 border-t border-warning-200">
                      <span className="text-xs text-warning-700 font-semibold">Assign Driver & Vehicle</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <DispatchFleetMap />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <DispatchEarnings />
            <DispatchVehicleStatus onNavigate={onNavigate} />
          </div>

          <div className="mb-4">
            <DispatchPerformanceMetrics />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <DispatchUpcomingJobs onNavigate={onNavigate} />
            <DispatchActivityFeed onNavigate={onNavigate} />
          </div>

          <div className="mb-6">
            <DispatchCustomerInsights onNavigate={onNavigate} />
          </div>
        </div>

        <GuidedTour
          steps={haulageTourSteps}
          isOpen={showTour}
          onComplete={completeTour}
          onSkip={completeTour}
        />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-moveme-blue-50 text-moveme-blue-700';
      case 'bidding': return 'bg-warning-50 text-warning-700';
      case 'assigned': return 'bg-moveme-blue-50 text-moveme-blue-700';
      case 'on_way_to_pickup': return 'bg-warning-50 text-warning-700';
      case 'cargo_collected': return 'bg-warning-50 text-warning-700';
      case 'in_transit': return 'bg-moveme-blue-50 text-moveme-blue-700';
      case 'delivered': return 'bg-success-50 text-success-700';
      case 'in_progress': return 'bg-warning-50 text-warning-700';
      case 'completed': return 'bg-success-50 text-success-700';
      case 'returning': return 'bg-orange-50 text-orange-700';
      case 'cancelled': return 'bg-error-50 text-error-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'open': 'Open',
      'bidding': 'Receiving Bids',
      'assigned': 'Assigned',
      'on_way_to_pickup': 'En Route',
      'cargo_collected': 'Collected',
      'in_transit': 'In Transit',
      'delivered': 'Delivered',
      'returning': 'Returning',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
    };
    return labels[status] || status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const pendingQuotes = recentJobs.filter(j => ['open', 'bidding'].includes(j.status || '')).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="gradient-header px-4 pt-8 pb-12">
        <div className="max-w-4xl mx-auto">
          <p className="text-white/60 text-sm font-medium mb-1">Good to see you</p>
          <h1 className="text-2xl font-bold tracking-tight">{profile?.company_name || profile?.first_name || 'Business'}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 animate-fade-in-up">
        <div className="grid grid-cols-4 gap-2.5 mb-5">
          <button onClick={() => onNavigate('/business/jobs?tab=active')} className="stat-card">
            <div className="flex items-center justify-center w-9 h-9 bg-warning-50 rounded-xl mb-2 mx-auto">
              <Package className="w-4 h-4 text-warning-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.activeShipments}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Active</p>
          </button>

          <button onClick={() => onNavigate('/business/jobs?filter=pending')} className="stat-card">
            <div className="flex items-center justify-center w-9 h-9 bg-moveme-blue-50 rounded-xl mb-2 mx-auto">
              <FileText className="w-4 h-4 text-moveme-blue-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">{pendingQuotes}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Pending</p>
          </button>

          <button onClick={() => onNavigate('/business/jobs?filter=all')} className="stat-card">
            <div className="flex items-center justify-center w-9 h-9 bg-moveme-teal-50 rounded-xl mb-2 mx-auto">
              <DollarSign className="w-4 h-4 text-moveme-teal-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">${stats.monthlySpend.toFixed(0)}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Monthly</p>
          </button>

          <button onClick={() => onNavigate('/business/jobs?filter=completed')} className="stat-card">
            <div className="flex items-center justify-center w-9 h-9 bg-success-50 rounded-xl mb-2 mx-auto">
              <CheckCircle className="w-4 h-4 text-success-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.completedJobs}</p>
            <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Completed</p>
          </button>
        </div>

        <button
          data-tour="create-delivery"
          onClick={() => onNavigate('/create-job')}
          className="btn-primary w-full py-4 text-base mb-5 shadow-glow-blue"
        >
          <Plus className="w-5 h-5" />
          Create New Shipment
        </button>

        <AnnouncementsBanner userId={profile!.id} />

        <RetailActiveDeliveries userId={profile!.id} onNavigate={onNavigate} />

        <RetailPendingActions userId={profile!.id} onNavigate={onNavigate} />

        <RetailQuickLocations userId={profile!.id} onNavigate={onNavigate} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <RetailSpendingBreakdown userId={profile!.id} />
          <RetailDeliveryChart userId={profile!.id} />
        </div>

        <div className="card p-4 mb-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="section-title">Recent Shipments</h2>
            <button
              onClick={() => onNavigate('/business/jobs')}
              className="flex items-center gap-1 text-sm text-moveme-blue-600 hover:text-moveme-blue-700 font-medium transition-colors"
            >
              View All
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentJobs.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Package className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-gray-900 font-semibold text-sm">No shipments yet</p>
              <p className="text-xs text-gray-400 mt-1">Create your first delivery to get started</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => onNavigate(`/job/${job.id}`)}
                  className="w-full border border-gray-100 rounded-xl p-3.5 hover:bg-gray-50 transition-all text-left hover:shadow-soft active:scale-[0.99] group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-success-500 flex-shrink-0" />
                        <p className="text-sm font-semibold text-gray-900 truncate">{job.pickup_location_text}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-error-500 flex-shrink-0" />
                        <p className="text-xs text-gray-500 truncate">{job.dropoff_location_text}</p>
                      </div>
                    </div>
                    <span className={`badge ml-2 flex-shrink-0 ${getStatusColor(job.status || '')}`}>
                      {getStatusLabel(job.status || '')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-400 pt-2 border-t border-gray-50">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {job.distance_km} km
                    </span>
                    <span className="font-semibold text-gray-700">TTD ${((job as any).customer_total || Math.round((job.customer_offer_ttd || 0) * 1.225 * 100) / 100).toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <RetailQuickTemplates userId={profile!.id} onNavigate={onNavigate} />
          <RetailQuickCouriers userId={profile!.id} onNavigate={onNavigate} />
        </div>

        <div className="mb-5">
          <RetailProfileCard profile={profile!} onNavigate={onNavigate} />
        </div>
      </div>

      <GuidedTour
        steps={retailTourSteps}
        isOpen={showTour}
        onComplete={completeTour}
        onSkip={completeTour}
      />
    </div>
  );
}
