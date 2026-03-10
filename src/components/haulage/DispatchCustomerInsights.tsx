import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Users, Star, Crown, ArrowRight, MessageSquare } from 'lucide-react';

interface TopCustomer {
  userId: string;
  name: string;
  email: string;
  jobCount: number;
  totalSpend: number;
}

interface RecentRating {
  id: string;
  stars: number;
  comment: string | null;
  raterName: string;
  createdAt: string;
}

interface DispatchCustomerInsightsProps {
  onNavigate: (path: string) => void;
}

export function DispatchCustomerInsights({ onNavigate }: DispatchCustomerInsightsProps) {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<TopCustomer[]>([]);
  const [ratings, setRatings] = useState<RecentRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    Promise.all([fetchTopCustomers(), fetchRecentRatings()]).finally(() => setLoading(false));
  }, [profile?.id]);

  const fetchTopCustomers = async () => {
    try {
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('customer_user_id, customer_offer_ttd')
        .eq('assigned_company_id', profile!.id)
        .eq('status', 'completed');

      if (error) throw error;

      const customerMap = new Map<string, { count: number; spend: number }>();
      (jobs || []).forEach(job => {
        const existing = customerMap.get(job.customer_user_id) || { count: 0, spend: 0 };
        existing.count++;
        existing.spend += job.customer_offer_ttd || 0;
        customerMap.set(job.customer_user_id, existing);
      });

      const topIds = Array.from(customerMap.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([id]) => id);

      if (topIds.length === 0) {
        setCustomers([]);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, email')
        .in('id', topIds);

      if (profileError) throw profileError;

      const profileMap = new Map<string, { name: string; email: string }>();
      (profiles || []).forEach(p => {
        profileMap.set(p.id, {
          name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
          email: p.email || ''
        });
      });

      const result: TopCustomer[] = topIds.map(id => {
        const data = customerMap.get(id)!;
        const prof = profileMap.get(id) || { name: 'Unknown Customer', email: '' };
        return {
          userId: id,
          name: prof.name,
          email: prof.email,
          jobCount: data.count,
          totalSpend: data.spend
        };
      });

      setCustomers(result);
    } catch (err) {
      console.error('Error fetching top customers:', err);
    }
  };

  const fetchRecentRatings = async () => {
    try {
      const { data, error } = await supabase
        .from('provider_ratings' as any)
        .select('id, stars, comment, rater_user_id, created_at')
        .eq('provider_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (!data || data.length === 0) {
        setRatings([]);
        return;
      }

      const raterIds = [...new Set((data as any[]).map((r: any) => r.rater_user_id))];
      const { data: raterProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name')
        .in('id', raterIds);

      const raterMap = new Map<string, string>();
      (raterProfiles || []).forEach(p => {
        raterMap.set(p.id, p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Customer');
      });

      setRatings((data as any[]).map((r: any) => ({
        id: r.id,
        stars: r.stars,
        comment: r.comment,
        raterName: raterMap.get(r.rater_user_id) || 'Customer',
        createdAt: r.created_at
      })));
    } catch (err) {
      console.error('Error fetching ratings:', err);
    }
  };

  const rankColors = ['text-yellow-500', 'text-gray-400', 'text-orange-400'];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card p-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-32 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {customers.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-5 h-5 text-warning-500" />
            <h3 className="text-sm font-semibold text-gray-900">Top Customers</h3>
          </div>

          <div className="space-y-2">
            {customers.map((customer, i) => (
              <div
                key={customer.userId}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  {i < 3 ? (
                    <Crown className={`w-3.5 h-3.5 ${rankColors[i]}`} />
                  ) : (
                    <span className="text-[10px] font-bold text-gray-400">#{i + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{customer.name}</p>
                  <p className="text-[10px] text-gray-400">{customer.jobCount} jobs - TTD ${customer.totalSpend.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ratings.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <h3 className="text-sm font-semibold text-gray-900">Recent Ratings</h3>
            </div>
          </div>

          <div className="space-y-3">
            {ratings.map(rating => (
              <div key={rating.id} className="border border-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`w-3 h-3 ${
                          star <= rating.stars
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {new Date(rating.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-xs font-medium text-gray-700">{rating.raterName}</p>
                {rating.comment && (
                  <div className="flex items-start gap-1.5 mt-1.5">
                    <MessageSquare className="w-3 h-3 text-gray-300 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-gray-500 line-clamp-2">{rating.comment}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
