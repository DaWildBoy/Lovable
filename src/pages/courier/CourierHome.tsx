import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Package, DollarSign, TrendingUp, MapPin, Loader2, Clock, AlertCircle, Smartphone, X, Megaphone, Zap, ArrowRight } from 'lucide-react';
import { Database } from '../../lib/database.types';
import { CourierActiveDelivery } from '../../components/courier/CourierActiveDelivery';
import { CourierTodaysEarnings } from '../../components/courier/CourierTodaysEarnings';
import { CourierRatingSnapshot } from '../../components/courier/CourierRatingSnapshot';
import { CourierWeeklyChart } from '../../components/courier/CourierWeeklyChart';
import { CourierPendingActions } from '../../components/courier/CourierPendingActions';
import { CourierHomeBase } from '../../components/courier/CourierHomeBase';
import { CourierQuickStats } from '../../components/courier/CourierQuickStats';
import { CashReturnBanner } from '../../components/CashReturnBanner';
import { isMobileDevice } from '../../lib/deviceDetection';
import { GuidedTour } from '../../components/GuidedTour';
import { courierTourSteps, haulageTourSteps } from '../../lib/tourSteps';

type Job = Database['public']['Tables']['jobs']['Row'];
type Courier = Database['public']['Tables']['couriers']['Row'];
type CargoItem = Database['public']['Tables']['cargo_items']['Row'];

interface JobWithCargo extends Job {
  cargo_items?: CargoItem[];
}

interface CourierStats {
  availableNearby: number;
  activeDeliveries: number;
  weeklyEarnings: number;
}

interface CourierHomeProps {
  onNavigate: (path: string) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function CourierHome({ onNavigate }: CourierHomeProps) {
  const { profile, user } = useAuth();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [stats, setStats] = useState<CourierStats>({ availableNearby: 0, activeDeliveries: 0, weeklyEarnings: 0 });
  const [nearbyJobs, setNearbyJobs] = useState<JobWithCargo[]>([]);
  const [loading, setLoading] = useState(true);
  const isOnDesktop = !isMobileDevice();
  const [showTour, setShowTour] = useState(false);
  const [showTip, setShowTip] = useState(() => {
    return !sessionStorage.getItem('courier_tip_dismissed');
  });
  const [cashReturnJobs, setCashReturnJobs] = useState<Array<{
    id: string;
    cash_to_return_amount: number;
    cash_collection_status: string;
    pickup_location_text: string;
    customer_user_id: string;
  }>>([]);

  const fetchCashReturnJobs = async (cId?: string) => {
    const id = cId || courier?.id;
    if (!id) return;
    try {
      const { data } = await supabase
        .from('jobs')
        .select('id, cash_to_return_amount, cash_collection_status, pickup_location_text, customer_user_id')
        .eq('assigned_courier_id', id)
        .eq('cash_to_return', true)
        .eq('cash_collection_status', 'collected');
      setCashReturnJobs(data || []);
    } catch (error) {
      console.error('Error fetching cash return jobs:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const fetchData = async () => {
    let courierRef: Courier | null = null;
    try {
      const isHaulageCompany = profile?.role === 'business' && profile?.business_type === 'haulage';

      if (isHaulageCompany) {
        if (profile.business_verification_status !== 'approved') {
          setLoading(false);
          return;
        }
        setCourier({ verification_status: 'approved' } as Courier);
      } else {
        const { data: courierData, error: courierError } = await supabase
          .from('couriers')
          .select('*')
          .eq('user_id', user!.id)
          .maybeSingle();

        if (courierError) throw courierError;
        setCourier(courierData);
        courierRef = courierData;

        if (!courierData || courierData.verification_status !== 'approved') {
          setLoading(false);
          return;
        }

        fetchCashReturnJobs(courierData.id);
      }

      if (isHaulageCompany) {
        const { data: drivers } = await supabase
          .from('haulage_drivers')
          .select('id')
          .eq('company_id', user!.id);

        const { data: availableJobs, error: jobsError } = await supabase
          .from('jobs')
          .select(`*, cargo_items(*)`)
          .in('status', ['open', 'bidding'])
          .order('created_at', { ascending: false })
          .limit(3);

        if (jobsError) throw jobsError;
        setNearbyJobs(availableJobs || []);

        const { data: allAvailableJobs } = await supabase
          .from('jobs')
          .select('id')
          .in('status', ['open', 'bidding']);

        let activeJobsData: { id: string }[] = [];
        if (drivers && drivers.length > 0) {
          const { data: activeJobs } = await supabase
            .from('jobs')
            .select('id')
            .in('status', ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit'])
            .in('assigned_courier_id', drivers.map(d => d.id));

          activeJobsData = activeJobs || [];
        }

        setStats({
          availableNearby: allAvailableJobs?.length || 0,
          activeDeliveries: activeJobsData.length,
          weeklyEarnings: 0,
        });
      } else {
        const { data: availableJobs, error: jobsError } = await supabase
          .from('jobs')
          .select(`*, cargo_items(*)`)
          .in('status', ['open', 'bidding'])
          .order('created_at', { ascending: false })
          .limit(3);

        if (jobsError) throw jobsError;
        setNearbyJobs(availableJobs || []);

        const { data: allAvailableJobs } = await supabase
          .from('jobs')
          .select('id')
          .in('status', ['open', 'bidding']);

        const { data: myBids } = await supabase
          .from('bids')
          .select('job_id')
          .eq('courier_id', courierRef!.id);

        const myBidJobIds = new Set(myBids?.map(b => b.job_id) || []);
        const availableJobsCount = allAvailableJobs?.filter(job => !myBidJobIds.has(job.id)).length || 0;

        const { data: activeJobs } = await supabase
          .from('jobs')
          .select('id')
          .eq('assigned_courier_id', courierRef!.id)
          .in('status', ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'delivered']);

        const { data: completedJobs } = await supabase
          .from('jobs')
          .select('customer_offer_ttd')
          .eq('assigned_courier_id', courierRef!.id)
          .eq('status', 'completed')
          .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        const weeklyEarnings = completedJobs?.reduce((sum, job) => sum + (job.customer_offer_ttd || 0), 0) || 0;

        setStats({
          availableNearby: availableJobsCount,
          activeDeliveries: activeJobs?.length || 0,
          weeklyEarnings,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-moveme-blue-600 flex items-center justify-center animate-pulse-soft">
            <Package className="w-6 h-6 text-white" />
          </div>
          <Loader2 className="w-5 h-5 text-moveme-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  const isHaulageCompany = profile?.role === 'business' && profile?.business_type === 'haulage';
  const verificationStatus = isHaulageCompany ? profile?.business_verification_status : courier?.verification_status;

  if (!verificationStatus || verificationStatus === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-8 flex items-center justify-center p-5">
        <div className="w-full max-w-sm text-center animate-fade-in-up">
          <div className="bg-white rounded-3xl shadow-elevated p-8 border border-gray-100">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-200/50">
              <Clock className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">Verification Pending</h1>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              Your {isHaulageCompany ? 'business' : 'courier'} application is being reviewed. You'll be notified once approved.
            </p>
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
              <p className="text-sm text-blue-700 font-medium">Typically 1-2 business days</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-8 flex items-center justify-center p-5">
        <div className="w-full max-w-sm text-center animate-fade-in-up">
          <div className="bg-white rounded-3xl shadow-elevated p-8 border border-gray-100">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-200/50">
              <AlertCircle className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">Not Approved</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              Your {isHaulageCompany ? 'business' : 'courier'} application was not approved. Please contact support.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isHaulage = profile?.role === 'business' && profile?.business_type === 'haulage';
  const isCompanyDriver = !!(profile as any)?.is_company_driver;
  const isRegularCourier = !isHaulage && !isCompanyDriver;
  const greeting = getGreeting();
  const firstName = isHaulage ? (profile?.company_name || 'Fleet Manager') : (profile?.first_name || 'Courier');

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="gradient-header px-4 pt-8 pb-12">
        <div className="max-w-4xl mx-auto">
          <p className="text-white/60 text-sm font-medium mb-1">{greeting}</p>
          <h1 className="text-2xl font-bold tracking-tight">{firstName}</h1>
          {isHaulage && (
            <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-white/10 rounded-lg text-xs text-white/80 font-medium backdrop-blur-sm border border-white/10">
              Fleet Operations
            </span>
          )}
          {isCompanyDriver && (
            <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-white/10 rounded-lg text-xs text-white/80 font-medium backdrop-blur-sm border border-white/10">
              Company Driver
            </span>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 animate-fade-in-up">
        {isOnDesktop && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 mb-5">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-900">Mobile Device Required</h3>
              <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                GPS tracking, status updates, and proof of delivery require mobile access. Please switch to your phone.
              </p>
            </div>
          </div>
        )}

        <div className={`grid ${isCompanyDriver ? 'grid-cols-2' : 'grid-cols-3'} gap-3 mb-5`}>
          <button
            onClick={() => onNavigate(isHaulage ? '/courier/profile' : '/courier/jobs?tab=available')}
            className="stat-card"
          >
            <div className="flex items-center justify-center w-10 h-10 bg-moveme-blue-50 rounded-xl mb-2.5 mx-auto">
              <Package className="w-5 h-5 text-moveme-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.availableNearby}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">{isHaulage ? 'Active Drivers' : 'Available'}</p>
          </button>

          <button
            onClick={() => onNavigate('/courier/jobs?tab=active')}
            className="stat-card"
          >
            <div className="flex items-center justify-center w-10 h-10 bg-warning-50 rounded-xl mb-2.5 mx-auto">
              <TrendingUp className="w-5 h-5 text-warning-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.activeDeliveries}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Active</p>
          </button>

          {!isCompanyDriver && (
            <button
              onClick={() => onNavigate('/courier/jobs?tab=completed')}
              className="stat-card"
            >
              <div className="flex items-center justify-center w-10 h-10 bg-success-50 rounded-xl mb-2.5 mx-auto">
                <DollarSign className="w-5 h-5 text-success-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">${stats.weeklyEarnings.toFixed(0)}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">This Week</p>
            </button>
          )}
        </div>

        <button
          data-tour="browse-jobs"
          onClick={() => onNavigate('/courier/jobs')}
          className="btn-primary w-full py-4 text-base mb-5 shadow-glow-blue"
        >
          <Zap className="w-5 h-5" />
          Browse Available Jobs
        </button>

        {cashReturnJobs.length > 0 && !isCompanyDriver && (
          <div className="mb-5">
            <CashReturnBanner
              jobs={cashReturnJobs}
              onNavigate={onNavigate}
              onCashReturned={fetchCashReturnJobs}
            />
          </div>
        )}

        {isRegularCourier && courier && user && (
          <CourierActiveDelivery
            courierId={courier.id}
            userId={user.id}
            onNavigate={onNavigate}
          />
        )}

        {isRegularCourier && user && courier && (
          <div className="mb-5">
            <CourierTodaysEarnings userId={user.id} courierId={courier.id} onNavigate={onNavigate} />
          </div>
        )}

        {isRegularCourier && courier && user && (
          <div className="mb-5">
            <CourierPendingActions
              userId={user.id}
              courierId={courier.id}
              onNavigate={onNavigate}
            />
          </div>
        )}

        {isRegularCourier && courier && (
          <div className="mb-5">
            <CourierRatingSnapshot
              ratingAverage={courier.rating_average || 0}
              ratingCount={courier.rating_count || 0}
              completedDeliveries={(courier as any).completed_deliveries_count || 0}
              onNavigate={onNavigate}
            />
          </div>
        )}

        {isRegularCourier && user && courier && (
          <div className="mb-5">
            <CourierWeeklyChart userId={user.id} courierId={courier.id} />
          </div>
        )}

        {isRegularCourier && profile && (
          <div className="mb-5">
            <CourierHomeBase
              homeBaseText={(profile as any).home_base_location_text || null}
              homeBaseLat={(profile as any).home_base_lat || null}
              homeBaseLng={(profile as any).home_base_lng || null}
              onNavigate={onNavigate}
            />
          </div>
        )}

        {isRegularCourier && courier && user && (
          <div className="mb-5">
            <CourierQuickStats userId={user.id} courierId={courier.id} />
          </div>
        )}

        {showTip && (
          <div className="bg-gradient-to-r from-blue-50 to-sky-50 rounded-2xl p-4 border border-blue-100 relative mb-5">
            <button
              onClick={() => {
                setShowTip(false);
                sessionStorage.setItem('courier_tip_dismissed', 'true');
              }}
              className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center hover:bg-blue-100 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5 text-blue-400" />
            </button>
            <div className="flex items-start gap-3 pr-6">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Megaphone className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-900">Pro Tip</p>
                <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                  Set your home base in your profile to get backhaul job suggestions -- earn money on your way home!
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="card p-4 mb-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="section-title">Jobs Near You</h2>
            <button
              onClick={() => onNavigate('/courier/jobs')}
              className="flex items-center gap-1 text-sm text-moveme-blue-600 hover:text-moveme-blue-700 font-medium transition-colors"
            >
              View All
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {nearbyJobs.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Package className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-gray-900 font-semibold text-sm">No jobs available right now</p>
              <p className="text-xs text-gray-400 mt-1">Check back soon for new opportunities</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {nearbyJobs.map((job) => {
                const hasMultipleDropoffs = job.cargo_items?.some(item => item.dropoff_location_text !== null) || false;

                return (
                  <button
                    key={job.id}
                    onClick={() => onNavigate('/courier/jobs')}
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
                      {hasMultipleDropoffs && (
                        <span className="badge bg-warning-50 text-warning-700 ml-2 flex-shrink-0">
                          Multi-stop
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-400 pt-2 border-t border-gray-50">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {job.distance_km} km
                      </span>
                      {!isCompanyDriver && (
                        <span className="font-semibold text-gray-700">TTD ${job.customer_offer_ttd}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <GuidedTour
        steps={isHaulage ? haulageTourSteps : courierTourSteps}
        isOpen={showTour}
        onComplete={completeTour}
        onSkip={completeTour}
      />
    </div>
  );
}
