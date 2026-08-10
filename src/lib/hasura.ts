import { GraphQLClient } from 'graphql-request';

const endpoint = process.env.HASURA_GRAPHQL_ENDPOINT || 'http://localhost:8080/v1/graphql';
const adminSecret = process.env.HASURA_ADMIN_SECRET || 'myadminsecretkey';

export const hasuraAdminClient = new GraphQLClient(endpoint, {
  headers: {
    'X-Hasura-Admin-Secret': adminSecret,
  },
});

export const runGraphQL = async (query: string, variables?: any) => {
  return await hasuraAdminClient.request(query, variables);
};
