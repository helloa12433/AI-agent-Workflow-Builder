'use client';

import { useEffect, useState } from 'react';
import { gql } from '@apollo/client';
import * as ApolloReact from '@apollo/client/react';
const useMutation: any = ApolloReact.useMutation || (ApolloReact as any).default?.useMutation;

const CREATE_WORKFLOW = gql`
  mutation CreateWorkflow($orgId: uuid!, $name: String!, $description: String!, $steps: [workflow_steps_insert_input!]!, $triggers: [workflow_triggers_insert_input!]!) {
    insert_workflows_one(object: { org_id: $orgId, name: $name, description: $description, steps: { data: $steps }, triggers: { data: $triggers } }) { id }
  }
`;

export default function TestMutationClient() {
  const [createWorkflow] = useMutation(CREATE_WORKFLOW);
  const [status, setStatus] = useState('waiting');

  useEffect(() => {
    async function test() {
      try {
        setStatus('mutating');
        console.log("Starting mutation...");
        // Use the Org ID from test_data.json
        const orgId = "42ef7618-8e53-44cb-aea7-b539626bd2dd"; 
        
        const res = await createWorkflow({
          variables: {
            orgId: orgId,
            name: "Test Frontend Mutation",
            description: "",
            steps: [],
            triggers: []
          }
        });
        console.log("Mutation success!", res);
        setStatus('success: ' + res.data.insert_workflows_one.id);
        
        // Report to server
        await fetch('/api/test-apollo', { method: 'POST', body: JSON.stringify({ status: 'success', data: res.data }) });
      } catch (err: any) {
        console.error("Mutation failed!", err);
        setStatus('error: ' + err.message);
        await fetch('/api/test-apollo', { method: 'POST', body: JSON.stringify({ status: 'error', error: err.message }) });
      }
    }
    test();
  }, [createWorkflow]);

  return <div>Test Status: {status}</div>;
}
