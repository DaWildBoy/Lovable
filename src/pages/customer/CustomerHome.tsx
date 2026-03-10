import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Clock, CheckCircle, FileText, Plus, Loader2, MapPin, ArrowRight } from 'lucide-react';
import { Database } from '../../lib/database.types';
import { ActiveDeliveryTracker } from '../../components/customer/ActiveDeliveryTracker';
import { AnnouncementsBanner } from '../../components/customer/AnnouncementsBanner';
import { PendingActions } from '../../components/customer/PendingActions';
import { RateLastDelivery } from '../../components/customer/RateLastDelivery';
import { SavedAddressesQuick } from '../../components/customer/SavedAddressesQuick';
import { SpendingSummary } from '../../components/customer/SpendingSummary';
import { MonthlyDeliveryStats } from '../../components/customer/MonthlyDeliveryStats';
import { QuickRebook } from '../../components/customer/QuickRebook';
import { PreferredCouriers } from '../../components/customer/PreferredCouriers';
import { GuidedTour } from '../../components/GuidedTour';
import { customerTourSteps } from '../../lib/tourSteps';

type Job = Database['public']['Tables']['jobs']['Row'];

interface JobStats {
  active: number;
  pendingQuotes: number;
  completed: number;
}

interface CustomerHomeProps {
  onNavigate: (path: string) => void;
}

export function CustomerHome({ onNavigate }: CustomerHomeProps) {
  const { profile, user } = useAuth();
  const [stats, setStats] = useState<JobStats>({ active: 0, pendingQuotes: 0, completed: 0 });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);

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
    try {
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_user_id', profile!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const active = jobs?.filter(j => ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'delivered', 'in_progress', 'returning'].includes(j.status)).length || 0;
      const pendingQuotes = jobs?.filter(j => ['open', 'bidding'].includes(j.status)).length || 0;
      const completed = jobs?.filter(j => j.status === 'completed').length || 0;

      setStats({ active, pendingQuotes, completed });
      setRecentJobs(jobs?.slice(0, 3) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

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
      case 'cancelled': return 'bg-error-50 text-error-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'open': 'Open',
      'bidding': 'Receiving Bids',
      'assigned': 'Courier Assigned',
      'on_way_to_pickup': 'En Route',
      'cargo_collected': 'Collected',
      'in_transit': 'In Transit',
      'delivered': 'Delivered',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
    };
    return labels[status] || status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-16">
        <Loader2 className="w-8 h-8 text-moveme-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="gradient-header px-4 pt-8 pb-12">
        <div className="max-w-4xl mx-auto">
          <p className="text-white/60 text-sm font-medium mb-1">Good to see you</p>
          <h1 className="text-2xl font-bold tracking-tight">{profile?.first_name || 'Customer'}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 animate-fade-in-up">
        <div className="grid grid-cols-3 gap-3 mb-5">
          <button data-tour="stats-active" onClick={() => onNavigate('/customer/jobs?filter=active')} className="stat-card">
            <div className="flex items-center justify-center w-10 h-10 bg-warning-50 rounded-xl mb-2.5 mx-auto">
              <Clock className="w-5 h-5 text-warning-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Active</p>
          </button>

          <button data-tour="stats-pending" onClick={() => onNavigate('/customer/jobs?filter=pending')} className="stat-card">
            <div className="flex items-center justify-center w-10 h-10 bg-moveme-blue-50 rounded-xl mb-2.5 mx-auto">
              <FileText className="w-5 h-5 text-moveme-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.pendingQuotes}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Pending</p>
          </button>

          <button onClick={() => onNavigate('/customer/jobs?filter=completed')} className="stat-card">
            <div className="flex items-center justify-center w-10 h-10 bg-success-50 rounded-xl mb-2.5 mx-auto">
              <CheckCircle className="w-5 h-5 text-success-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Completed</p>
          </button>
        </div>

        <button
          data-tour="create-delivery"
          onClick={() => onNavigate('/create-job')}
          className="btn-primary w-full py-4 text-base mb-5 shadow-glow-blue"
        >
          <Plus className="w-5 h-5" />
          Create New Delivery
        </button>

        <AnnouncementsBanner userId={profile!.id} />

        <ActiveDeliveryTracker userId={profile!.id} onNavigate={onNavigate} />

        <div className="mb-5">
          <RateLastDelivery userId={profile!.id} onNavigate={onNavigate} />
        </div>

        <div className="mb-5">
          <PendingActions userId={profile!.id} onNavigate={onNavigate} />
        </div>

        <div className="mb-5">
          <SavedAddressesQuick userId={profile!.id} onNavigate={onNavigate} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <SpendingSummary userId={profile!.id} />
          <MonthlyDeliveryStats userId={profile!.id} />
        </div>

        <div className="card p-4 mb-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="section-title">Recent Jobs</h2>
            <button
              onClick={() => onNavigate('/customer/jobs')}
              className="flex items-center gap-1 text-sm text-moveme-blue-600 hover:text-moveme-blue-700 font-medium transition-colors"
            >
              View All
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentJobs.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FileText className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-gray-900 font-semibold text-sm">No jobs yet</p>
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
                    <span className={`badge ml-2 flex-shrink-0 ${getStatusColor(job.status)}`}>
                      {getStatusLabel(job.status)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-400 pt-2 border-t border-gray-50">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {job.distance_km} km
                    </span>
                    <span className="font-semibold text-gray-700">TTD ${job.customer_offer_ttd}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <QuickRebook userId={profile!.id} onNavigate={onNavigate} />
          <PreferredCouriers userId={profile!.id} />
        </div>
      </div>

      <GuidedTour
        steps={customerTourSteps}
        isOpen={showTour}
        onComplete={completeTour}
        onSkip={completeTour}
      />
    </div>
  );
}
