
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastContainer, ToastMessage } from '../components/Toast';

type ToastContextType = {
    toast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const toast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now().toString() + Math.random().toString().slice(2);
        const newToast = { id, message, type };

        setToasts(prev => [...prev, newToast]);

        // Auto dismiss after 3 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
}

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        // Should generally be wrapped, but if not, return a dummy so it doesn't crash apps not fully wrapped yet
        console.warn("useToast called outside provider");
        return { toast: (msg: string) => console.log(msg) };
    }
    return context;
};
