const jwt = require('jsonwebtoken');

async function diagnose() {
  const API_URL = 'https://ai-agent-workflow-builder-a9ot.vercel.app/api';
  const GRAPHQL_URL = 'https://select-satyr-95.hasura.app/v1/graphql';
  const ADMIN_SECRET = 'Wm6QDGSNlVgcNZVUhXVOPg4xMU3yEk18jcBcpZwgyEBdSRfWIehKmKAwezw2o9GN';

  console.log("1. Logging in as orga-owner@test.com");
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'orga-owner@test.com' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  const user = loginData.user;
  console.log("User from login API:", user);

  console.log("\n2. Decoding JWT");
  const decoded = jwt.decode(token);
  console.log("JWT Claims:", decoded['https://hasura.io/jwt/claims']);

  const userId = decoded['https://hasura.io/jwt/claims']['x-hasura-user-id'];
  console.log("JWT User ID:", userId);

  console.log("\n3. Querying DB directly using Admin Secret to check org_members");
  const adminRes = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hasura-Admin-Secret': ADMIN_SECRET },
    body: JSON.stringify({
      query: `query { org_members(where: { user_id: { _eq: "${userId}" } }) { id org_id role user_id } }`
    })
  });
  const adminData = await adminRes.json();
  console.dir(adminData, {depth: null});

  console.log("\n4. Querying Hasura using User JWT to see what the frontend sees");
  const userRes = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      query: `query { org_members { id org_id role user_id } }`
    })
  });
  const userData = await userRes.json();
  console.dir(userData, {depth: null});
}

diagnose().catch(console.error);
