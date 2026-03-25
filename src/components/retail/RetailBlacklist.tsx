import { useState, useEffect } from 'react';
import { UserX, Search, ShieldOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface RestrictedDriver {
  id: string;
  courier_id: string;
  courier_name: string;
  courier_avatar?: string;
  reason: string;
  restricted_at: string;
}

export function RetailBlacklist({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState<RestrictedDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('restricted_drivers')
        .select('id, courier_id, reason, created_at, courier:profiles!restricted_drivers_courier_id_fkey(full_name, avatar_url)')
        .eq('business_id', profile.id)
        .order('created_at', { ascending: false });

      if (data) {
        setDrivers(data.map((d: any) => ({
          id: d.id,
          courier_id: d.courier_id,
          courier_name: d.courier?.full_name || 'Unknown Driver',
          courier_avatar: d.courier?.avatar_url,
          reason: d.reason || 'No reason specified',
          restricted_at: d.created_at,
        })));
      }
      setLoading(false);
    })();
  }, [profile?.id]);

  const handleRemoveBan = async (id: string) => {
    setRemoving(id);
    await supabase.from('restricted_drivers').delete().eq('id', id);
    setDrivers(drivers.filter(d => d.id !== id));
    setRemoving(null);
  };

  const filtered = drivers.filter(d =>
    d.courier_name.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-TT', { month: 'short', day: 'numeric', year: 'numeric' });

  const content = (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
        <ShieldOff className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-red-700 leading-relaxed">
          Drivers on this list will <strong>never see or bid on your company's dispatches</strong>. Removing a ban restores their access immediately.
        </p>
      </div>

      {drivers.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search restricted drivers..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none"
          />
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-500">Loading restricted drivers...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
          <UserX className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">
            {drivers.length === 0 ? 'No restricted drivers' : 'No matching drivers'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {drivers.length === 0
              ? 'You have not restricted any drivers from your dispatches'
              : 'Try a different search term'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(driver => (
            <div
              key={driver.id}
              className="flex items-center gap-4 border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
            >
              {driver.courier_avatar ? (
                <img src={driver.courier_avatar} alt={driver.courier_name} className="w-11 h-11 rounded-full object-cover" />
              ) : (
                <div className="w-11 h-11 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-slate-500">
                    {driver.courier_name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{driver.courier_name}</p>
                <p className="text-xs text-slate-500 mt-0.5">Restricted {formatDate(driver.restricted_at)}</p>
                {driver.reason && (
                  <p className="text-xs text-slate-400 italic mt-1 truncate">{driver.reason}</p>
                )}
              </div>
              <button
                onClick={() => handleRemoveBan(driver.id)}
                disabled={removing === driver.id}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors text-xs font-semibold whitespace-nowrap"
              >
                <UserX className="w-3.5 h-3.5" />
                {removing === driver.id ? 'Removing...' : 'Remove Ban'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-500 leading-relaxed">
          To restrict a driver, navigate to a completed job and select "Restrict Driver" from the driver's profile actions.
        </p>
      </div>
    </div>
  );

  if (embedded) return <div>{content}</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-100 text-red-600 rounded-lg flex items-center justify-center">
          <UserX className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Restricted Drivers</h2>
          <p className="text-sm text-gray-600">Manage blocked drivers</p>
        </div>
      </div>
      {content}
    </div>
  );
}
