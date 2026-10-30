import React from 'react';

interface CohortModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CohortModal: React.FC<CohortModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      id="cohort-comparison-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl p-space-lg shadow-xl relative max-h-[90vh] overflow-y-auto flex flex-col gap-space-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-space-sm border-b border-surface-container-low">
          <div>
            <span className="font-label-sm text-label-sm text-secondary uppercase font-bold tracking-wider">
              Batch Intelligence
            </span>
            <h3 className="font-headline-lg text-headline-lg text-on-surface font-bold">
              2026-27 Engineering Batch Comparison
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Department: Computer Engineering • 480 Total Candidates
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Highlight Card */}
        <div className="bg-surface-container-low p-space-md rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-outline uppercase">
              Current Rank Percentile
            </span>
            <h4 className="font-headline-xl text-headline-xl text-secondary font-extrabold">
              Top 18.4%
            </h4>
            <span className="text-xs text-on-surface-variant">
              Ahead of 392 peers in your department cohort
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-outline uppercase">
              Average Gap Resolution
            </span>
            <h4 className="font-headline-xl text-headline-xl text-on-surface font-bold">
              16.4 Days
            </h4>
            <span className="text-xs text-secondary font-semibold">
              3.2 days faster than batch avg
            </span>
          </div>
        </div>

        {/* Section Comparative Chart */}
        <div className="space-y-3">
          <h4 className="font-label-lg text-label-lg text-on-surface font-bold">
            Subject-wise Cohort Benchmarks
          </h4>

          <div className="space-y-3 font-body-sm text-body-sm">
            {/* Subject 1 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-on-surface">Quantitative Aptitude</span>
                <span>
                  <strong className="text-secondary">You: 82%</strong> | Batch Avg: 68%
                </span>
              </div>
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden flex">
                <div className="bg-secondary h-full rounded-full" style={{ width: '82%' }}></div>
              </div>
            </div>

            {/* Subject 2 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-on-surface">System Design & OOP</span>
                <span>
                  <strong className="text-secondary">You: 80%</strong> | Batch Avg: 64%
                </span>
              </div>
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden flex">
                <div className="bg-secondary h-full rounded-full" style={{ width: '80%' }}></div>
              </div>
            </div>

            {/* Subject 3 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-on-surface">Technical Core (DBMS/OS)</span>
                <span>
                  <strong className="text-secondary">You: 65%</strong> | Batch Avg: 62%
                </span>
              </div>
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden flex">
                <div className="bg-secondary h-full rounded-full" style={{ width: '65%' }}></div>
              </div>
            </div>

            {/* Subject 4 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-on-surface">DSA (Trees, Graphs, DP)</span>
                <span>
                  <strong className="text-error">You: 40%</strong> | Batch Avg: 54%
                </span>
              </div>
              <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden flex">
                <div className="bg-error h-full rounded-full" style={{ width: '40%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Takeaway Insight */}
        <div className="p-3 bg-surface-container-low rounded-lg flex items-start gap-2.5 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">
            tips_and_updates
          </span>
          <div>
            <strong className="text-on-surface">Key Placement Strategist Note:</strong> Students
            who addressed their DP & Graph deficits within 2 weeks of campus Day-0 drives saw their
            Tier-1 shortlist rates jump from 32% to 79%.
          </div>
        </div>

        <div className="flex justify-end pt-space-sm border-t border-surface-container-low">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-secondary text-on-secondary font-label-md hover:bg-secondary-container transition-colors"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
};
