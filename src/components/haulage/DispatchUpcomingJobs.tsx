import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { CalendarClock, MapPin, ArrowRight, Package } from 'lucide-react';
import { Database } from '../../lib/database.types';

type Job = Database['public']['Tables']['jobs']['Row'];

interface DispatchUpcomingJobsProps {
  onNavigate: (path: string) => void;
}

function formatScheduledTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (isToday) return `Today at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` at ${time}`;
}

export function DispatchUpcomingJobs({ onNavigate }: DispatchUpcomingJobsProps) {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    fetchUpcoming();

    const channel = supabase
      .channel('dispatch-upcoming-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `assigned_company_id=eq.${profile.id}`,
        },
        () => {
          fetchUpcoming();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const fetchUpcoming = async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('assigned_company_id', profile!.id)
        .eq('delivery_type', 'scheduled')
        .gte('scheduled_pickup_time', now)
        .in('status', ['assigned', 'on_way_to_pickup'])
        .order('scheduled_pickup_time', { ascending: true })
        .limit(5);

      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error('Error fetching upcoming jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-gray-200 rounded-lg" />
          <div className="h-4 bg-gray-200 rounded w-40" />
        </div>
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock className="w-5 h-5 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Upcoming Scheduled</h3>
        </div>
        <div className="text-center py-4">
          <CalendarClock className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No upcoming scheduled pickups</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-moveme-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">Upcoming Scheduled</h3>
        </div>
        <span className="text-xs bg-moveme-blue-100 text-moveme-blue-700 px-2 py-0.5 rounded-full font-medium">
          {jobs.length} upcoming
        </span>
      </div>

      <div className="space-y-2.5">
        {jobs.map(job => (
          <button
            key={job.id}
            onClick={() => onNavigate(`/job/${job.id}`)}
            className="w-full text-left border border-gray-100 rounded-xl p-3 hover:bg-gray-50 hover:border-moveme-blue-200 transition-all active:scale-[0.99] group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-moveme-blue-600">
                {formatScheduledTime(job.scheduled_pickup_time!)}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-moveme-blue-500 transition-colors" />
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{job.pickup_location_text}</p>
                <p className="text-xs text-gray-400 truncate">{job.dropoff_location_text}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
              <Package className="w-3 h-3" />
              <span>{job.cargo_size_category || 'Standard'}</span>
              <span className="text-gray-300">|</span>
              <span className="font-semibold text-gray-700">TTD ${job.customer_offer_ttd}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
