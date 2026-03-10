import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Clock, MapPin, Package, DollarSign, Send, Loader2, LogOut, AlertCircle } from 'lucide-react';
import { Database } from '../lib/database.types';
import { parseHoursMinutesToMinutes } from '../lib/timeUtils';

type Job = Database['public']['Tables']['jobs']['Row'];
type Courier = Database['public']['Tables']['couriers']['Row'];

export function CourierDashboard() {
  const { profile, user, signOut } = useAuth();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [biddingJob, setBiddingJob] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidEta, setBidEta] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCourierStatus();
  }, [user]);

  const fetchCourierStatus = async () => {
    try {
      const { data: courierData, error: courierError } = await supabase
        .from('couriers')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (courierError) throw courierError;
      setCourier(courierData);

      if (courierData?.verification_status === 'approved') {
        fetchJobs();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching courier status:', error);
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .in('status', ['open', 'bidding'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitBid = async (jobId: string) => {
    if (!bidAmount || parseFloat(bidAmount) <= 0) {
      alert('Please enter a valid bid amount');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('bids')
        .insert({
          job_id: jobId,
          courier_id: courier!.id,
          amount_ttd: parseFloat(bidAmount),
          eta_minutes: bidEta ? parseHoursMinutesToMinutes(bidEta) : null,
          message: bidMessage || null,
        });

      if (error) throw error;

      await supabase
        .from('jobs')
        .update({ status: 'bidding' })
        .eq('id', jobId);

      setBiddingJob(null);
      setBidAmount('');
      setBidMessage('');
      setBidEta('');
      fetchJobs();
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!courier || courier.verification_status === 'pending') {
    return (
      <div className="min-h-screen bg-moveme-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="inline-flex p-4 rounded-full bg-yellow-100 mb-6">
            <Clock className="w-12 h-12 text-yellow-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Verification Pending
          </h1>

          <p className="text-gray-600 mb-6">
            Your courier application is being reviewed by our team. You'll be notified via email once approved.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              This typically takes 1-2 business days. Thank you for your patience!
            </p>
          </div>

          <button
            onClick={() => signOut()}
            className="w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  if (courier.verification_status === 'rejected') {
    return (
      <div className="min-h-screen bg-moveme-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="inline-flex p-4 rounded-full bg-red-100 mb-6">
            <AlertCircle className="w-12 h-12 text-red-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Application Not Approved
          </h1>

          <p className="text-gray-600 mb-6">
            Unfortunately, your courier application was not approved. Please contact support for more information.
          </p>

          <button
            onClick={() => signOut()}
            className="w-full py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">MoveMe TT</h1>
            <p className="text-sm text-gray-600">Courier Dashboard - {profile?.full_name}</p>
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
        <h2 className="text-xl font-bold text-gray-900 mb-6">Available Jobs</h2>

        {jobs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs available</h3>
            <p className="text-gray-600">Check back soon for new delivery opportunities</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {jobs.map((job) => (
              <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <MapPin className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium">Pickup</span>
                      </div>
                      <p className="text-gray-900 ml-6">{job.pickup_location_text}</p>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 text-gray-600 mb-1">
                        <MapPin className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium">Dropoff</span>
                      </div>
                      <p className="text-gray-900 ml-6">{job.dropoff_location_text}</p>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        <span className="capitalize">{job.cargo_size_category}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>Within {job.urgency_hours}h</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{job.distance_km} km</span>
                      </div>
                    </div>

                    {job.cargo_notes && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700">{job.cargo_notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <p className="text-sm text-gray-600 mb-1">Customer Offer</p>
                      <p className="text-3xl font-bold text-green-600">TTD ${job.customer_offer_ttd}</p>
                    </div>

                    {biddingJob === job.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Your Bid (TTD) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter amount"
                            min="0"
                            step="10"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            ETA (e.g., "2h 30m" or "45m")
                          </label>
                          <input
                            type="text"
                            value={bidEta}
                            onChange={(e) => setBidEta(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g., 2h 30m or 45m"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Message
                          </label>
                          <textarea
                            value={bidMessage}
                            onChange={(e) => setBidMessage(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={2}
                            placeholder="Optional message..."
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setBiddingJob(null)}
                            className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => submitBid(job.id)}
                            disabled={submitting}
                            className="flex-1 py-2 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                          >
                            {submitting ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                <Send className="w-5 h-5" />
                                Submit Bid
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setBiddingJob(job.id);
                          setBidAmount(job.customer_offer_ttd?.toString() || '');
                        }}
                        className="w-full py-3 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 transition-all"
                      >
                        Place Bid
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
