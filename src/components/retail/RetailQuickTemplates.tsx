import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Plus, ChevronRight, Zap } from 'lucide-react';

interface Template {
  id: string;
  template_name: string;
  pod_requirements: string;
  delivery_order_preference: string;
}

interface Props {
  userId: string;
  onNavigate: (path: string) => void;
}

export function RetailQuickTemplates({ userId, onNavigate }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, [userId]);

  const fetchTemplates = async () => {
    try {
      setTemplates([]);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-moveme-teal-600" />
          <h3 className="text-sm font-bold text-gray-900">Delivery Templates</h3>
        </div>
        <button
          onClick={() => onNavigate('/business/profile?tab=templates')}
          className="text-xs font-medium text-moveme-blue-600 hover:text-moveme-blue-700 flex items-center gap-0.5"
        >
          Manage
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {templates.length === 0 ? (
        <button
          onClick={() => onNavigate('/business/profile?tab=templates')}
          className="w-full flex items-center justify-center gap-2 py-5 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Create your first template</span>
        </button>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => onNavigate('/create-job')}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 hover:border-gray-200 transition-all active:scale-[0.99] text-left group"
            >
              <div className="w-8 h-8 bg-moveme-teal-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="w-3.5 h-3.5 text-moveme-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{template.template_name}</p>
                <p className="text-[10px] text-gray-400">
                  POD: {template.pod_requirements} | {template.delivery_order_preference}
                </p>
              </div>
              <span className="text-[10px] text-moveme-teal-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                Use
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
