
import React, { useEffect, useState } from 'react';

export type ToastMessage = {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
};

export function ToastContainer({ toasts, removeToast }: { toasts: ToastMessage[], removeToast: (id: string) => void }) {
    if (toasts.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 20, // Changed to top based on conventional web app notifications being more visible there or center
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            width: '90%',
            maxWidth: 400,
            pointerEvents: 'none' // Allow clicks through container
        }}>
            {toasts.map(t => (
                <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
            ))}
        </div>
    );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage, onDismiss: () => void }) {
    const [exiting, setExiting] = useState(false);

    // Background colors
    const bg = toast.type === 'success' ? 'rgba(16, 185, 129, 0.95)'
        : toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)'
            : 'rgba(59, 130, 246, 0.95)';

    const icon = toast.type === 'success' ? '✅'
        : toast.type === 'error' ? '⚠️'
            : 'ℹ️';

    return (
        <div
            onClick={() => { setExiting(true); setTimeout(onDismiss, 300); }}
            style={{
                pointerEvents: 'auto',
                background: bg,
                color: 'white',
                padding: '12px 16px',
                borderRadius: 12,
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 14,
                fontWeight: 600,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                animation: exiting ? 'slideOut 0.3s forwards' : 'slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}
        >
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span>{toast.message}</span>
            <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-20px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(-20px) scale(0.9); }
        }
      `}</style>
        </div>
    );
}
