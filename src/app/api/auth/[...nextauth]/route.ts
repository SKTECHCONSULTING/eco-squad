export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import NextAuth from 'next-auth';
import CognitoProvider from 'next-auth/providers/cognito';
import { NextRequest, NextResponse } from 'next/server';

// NextAuth configuration
const authOptions = {
  providers: [
    CognitoProvider({
      clientId: process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET!,
      issuer: process.env.COGNITO_ISSUER,
      authorization: {
        params: {
          scope: 'openid email profile aws.cognito.signin.user.admin',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }: any) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        
        // Add Cognito groups if available
        if (profile && (profile as any)['cognito:groups']) {
          token.groups = (profile as any)['cognito:groups'];
        }
      }

      // Refresh token if expired
      if (token.expiresAt && Date.now() >= (token.expiresAt as number) * 1000) {
        try {
          const refreshedTokens = await refreshAccessToken(token);
          return refreshedTokens;
        } catch (error) {
          console.error('Error refreshing access token', error);
          return { ...token, error: 'RefreshAccessTokenError' };
        }
      }

      return token;
    },
    async session({ session, token }: any) {
      // Send properties to the client
      session.accessToken = token.accessToken;
      session.idToken = token.idToken;
      session.user.id = token.sub;
      session.user.groups = token.groups || [];
      session.error = token.error;
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  events: {
    async signIn({ user, account, profile }: any) {
      console.log('User signed in:', user.email);
    },
    async signOut({ token }: any) {
      console.log('User signed out:', token.email);
    },
  },
  debug: process.env.NODE_ENV === 'development',
};

/**
 * Refresh Cognito access token
 */
async function refreshAccessToken(token: any) {
  try {
    const url = `${process.env.COGNITO_ISSUER}/oauth2/token`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.COGNITO_CLIENT_ID!,
        client_secret: process.env.COGNITO_CLIENT_SECRET!,
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      idToken: refreshedTokens.id_token || token.idToken,
      expiresAt: Math.floor(Date.now() / 1000 + refreshedTokens.expires_in),
      refreshToken: refreshedTokens.refresh_token || token.refreshToken,
    };
  } catch (error) {
    console.error('RefreshAccessTokenError', error);
    throw error;
  }
}

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
