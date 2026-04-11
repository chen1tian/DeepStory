interface Props {
  branchCount: number;
  currentIndex: number;
}

export default function BranchIndicator({ branchCount, currentIndex }: Props) {
  if (branchCount <= 1) return null;
  return (
    <div className="inline-flex items-center gap-1 text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full mb-1">
      ⑂ 分支 {currentIndex + 1}/{branchCount}
    </div>
  );
}
