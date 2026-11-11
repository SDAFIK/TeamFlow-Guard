export function JourneySteps({ current }: { current: number }) {
  return <ol className="journey-steps" aria-label="Recovery progress">{['Understand','Compare','Review','Recorded'].map((label,index)=><li key={label} aria-current={current===index?'step':undefined} className={index<current?'complete':index===current?'current':''}><span>{index+1}</span>{label}</li>)}</ol>;
}
