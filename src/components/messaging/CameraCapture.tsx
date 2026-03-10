import { useEffect, useRef, useState } from 'react';
import { X, Camera, Video, SwitchCamera, Square } from 'lucide-react';

interface CameraCaptureProps {
  mode: 'photo' | 'video';
  onCapture: (file: File) => void;
  onClose: () => void;
}

export function CameraCapture({ mode, onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [facingMode]);

  const startCamera = async () => {
    stopCamera();
    setReady(false);
    setError(null);

    try {
      const constraints: MediaStreamConstraints = {
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: mode === 'video',
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      }
    } catch {
      setError('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const toggleFacing = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        stopCamera();
        onCapture(file);
      }
    }, 'image/jpeg', 0.9);
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordingTime(0);

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
      const file = new File([blob], `video_${Date.now()}.${ext}`, { type: mimeType });
      stopCamera();
      onCapture(file);
    };

    recorder.start(100);
    setRecording(true);

    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {recording && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white text-sm font-medium tabular-nums">{formatTime(recordingTime)}</span>
          </div>
        )}

        <button
          onClick={toggleFacing}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
          disabled={recording}
        >
          <SwitchCamera className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="flex items-center justify-center h-full px-6">
            <div className="text-center">
              <Camera className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-white text-sm">{error}</p>
              <button
                onClick={() => { stopCamera(); onClose(); }}
                className="mt-4 px-6 py-2 bg-white/20 text-white rounded-full text-sm"
              >
                Go Back
              </button>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={facingMode === 'user' ? { transform: 'scaleX(-1)' } : undefined}
          />
        )}

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
      </div>

      {ready && !error && (
        <div className="absolute bottom-0 left-0 right-0 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 flex items-center justify-center">
          {mode === 'photo' ? (
            <button
              onClick={takePhoto}
              className="w-[72px] h-[72px] rounded-full border-[4px] border-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <div className="w-[58px] h-[58px] rounded-full bg-white" />
            </button>
          ) : recording ? (
            <button
              onClick={stopRecording}
              className="w-[72px] h-[72px] rounded-full border-[4px] border-red-500 flex items-center justify-center active:scale-95 transition-transform"
            >
              <Square className="w-7 h-7 text-red-500 fill-red-500" />
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="w-[72px] h-[72px] rounded-full border-[4px] border-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <div className="w-[58px] h-[58px] rounded-full bg-red-500" />
            </button>
          )}

          <div className="absolute bottom-[max(2.5rem,calc(env(safe-area-inset-bottom)+0.5rem))] left-0 right-0 flex justify-center">
            <span className="text-white/70 text-xs font-medium">
              {mode === 'photo' ? 'Tap to capture' : recording ? 'Tap to stop' : 'Tap to record'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
