'use client';
import dynamic from 'next/dynamic';
const WorkflowDetails = dynamic(() => import('./WorkflowDetails'), { ssr: false });
export default function Page(props: { params: Promise<{ id: string }> }) { return <WorkflowDetails params={props.params} />; }
