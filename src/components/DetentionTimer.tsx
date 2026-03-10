import { useState, useEffect, useRef } from 'react';
import { Clock, AlertTriangle, DollarSign, Timer } from 'lucide-react';
import {
  FREE_MINUTES,
  DETENTION_TIERS,
  calculateDetentionFee,
  formatWaitTime,
  updateDetentionThreshold,
} from '../lib/detentionFees';

interface DetentionTimerProps {
  arrivedAt: string;
  vehicleType: string;
  jobBasePrice: number;
  detentionRecordId: string | null;
  variant: 'courier' | 'customer';
  paused?: boolean;
  pausedAt?: string | null;
}

export function DetentionTimer({
  arrivedAt,
  vehicleType,
  jobBasePrice,
  detentionRecordId,
  variant,
  paused = false,
  pausedAt,
}: DetentionTimerProps) {
  const [waitMinutes, setWaitMinutes] = useState(0);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const lastThresholdRef = useRef<string>('none');

  useEffect(() => {
    const arrival = new Date(arrivedAt).getTime();

    if (paused) {
      const endTime = pausedAt ? new Date(pausedAt).getTime() : Date.now();
      const elapsed = endTime - arrival;
      const totalSec = Math.max(0, Math.floor(elapsed / 1000));
      setWaitMinutes(Math.floor(totalSec / 60));
      setWaitSeconds(totalSec % 60);
      return;
    }

    const tick = () => {
      const elapsed = Date.now() - arrival;
      const totalSec = Math.floor(elapsed / 1000);
      setWaitMinutes(Math.floor(totalSec / 60));
      setWaitSeconds(totalSec % 60);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [arrivedAt, paused, pausedAt]);

  useEffect(() => {
    if (!detentionRecordId || paused) return;

    let newThreshold = 'none';
    if (waitMinutes >= 45) newThreshold = 'tier_3';
    else if (waitMinutes >= 25) newThreshold = 'tier_2';
    else if (waitMinutes >= 15) newThreshold = 'tier_1';

    if (newThreshold !== 'none' && newThreshold !== lastThresholdRef.current) {
      lastThresholdRef.current = newThreshold;
      updateDetentionThreshold(
        detentionRecordId,
        waitMinutes,
        vehicleType,
        jobBasePrice
      );
    }
  }, [waitMinutes, detentionRecordId, vehicleType, jobBasePrice, paused]);

  const { fee, tier } = calculateDetentionFee(waitMinutes, vehicleType, jobBasePrice);
  const isFreeTime = waitMinutes < FREE_MINUTES;
  const freeTimeRemaining = Math.max(0, FREE_MINUTES - waitMinutes);

  const timerDisplay = `${String(waitMinutes).padStart(2, '0')}:${String(waitSeconds).padStart(2, '0')}`;

  const nextTier = DETENTION_TIERS.find(t => waitMinutes < t.minutes);

  if (variant === 'courier') {
    return (
      <div className={`rounded-2xl overflow-hidden transition-all duration-500 ${
        tier === 'tier_3'
          ? 'bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-300 shadow-lg shadow-red-100'
          : tier === 'tier_2'
          ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 shadow-md shadow-amber-100'
          : tier === 'tier_1'
          ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200'
          : 'bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-200'
      }`}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isFreeTime
                  ? 'bg-blue-100 text-blue-600'
                  : tier === 'tier_3'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-amber-100 text-amber-600'
              }`}>
                <Timer className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Waiting at Pickup
                </p>
                <p className={`text-xs font-semibold ${
                  isFreeTime ? 'text-blue-700' : 'text-amber-700'
                }`}>
                  {isFreeTime
                    ? `Free time: ${freeTimeRemaining}m remaining`
                    : `Detention fee active`}
                </p>
              </div>
            </div>

            <div className={`font-mono text-2xl font-black tracking-tight tabular-nums ${
              isFreeTime
                ? 'text-blue-700'
                : tier === 'tier_3'
                ? 'text-red-600'
                : 'text-amber-600'
            }`}>
              {timerDisplay}
            </div>
          </div>

          {!isFreeTime && (
            <div className="flex items-center justify-between mt-1 pt-2 border-t border-black/5">
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs font-bold text-green-700">
                  You earn: ${fee.toFixed(0)} TTD
                </span>
              </div>
              {nextTier && (
                <span className="text-[10px] text-gray-500 font-medium">
                  Next tier at {nextTier.minutes}m
                </span>
              )}
            </div>
          )}
        </div>

        {!isFreeTime && (
          <div className="px-4 pb-3">
            <div className="flex gap-1">
              {DETENTION_TIERS.map((t) => (
                <div
                  key={t.tierKey}
                  className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                    waitMinutes >= t.minutes
                      ? t.tierKey === 'tier_3'
                        ? 'bg-red-500'
                        : t.tierKey === 'tier_2'
                        ? 'bg-amber-500'
                        : 'bg-amber-400'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {DETENTION_TIERS.map((t) => (
                <span
                  key={t.tierKey}
                  className={`text-[9px] font-semibold ${
                    waitMinutes >= t.minutes ? 'text-gray-700' : 'text-gray-400'
                  }`}
                >
                  {t.minutes}m
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl overflow-hidden ${
      tier === 'tier_3'
        ? 'bg-red-50 border border-red-200'
        : tier !== 'none'
        ? 'bg-amber-50 border border-amber-200'
        : 'bg-blue-50 border border-blue-200'
    }`}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {tier === 'tier_3' ? (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            ) : tier !== 'none' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            ) : (
              <Clock className="w-4 h-4 text-blue-600" />
            )}
            <div>
              <p className={`text-sm font-bold ${
                tier === 'tier_3'
                  ? 'text-red-800'
                  : tier !== 'none'
                  ? 'text-amber-800'
                  : 'text-blue-800'
              }`}>
                {isFreeTime
                  ? 'Driver Arrived at Pickup'
                  : 'Detention Fee Active'}
              </p>
              <p className="text-xs text-gray-600">
                {isFreeTime
                  ? `Waiting ${formatWaitTime(waitMinutes)} (free period)`
                  : `Waiting ${formatWaitTime(waitMinutes)} -- Fee: $${fee.toFixed(0)} TTD`}
              </p>
            </div>
          </div>

          <div className={`font-mono text-lg font-bold ${
            tier === 'tier_3'
              ? 'text-red-600'
              : tier !== 'none'
              ? 'text-amber-600'
              : 'text-blue-600'
          }`}>
            {timerDisplay}
          </div>
        </div>
      </div>
    </div>
  );
}
