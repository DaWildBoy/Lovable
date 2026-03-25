import { useState, useEffect, useRef } from 'react';
import { ShieldAlert, ChevronDown, Upload, X, Image, Send, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface PastDelivery {
  id: string;
  reference_id: string;
  dropoff_address: string;
  completed_at: string;
}

export function RetailClaims({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deliveries, setDeliveries] = useState<PastDelivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);

  const [selectedDelivery, setSelectedDelivery] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      setLoadingDeliveries(true);
      const { data } = await supabase
        .from('jobs')
        .select('id, reference_id, dropoff_address, updated_at')
        .eq('customer_id', profile.id)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (data) {
        setDeliveries(data.map(d => ({
          id: d.id,
          reference_id: d.reference_id || d.id.slice(0, 8),
          dropoff_address: d.dropoff_address || 'Unknown address',
          completed_at: d.updated_at,
        })));
      }
      setLoadingDeliveries(false);
    })();
  }, [profile?.id]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos = Array.from(files).slice(0, 5 - photos.length).map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (!selectedDelivery || !description.trim()) return;
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    setSubmitting(false);
    setSubmitted(true);
    setSelectedDelivery('');
    setDescription('');
    setPhotos([]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (!files) return;
    const newPhotos = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 5 - photos.length)
      .map(file => ({ file, preview: URL.createObjectURL(file) }));
    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-TT', { month: 'short', day: 'numeric', year: 'numeric' });

  const selectedInfo = deliveries.find(d => d.id === selectedDelivery);

  const content = (
    <div className="space-y-6">
      {submitted && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800">Claim submitted successfully</p>
            <p className="text-xs text-emerald-600 mt-0.5">Our team will review your claim within 2 business days. You will be notified of the outcome.</p>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Select Past Delivery</label>
        <div className="relative">
          <select
            value={selectedDelivery}
            onChange={e => { setSelectedDelivery(e.target.value); setSubmitted(false); }}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 appearance-none bg-white focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none"
          >
            <option value="">
              {loadingDeliveries ? 'Loading deliveries...' : '-- Select a completed delivery --'}
            </option>
            {deliveries.map(d => (
              <option key={d.id} value={d.id}>
                #{d.reference_id} - {d.dropoff_address.substring(0, 50)} ({formatDate(d.completed_at)})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
        {selectedInfo && (
          <div className="mt-2 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-500">
            Delivery #{selectedInfo.reference_id} -- completed {formatDate(selectedInfo.completed_at)}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Damage Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={5}
          placeholder="Describe the damage or issue in detail. Include what was expected vs what was delivered, estimated value of damaged goods, and any other relevant information..."
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-800 leading-relaxed resize-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none placeholder:text-slate-300"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Photo Evidence</label>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => photos.length < 5 && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            photos.length >= 5
              ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
              : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">
            {photos.length >= 5 ? 'Maximum photos reached' : 'Drop photos here or click to browse'}
          </p>
          <p className="text-xs text-slate-400 mt-1">Up to 5 images. JPG, PNG supported.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {photos.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-4">
            {photos.map((photo, i) => (
              <div key={i} className="relative group">
                <img
                  src={photo.preview}
                  alt={`Evidence ${i + 1}`}
                  className="w-20 h-20 rounded-lg object-cover border border-slate-200"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center">
                  <Image className="w-4 h-4 text-white opacity-0 group-hover:opacity-60 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-400 leading-relaxed">
            Claims are reviewed within 2 business days. Incomplete claims may be returned.
          </p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!selectedDelivery || !description.trim() || submitting}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap"
        >
          <Send className="w-4 h-4" />
          {submitting ? 'Submitting...' : 'Submit Claim'}
        </button>
      </div>
    </div>
  );

  if (embedded) return <div>{content}</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Insurance & Claims</h2>
          <p className="text-sm text-gray-600">File a cargo dispute or damage claim</p>
        </div>
      </div>
      {content}
    </div>
  );
}
