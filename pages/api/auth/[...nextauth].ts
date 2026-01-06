import NextAuth from 'next-auth'
import TwitterProvider from 'next-auth/providers/twitter'
import type { NextAuthOptions } from 'next-auth'

export const authOptions: NextAuthOptions = {
    providers: [
        TwitterProvider({
            clientId: process.env.TWITTER_CLIENT_ID!,
            clientSecret: process.env.TWITTER_CLIENT_SECRET!,
            version: '2.0',
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile }) {
            // İlk login'de X bilgilerini token'a ekle
            if (account && profile) {
                token.xHandle = (profile as any).data?.username || (profile as any).screen_name
                token.xUserId = (profile as any).data?.id || (profile as any).id_str
                token.xName = (profile as any).data?.name || (profile as any).name
                token.xImage = (profile as any).data?.profile_image_url || (profile as any).profile_image_url_https
            }
            return token
        },
        async session({ session, token }) {
            // Session'a X bilgilerini ekle
            if (session.user) {
                (session.user as any).xHandle = token.xHandle
                    ; (session.user as any).xUserId = token.xUserId
                    ; (session.user as any).xName = token.xName
                    ; (session.user as any).xImage = token.xImage
            }
            return session
        },
    },
    pages: {
        signIn: '/auth/signin',
        error: '/auth/error',
    },
    secret: process.env.NEXTAUTH_SECRET,
}

export default NextAuth(authOptions)
