import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DEFAULT_PLATFORM_FEE, VAT_PERCENTAGE, fetchPlatformFeePercentage } from '../lib/pricing';
import { ArrowLeft, Wallet, ArrowUpRight, ArrowDownLeft, Loader2, DollarSign } from 'lucide-react';

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  created_at: string;
  job_id?: string;
}

interface WalletPageProps {
  onNavigate: (path: string) => void;
}

export function WalletPage({ onNavigate }: WalletPageProps) {
  const { user, profile } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const getProfilePath = () => {
    if (!profile) return '/';
    if (profile.role === 'customer') return '/customer/profile';
    if (profile.role === 'courier') return '/courier/profile';
    if (profile.role === 'business') {
      return profile.business_type === 'haulage' ? '/courier/profile' : '/business/profile';
    }
    return '/';
  };

  useEffect(() => {
    fetchWalletData();
  }, [user, profile]);

  const fetchWalletData = async () => {
    if (!profile || !user) return;

    try {
      const feeRate = await fetchPlatformFeePercentage();
      const isCourier = profile.role === 'courier' || (profile.role === 'business' && profile.business_type === 'haulage');

      if (isCourier) {
        const courierField = profile.role === 'business' ? 'assigned_company_id' : 'assigned_courier_id';
        const { data: completedJobs } = await supabase
          .from('jobs')
          .select('id, customer_offer_ttd, driver_net_earnings, return_fee, return_driver_payout, pickup_location_text, dropoff_location_text, updated_at')
          .eq(courierField, user.id)
          .eq('status', 'completed')
          .order('updated_at', { ascending: false })
          .limit(50);

        const jobs = completedJobs || [];
        const txns: Transaction[] = [];
        let totalNetEarnings = 0;

        for (const job of jobs) {
          const baseNet = (job as any).driver_net_earnings ?? Math.round((job.customer_offer_ttd || 0) * (1 - feeRate) * 100) / 100;
          totalNetEarnings += baseNet;

          txns.push({
            id: job.id,
            type: 'credit' as const,
            amount: baseNet,
            description: `Delivery: ${(job.pickup_location_text || '').split(',')[0]} to ${(job.dropoff_location_text || '').split(',')[0]}`,
            created_at: job.updated_at,
            job_id: job.id,
          });

          const returnPayout = Number((job as any).return_driver_payout) || Number((job as any).return_fee) || 0;
          if (returnPayout > 0) {
            txns.push({
              id: `${job.id}-return`,
              type: 'credit' as const,
              amount: returnPayout,
              description: `Return to Base: ${(job.dropoff_location_text || '').split(',')[0]}`,
              created_at: job.updated_at,
              job_id: job.id,
            });
          }
        }

        setBalance(Math.round(totalNetEarnings * 100) / 100);
        setTransactions(txns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      } else {
        const { data: completedJobs } = await supabase
          .from('jobs')
          .select('id, customer_offer_ttd, customer_total, customer_service_fee, pickup_location_text, dropoff_location_text, updated_at')
          .eq('customer_user_id', user.id)
          .eq('status', 'completed')
          .order('updated_at', { ascending: false })
          .limit(50);

        const jobs = completedJobs || [];
        const totalSpent = jobs.reduce((sum, job) => {
          const total = (job as any).customer_total ?? Math.round((job.customer_offer_ttd || 0) * (1 + feeRate + VAT_PERCENTAGE) * 100) / 100;
          return sum + total;
        }, 0);
        setBalance(Math.round(totalSpent * 100) / 100);

        const txns: Transaction[] = jobs.map(job => {
          const total = (job as any).customer_total ?? Math.round((job.customer_offer_ttd || 0) * (1 + feeRate + VAT_PERCENTAGE) * 100) / 100;
          return {
            id: job.id,
            type: 'debit' as const,
            amount: total,
            description: `Delivery: ${(job.pickup_location_text || '').split(',')[0]} to ${(job.dropoff_location_text || '').split(',')[0]}`,
            created_at: job.updated_at,
            job_id: job.id,
          };
        });
        setTransactions(txns);
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const balanceLabel = (profile?.role === 'courier' || (profile?.role === 'business' && profile?.business_type === 'haulage'))
    ? 'Total Earnings'
    : 'Total Spent';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-moveme-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8 animate-fade-in-up">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => onNavigate(getProfilePath())}
            className="flex items-center gap-1.5 text-moveme-blue-600 hover:text-moveme-blue-700 font-medium mb-3 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Profile
          </button>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Wallet</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="gradient-header rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3.5 mb-1">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-white/70">{balanceLabel}</p>
              <p className="text-3xl font-bold text-white">TTD ${balance.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="section-title !mb-0">Transaction History</h2>
          </div>

          {transactions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-900 font-medium mb-1">No transactions yet</p>
              <p className="text-sm text-gray-500">
                Your wallet transactions will appear here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="p-4 hover:bg-gray-50 transition-all">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        transaction.type === 'credit'
                          ? 'bg-success-100 text-success-600'
                          : 'bg-error-100 text-error-600'
                      }`}
                    >
                      {transaction.type === 'credit' ? (
                        <ArrowDownLeft className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{transaction.description}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <p
                      className={`font-semibold text-sm ${
                        transaction.type === 'credit' ? 'text-success-600' : 'text-error-600'
                      }`}
                    >
                      {transaction.type === 'credit' ? '+' : '-'}TTD $
                      {transaction.amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
