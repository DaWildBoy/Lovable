import { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface MediaViewerProps {
  url: string;
  type: 'image' | 'video';
  onClose: () => void;
}

export function MediaViewer({ url, type, onClose }: MediaViewerProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="w-5 h-5 text-white" />
        </a>
      </div>

      <div
        className="max-w-[90vw] max-h-[85vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {type === 'image' ? (
          <img
            src={url}
            alt=""
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
          />
        ) : (
          <video
            src={url}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded-lg"
          />
        )}
      </div>
    </div>
  );
}
