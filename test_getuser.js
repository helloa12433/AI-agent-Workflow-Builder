const HASURA_ENDPOINT = 'https://select-satyr-95.hasura.app/v1/graphql';

async function runGraphQL(query, variables) {
  const res = await fetch(HASURA_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hasura-Admin-Secret': 'Wm6QDGSNlVgcNZVUhXVOPg4xMU3yEk18jcBcpZwgyEBdSRfWIehKmKAwezw2o9GN'
    },
    body: JSON.stringify({ query, variables })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

runGraphQL('query GetUser($email: citext!) { users(where: { email: { _eq: $email } }) { id defaultRole } }', { email: 'orga-owner@test.com' });
