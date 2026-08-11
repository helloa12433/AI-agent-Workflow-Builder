async function test() {
  const query = `query { users { id } }`;
  const dataRes = await fetch('https://select-satyr-95.hasura.app/v1/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  console.log(await dataRes.json());
}
test().catch(console.error);
