import { useEffect, useRef } from 'react';
import { Camera, Image, MapPin, Video, X } from 'lucide-react';

interface AttachmentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onVideo: () => void;
  onLocation: () => void;
}

export function AttachmentSheet({ isOpen, onClose, onCamera, onGallery, onVideo, onLocation }: AttachmentSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const options = [
    { label: 'Camera', icon: Camera, color: 'bg-rose-500', onClick: onCamera },
    { label: 'Gallery', icon: Image, color: 'bg-blue-500', onClick: onGallery },
    { label: 'Video', icon: Video, color: 'bg-orange-500', onClick: onVideo },
    { label: 'Location', icon: MapPin, color: 'bg-emerald-500', onClick: onLocation },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 animate-in fade-in duration-200">
      <div
        ref={sheetRef}
        className="w-full max-w-lg bg-white rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 safe-bottom"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Share</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 px-5 pb-6 pt-2">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.label}
                onClick={() => {
                  opt.onClick();
                  onClose();
                }}
                className="flex flex-col items-center gap-2 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div className={`w-14 h-14 rounded-2xl ${opt.color} flex items-center justify-center shadow-lg shadow-black/10`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-medium text-gray-600">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
