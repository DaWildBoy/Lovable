import { useState, useEffect } from 'react';
import { DollarSign, Package, Star, Clock, TrendingUp, Award, MessageSquare, CheckCircle, XCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface PerformanceMetrics {
  totalEarnings: number;
  totalJobs: number;
  overallRating: number;
  onTimeRate: number;
}

interface WeeklyRevenue {
  week: string;
  amount: number;
}

interface JobBreakdown {
  completed: number;
  cancelled: number;
  missed: number;
}

type TimeFilter = '4weeks' | '3months' | '6months' | 'alltime';

interface DriverPerformance {
  id: string;
  name: string;
  jobsCompleted: number;
  totalEarnings: number;
  rating: number;
}

interface Review {
  id: string;
  stars: number;
  comment: string | null;
  created_at: string;
  rater_name: string;
}

export function HaulagePerformanceAnalytics() {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    totalEarnings: 0,
    totalJobs: 0,
    overallRating: 0,
    onTimeRate: 0,
  });
  const [weeklyRevenue, setWeeklyRevenue] = useState<WeeklyRevenue[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('4weeks');
  const [jobBreakdown, setJobBreakdown] = useState<JobBreakdown>({
    completed: 0,
    cancelled: 0,
    missed: 0,
  });
  const [drivers, setDrivers] = useState<DriverPerformance[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      fetchPerformanceData();
    }
  }, [profile, timeFilter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showTimeDropdown && !target.closest('.time-dropdown-container')) {
        setShowTimeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTimeDropdown]);

  const fetchPerformanceData = async () => {
    if (!profile?.id) return;

    try {
      await Promise.all([
        fetchKPIs(),
        fetchWeeklyRevenue(),
        fetchJobBreakdown(),
        fetchDriverPerformance(),
        fetchRecentReviews(),
      ]);
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchKPIs = async () => {
    const { data: jobs } = await supabase
      .from('jobs')
      .select('courier_earnings, status')
      .eq('assigned_company_id', profile!.id)
      .eq('status', 'completed');

    const totalEarnings = jobs?.reduce((sum, job) => sum + (Number(job.courier_earnings) * 0.9 || 0), 0) || 0;
    const totalJobs = jobs?.length || 0;

    setMetrics({
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      totalJobs,
      overallRating: Number(profile?.rating_average) || 0,
      onTimeRate: Number(profile?.haulage_on_time_delivery_rate) || 0,
    });
  };

  const fetchWeeklyRevenue = async () => {
    let startDate = new Date();
    let useMonthlyView = false;

    switch (timeFilter) {
      case '4weeks':
        startDate.setDate(startDate.getDate() - 28);
        break;
      case '3months':
        startDate.setMonth(startDate.getMonth() - 3);
        useMonthlyView = true;
        break;
      case '6months':
        startDate.setMonth(startDate.getMonth() - 6);
        useMonthlyView = true;
        break;
      case 'alltime':
        startDate = new Date('2020-01-01');
        useMonthlyView = true;
        break;
    }

    const { data: jobs } = await supabase
      .from('jobs')
      .select('courier_earnings, updated_at')
      .eq('assigned_company_id', profile!.id)
      .eq('status', 'completed')
      .gte('updated_at', startDate.toISOString())
      .order('updated_at', { ascending: true });

    if (useMonthlyView) {
      const monthlyData: { [key: string]: number } = {};
      const now = new Date();
      const periodMonths: string[] = [];

      let monthCount = 0;
      switch (timeFilter) {
        case '3months':
          monthCount = 3;
          break;
        case '6months':
          monthCount = 6;
          break;
        case 'alltime':
          monthCount = Math.max(12, Math.ceil((now.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));
          break;
      }

      for (let i = monthCount - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        periodMonths.push(monthKey);
        monthlyData[monthKey] = 0;
      }

      jobs?.forEach((job) => {
        const jobDate = new Date(job.updated_at);
        const monthKey = jobDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (monthlyData.hasOwnProperty(monthKey)) {
          monthlyData[monthKey] += (Number(job.courier_earnings) * 0.9 || 0);
        }
      });

      const monthlyArray = periodMonths.map(month => ({
        week: month,
        amount: Math.round(monthlyData[month] * 100) / 100,
      }));

      setWeeklyRevenue(monthlyArray);
    } else {
      const weeklyData: { [key: string]: number } = {};
      const weekNames = ['Week 4', 'Week 3', 'Week 2', 'Week 1'];

      weekNames.forEach(weekName => {
        weeklyData[weekName] = 0;
      });

      jobs?.forEach((job) => {
        const jobDate = new Date(job.updated_at);
        const weeksAgo = Math.floor((Date.now() - jobDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const weekIndex = Math.min(weeksAgo, 3);
        const weekName = weekNames[3 - weekIndex];

        weeklyData[weekName] += (Number(job.courier_earnings) * 0.9 || 0);
      });

      const weeklyArray = weekNames.map(week => ({
        week,
        amount: Math.round(weeklyData[week] * 100) / 100,
      }));

      setWeeklyRevenue(weeklyArray);
    }
  };

  const fetchJobBreakdown = async () => {
    const { data: jobs } = await supabase
      .from('jobs')
      .select('status')
      .eq('assigned_company_id', profile!.id);

    const breakdown = {
      completed: jobs?.filter(j => j.status === 'completed').length || 0,
      cancelled: jobs?.filter(j => j.status === 'cancelled').length || 0,
      missed: jobs?.filter(j => j.status === 'open' || j.status === 'bidding').length || 0,
    };

    setJobBreakdown(breakdown);
  };

  const fetchDriverPerformance = async () => {
    const { data: assignments } = await supabase
      .from('job_assignments')
      .select(`
        driver_id,
        job:jobs(
          status,
          courier_earnings,
          assigned_driver_name
        )
      `)
      .eq('company_id', profile!.id);

    if (!assignments) return;

    const driverMap = new Map<string, DriverPerformance>();

    assignments.forEach((assignment: any) => {
      const driverId = assignment.driver_id;
      const job = assignment.job;

      if (!job) return;

      if (!driverMap.has(driverId)) {
        driverMap.set(driverId, {
          id: driverId,
          name: job.assigned_driver_name || 'Unknown Driver',
          jobsCompleted: 0,
          totalEarnings: 0,
          rating: 0,
        });
      }

      const driver = driverMap.get(driverId)!;

      if (job.status === 'completed') {
        driver.jobsCompleted++;
        driver.totalEarnings += Number(job.courier_earnings) * 0.9 || 0;
      }
    });

    const driverArray = Array.from(driverMap.values())
      .sort((a, b) => b.jobsCompleted - a.jobsCompleted);

    setDrivers(driverArray);
  };

  const fetchRecentReviews = async () => {
    const { data } = await supabase
      .from('provider_ratings')
      .select(`
        id,
        stars,
        comment,
        created_at,
        rater:profiles!provider_ratings_rater_user_id_fkey(first_name, last_name, full_name)
      `)
      .eq('provider_id', profile!.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      const formattedReviews = data.map((review: any) => ({
        id: review.id,
        stars: review.stars,
        comment: review.comment,
        created_at: review.created_at,
        rater_name: review.rater?.full_name || review.rater?.first_name || 'Anonymous',
      }));
      setReviews(formattedReviews);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading performance data...</div>
      </div>
    );
  }

  const maxRevenue = Math.max(...weeklyRevenue.map(w => w.amount), 1);
  const totalJobs = jobBreakdown.completed + jobBreakdown.cancelled + jobBreakdown.missed;

  const getChartTitle = () => {
    switch (timeFilter) {
      case '4weeks':
        return 'Revenue Trend (Last 4 Weeks)';
      case '3months':
        return 'Revenue Trend (Last 3 Months)';
      case '6months':
        return 'Revenue Trend (Last 6 Months)';
      case 'alltime':
        return 'Revenue Trend (All Time)';
    }
  };

  const timeFilterOptions = [
    { value: '4weeks' as TimeFilter, label: 'Last 4 Weeks' },
    { value: '3months' as TimeFilter, label: 'Last 3 Months' },
    { value: '6months' as TimeFilter, label: 'Last 6 Months' },
    { value: 'alltime' as TimeFilter, label: 'All Time' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-green-700">Total Earnings (Net)</span>
          </div>
          <div className="text-2xl font-bold text-green-900">
            ${metrics.totalEarnings.toLocaleString()} <span className="text-sm font-normal text-green-600">TTD</span>
          </div>
          <p className="text-xs text-green-600 mt-1">After 7.5% platform fee</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-blue-700">Jobs Completed</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">
            {metrics.totalJobs}
          </div>
          <p className="text-xs text-blue-600 mt-1">All time</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-600 flex items-center justify-center">
              <Star className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-yellow-700">Overall Rating</span>
          </div>
          <div className="text-2xl font-bold text-yellow-900">
            {metrics.overallRating.toFixed(1)}/5.0
          </div>
          <p className="text-xs text-yellow-600 mt-1">Average across all drivers</p>
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-4 border border-teal-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-teal-700">On-Time Rate</span>
          </div>
          <div className="text-2xl font-bold text-teal-900">
            {metrics.onTimeRate}%
          </div>
          <p className="text-xs text-teal-600 mt-1">Punctuality matters</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Revenue Trend
            </h3>
            <div className="relative time-dropdown-container">
              <button
                onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {timeFilterOptions.find(opt => opt.value === timeFilter)?.label}
                <ChevronDown className={`w-4 h-4 transition-transform ${showTimeDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showTimeDropdown && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  {timeFilterOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setTimeFilter(option.value);
                        setShowTimeDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        timeFilter === option.value
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="relative" style={{ height: '280px' }}>
            <svg width="100%" height="100%" viewBox="0 0 500 280" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity="1" />
                </linearGradient>
              </defs>

              {(() => {
                const chartHeight = 280;
                const chartWidth = 500;
                const padding = { top: 20, right: 20, bottom: 50, left: 60 };
                const plotHeight = chartHeight - padding.top - padding.bottom;
                const plotWidth = chartWidth - padding.left - padding.right;
                const dataCount = weeklyRevenue.length;
                const barSpacing = plotWidth / Math.max(dataCount, 1);
                const barWidth = Math.min(barSpacing * 0.7, 50);

                const yAxisSteps = 5;
                const yAxisMax = maxRevenue > 0 ? Math.ceil(maxRevenue * 1.2 / 100) * 100 : 100;

                return (
                  <>
                    {Array.from({ length: yAxisSteps + 1 }).map((_, i) => {
                      const value = (yAxisMax / yAxisSteps) * (yAxisSteps - i);
                      const y = padding.top + (plotHeight / yAxisSteps) * i;
                      return (
                        <g key={i}>
                          <line
                            x1={padding.left}
                            y1={y}
                            x2={chartWidth - padding.right}
                            y2={y}
                            stroke="#e5e7eb"
                            strokeWidth="1"
                            strokeDasharray={i === yAxisSteps ? "0" : "3 3"}
                          />
                          <text
                            x={padding.left - 10}
                            y={y + 4}
                            textAnchor="end"
                            className="fill-gray-500"
                            style={{ fontSize: '11px', fontWeight: '500' }}
                          >
                            ${Math.round(value)}
                          </text>
                        </g>
                      );
                    })}

                    {weeklyRevenue.map((item, index) => {
                      const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
                      const barHeightValue = item.amount > 0
                        ? Math.min((item.amount / yAxisMax) * plotHeight, plotHeight)
                        : 0;
                      const barY = chartHeight - padding.bottom - barHeightValue;

                      return (
                        <g key={item.week}>
                          <rect
                            x={x}
                            y={barY}
                            width={barWidth}
                            height={barHeightValue}
                            fill="url(#barGradient)"
                            rx="4"
                            className="transition-all duration-300"
                            style={{ filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.2))' }}
                          />

                          {item.amount > 0 && (
                            <text
                              x={x + barWidth / 2}
                              y={barY - 8}
                              textAnchor="middle"
                              className="fill-gray-700"
                              style={{ fontSize: '11px', fontWeight: '600' }}
                            >
                              ${item.amount}
                            </text>
                          )}

                          <text
                            x={x + barWidth / 2}
                            y={chartHeight - padding.bottom + 20}
                            textAnchor="middle"
                            className="fill-gray-600"
                            style={{ fontSize: '10px', fontWeight: '500' }}
                          >
                            {item.week.length > 10 ? item.week.substring(0, 9) : item.week}
                          </text>
                        </g>
                      );
                    })}

                    <line
                      x1={padding.left}
                      y1={chartHeight - padding.bottom}
                      x2={chartWidth - padding.right}
                      y2={chartHeight - padding.bottom}
                      stroke="#374151"
                      strokeWidth="2"
                    />
                    <line
                      x1={padding.left}
                      y1={padding.top}
                      x2={padding.left}
                      y2={chartHeight - padding.bottom}
                      stroke="#374151"
                      strokeWidth="2"
                    />
                  </>
                );
              })()}
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium text-green-700">Completed Jobs</span>
            </div>
            <div className="text-2xl font-bold text-green-900">
              {jobBreakdown.completed}
            </div>
            <p className="text-xs text-green-600 mt-1">
              {totalJobs > 0 ? Math.round((jobBreakdown.completed / totalJobs) * 100) : 0}% of total jobs
            </p>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
                <XCircle className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium text-red-700">Cancelled Jobs</span>
            </div>
            <div className="text-2xl font-bold text-red-900">
              {jobBreakdown.cancelled}
            </div>
            <p className="text-xs text-red-600 mt-1">
              {totalJobs > 0 ? Math.round((jobBreakdown.cancelled / totalJobs) * 100) : 0}% of total jobs
            </p>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center">
                <AlertCircle className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium text-gray-700">Missed/Rejected</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {jobBreakdown.missed}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {totalJobs > 0 ? Math.round((jobBreakdown.missed / totalJobs) * 100) : 0}% of total jobs
            </p>
          </div>
        </div>
      </div>

      {drivers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-orange-600" />
            Driver Leaderboard
          </h3>
          <div className="space-y-3">
            {drivers.slice(0, 5).map((driver, index) => (
              <div
                key={driver.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  index === 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0
                        ? 'bg-yellow-500 text-white'
                        : index === 1
                        ? 'bg-gray-300 text-gray-700'
                        : index === 2
                        ? 'bg-orange-400 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{driver.name}</p>
                    <p className="text-xs text-gray-600">
                      {driver.jobsCompleted} Jobs • ${Math.round(driver.totalEarnings).toLocaleString()} TTD
                    </p>
                  </div>
                </div>
                {index === 0 && (
                  <div className="flex items-center gap-1 text-yellow-600">
                    <Award className="w-4 h-4" />
                    <span className="text-xs font-semibold">Top Performer</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            Recent Reviews
          </h3>
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="border-b border-gray-100 pb-3 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3 h-3 ${
                          star <= review.stars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-sm text-gray-700 mb-1">"{review.comment}"</p>
                )}
                <p className="text-xs text-gray-500">- {review.rater_name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {reviews.length === 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No customer reviews yet</p>
          <p className="text-xs text-gray-500 mt-1">Reviews will appear here after customers rate your service</p>
        </div>
      )}
    </div>
  );
}
