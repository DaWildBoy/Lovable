import { useState, useEffect } from 'react';
import { X, MapPin, Navigation, Loader2, PackageCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';
import { AssignedCompanyCard } from './AssignedCompanyCard';

type Job = Database['public']['Tables']['jobs']['Row'];

interface LiveTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}

export function LiveTrackingModal({ isOpen, onClose, jobId }: LiveTrackingModalProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !jobId) return;

    fetchJobData();

    const channel = supabase
      .channel(`tracking-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          setJob(payload.new as Job);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, jobId]);

  const fetchJobData = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      setJob(data);
    } catch (error) {
      console.error('Error fetching job:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getTimeSinceUpdate = () => {
    if (!job?.location_updated_at) return 'Never';
    const diff = Date.now() - new Date(job.location_updated_at).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Navigation className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Live Tracking</h2>
              <p className="text-sm text-blue-100">Follow your delivery in real-time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : job?.tracking_enabled && job.courier_location_lat && job.courier_location_lng ? (
            <div className="space-y-6">
              {job.status === 'loading_cargo' ? (
                <div className="bg-teal-50 border-2 border-teal-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                    <PackageCheck className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-teal-900 mb-1">Status: Loading Cargo</p>
                    <p className="text-sm text-teal-700">Your driver has made contact and is loading your cargo</p>
                    <p className="text-xs text-teal-600 mt-2">
                      Last updated: {getTimeSinceUpdate()}
                    </p>
                  </div>
                </div>
              ) : job.status === 'arrived_waiting' ? (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-amber-900 mb-1">Driver Has Arrived</p>
                    <p className="text-sm text-amber-700">Your driver is waiting at the pickup location. Please meet them.</p>
                    <p className="text-xs text-amber-600 mt-2">
                      Last updated: {getTimeSinceUpdate()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                    <Navigation className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-green-900 mb-1">Courier is on the way</p>
                    <p className="text-sm text-green-700">Your delivery is in transit to the destination</p>
                    <p className="text-xs text-green-600 mt-2">
                      Last updated: {getTimeSinceUpdate()}
                    </p>
                  </div>
                </div>
              )}

              {job.assigned_company_id && job.assigned_company_name && (
                <AssignedCompanyCard
                  companyName={job.assigned_company_name}
                  companyLogoUrl={job.assigned_company_logo_url}
                  isCompleted={false}
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <p className="text-xs font-medium text-gray-600">From</p>
                  </div>
                  <p className="text-sm text-gray-900 font-medium line-clamp-2">
                    {job.pickup_location_text}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-red-600" />
                    <p className="text-xs font-medium text-gray-600">To</p>
                  </div>
                  <p className="text-sm text-gray-900 font-medium line-clamp-2">
                    {job.dropoff_location_text}
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Navigation className="w-5 h-5" />
                  Current Location
                </h3>
                <div className="space-y-2 text-sm text-blue-800">
                  <div className="flex justify-between">
                    <span className="text-blue-600">Latitude:</span>
                    <span className="font-mono font-semibold">{job.courier_location_lat.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Longitude:</span>
                    <span className="font-mono font-semibold">{job.courier_location_lng.toFixed(6)}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <a
                      href={`https://www.google.com/maps?q=${job.courier_location_lat},${job.courier_location_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <MapPin className="w-4 h-4" />
                      View on Google Maps
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800">
                  <strong className="font-semibold">Note:</strong> Location updates every 10 seconds while the courier is in transit.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Navigation className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Tracking Not Available</h3>
              <p className="text-gray-600">
                {job?.tracking_enabled
                  ? 'Waiting for courier location...'
                  : 'Live tracking is only available during transit'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
