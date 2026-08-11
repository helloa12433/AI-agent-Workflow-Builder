async function test() {
  const r = await fetch('https://select-satyr-95.hasura.app/v1/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hasura-Admin-Secret': 'Wm6QDGSNlVgcNZVUhXVOPg4xMU3yEk18jcBcpZwgyEBdSRfWIehKmKAwezw2o9GN'
    },
    body: JSON.stringify({ query: 'query { workflow_runs_by_pk(id: "6e6a3c46-916b-4e15-b33e-8a3988f6000a") { error step_runs { status error output } } }' })
  });
  console.dir(await r.json(), {depth: null});
}
test();
