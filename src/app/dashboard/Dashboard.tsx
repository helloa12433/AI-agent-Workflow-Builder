'use client';

import { gql } from '@apollo/client';
import * as ApolloReact from '@apollo/client/react';
const useQuery: any = ApolloReact.useQuery || (ApolloReact as any).default?.useQuery;
import Link from 'next/link';

const GET_ORG_DATA = gql`
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
`;

export default function DashboardPage() {
  const { data, loading, error } = useQuery(GET_ORG_DATA, {
    skip: typeof window === 'undefined'
  });

  if (loading || typeof window === 'undefined') return <div>Loading dashboard...</div>;
  if (error) return <div>Error loading data: {error.message}</div>;

  const membership = data?.org_members[0];
  if (!membership) {
    return (
      <div className="p-8 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg">
        You don't belong to any organization. Please contact an administrator.
      </div>
    );
  }

  const { org, role } = membership;
  const usagePercentage = Math.min((org.usage_calls / org.usage_limit) * 100, 100);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{org.name}</h2>
          <p className="text-sm text-gray-500 capitalize">Role: {role}</p>
        </div>
        
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm min-w-64 border dark:border-zinc-700">
          <div className="flex justify-between text-sm mb-2">
            <span>Quota Usage</span>
            <span className="font-semibold">{org.usage_calls} / {org.usage_limit}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${usagePercentage > 90 ? 'bg-red-500' : 'bg-blue-600'}`} 
              style={{ width: `${usagePercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <h3 className="text-xl font-bold">Your Workflows</h3>
        {(role === 'owner' || role === 'editor') && (
          <Link 
            href="/dashboard/workflows/new" 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            + Create Workflow
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {org.workflows.map((wf: any) => (
          <Link key={wf.id} href={`/dashboard/workflows/${wf.id}`} className="block group">
            <div className="bg-white dark:bg-zinc-800 border dark:border-zinc-700 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-500 transition-all">
              <h4 className="text-lg font-semibold group-hover:text-blue-600 transition-colors">{wf.name}</h4>
              <p className="text-sm text-gray-500 mt-2 line-clamp-2">{wf.description || 'No description'}</p>
              
              <div className="mt-4 pt-4 border-t dark:border-zinc-700 flex items-center justify-between text-xs">
                <span className="text-gray-500">Latest Run:</span>
                {wf.runs.length > 0 ? (
                  <span className={`px-2 py-1 rounded-full font-medium ${
                    wf.runs[0].status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' :
                    wf.runs[0].status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' :
                    wf.runs[0].status === 'paused' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-900/30'
                  }`}>
                    {wf.runs[0].status}
                  </span>
                ) : (
                  <span className="text-gray-400">Never</span>
                )}
              </div>
            </div>
          </Link>
        ))}
        {org.workflows.length === 0 && (
          <div className="col-span-full p-12 text-center border-2 border-dashed rounded-2xl dark:border-zinc-700 text-gray-500">
            No workflows found. Create one to get started!
          </div>
        )}
      </div>
    </div>
  );
}
