import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, Clock, UserX, Truck, XCircle, ArrowRight } from 'lucide-react';

interface Alert {
  id: string;
  severity: 'high' | 'medium' | 'low';
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  action?: string;
  jobId?: string;
}

interface DispatchAlertsProps {
  onNavigate: (path: string) => void;
}

export function DispatchAlerts({ onNavigate }: DispatchAlertsProps) {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    analyzeAlerts();

    const channel = supabase
      .channel('dispatch-alerts-live')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `assigned_company_id=eq.${profile.id}`,
        },
        () => {
          analyzeAlerts();
        }
      )
      .subscribe();

    const interval = setInterval(analyzeAlerts, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [profile?.id]);

  const analyzeAlerts = async () => {
    try {
      const [activeJobsRes, driversRes, vehiclesRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, status, assigned_driver_id, assigned_vehicle_id, created_at, updated_at, pickup_location_text, location_updated_at')
          .eq('assigned_company_id', profile!.id)
          .in('status', ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit']),
        supabase
          .from('haulage_drivers')
          .select('id, full_name, is_active')
          .eq('company_id', profile!.id),
        supabase
          .from('haulage_vehicles')
          .select('id, vehicle_name, is_active')
          .eq('company_id', profile!.id)
      ]);

      if (activeJobsRes.error) throw activeJobsRes.error;

      const activeJobs = activeJobsRes.data || [];
      const drivers = driversRes.data || [];
      const vehicles = vehiclesRes.data || [];
      const foundAlerts: Alert[] = [];

      const unassigned = activeJobs.filter(j => j.status === 'assigned' && !j.assigned_driver_id);
      const now = new Date();

      unassigned.forEach(job => {
        const created = new Date(job.created_at);
        const hoursOld = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

        if (hoursOld > 2) {
          foundAlerts.push({
            id: `unassigned-${job.id}`,
            severity: hoursOld > 6 ? 'high' : 'medium',
            icon: UserX,
            title: 'Unassigned Job',
            description: `${job.pickup_location_text?.substring(0, 40)}... waiting ${Math.floor(hoursOld)}h`,
            action: 'Assign Now',
            jobId: job.id
          });
        }
      });

      const inTransitJobs = activeJobs.filter(j =>
        ['on_way_to_pickup', 'cargo_collected', 'in_transit'].includes(j.status)
      );
      inTransitJobs.forEach(job => {
        if (job.location_updated_at) {
          const lastUpdate = new Date(job.location_updated_at);
          const minutesStale = (now.getTime() - lastUpdate.getTime()) / 60000;
          if (minutesStale > 30) {
            foundAlerts.push({
              id: `stale-${job.id}`,
              severity: minutesStale > 60 ? 'high' : 'medium',
              icon: Clock,
              title: 'Stale Location',
              description: `Driver location not updated for ${Math.floor(minutesStale)}min`,
              jobId: job.id
            });
          }
        }
      });

      const activeDriverCount = drivers.filter(d => d.is_active).length;
      const activeVehicleCount = vehicles.filter(v => v.is_active).length;

      if (activeDriverCount === 0 && drivers.length > 0) {
        foundAlerts.push({
          id: 'no-drivers',
          severity: 'medium',
          icon: UserX,
          title: 'No Active Drivers',
          description: `All ${drivers.length} drivers are off duty`
        });
      }

      if (activeVehicleCount === 0 && vehicles.length > 0) {
        foundAlerts.push({
          id: 'no-vehicles',
          severity: 'medium',
          icon: Truck,
          title: 'No Active Vehicles',
          description: `All ${vehicles.length} vehicles are inactive`
        });
      }

      foundAlerts.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.severity] - order[b.severity];
      });

      setAlerts(foundAlerts);
    } catch (err) {
      console.error('Error analyzing alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;
  if (alerts.length === 0) return null;

  const severityStyles = {
    high: { bg: 'bg-error-50', border: 'border-error-200', iconBg: 'bg-error-100', iconColor: 'text-error-600' },
    medium: { bg: 'bg-warning-50', border: 'border-warning-200', iconBg: 'bg-warning-100', iconColor: 'text-warning-600' },
    low: { bg: 'bg-moveme-blue-50', border: 'border-moveme-blue-200', iconBg: 'bg-moveme-blue-100', iconColor: 'text-moveme-blue-600' },
  };

  return (
    <div className="card border-l-4 border-l-warning-500 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning-600" />
          <h3 className="text-sm font-semibold text-gray-900">Attention Needed</h3>
        </div>
        <span className="text-xs bg-warning-100 text-warning-700 px-2 py-0.5 rounded-full font-medium">
          {alerts.length} {alerts.length === 1 ? 'issue' : 'issues'}
        </span>
      </div>

      <div className="space-y-2">
        {alerts.slice(0, 4).map(alert => {
          const style = severityStyles[alert.severity];
          const Icon = alert.icon;
          return (
            <div
              key={alert.id}
              className={`flex items-center gap-3 ${style.bg} ${style.border} border rounded-xl p-3 transition-all`}
            >
              <div className={`w-8 h-8 ${style.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${style.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900">{alert.title}</p>
                <p className="text-[10px] text-gray-500 truncate">{alert.description}</p>
              </div>
              {alert.action && alert.jobId && (
                <button
                  onClick={() => onNavigate(`/job/${alert.jobId}`)}
                  className="text-[10px] font-semibold text-moveme-blue-600 hover:text-moveme-blue-700 flex items-center gap-0.5 flex-shrink-0"
                >
                  {alert.action}
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
