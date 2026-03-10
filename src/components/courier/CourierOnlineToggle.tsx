import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Wifi, WifiOff } from 'lucide-react';

interface Props {
  courierId: string;
  initialOnline: boolean;
  visibilityLabel?: string;
}

export function CourierOnlineToggle({ courierId, initialOnline, visibilityLabel = 'You are visible to customers' }: Props) {
  const [isOnline, setIsOnline] = useState(initialOnline);
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    const newStatus = !isOnline;

    try {
      const { error } = await supabase
        .from('couriers')
        .update({
          is_online: newStatus,
          last_online_at: newStatus ? new Date().toISOString() : undefined,
        })
        .eq('id', courierId);

      if (!error) {
        setIsOnline(newStatus);
      }
    } catch (err) {
      console.error('Error toggling online status:', err);
    } finally {
      setToggling(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={toggling}
      className={`flex items-center gap-3 w-full rounded-2xl p-4 transition-all duration-300 border ${
        isOnline
          ? 'bg-success-50 border-success-200 shadow-sm'
          : 'bg-gray-50 border-gray-200'
      } ${toggling ? 'opacity-70' : 'active:scale-[0.98]'}`}
    >
      <div className={`relative w-14 h-8 rounded-full transition-colors duration-300 flex-shrink-0 ${
        isOnline ? 'bg-success-500' : 'bg-gray-300'
      }`}>
        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
          isOnline ? 'translate-x-7' : 'translate-x-1'
        }`} />
      </div>
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-success-600" />
          ) : (
            <WifiOff className="w-4 h-4 text-gray-400" />
          )}
          <span className={`text-sm font-bold ${isOnline ? 'text-success-700' : 'text-gray-600'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {isOnline ? visibilityLabel : 'Go online to receive jobs'}
        </p>
      </div>
      {isOnline && (
        <div className="w-2.5 h-2.5 bg-success-500 rounded-full animate-pulse-soft flex-shrink-0" />
      )}
    </button>
  );
}
