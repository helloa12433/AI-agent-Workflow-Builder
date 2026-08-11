'use client';

import { HttpLink, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import {
  ApolloNextAppProvider,
  ApolloClient,
  InMemoryCache,
} from "@apollo/client-integration-nextjs";
import { useEffect, useState } from 'react';

function makeClient() {
  const graphqlEndpoint = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_ENDPOINT || 'https://select-satyr-95.hasura.app/v1/graphql';
  const wsEndpoint = graphqlEndpoint.replace(/^http/, 'ws');

  const httpLink = new HttpLink({
    uri: graphqlEndpoint,
  });

  const authLink = setContext((_, { headers }) => {
    // Only run localStorage on client
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        return {
          headers: {
            ...headers,
            Authorization: `Bearer ${token}`
          }
        };
      }
    }
    return { headers };
  });

  let splitLink;
  
  if (typeof window !== 'undefined') {
    const wsLink = new GraphQLWsLink(createClient({
      url: wsEndpoint,
      connectionParams: () => {
        const token = localStorage.getItem('token');
        if (token) {
          return {
            headers: {
              Authorization: `Bearer ${token}`
            }
          };
        }
        return {};
      }
    }));

    splitLink = split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      authLink.concat(httpLink)
    );
  } else {
    splitLink = authLink.concat(httpLink);
  }

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: splitLink,
  });
}

export default function ApolloProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ApolloNextAppProvider makeClient={makeClient}>
      {children}
    </ApolloNextAppProvider>
  );
}
