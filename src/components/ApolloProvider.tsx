'use client';

import { HttpLink, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { setContext } from '@apollo/client/link/context';
import {
  ApolloNextAppProvider,
  NextSSRInMemoryCache,
  NextSSRApolloClient,
} from "@apollo/experimental-nextjs-app-support/ssr";

function makeClient() {
  const graphqlEndpoint = process.env.NEXT_PUBLIC_HASURA_GRAPHQL_ENDPOINT || 'http://localhost:8080/v1/graphql';
  const wsEndpoint = graphqlEndpoint.replace(/^http/, 'ws');

  const httpLink = new HttpLink({
    uri: graphqlEndpoint,
  });

  const authLink = setContext((_, { headers }) => {
    // Only run localStorage on client
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      return {
        headers: {
          ...headers,
          authorization: token ? `Bearer ${token}` : "",
        }
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
        return {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          }
        };
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

  return new NextSSRApolloClient({
    cache: new NextSSRInMemoryCache(),
    link: splitLink,
  });
}

export default function ApolloProvider({ children }: { children: React.ReactNode }) {
  return (
    <ApolloNextAppProvider makeClient={makeClient}>
      {children}
    </ApolloNextAppProvider>
  );
}
