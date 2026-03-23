import { useState } from 'react';
import { X, Upload, CheckCircle, Clock, AlertCircle, FileText, Shield } from 'lucide-react';

interface CourierDocumentsProps {
  open: boolean;
  onClose: () => void;
}

interface DocumentCard {
  id: string;
  title: string;
  description: string;
  status: 'verified' | 'pending' | 'required';
  fileName?: string;
}

const MOCK_DOCUMENTS: DocumentCard[] = [
  {
    id: 'drivers-license',
    title: "Driver's License (Front & Back)",
    description: 'Valid government-issued driver\'s license',
    status: 'verified',
    fileName: 'drivers_license_front_back.pdf',
  },
  {
    id: 'vehicle-insurance',
    title: 'Vehicle Insurance Certificate',
    description: 'Current proof of motor vehicle insurance',
    status: 'pending',
    fileName: 'insurance_cert_2026.pdf',
  },
  {
    id: 'police-certificate',
    title: 'Police Certificate of Character',
    description: 'Issued within the last 6 months',
    status: 'required',
  },
];

const STATUS_CONFIG = {
  verified: {
    label: 'Verified',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: CheckCircle,
    dot: 'bg-emerald-500',
  },
  pending: {
    label: 'Pending Review',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: Clock,
    dot: 'bg-amber-500',
  },
  required: {
    label: 'Upload Required',
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
    icon: AlertCircle,
    dot: 'bg-red-500',
  },
};

export function CourierDocuments({ open, onClose }: CourierDocumentsProps) {
  const [documents] = useState<DocumentCard[]>(MOCK_DOCUMENTS);
  const [dragOver, setDragOver] = useState<string | null>(null);

  if (!open) return null;

  const handleDrop = (e: React.DragEvent, _docId: string) => {
    e.preventDefault();
    setDragOver(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-slide-up">
      <header className="flex-shrink-0 bg-moveme-blue-900 text-white">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Trust & Safety Documents</h1>
              <p className="text-xs text-white/50 mt-0.5">Required for account verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pb-4 flex items-center gap-3">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => {
            const count = documents.filter((d) => d.status === key).length;
            return (
              <div key={key} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                <span className="text-xs text-white/70">
                  {count} {config.label}
                </span>
              </div>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-lg mx-auto p-4 space-y-3">
          {documents.map((doc) => {
            const config = STATUS_CONFIG[doc.status];
            const StatusIcon = config.icon;
            const isDragging = dragOver === doc.id;

            return (
              <div
                key={doc.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900">{doc.title}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{doc.description}</p>
                      </div>
                    </div>
                    <span
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold flex-shrink-0 ${config.bg} ${config.text}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>

                  {doc.fileName && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg mb-3">
                      <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-xs text-slate-600 truncate">{doc.fileName}</span>
                    </div>
                  )}

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(doc.id);
                    }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => handleDrop(e, doc.id)}
                    className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer hover:border-moveme-blue-300 hover:bg-moveme-blue-50/30 ${
                      isDragging
                        ? 'border-moveme-blue-400 bg-moveme-blue-50/50'
                        : doc.status === 'required'
                          ? 'border-red-200 bg-red-50/30'
                          : 'border-gray-200 bg-gray-50/30'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isDragging ? 'bg-moveme-blue-100' : 'bg-slate-100'
                        }`}
                      >
                        <Upload
                          className={`w-4 h-4 ${isDragging ? 'text-moveme-blue-600' : 'text-slate-400'}`}
                        />
                      </div>
                      <p className="text-xs font-medium text-gray-500">
                        {doc.status === 'required' ? 'Upload document' : 'Replace document'}
                      </p>
                      <p className="text-[11px] text-gray-400">PDF, JPG, or PNG up to 10MB</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="pt-2 pb-6">
            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              All documents are encrypted and stored securely. Verification typically takes 1-2
              business days.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
