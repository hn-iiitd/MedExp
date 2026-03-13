import { useState } from 'react';

export default function MedicineTable({
  medicines,
  loading,
  sortField,
  sortOrder,
  onSort,
  onDelete,
  onBulkDelete,
}) {
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === medicines.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(medicines.map((m) => m.id)));
    }
  };

  const handleBulkDelete = () => {
    onBulkDelete([...selectedIds]);
    setSelectedIds(new Set());
  };

  const getExpiryStatus = (dateStr) => {
    if (!dateStr) return 'unknown';
    const expiry = new Date(dateStr);
    const now = new Date();
    const threeMonths = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    if (expiry < now) return 'expired';
    if (expiry <= threeMonths) return 'expiring';
    return 'valid';
  };

  const statusColors = {
    expired: 'bg-red-100 text-red-800',
    expiring: 'bg-yellow-100 text-yellow-800',
    valid: 'bg-green-100 text-green-800',
    unknown: 'bg-gray-100 text-gray-600',
  };

  const statusLabels = {
    expired: 'Expired',
    expiring: 'Expiring Soon',
    valid: 'Valid',
    unknown: 'No Date',
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field)
      return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-primary-600 ml-1">{sortOrder === 'ASC' ? '↑' : '↓'}</span>;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (medicines.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        <p className="text-gray-500">No medicines found.</p>
        <p className="text-sm text-gray-400 mt-1">Upload a bill or fetch from your Gmail to get started.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-primary-50 rounded-lg">
          <span className="text-sm text-primary-700 font-medium">
            {selectedIds.size} selected
          </span>
          <button onClick={handleBulkDelete} className="btn-danger text-sm py-1 px-3">
            Delete Selected
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="btn-secondary text-sm py-1 px-3">
            Clear Selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto -mx-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-6 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === medicines.length && medicines.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th
                className="text-left py-3 px-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                onClick={() => onSort('medicine_name')}
              >
                Medicine Name <SortIcon field="medicine_name" />
              </th>
              <th
                className="text-left py-3 px-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                onClick={() => onSort('expiry_date')}
              >
                Expiry Date <SortIcon field="expiry_date" />
              </th>
              <th className="text-left py-3 px-3 font-medium text-gray-600">Batch No</th>
              <th
                className="text-left py-3 px-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                onClick={() => onSort('bill_date')}
              >
                Bill Date <SortIcon field="bill_date" />
              </th>
              <th
                className="text-left py-3 px-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                onClick={() => onSort('distributor_name')}
              >
                Distributor <SortIcon field="distributor_name" />
              </th>
              <th
                className="text-left py-3 px-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                onClick={() => onSort('mrp')}
              >
                MRP <SortIcon field="mrp" />
              </th>
              <th className="text-left py-3 px-3 font-medium text-gray-600">Status</th>
              <th className="text-right py-3 px-6 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {medicines.map((med) => {
              const status = getExpiryStatus(med.expiry_date);
              return (
                <tr
                  key={med.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedIds.has(med.id) ? 'bg-primary-50' : ''
                  }`}
                >
                  <td className="py-3 px-6">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(med.id)}
                      onChange={() => toggleSelect(med.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="py-3 px-3 font-medium text-gray-900">{med.medicine_name}</td>
                  <td className="py-3 px-3 text-gray-700">{formatDate(med.expiry_date)}</td>
                  <td className="py-3 px-3 text-gray-600">{med.batch_no || '—'}</td>
                  <td className="py-3 px-3 text-gray-600">{formatDate(med.bill_date)}</td>
                  <td className="py-3 px-3 text-gray-600">{med.distributor_name || '—'}</td>
                  <td className="py-3 px-3 text-gray-600">{med.mrp != null ? `₹${med.mrp}` : '—'}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}>
                      {statusLabels[status]}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-right">
                    <button
                      onClick={() => onDelete(med.id)}
                      className="text-red-500 hover:text-red-700 transition-colors p-1"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
