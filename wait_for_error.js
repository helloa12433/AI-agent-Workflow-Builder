async function test() {
  const GRAPHQL_URL = 'https://select-satyr-95.hasura.app/v1/graphql';
  const query = `mutation($wfId: uuid!) { triggerWorkflowRun(workflow_id: $wfId) { run_id status } }`;
  const variables = { wfId: 'd695deb2-fab8-4b0d-bdda-2c451ce15a49' };
  
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hasura-Admin-Secret': 'Wm6QDGSNlVgcNZVUhXVOPg4xMU3yEk18jcBcpZwgyEBdSRfWIehKmKAwezw2o9GN',
      'X-Hasura-Role': 'user',
      'X-Hasura-User-Id': '2700e9f0-b68a-4419-a6fe-7d9ab7eec416'
    },
    body: JSON.stringify({ query, variables })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
