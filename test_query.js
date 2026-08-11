const HASURA_ENDPOINT = 'https://select-satyr-95.hasura.app/v1/graphql';

async function runGraphQL(query) {
  const res = await fetch(HASURA_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hasura-Admin-Secret': 'Wm6QDGSNlVgcNZVUhXVOPg4xMU3yEk18jcBcpZwgyEBdSRfWIehKmKAwezw2o9GN',
      'X-Hasura-Role': 'user',
      'X-Hasura-User-Id': '2700e9f0-b68a-4419-a6fe-7d9ab7eec416'
    },
    body: JSON.stringify({ query })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

runGraphQL(`
  query GetOrgData {
    org_members {
      role
      org {
        id
        name
        usage_calls
        usage_limit
        workflows {
          id
          name
          description
          runs(order_by: { created_at: desc }, limit: 1) {
            status
            started_at
          }
        }
      }
    }
  }
`);
