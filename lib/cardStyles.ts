
export interface CardCSSStyles {
    background: string
    borderColor: string
    boxShadow: string
    ringColor: string
    ringGlow: string
    textColor: string
    typeColor: string
}

export function getCardCSSStyles(type: string): CardCSSStyles {
    const styles: Record<string, CardCSSStyles> = {
        pegasus: {
            background: 'linear-gradient(180deg, #2d5a3f 0%, #1a3a28 50%, #050a07 100%)',
            borderColor: '#4a7c59',
            boxShadow: '0 0 15px rgba(74, 124, 89, 0.3)',
            ringColor: '#7cb342',
            ringGlow: '0 0 15px #7cb342, 0 0 30px #7cb342',
            textColor: '#ffffff',
            typeColor: '#4ade80',
        },
        genesis: {
            background: 'linear-gradient(180deg, #6b3d8f 0%, #4a2c6a 50%, #0a0510 100%)',
            borderColor: '#7c4a9e',
            boxShadow: '0 0 15px rgba(124, 74, 158, 0.3)',
            ringColor: '#9c27b0',
            ringGlow: '0 0 15px #9c27b0, 0 0 30px #9c27b0',
            textColor: '#ffffff',
            typeColor: '#c084fc',
        },
        unicorn: {
            background: 'linear-gradient(180deg, #f0c14b 0%, #daa520 50%, #4a3000 100%)',
            borderColor: '#daa520',
            boxShadow: '0 0 15px rgba(218, 165, 32, 0.3)',
            ringColor: '#ffd700',
            ringGlow: '0 0 15px #ffd700, 0 0 30px #ffd700',
            textColor: '#000000',
            typeColor: '#78350f',
        },
        sentient: {
            background: 'linear-gradient(180deg, #2a4a6a 0%, #1a3050 50%, #050a10 100%)',
            borderColor: '#3a5a8a',
            boxShadow: '0 0 15px rgba(58, 90, 138, 0.3)',
            ringColor: '#2196f3',
            ringGlow: '0 0 15px #2196f3, 0 0 30px #2196f3',
            textColor: '#ffffff',
            typeColor: '#60a5fa',
        },
    }
    return styles[type?.toLowerCase()] || styles.sentient
}
