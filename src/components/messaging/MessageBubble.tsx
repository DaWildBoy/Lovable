import { useState, useMemo, useRef } from 'react';
import { CheckCheck, Bot, Play, Pause, MapPin, FileText, Download } from 'lucide-react';
import type { Message } from './types';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  onImageClick: (url: string) => void;
  onVideoClick: (url: string) => void;
}

export function MessageBubble({ message, isOwn, showAvatar, onImageClick, onVideoClick }: MessageBubbleProps) {
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRefCb = useRef<HTMLAudioElement | null>(null);
  const isBot = message.sender_type === 'bot';
  const waveformHeights = useMemo(() => Array.from({ length: 28 }, () => Math.random() * 20 + 6), []);
  const isDeleted = message.is_deleted;

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const toggleAudio = () => {
    if (!audioRefCb.current) return;
    if (audioPlaying) {
      audioRefCb.current.pause();
    } else {
      audioRefCb.current.play();
    }
    setAudioPlaying(!audioPlaying);
  };

  const handleAudioEnded = () => {
    setAudioPlaying(false);
  };

  const isLocationMessage = message.attachment_type === 'location' ||
    message.content?.includes('maps.google.com');

  const getLocationCoords = () => {
    if (message.attachment_metadata) {
      const meta = message.attachment_metadata as Record<string, number>;
      if (meta.lat && meta.lng) return { lat: meta.lat, lng: meta.lng };
    }
    const match = message.content?.match(/q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    return null;
  };

  if (isDeleted) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
        <div className={`max-w-[75%] px-3 py-2 rounded-2xl ${
          isOwn ? 'bg-gray-100 rounded-br-md' : 'bg-gray-100 rounded-bl-md'
        }`}>
          <p className="text-sm text-gray-400 italic">This message was deleted</p>
          <span className="text-[10px] text-gray-300 float-right mt-1 ml-3">
            {formatTime(message.created_at)}
          </span>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (message.attachment_type === 'image' && message.attachment_url) {
      return (
        <div className="space-y-1">
          <button
            onClick={() => onImageClick(message.attachment_url!)}
            className="block rounded-lg overflow-hidden"
          >
            <img
              src={message.attachment_url}
              alt=""
              className="max-w-full h-auto rounded-lg"
              style={{ maxHeight: '280px', objectFit: 'cover' }}
              loading="lazy"
            />
          </button>
          {message.content && message.content !== '' && (
            <p className="text-sm whitespace-pre-wrap px-1">{message.content}</p>
          )}
        </div>
      );
    }

    if (message.attachment_type === 'video' && message.attachment_url) {
      return (
        <div className="space-y-1">
          <button
            onClick={() => onVideoClick(message.attachment_url!)}
            className="block rounded-lg overflow-hidden relative group"
          >
            <video
              src={message.attachment_url}
              className="max-w-full h-auto rounded-lg"
              style={{ maxHeight: '280px' }}
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                <Play className="w-6 h-6 text-gray-800 ml-0.5" />
              </div>
            </div>
          </button>
          {message.content && message.content !== '' && (
            <p className="text-sm whitespace-pre-wrap px-1">{message.content}</p>
          )}
        </div>
      );
    }

    if (message.attachment_type === 'audio' && message.attachment_url) {
      const duration = (message.attachment_metadata as Record<string, number>)?.duration;
      return (
        <div className="flex items-center gap-3 min-w-[220px]">
          <audio
            ref={audioRefCb}
            src={message.attachment_url}
            onEnded={handleAudioEnded}
            preload="metadata"
          />
          <button
            onClick={toggleAudio}
            className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center transition-colors ${
              isOwn
                ? 'bg-white/20 hover:bg-white/30'
                : 'bg-blue-100 hover:bg-blue-200'
            }`}
          >
            {audioPlaying ? (
              <Pause className={`w-5 h-5 ${isOwn ? 'text-white' : 'text-blue-600'}`} />
            ) : (
              <Play className={`w-5 h-5 ml-0.5 ${isOwn ? 'text-white' : 'text-blue-600'}`} />
            )}
          </button>
          <div className="flex-1">
            <div className="h-8 flex items-center gap-[2px]">
              {waveformHeights.map((h, i) => (
                <div
                  key={i}
                  className={`w-[3px] rounded-full ${
                    isOwn ? 'bg-white/40' : 'bg-blue-300'
                  }`}
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
            {duration && (
              <span className={`text-[10px] ${isOwn ? 'text-white/70' : 'text-gray-400'}`}>
                {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
              </span>
            )}
          </div>
        </div>
      );
    }

    if (isLocationMessage) {
      const coords = getLocationCoords();
      const mapUrl = coords
        ? `https://maps.google.com/?q=${coords.lat},${coords.lng}`
        : message.content;

      return (
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden"
        >
          <div className="w-full h-32 bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center relative">
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, #999, #999 1px, transparent 1px, transparent 12px), repeating-linear-gradient(90deg, #999, #999 1px, transparent 1px, transparent 12px)'
            }} />
            <MapPin className="w-10 h-10 text-red-500 drop-shadow-md relative z-10" />
          </div>
          <div className="px-2 py-1.5">
            <p className={`text-xs font-medium ${isOwn ? 'text-white/90' : 'text-blue-600'}`}>
              Shared Location
            </p>
            <p className={`text-[10px] ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>
              Tap to open in Maps
            </p>
          </div>
        </a>
      );
    }

    if (message.attachment_type === 'document' && message.attachment_url) {
      const meta = message.attachment_metadata as Record<string, string | number> | null;
      const fileName = meta?.filename as string || 'Document';
      const fileSize = meta?.size as number;

      return (
        <a
          href={message.attachment_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 min-w-[200px]"
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isOwn ? 'bg-white/20' : 'bg-blue-100'
          }`}>
            <FileText className={`w-5 h-5 ${isOwn ? 'text-white' : 'text-blue-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${isOwn ? 'text-white' : 'text-gray-900'}`}>
              {fileName}
            </p>
            {fileSize && (
              <p className={`text-[10px] ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>
                {(fileSize / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
          <Download className={`w-4 h-4 flex-shrink-0 ${isOwn ? 'text-white/70' : 'text-gray-400'}`} />
        </a>
      );
    }

    return (
      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
        {message.content}
      </p>
    );
  };

  const hasMedia = message.attachment_type === 'image' || message.attachment_type === 'video';

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1 group`}>
      {!isOwn && showAvatar && (
        <div className="w-7 h-7 rounded-full flex-shrink-0 mr-2 mt-auto mb-1">
          {isBot ? (
            <div className="w-full h-full rounded-full bg-emerald-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-emerald-600" />
            </div>
          ) : message.sender_avatar ? (
            <img src={message.sender_avatar} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-xs font-semibold text-gray-500">
                {message.sender_name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
          )}
        </div>
      )}
      {!isOwn && !showAvatar && <div className="w-7 mr-2 flex-shrink-0" />}

      <div className={`max-w-[75%] ${hasMedia ? 'p-1' : 'px-3 py-2'} rounded-2xl ${
        isOwn
          ? 'bg-blue-600 text-white rounded-br-md'
          : isBot
            ? 'bg-emerald-50 text-gray-900 rounded-bl-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
      }`}>
        {!isOwn && showAvatar && message.sender_name && (
          <p className={`text-[10px] font-semibold mb-0.5 ${
            isBot ? 'text-emerald-600' : 'text-blue-600'
          } ${hasMedia ? 'px-2 pt-1' : ''}`}>
            {isBot ? 'Support Bot' : message.sender_name}
          </p>
        )}

        {renderContent()}

        <div className={`flex items-center gap-1 mt-0.5 ${
          isOwn ? 'justify-end' : 'justify-end'
        } ${hasMedia ? 'px-2 pb-1' : ''}`}>
          <span className={`text-[10px] ${
            isOwn ? 'text-white/60' : 'text-gray-400'
          }`}>
            {formatTime(message.created_at)}
          </span>
          {isOwn && (
            <CheckCheck className={`w-3.5 h-3.5 ${
              isOwn ? 'text-white/50' : 'text-gray-300'
            }`} />
          )}
        </div>
      </div>
    </div>
  );
}
