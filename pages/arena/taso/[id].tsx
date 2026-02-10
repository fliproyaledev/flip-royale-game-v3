/**
 * Redirect: /arena/taso/[id] → /arena/card-flip/[id]
 * Old taso URLs are still saved in KV history, this redirect ensures they work
 */
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function TasoRedirect() {
    const router = useRouter()
    const { id } = router.query

    useEffect(() => {
        if (id) {
            router.replace(`/arena/card-flip/${id}`)
        }
    }, [id, router])

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            color: 'white',
            background: '#0a0a1a'
        }}>
            Redirecting...
        </div>
    )
}
