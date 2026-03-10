import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';

export interface TourStep {
  targetSelector: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface GuidedTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function GuidedTour({ steps, isOpen, onComplete, onSkip }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [viewportRect, setViewportRect] = useState<Rect | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<number>(0);

  const measureTarget = useCallback((stepIndex?: number) => {
    if (showWelcome || !isOpen) return false;
    const idx = stepIndex ?? currentStep;
    const s = steps[idx];
    if (!s) return false;

    const el = document.querySelector(s.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });

        const isInView =
          rect.top >= 0 &&
          rect.bottom <= window.innerHeight &&
          rect.left >= 0 &&
          rect.right <= window.innerWidth;

        const isFixed = window.getComputedStyle(el).position === 'fixed' ||
          (el.closest('[class*="fixed"]') !== null);

        if (!isInView && !isFixed) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return true;
      }
    }
    return false;
  }, [currentStep, steps, isOpen, showWelcome]);

  useEffect(() => {
    if (!isOpen || showWelcome) return;

    const found = measureTarget();

    if (!found) {
      setViewportRect(null);
    }

    const raf = requestAnimationFrame(() => {
      measureTarget();
    });

    let retryCount = 0;
    const retryInterval = setInterval(() => {
      retryCount++;
      const ok = measureTarget();
      if (ok || retryCount >= 10) {
        clearInterval(retryInterval);
      }
    }, 100);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(retryInterval);
    };
  }, [measureTarget, isOpen, currentStep, showWelcome]);

  useEffect(() => {
    if (!isOpen) return;
    const onUpdate = () => {
      if (!showWelcome) measureTarget();
    };
    window.addEventListener('resize', onUpdate);
    window.addEventListener('scroll', onUpdate);
    return () => {
      window.removeEventListener('resize', onUpdate);
      window.removeEventListener('scroll', onUpdate);
    };
  }, [measureTarget, isOpen, showWelcome]);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setShowWelcome(true);
      setViewportRect(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const getTooltipStyle = (): React.CSSProperties => {
    if (!viewportRect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const tooltipH = 180;
    const pad = 16;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const centerX = Math.max(160, Math.min(viewportRect.left + viewportRect.width / 2, viewW - 160));

    let pos = step?.position || 'bottom';

    if (pos === 'top' && viewportRect.top - pad - tooltipH < 0) {
      pos = 'bottom';
    } else if (pos === 'bottom' && viewportRect.top + viewportRect.height + pad + tooltipH > viewH) {
      pos = 'top';
    }

    if (pos === 'top') {
      const topY = Math.max(pad, viewportRect.top - pad);
      return {
        top: `${topY}px`,
        left: `${centerX}px`,
        transform: 'translateX(-50%) translateY(-100%)',
      };
    }

    if (pos === 'left') {
      return {
        top: `${viewportRect.top + viewportRect.height / 2}px`,
        left: `${viewportRect.left - pad}px`,
        transform: 'translate(-100%, -50%)',
      };
    }

    if (pos === 'right') {
      return {
        top: `${viewportRect.top + viewportRect.height / 2}px`,
        left: `${viewportRect.left + viewportRect.width + pad}px`,
        transform: 'translateY(-50%)',
      };
    }

    return {
      top: `${viewportRect.top + viewportRect.height + pad}px`,
      left: `${centerX}px`,
      transform: 'translateX(-50%)',
    };
  };

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (showWelcome) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onSkip} />
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm mx-4 p-6 animate-scale-in">
          <button
            onClick={onSkip}
            className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Welcome to MoveMe!</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Let us show you around. This quick tour will help you get familiar with the key features of your dashboard.
            </p>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => setShowWelcome(false)}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md"
            >
              Start Tour
            </button>
            <button
              onClick={onSkip}
              className="w-full py-2.5 px-4 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <svg
        className="fixed inset-0 w-full h-full z-[9999]"
        onClick={onSkip}
      >
        <defs>
          <mask id="tour-spotlight">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {viewportRect && (
              <rect
                x={viewportRect.left - 8}
                y={viewportRect.top - 8}
                width={viewportRect.width + 16}
                height={viewportRect.height + 16}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#tour-spotlight)"
        />
      </svg>

      {viewportRect && (
        <div
          className="fixed pointer-events-none rounded-xl z-[9999]"
          style={{
            top: viewportRect.top - 8,
            left: viewportRect.left - 8,
            width: viewportRect.width + 16,
            height: viewportRect.height + 16,
            boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.6), 0 0 20px rgba(59, 130, 246, 0.3)',
          }}
        />
      )}

      <div
        ref={tooltipRef}
        className="fixed z-[10000] max-w-xs w-72 pointer-events-auto"
        style={getTooltipStyle()}
      >
        <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="h-1 bg-gray-100">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between mb-1">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                Step {currentStep + 1} of {steps.length}
              </span>
              <button
                onClick={onSkip}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors -mt-1 -mr-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">{step?.title}</h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-3">{step?.description}</p>
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrev}
                disabled={isFirst}
                className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                  isFirst ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                {isLast ? 'Done' : 'Next'}
                {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
