// lib/invites.ts
// Invite kod yönetimi - Waitlist ve Referral sistemi için

import { getKV, setKV } from './kv'



// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type InviteCodeType = 'waitlist' | 'admin_bypass' | 'referral'

export type InviteCode = {
    code: string
    type: InviteCodeType
    createdBy: string           // Admin wallet veya referrer wallet
    createdAt: string
    givesFreepack: boolean      // Waitlist kodları için true
    usedBy: string | null       // Kullanan user wallet
    usedAt: string | null
    maxUses?: number            // Referral kodları için sınırsız (undefined)
    useCount: number            // Kaç kez kullanıldı
}

export type InviteCodesStore = {
    codes: Record<string, InviteCode>
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const KV_KEY = 'fliproyale:invites'

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

// 6-8 karakterlik unique kod üret
export function generateInviteCode(length: number = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // O, 0, 1, I karışmasın
    let code = ''
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

// ─────────────────────────────────────────────────────────────
// KV OPERATIONS
// ─────────────────────────────────────────────────────────────

async function loadInviteCodes(): Promise<InviteCodesStore> {
    const raw = await getKV(KV_KEY)
    if (!raw) return { codes: {} }
    try {
        const data = JSON.parse(raw)
        return data && typeof data === 'object' ? data : { codes: {} }
    } catch {
        return { codes: {} }
    }
}

async function saveInviteCodes(store: InviteCodesStore): Promise<void> {
    await setKV(KV_KEY, JSON.stringify(store))
}

// ─────────────────────────────────────────────────────────────
// PUBLIC FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Yeni invite kodu oluştur (Admin veya Referral)
 */
export async function createInviteCode(params: {
    type: InviteCodeType
    createdBy: string
    givesFreepack?: boolean
    maxUses?: number
    customCode?: string
}): Promise<InviteCode> {
    const store = await loadInviteCodes()

    // Kod oluştur (custom veya random)
    let code = params.customCode?.toUpperCase() || generateInviteCode(6)

    // Eğer kod zaten varsa, yeni kod üret
    while (store.codes[code]) {
        code = generateInviteCode(6)
    }

    const inviteCode: InviteCode = {
        code,
        type: params.type,
        createdBy: params.createdBy.toLowerCase(),
        createdAt: new Date().toISOString(),
        givesFreepack: params.givesFreepack ?? (params.type === 'waitlist'),
        usedBy: null,
        usedAt: null,
        maxUses: params.type === 'referral' ? undefined : (params.maxUses ?? 1),
        useCount: 0
    }

    store.codes[code] = inviteCode
    await saveInviteCodes(store)

    return inviteCode
}

/**
 * Invite kodunu doğrula
 */
export async function validateInviteCode(code: string): Promise<{
    valid: boolean
    invite?: InviteCode
    error?: string
}> {
    if (!code) return { valid: false, error: 'Code is required' }

    const store = await loadInviteCodes()
    const invite = store.codes[code.toUpperCase()]

    if (!invite) {
        return { valid: false, error: 'Invalid invite code' }
    }

    // Tek kullanımlık kodlar için kontrol
    if (invite.maxUses !== undefined && invite.useCount >= invite.maxUses) {
        return { valid: false, error: 'Invite code already used' }
    }

    return { valid: true, invite }
}

/**
 * Invite kodunu kullan
 */
export async function useInviteCode(code: string, userId: string): Promise<{
    success: boolean
    invite?: InviteCode
    error?: string
}> {
    const validation = await validateInviteCode(code)
    if (!validation.valid) {
        return { success: false, error: validation.error }
    }

    const store = await loadInviteCodes()
    const invite = store.codes[code.toUpperCase()]

    // Kodu güncelle
    invite.useCount += 1
    invite.usedBy = userId.toLowerCase()
    invite.usedAt = new Date().toISOString()

    store.codes[code.toUpperCase()] = invite
    await saveInviteCodes(store)

    return { success: true, invite }
}

/**
 * Kullanıcının referral kodunu al veya oluştur
 */
export async function getUserReferralCode(userId: string): Promise<InviteCode | null> {
    const store = await loadInviteCodes()

    // Kullanıcının mevcut referral kodunu bul
    const existingCode = Object.values(store.codes).find(
        c => c.type === 'referral' && c.createdBy === userId.toLowerCase()
    )

    return existingCode || null
}

/**
 * Kullanıcı için referral kodu oluştur (1 paket aldıktan sonra)
 */
export async function createUserReferralCode(userId: string): Promise<InviteCode> {
    // Mevcut kodu kontrol et
    const existing = await getUserReferralCode(userId)
    if (existing) return existing

    // Yeni referral kodu oluştur
    return createInviteCode({
        type: 'referral',
        createdBy: userId,
        givesFreepack: false
    })
}

/**
 * Referrer'ın davet ettiği kullanıcıları getir
 */
export async function getReferrals(referrerId: string): Promise<{
    code: string
    referrals: { userId: string; usedAt: string }[]
}> {
    const store = await loadInviteCodes()

    // Referrer'ın kodunu bul
    const referralCode = Object.values(store.codes).find(
        c => c.type === 'referral' && c.createdBy === referrerId.toLowerCase()
    )

    if (!referralCode) {
        return { code: '', referrals: [] }
    }

    // Bu kodla giren kullanıcıları bul
    // Not: Aslında burada users'dan referredBy alanına bakmak gerekiyor
    // Şimdilik sadece kod bilgisini dönüyoruz

    return {
        code: referralCode.code,
        referrals: referralCode.usedBy ? [{
            userId: referralCode.usedBy,
            usedAt: referralCode.usedAt || ''
        }] : []
    }
}

/**
 * Tüm invite kodlarını listele (Admin için)
 */
export async function listInviteCodes(filter?: {
    type?: InviteCodeType
    unused?: boolean
}): Promise<InviteCode[]> {
    const store = await loadInviteCodes()
    let codes = Object.values(store.codes)

    if (filter?.type) {
        codes = codes.filter(c => c.type === filter.type)
    }

    if (filter?.unused === true) {
        codes = codes.filter(c => c.maxUses === undefined || c.useCount < c.maxUses)
    }

    return codes.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
}
