import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type NoticeTone = 'info' | 'success' | 'warning' | 'error'

type Notice = {
  id: number
  message: string
  title?: string
  tone: NoticeTone
}

type NotifyOptions = {
  title?: string
  tone?: NoticeTone
  timeoutMs?: number
}

type NotificationContextValue = {
  notify: (message: string, options?: NotifyOptions) => void
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([])

  const remove = useCallback((id: number) => {
    setNotices((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const notify = useCallback((message: string, options?: NotifyOptions) => {
    if (!message) return

    const id = Date.now() + Math.random()
    const tone = options?.tone ?? 'info'
    setNotices((prev) => [...prev, { id, message, title: options?.title, tone }])

    const timeout = options?.timeoutMs ?? 3500
    if (timeout > 0) {
      setTimeout(() => remove(id), timeout)
    }
  }, [remove])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="notice-stack" aria-live="polite" aria-atomic="true">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={`notice notice-${notice.tone}`}
            role="status"
            onClick={() => remove(notice.id)}
          >
            {notice.title && <div className="notice-title">{notice.title}</div>}
            <div className="notice-message">{notice.message}</div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotify() {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    throw new Error('useNotify must be used within NotificationProvider')
  }
  return ctx.notify
}
