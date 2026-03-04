import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import Header from '../components/Header';
import UploadBill from '../components/UploadBill';
import FetchEmails from '../components/FetchEmails';
import MedicineTable from '../components/MedicineTable';
import AddMedicineModal from '../components/AddMedicineModal';
import Toast from '../components/Toast';

export default function Dashboard() {
  const { user } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('expiry_date');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchMedicines = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getMedicines({
        sort: sortField,
        order: sortOrder,
        search,
      });
      setMedicines(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [sortField, sortOrder, search]);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  const handleSort = (field) => {
    if (field === sortField) {
      setSortOrder((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortField(field);
      setSortOrder('ASC');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this medicine?')) return;
    try {
      await api.deleteMedicine(id);
      setMedicines((prev) => prev.filter((m) => m.id !== id));
      showToast('Medicine deleted successfully');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleBulkDelete = async (ids) => {
    if (!confirm(`Delete ${ids.length} selected medicine(s)?`)) return;
    try {
      await api.deleteMedicines(ids);
      setMedicines((prev) => prev.filter((m) => !ids.includes(m.id)));
      showToast(`${ids.length} medicine(s) deleted`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUploadSuccess = (result) => {
    showToast(result.message);
    fetchMedicines();
  };

  const handleEmailFetchSuccess = (result) => {
    showToast(result.message);
    fetchMedicines();
  };

  const handleAddMedicine = async (data) => {
    try {
      await api.addMedicine(data);
      showToast('Medicine added successfully');
      setShowAddModal(false);
      fetchMedicines();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Calculate stats
  const totalMedicines = medicines.length;
  const expiredCount = medicines.filter((m) => {
    if (!m.expiry_date) return false;
    return new Date(m.expiry_date) < new Date();
  }).length;
  const expiringCount = medicines.filter((m) => {
    if (!m.expiry_date) return false;
    const expiry = new Date(m.expiry_date);
    const now = new Date();
    const threeMonths = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    return expiry >= now && expiry <= threeMonths;
  }).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalMedicines}</p>
              <p className="text-sm text-gray-500">Total Medicines</p>
            </div>
          </div>

          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{expiringCount}</p>
              <p className="text-sm text-gray-500">Expiring Soon (90 days)</p>
            </div>
          </div>

          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{expiredCount}</p>
              <p className="text-sm text-gray-500">Expired</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <UploadBill onSuccess={handleUploadSuccess} onError={(msg) => showToast(msg, 'error')} />
          <FetchEmails onSuccess={handleEmailFetchSuccess} onError={(msg) => showToast(msg, 'error')} />
        </div>

        {/* Medicine Table */}
        <div className="card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Your Medicines</h2>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search medicines..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field sm:w-64"
              />
              <button onClick={() => setShowAddModal(true)} className="btn-primary whitespace-nowrap">
                + Add Medicine
              </button>
            </div>
          </div>

          <MedicineTable
            medicines={medicines}
            loading={loading}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
          />
        </div>
      </main>

      {showAddModal && (
        <AddMedicineModal
          onAdd={handleAddMedicine}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
