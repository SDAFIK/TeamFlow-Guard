import Workspace from "@/components/workspace";
export default async function Page({searchParams}:{searchParams:Promise<{confirmation?:string}>}) {
  const params=await searchParams;
  return <Workspace confirmationFailed={params.confirmation==="failed"}/>;
}
