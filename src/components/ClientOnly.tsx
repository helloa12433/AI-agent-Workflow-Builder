'use client';

import dynamic from 'next/dynamic';

const ApolloProvider = dynamic(() => import('./ApolloProvider'), {
  ssr: false,
});

export default function ClientOnly({ children }: { children: React.ReactNode }) {
  return <ApolloProvider>{children}</ApolloProvider>;
}
