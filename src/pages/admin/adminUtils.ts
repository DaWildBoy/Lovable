import { supabase } from '../../lib/supabase';

export async function logAuditAction(
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {}
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('admin_audit_log').insert({
    admin_user_id: user.id,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  });
}

export function exportToCsv(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function formatCurrencyTTD(amount: number | null | undefined) {
  return amount != null
    ? `TT$${Number(amount).toLocaleString('en-TT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '--';
}

export function formatDateShort(d: string | null) {
  return d
    ? new Date(d).toLocaleDateString('en-TT', { day: '2-digit', month: 'short', year: 'numeric' })
    : '--';
}

export function timeAgo(dateStr: string | null) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
