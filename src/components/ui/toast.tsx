import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItemData {
  id: string;
  title?: string;
  description?: string;
  type?: ToastType;
}

interface ToastContextValue {
  toasts: ToastItemData[];
  addToast: (toast: Omit<ToastItemData, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastItemData, "id">) => {
    const id = Math.random().toString(36).slice(2, 11);
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => removeToast(id), 5000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC<{ toasts: ToastItemData[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(t => (
        <ToastCard key={t.id} toast={t} onRemove={() => onRemove(t.id)} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastItemData; onRemove: () => void }> = ({ toast, onRemove }) => {
  let color = "bg-blue-500";
  if (toast.type === "success") color = "bg-green-500";
  else if (toast.type === "error") color = "bg-red-500";
  else if (toast.type === "warning") color = "bg-yellow-500";

  return (
    <div className={`relative p-4 rounded-lg shadow-lg max-w-sm text-white ${color}`}>
      {toast.title ? <div className="font-semibold">{toast.title}</div> : null}
      {toast.description ? <div className="text-sm opacity-90">{toast.description}</div> : null}
      <button
        type="button"
        aria-label="Dismiss notification"
        className="absolute top-2 right-2 hover:text-gray-200"
        onClick={onRemove}
      >
        x
      </button>
    </div>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
};







