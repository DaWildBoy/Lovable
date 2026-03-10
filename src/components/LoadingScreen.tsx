import { Truck } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading MoveMe TT...' }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-moveme-blue-50 via-white to-moveme-teal-50 flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 rounded-2xl bg-moveme-blue-600/10 animate-pulse-soft" />
          <div className="absolute inset-2 rounded-xl bg-moveme-blue-600/5 flex items-center justify-center">
            <Truck className="w-10 h-10 text-moveme-blue-600 animate-float" />
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-6">
          <div className="w-2 h-2 bg-moveme-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-moveme-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-moveme-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>

        <p className="text-gray-700 font-semibold text-base tracking-tight">{message}</p>
      </div>
    </div>
  );
}
