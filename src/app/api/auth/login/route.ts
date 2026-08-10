import { NextResponse } from 'next/server';
import { runGraphQL } from '@/lib/hasura';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'this-is-a-very-long-secret-key-that-is-at-least-32-chars-long';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    const query = `
      query GetUser($email: citext!) {
        users(where: { email: { _eq: $email } }) {
          id
          defaultRole
        }
      }
    `;

    const data: any = await runGraphQL(query, { email });
    let user = data.users[0];

    // Auto-create user for demo purposes if it doesn't exist
    if (!user) {
      const insert = `
        mutation CreateUser($email: citext!) {
          insert_users_one(object: { email: $email, defaultRole: "user" }) {
            id
            defaultRole
          }
        }
      `;
      const insertData: any = await runGraphQL(insert, { email });
      user = insertData.insert_users_one;
    }

    const payload = {
      sub: user.id.toString(),
      name: email,
      admin: false,
      "https://hasura.io/jwt/claims": {
        "x-hasura-allowed-roles": [user.defaultRole],
        "x-hasura-default-role": user.defaultRole,
        "x-hasura-user-id": user.id.toString(),
      },
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };

    const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });

    return NextResponse.json({ token, user: { id: user.id, email } });

  } catch (error: any) {
    console.error('Auth error:', error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
