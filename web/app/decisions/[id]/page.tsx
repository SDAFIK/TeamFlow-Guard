import Workspace from "@/components/workspace";
import { notFound } from "next/navigation";
import { z } from "zod";
export default async function Page({ params }: { params: Promise<{id:string}> }) {
  const {id}=await params;
  if(!z.uuid().safeParse(id).success) notFound();
  return <Workspace initialProposalId={id}/>;
}
