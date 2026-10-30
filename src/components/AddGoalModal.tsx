import React, { useState } from 'react';
import { DailyTask } from '../types';

interface AddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGoal: (goal: DailyTask) => void;
}

export const AddGoalModal: React.FC<AddGoalModalProps> = ({
  isOpen,
  onClose,
  onAddGoal,
}) => {
  const [title, setTitle] = useState('');
  const [timeEstimate, setTimeEstimate] = useState('30 mins');
  const [category, setCategory] = useState('DSA & Problem Solving');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask: DailyTask = {
      id: `task-${Date.now()}`,
      title: title.trim(),
      subtitle: `${category} • ${timeEstimate}`,
      completed: false,
      timeEstimate,
      category,
    };

    onAddGoal(newTask);
    setTitle('');
    onClose();
  };

  return (
    <div
      id="add-goal-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        id="add-goal-modal-content"
        className="bg-surface-container-lowest w-full max-w-md rounded-2xl p-space-lg shadow-xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-low mb-space-sm">
          <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
            Add Daily Preparation Goal
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-label-md text-label-md text-on-surface font-semibold mb-1">
              Task Goal Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Solve 3 LeetCode Graph problems"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface font-body-md focus:border-secondary outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-label-md text-label-md text-on-surface font-semibold mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface font-body-md focus:border-secondary outline-none"
              >
                <option value="DSA & Problem Solving">DSA & Coding</option>
                <option value="Quantitative Aptitude">Aptitude & Math</option>
                <option value="Core Subjects (DBMS/OS)">Core Subjects</option>
                <option value="Behavioral / Mock">Behavioral Prep</option>
              </select>
            </div>

            <div>
              <label className="block font-label-md text-label-md text-on-surface font-semibold mb-1">
                Duration
              </label>
              <select
                value={timeEstimate}
                onChange={(e) => setTimeEstimate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-low text-on-surface font-body-md focus:border-secondary outline-none"
              >
                <option value="15 mins">15 mins</option>
                <option value="30 mins">30 mins</option>
                <option value="45 mins">45 mins</option>
                <option value="60 mins">60 mins</option>
                <option value="90 mins">90 mins</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-space-sm border-t border-surface-container-low mt-space-sm">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-secondary text-on-secondary font-label-md hover:bg-secondary-container transition-colors font-bold shadow-xs"
            >
              Save Goal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
