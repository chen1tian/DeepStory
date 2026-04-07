interface Props {
  branchCount: number;
  currentIndex: number;
}

export default function BranchIndicator({ branchCount, currentIndex }: Props) {
  if (branchCount <= 1) return null;
  return (
    <div className="branch-indicator">
      ⑂ 分支 {currentIndex + 1}/{branchCount}
    </div>
  );
}
