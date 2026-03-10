import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Package, MapPin, Clock, DollarSign, Eye, LogOut } from 'lucide-react';
import { Database } from '../lib/database.types';

type Job = Database['public']['Tables']['jobs']['Row'];

interface CustomerDashboardProps {
  onCreateJob: () => void;
  onViewJob: (jobId: string) => void;
}

export function CustomerDashboard({ onCreateJob, onViewJob }: CustomerDashboardProps) {
  const { profile, signOut } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
      case 'bidding':
        return 'bg-blue-100 text-blue-700';
      case 'assigned':
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (filter === 'all') return true;
    return job.status === filter;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MoveMe TT</h1>
            <p className="text-sm text-gray-600">Welcome, {profile?.full_name || profile?.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">My Delivery Jobs</h2>
          <button
            onClick={onCreateJob}
            className="flex items-center gap-2 px-6 py-3 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 transition-all shadow-md"
          >
            <Plus className="w-5 h-5" />
            Create Job
          </button>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {['all', 'open', 'bidding', 'assigned', 'in_progress', 'completed', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border hover:border-gray-300'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs found</h3>
            <p className="text-gray-600 mb-6">
              {filter === 'all' ? 'Create your first delivery job to get started' : `No ${filter} jobs`}
            </p>
            {filter === 'all' && (
              <button
                onClick={onCreateJob}
                className="px-6 py-3 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 transition-all"
              >
                Create Your First Job
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredJobs.map((job) => (
              <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(job.status)}`}>
                    {job.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(job.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex gap-2">
                    <MapPin className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">Pickup</p>
                      <p className="text-sm text-gray-900 truncate">{job.pickup_location_text}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <MapPin className="w-4 h-4 text-red-600 flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">Dropoff</p>
                      <p className="text-sm text-gray-900 truncate">{job.dropoff_location_text}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      <span className="capitalize">{job.cargo_size_category}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-semibold">${job.customer_offer_ttd}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onViewJob(job.id)}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
