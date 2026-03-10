import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, X, Trash2 } from 'lucide-react';

interface VoiceRecorderProps {
  onSend: (blob: Blob, duration: number) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onSend, onCancel, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setDuration(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = window.setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch {
      alert('Unable to access microphone. Please enable microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onSend(audioBlob, duration);
      reset();
    }
  };

  const reset = () => {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleCancel = () => {
    if (isRecording) stopRecording();
    reset();
    onCancel();
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (!isRecording && !audioBlob) {
    return (
      <button
        type="button"
        onClick={startRecording}
        disabled={disabled}
        className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
      >
        <Mic className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 w-full bg-gray-50 rounded-full px-3 py-1.5 animate-in slide-in-from-bottom-2">
      <button
        onClick={handleCancel}
        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
      >
        {audioBlob ? <Trash2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
      </button>

      {isRecording && (
        <>
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <div className="flex-1 flex items-center gap-[2px] h-8">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="w-[2px] bg-red-400 rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 20 + 4}px`,
                  animationDelay: `${i * 50}ms`
                }}
              />
            ))}
          </div>
          <span className="text-sm font-mono text-red-500 tabular-nums min-w-[40px]">
            {formatDuration(duration)}
          </span>
          <button
            onClick={stopRecording}
            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
          >
            <Square className="w-4 h-4" fill="currentColor" />
          </button>
        </>
      )}

      {audioBlob && !isRecording && (
        <>
          <div className="flex-1">
            <audio src={audioUrl || undefined} controls className="w-full h-8" />
          </div>
          <span className="text-xs text-gray-500 tabular-nums min-w-[40px]">
            {formatDuration(duration)}
          </span>
          <button
            onClick={handleSend}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
