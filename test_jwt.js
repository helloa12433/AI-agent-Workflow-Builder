async function test() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'orga-owner@test.com' })
  });
  if (!loginRes.ok) throw new Error('Login failed: ' + await loginRes.text());
  const { token } = await loginRes.json();

  const query = `
  query GetOrgData {
    org_members {
      role
      org {
        id
        name
      }
    }
  }`;
  const dataRes = await fetch('https://select-satyr-95.hasura.app/v1/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ query })
  });
  const data = await dataRes.json();
  console.log('Data:', JSON.stringify(data, null, 2));
}
test().catch(console.error);
