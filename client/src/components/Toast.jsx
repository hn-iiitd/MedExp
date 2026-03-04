export default function Toast({ message, type = 'success', onClose }) {
  const bgColor = type === 'error' ? 'bg-red-600' : type === 'warning' ? 'bg-yellow-500' : 'bg-green-600';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className={`${bgColor} text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md`}>
        <span className="text-sm">{message}</span>
        <button onClick={onClose} className="text-white/80 hover:text-white flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
