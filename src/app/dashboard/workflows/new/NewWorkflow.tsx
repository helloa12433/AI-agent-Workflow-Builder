'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { gql } from '@apollo/client';
import * as ApolloReact from '@apollo/client/react';
const useQuery: any = ApolloReact.useQuery || (ApolloReact as any).default?.useQuery;
const useMutation: any = ApolloReact.useMutation || (ApolloReact as any).default?.useMutation;
import { Plus, Trash2, Save, GripVertical } from 'lucide-react';

const GET_ORGS = gql`
  query GetMyOrgs {
    org_members {
      org_id
      role
      org {
        name
      }
    }
  }
`;

const CREATE_WORKFLOW = gql`
  mutation CreateWorkflow(
    $orgId: uuid!, 
    $name: String!, 
    $description: String!, 
    $steps: [workflow_steps_insert_input!]!,
    $triggers: [workflow_triggers_insert_input!]!
  ) {
    insert_workflows_one(object: {
      org_id: $orgId,
      name: $name,
      description: $description,
      steps: { data: $steps },
      triggers: { data: $triggers }
    }) {
      id
    }
  }
`;

export default function NewWorkflowPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('manual');
  const [steps, setSteps] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: orgData, loading: orgLoading } = useQuery(GET_ORGS, { skip: typeof window === 'undefined' });
  const [createWorkflow] = useMutation(CREATE_WORKFLOW);

  if (orgLoading || typeof window === 'undefined') return <div className="p-8">Loading...</div>;
  
  const myOrg = orgData?.org_members[0];
  if (!myOrg || (myOrg.role !== 'owner' && myOrg.role !== 'editor')) {
    return <div className="p-8 text-red-500">Access denied. Must be owner or editor.</div>;
  }

  const addStep = (type: string) => {
    let defaultConfig = {};
    if (type === 'llm_call') defaultConfig = { prompt: "Summarize this: {{input}}" };
    if (type === 'http_request') defaultConfig = { url: "https://jsonplaceholder.typicode.com/todos/1", method: "GET" };
    if (type === 'conditional_branch') defaultConfig = { match: "APPROVE|REJECT" };

    setSteps([...steps, { id: Date.now().toString(), type, config: JSON.stringify(defaultConfig, null, 2) }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, dir: number) => {
    if (index + dir < 0 || index + dir >= steps.length) return;
    const newSteps = [...steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[index + dir];
    newSteps[index + dir] = temp;
    setSteps(newSteps);
  };

  const handleSave = async () => {
    if (!name) return alert("Please enter a name");
    
    // Parse configs to validate JSON
    const parsedSteps = [];
    for (let i = 0; i < steps.length; i++) {
      try {
        parsedSteps.push({
          position: i,
          type: steps[i].type,
          config: JSON.parse(steps[i].config)
        });
      } catch (err) {
        return alert(`Invalid JSON in step ${i + 1}`);
      }
    }

    try {
      setSaving(true);
      console.log("Submitting workflow:", { orgId: myOrg.org_id, name, description, steps: parsedSteps, triggers: [{ type: triggerType, config: {} }] });
      
      const { data } = await createWorkflow({
        variables: {
          orgId: myOrg.org_id,
          name,
          description,
          steps: parsedSteps,
          triggers: [{ type: triggerType, config: {} }]
        }
      });
      
      if (!data || !data.insert_workflows_one) {
        throw new Error("No data returned from mutation");
      }
      console.log("Pushing router to:", `/dashboard/workflows/${data.insert_workflows_one.id}`);
      router.push(`/dashboard/workflows/${data.insert_workflows_one.id}`);
    } catch (err: any) {
      console.error("Save Error:", err);
      alert("Failed to save workflow: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Build New Workflow</h2>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-blue-400"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Workflow'}
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border dark:border-zinc-700 flex flex-col gap-4">
        <h3 className="font-semibold text-lg border-b dark:border-zinc-700 pb-2">General Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Workflow Name</label>
            <input 
              type="text" value={name} onChange={e => setName(e.target.value)} 
              className="w-full border dark:border-zinc-700 rounded-md p-2 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="e.g. Lead Qualification"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Trigger Event</label>
            <select 
              value={triggerType} onChange={e => setTriggerType(e.target.value)}
              className="w-full border dark:border-zinc-700 rounded-md p-2 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="manual">Manual Execution</option>
              {myOrg.role === 'owner' && <option value="webhook">Webhook (Owner only)</option>}
              <option value="database_event">Database Event</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea 
            value={description} onChange={e => setDescription(e.target.value)} 
            className="w-full border dark:border-zinc-700 rounded-md p-2 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="What does this workflow do?"
            rows={2}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="font-semibold text-lg flex items-center justify-between">
          Workflow Steps
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 font-normal mr-2">Add Step:</span>
            {['llm_call', 'http_request', 'conditional_branch', 'approval_gate'].map(t => (
              <button 
                key={t} onClick={() => addStep(t)}
                className="text-xs bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border dark:border-zinc-700 px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" /> {t}
              </button>
            ))}
          </div>
        </h3>

        {steps.map((step, index) => (
          <div key={step.id} className="bg-white dark:bg-zinc-800 p-4 rounded-xl border dark:border-zinc-700 shadow-sm flex gap-4 items-start relative group">
            <div className="flex flex-col items-center gap-2 mt-2">
              <button onClick={() => moveStep(index, -1)} disabled={index === 0} className="text-gray-400 hover:text-blue-500 disabled:opacity-30">▲</button>
              <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                {index + 1}
              </div>
              <button onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} className="text-gray-400 hover:text-blue-500 disabled:opacity-30">▼</button>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-lg">{step.type}</h4>
                <button onClick={() => removeStep(index)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              
              <label className="block text-xs font-medium text-gray-500 mb-1">Configuration (JSON)</label>
              <textarea 
                value={step.config} 
                onChange={e => {
                  const newSteps = [...steps];
                  newSteps[index].config = e.target.value;
                  setSteps(newSteps);
                }} 
                className="w-full border dark:border-zinc-700 rounded-md p-3 bg-gray-50 dark:bg-zinc-900 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                rows={5}
              />
            </div>
          </div>
        ))}

        {steps.length === 0 && (
          <div className="bg-gray-50 dark:bg-zinc-800/50 border-2 border-dashed dark:border-zinc-700 rounded-xl p-12 text-center text-gray-500">
            Click a button above to add the first step to your workflow.
          </div>
        )}
      </div>
    </div>
  );
}
