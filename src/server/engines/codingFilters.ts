import { CodingProblem } from '../../types.ts';

export interface CodingFilterOptions {
  difficulty?: 'All' | 'Easy' | 'Medium' | 'Hard' | string;
  category?: string;
  status?: 'All' | 'Solved' | 'Unsolved' | 'Attempted' | 'Bookmarked' | string;
  searchQuery?: string;
  solvedIds?: string[];
  attemptedIds?: string[];
  bookmarkedIds?: string[];
}

/**
 * Deterministically filters coding problems based on difficulty, topic/category,
 * user progress status (Solved / Unsolved / Attempted / Bookmarked), and search terms.
 */
export function filterCodingProblems(
  problems: CodingProblem[],
  options: CodingFilterOptions
): CodingProblem[] {
  const {
    difficulty = 'All',
    category = 'All',
    status = 'All',
    searchQuery = '',
    solvedIds = [],
    attemptedIds = [],
    bookmarkedIds = [],
  } = options;

  const q = searchQuery.trim().toLowerCase();
  const normalizedCategory = category.trim().toLowerCase();

  return problems.filter((p) => {
    // 1. Difficulty Filter
    if (difficulty !== 'All' && p.difficulty !== difficulty) {
      return false;
    }

    // 2. Category / Topic Filter
    if (normalizedCategory !== 'all') {
      const topicLower = p.topic.toLowerCase();
      const badgeLower = (p.badge || '').toLowerCase();
      if (!topicLower.includes(normalizedCategory) && !badgeLower.includes(normalizedCategory)) {
        return false;
      }
    }

    // 3. Status Filter
    const isSolved = solvedIds.includes(p.id);
    const isAttempted = attemptedIds.includes(p.id);
    const isBookmarked = bookmarkedIds.includes(p.id);

    if (status === 'Solved' && !isSolved) return false;
    if (status === 'Unsolved' && isSolved) return false;
    if (status === 'Attempted' && !isAttempted) return false;
    if (status === 'Bookmarked' && !isBookmarked) return false;

    // 4. Search Query Filter
    if (q) {
      const titleMatch = p.title.toLowerCase().includes(q);
      const topicMatch = p.topic.toLowerCase().includes(q);
      const descMatch = (p.description || '').toLowerCase().includes(q);
      const badgeMatch = (p.badge || '').toLowerCase().includes(q);
      if (!titleMatch && !topicMatch && !descMatch && !badgeMatch) {
        return false;
      }
    }

    return true;
  });
}
