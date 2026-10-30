import {
  CompanyDrive,
  SkillGapItem,
  DailyTask,
  AptitudeQuestion,
  CodingProblem,
  StudentProfile,
  ApplicationRecord,
  StudyPlanModule,
  InterviewArchive,
  ResourceItem,
  PortalSettings,
} from '../types';

export const INITIAL_PROFILE: StudentProfile = {
  name: 'Aditya Sharma',
  degree: 'B.Tech',
  department: 'Computer Engg (CSE)',
  cgpa: 8.10,
  gradYear: 2027,
  activeBacklogs: 0,
  collegeName: 'National Institute of Engineering',
  readinessScore: 72,
  profileCompletion: 78,
  targetRole: 'Software Engineer (SDE-1)',
  avatarUrl: '',
  avatarBg: 'indigo',
  skills: ['Java', 'Python', 'SQL', 'C++', 'System Design', 'OOP', 'REST APIs', 'React', 'DBMS', 'Git'],
  certifications: [
    'AWS Certified Cloud Practitioner',
    'Oracle Certified Professional: Java SE',
    'HackerRank 5-Star Problem Solving',
    'Full-Stack MERN Engineering Specialization',
  ],
  projects: [
    {
      id: 'proj-1',
      title: 'Chronos — Distributed Job Queue & Worker Engine',
      stack: 'Java 21, Redis, PostgreSQL, Docker',
      impact: 'Processed 18,000+ background jobs/min with dead-letter retry guarantees and sub-15ms scheduling latency.',
    },
    {
      id: 'proj-2',
      title: 'CampusPulse — Real-Time Academic & Lab Telemetry Suite',
      stack: 'TypeScript, React, Node.js, PostgreSQL',
      impact: 'Reduced lab equipment booking conflicts by 64% across 480 engineering students with automated slot allocation.',
    },
  ],
  leetcodeSolved: 284,
  resumeSummary: `Aditya Sharma — B.Tech CSE (2026-27), CGPA 8.10/10.00
Skills: Java, Python, C++, SQL, PostgreSQL, Redis, React, Node.js, OOP, DBMS, Operating Systems.
Projects:
1. Chronos Distributed Job Queue (Java, Redis, PostgreSQL): Engineered a fault-tolerant job scheduler handling 18k+ tasks/min with exponential backoff and worker heartbeats.
2. CampusPulse Telemetry Suite (TypeScript, React, Express): Built lab scheduling and utilization analytics reducing booking collisions by 64% for 480+ students.
Achievements: HackerRank 5-Star Problem Solving (284 problems solved), AWS Cloud Practitioner Certified.`,
};

export const LOGO_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCw2W-XX9ishsNt-ZhXIAXzy5Fpt9JnvjRfSnM7ZLf2xu4-w9SDeoo3NXTERtj8uFaXv3IAhImFqHDWQw4fndndJ3W575wO6jlJfa-tChhc5mibDzllHirUwOe5Dbw9MPRhR5w9l28wXFynYDFx5YaFawYJmOW2zlJm96SdtOyDcIH05mGhTA1wZM_enj5dn0Nw3lPOyZ_9xawZcNtIAgsXOUTFMbD3WKPRUvYJYOovsM05F3auvDVq';

export const INITIAL_COMPANIES: CompanyDrive[] = [
  {
    id: 'microsoft',
    name: 'Microsoft',
    logoIcon: 'window',
    role: 'Software Development Engineer (SDE-1)',
    category: 'Day 0 Campus',
    matchScore: 88,
    location: 'Hyderabad / Bengaluru',
    packageLpa: '₹44 - 51 LPA',
    driveDate: 'Nov 03, 2026',
    daysRemaining: 5,
    isEligible: true,
    minCgpa: 8.00,
    allowedBacklogs: 0,
    allowedBranches: ['CSE', 'IT', 'ECE'],
    matchedSkills: ['Java', 'C++', 'DSA (Advanced)', 'System Design', 'SQL'],
    gapSkills: ['Advanced DSA (Trees & Graphs)'],
    hiringFunnel: ['1. Online Code', '2. Tech 1', '3. Tech 2', '4. AA / HR'],
    institutionalNotes:
      'Your CGPA satisfies the minimum 8.00 requirement. Practice Graphs & DP to maximize shortlist odds.',
  },
  {
    id: 'deloitte',
    name: 'Deloitte USI',
    logoIcon: 'domain',
    role: 'Technology Analyst',
    category: 'Consulting Tech',
    matchScore: 84,
    location: 'Pan-India (Hyd / Mumbai)',
    packageLpa: '₹9.0 - 11.5 LPA',
    driveDate: 'Nov 07, 2026',
    daysRemaining: 9,
    isEligible: true,
    minCgpa: 7.00,
    allowedBacklogs: 1,
    allowedBranches: ['All B.Tech Branches'],
    matchedSkills: ['Python', 'SQL', 'DBMS', 'Agile', 'Communication'],
    gapSkills: ['Cloud Basics'],
    hiringFunnel: ['1. Aptitude & Verbal', '2. Tech MCQ', '3. Techno-Managerial'],
    institutionalNotes:
      'CGPA comfortably exceeds the 7.00 cutoff. 3-hour fast-track cloud fundamentals module available in Study Plan.',
  },
  {
    id: 'tcs',
    name: 'TCS Digital',
    logoIcon: 'terminal',
    role: 'Systems Engineer / Innovator',
    category: 'Mass Premium',
    matchScore: 82,
    location: 'Pune / Noida / Chennai',
    packageLpa: '₹7.5 - 9.0 LPA',
    driveDate: 'Nov 12, 2026',
    daysRemaining: 14,
    isEligible: true,
    minCgpa: 7.50,
    allowedBacklogs: 0,
    allowedBranches: ['CSE', 'IT', 'Circuital'],
    matchedSkills: ['Java', 'Python', 'OOP', 'SQL', 'Web Dev'],
    gapSkills: ['DSA Trees/Graphs'],
    hiringFunnel: ['1. TCS NQT (Advanced)', '2. Interview (Tech + HR)'],
    institutionalNotes:
      'Direct eligibility verified. High probability of advancing to technical round based on current test scores.',
  },
  {
    id: 'goldman',
    name: 'Goldman Sachs',
    logoIcon: 'account_balance',
    role: 'Summer Analyst / Associate',
    category: 'High Frequency / FinTech',
    matchScore: 65,
    location: 'Bengaluru',
    packageLpa: '₹28 LPA',
    driveDate: 'Nov 19, 2026',
    daysRemaining: 21,
    isEligible: false,
    minCgpa: 8.50,
    allowedBacklogs: 0,
    allowedBranches: ['CSE', 'ECE', 'EE'],
    matchedSkills: ['Finance Fundamentals', 'Algorithms', 'C++'],
    gapSkills: ['CGPA Cutoff (Requires 8.50)', 'Competitive Math'],
    hiringFunnel: ['1. HackerRank CoderPad', '2. Math & Algo Screen', '3. Superday (3 Tech Rounds)'],
    institutionalNotes:
      'Requires CGPA ≥ 8.50. You may request an exceptional review waiver through your TPO department if you rank in the top 5% of your class section.',
  },
  {
    id: 'oracle',
    name: 'Oracle Server Tech',
    logoIcon: 'dns',
    role: 'Member of Technical Staff (MTS)',
    category: 'Tier-1 Product',
    matchScore: 86,
    location: 'Bengaluru / Hyderabad',
    packageLpa: '₹31.5 LPA',
    driveDate: 'Nov 24, 2026',
    daysRemaining: 26,
    isEligible: true,
    minCgpa: 7.80,
    allowedBacklogs: 0,
    allowedBranches: ['CSE', 'IT', 'ECE'],
    matchedSkills: ['Java', 'SQL', 'DBMS', 'OS Concurrency', 'OOP'],
    gapSkills: ['SQL Window Functions & Query Plans'],
    hiringFunnel: ['1. Online MCQ + Coding', '2. Core Systems Tech', '3. DB & Algo Tech', '4. Hiring Manager'],
    institutionalNotes:
      'Strong alignment with Java and DBMS coursework. Deep-dive into B+ Tree indexing before Round 2.',
  },
  {
    id: 'accenture',
    name: 'Accenture',
    logoIcon: 'apartment',
    role: 'Advanced Application Engineering Analyst',
    category: 'Volume Recruiter',
    matchScore: 91,
    location: 'Pan-India',
    packageLpa: '₹6.5 LPA',
    driveDate: 'Dec 01, 2026',
    daysRemaining: 32,
    isEligible: true,
    minCgpa: 6.50,
    allowedBacklogs: 1,
    allowedBranches: ['All Engineering Branches'],
    matchedSkills: ['Java', 'Cloud', 'DevOps', 'Agile', 'Web'],
    gapSkills: [],
    hiringFunnel: ['1. Cognitive & Tech Assessment', '2. Coding Assessment', '3. Communication Screen'],
    institutionalNotes:
      '100% academic criteria met. Quantitative aptitude score qualifies for Round-1 direct exemption.',
  },
];

export const INITIAL_SKILL_GAPS: SkillGapItem[] = [
  {
    id: 'dsa',
    title: 'Data Structures & Algorithms (DSA)',
    subtitle: 'Arrays, Linked Lists, Binary Trees & Recursion',
    priority: 'High',
    priorityTag: 'High Priority',
    moduleCategory: 'Code Sprint #4',
    currentProficiency: 40,
    currentLabel: 'Basic (40%)',
    targetBenchmark: 80,
    targetLabel: 'Target: 80%',
    deficitPercentage: -40,
    impactedCompanies: ['Microsoft', 'Oracle Server Tech', 'TCS Digital'],
    actionLabel: 'Start 14-Day DSA Sprint (42 Problems)',
    actionIcon: 'bolt',
  },
  {
    id: 'sql',
    title: 'Advanced SQL & Database Management',
    subtitle: 'Indexing, CTEs, Window Functions, Query Execution Plans',
    priority: 'Medium',
    priorityTag: 'Medium Priority',
    moduleCategory: 'Database Module',
    currentProficiency: 65,
    currentLabel: 'Intermediate (65%)',
    targetBenchmark: 85,
    targetLabel: 'Target: 85%',
    deficitPercentage: -20,
    impactedCompanies: ['Deloitte USI', 'Oracle Server Tech', 'Accenture'],
    actionLabel: 'Start SQL Hands-on Lab',
    actionIcon: 'terminal',
  },
  {
    id: 'dp',
    title: 'Dynamic Programming',
    subtitle: 'Knapsack, Longest Common Subsequence, Grid DP',
    priority: 'High',
    priorityTag: 'High Priority',
    moduleCategory: 'Advanced Problem Solving',
    currentProficiency: 25,
    currentLabel: 'Beginner (25%)',
    targetBenchmark: 75,
    targetLabel: 'Target: 75%',
    deficitPercentage: -50,
    impactedCompanies: ['Microsoft', 'Goldman Sachs', 'Oracle Server Tech'],
    actionLabel: 'Practice 10 Problems',
    actionIcon: 'psychology',
  },
];

export const INITIAL_TASKS: DailyTask[] = [
  {
    id: 'task-1',
    title: 'Solve 5 DSA Binary Search problems',
    subtitle: 'Completed at 08:30 AM · LeetCode Medium',
    completed: true,
    timeEstimate: '45 mins',
    category: 'DSA & Problem Solving',
  },
  {
    id: 'task-2',
    title: 'Practice 10 Quantitative Aptitude questions',
    subtitle: 'Percentages, Profit & Loss, Ratios · 25 mins',
    completed: false,
    timeEstimate: '25 mins',
    category: 'Quantitative Aptitude',
  },
  {
    id: 'task-3',
    title: 'Revise SQL Complex JOINs & Subqueries',
    subtitle: 'Self-assessment test · 30 mins',
    completed: false,
    timeEstimate: '30 mins',
    category: 'Core Subjects (DBMS/OS)',
  },
  {
    id: 'task-4',
    title: 'Complete AI Mock Interview session',
    subtitle: 'Behavioral + Tech Screen · 15 mins',
    completed: false,
    timeEstimate: '15 mins',
    category: 'Behavioral / Mock',
  },
];

export const APTITUDE_QUESTIONS: AptitudeQuestion[] = [
  {
    id: 1,
    category: 'Quantitative',
    patternBadge: 'Deloitte Fast-Track Screen',
    question:
      'A train 240m in length crosses a telegraph post in 16 seconds. How long will it take to cross a platform 360m in length?',
    options: [
      { key: 'A', text: '32 sec' },
      { key: 'B', text: '40 sec' },
      { key: 'C', text: '36 sec' },
      { key: 'D', text: '44 sec' },
    ],
    correctAnswer: 'B',
    explanation:
      'Speed = Distance / Time = 240 / 16 = 15 m/s. Total distance to cross platform = 240 + 360 = 600m. Time = 600 / 15 = 40 seconds.',
  },
  {
    id: 2,
    category: 'Logical Reasoning',
    patternBadge: 'TCS NQT Advanced Screen',
    question:
      'Pointing to a photograph, Rohit said, "His mother is the only daughter of my mother." How is Rohit related to the person in the photograph?',
    options: [
      { key: 'A', text: 'Father' },
      { key: 'B', text: 'Maternal Uncle' },
      { key: 'C', text: 'Brother' },
      { key: 'D', text: 'Grandfather' },
    ],
    correctAnswer: 'B',
    explanation:
      "The only daughter of Rohit's mother is Rohit's sister. The person's mother is Rohit's sister, which makes Rohit the maternal uncle.",
  },
  {
    id: 3,
    category: 'Speed Math',
    patternBadge: 'Accenture Cognitive Screen',
    question:
      'If 12 men or 18 women can complete a campus project rollout in 14 days, in how many days will 8 men and 16 women finish the same work?',
    options: [
      { key: 'A', text: '9 days' },
      { key: 'B', text: '10 days' },
      { key: 'C', text: '12 days' },
      { key: 'D', text: '8 days' },
    ],
    correctAnswer: 'A',
    explanation:
      '12M = 18W => 1M = 1.5W. So 8M + 16W = (8 × 1.5) + 16 = 28 women. Using W1 × D1 = W2 × D2: 18 × 14 = 28 × D2 => D2 = 9 days.',
  },
  {
    id: 4,
    category: 'Quantitative',
    patternBadge: 'Goldman Sachs Quant Screen',
    question:
      'Two fair six-sided dice are rolled simultaneously. Given that the sum of the faces is at least 9, what is the conditional probability that the sum is 10?',
    options: [
      { key: 'A', text: '3 / 10' },
      { key: 'B', text: '1 / 4' },
      { key: 'C', text: '1 / 3' },
      { key: 'D', text: '2 / 9' },
    ],
    correctAnswer: 'A',
    explanation:
      'Pairs with sum ≥ 9: sum 9 has 4 pairs, sum 10 has 3 pairs [(4,6),(5,5),(6,4)], sum 11 has 2 pairs, sum 12 has 1 pair. Total = 10 outcomes. Probability(sum=10 | sum≥9) = 3/10.',
  },
  {
    id: 5,
    category: 'Data Interpretation',
    patternBadge: 'Deloitte Case & DI Screen',
    question:
      'Company Alpha recorded ₹48 Crore revenue in Q1 and grew by 25% in Q2, followed by a 20% decline in Q3. What was its net revenue at the end of Q3?',
    options: [
      { key: 'A', text: '₹50.4 Crore' },
      { key: 'B', text: '₹48.0 Crore' },
      { key: 'C', text: '₹46.8 Crore' },
      { key: 'D', text: '₹52.0 Crore' },
    ],
    correctAnswer: 'B',
    explanation:
      'Q2 revenue = 48 × 1.25 = ₹60 Crore. Q3 revenue after 20% decline = 60 × 0.80 = ₹48.0 Crore (1.25 × 0.80 = 1.00).',
  },
  {
    id: 6,
    category: 'Logical Reasoning',
    patternBadge: 'Infosys & Capgemini Analytical',
    question:
      'Six candidates P, Q, R, S, T, and U sit in a circle facing the center. P sits second to the left of R. S sits opposite R, and Q sits immediately between R and S. Who sits opposite Q?',
    options: [
      { key: 'A', text: 'P or T' },
      { key: 'B', text: 'Definitely P' },
      { key: 'C', text: 'T or U' },
      { key: 'D', text: 'Definitely S' },
    ],
    correctAnswer: 'C',
    explanation:
      'In a 6-seat circle with R at seat 1 and S opposite at seat 4, P sits second to the left of R at seat 5. Q sits on the 2–3 arc between R and S, so the seat directly opposite Q on the 5–6 arc is occupied by T or U (or P depending on exact side), leaving T or U opposite when Q takes seat 2.',
  },
  {
    id: 7,
    category: 'Speed Math',
    patternBadge: 'TCS Digital Numerical Ability',
    question:
      'A sum invested at compound interest compounded annually grows to ₹14,520 in 2 years and ₹15,972 in 3 years. What is the annual rate of interest?',
    options: [
      { key: 'A', text: '8%' },
      { key: 'B', text: '10%' },
      { key: 'C', text: '12%' },
      { key: 'D', text: '9%' },
    ],
    correctAnswer: 'B',
    explanation:
      'Interest earned in the 3rd year on ₹14,520 = 15,972 - 14,520 = ₹1,452. Rate = (1,452 / 14,520) × 100 = 10% per annum.',
  },
  {
    id: 8,
    category: 'Verbal Ability',
    patternBadge: 'Consulting Verbal Screen',
    question:
      'Choose the word pair that best expresses a relationship similar to MITIGATE : SEVERITY ::',
    options: [
      { key: 'A', text: 'Aggravate : Relief' },
      { key: 'B', text: 'Alleviate : Discomfort' },
      { key: 'C', text: 'Amplify : Silence' },
      { key: 'D', text: 'Obscure : Clarity' },
    ],
    correctAnswer: 'B',
    explanation:
      'To mitigate is to lessen severity; similarly, to alleviate is to lessen discomfort.',
  },
  {
    id: 9,
    category: 'Quantitative',
    patternBadge: 'Aptitude Combinatorics Gate',
    question:
      'In how many distinct ways can the letters of the word "ALGORITHM" be arranged such that the vowels A, O, and I always stay together?',
    options: [
      { key: 'A', text: '7! × 3!' },
      { key: 'B', text: '6! × 3!' },
      { key: 'C', text: '9! / 3!' },
      { key: 'D', text: '8! × 3' },
    ],
    correctAnswer: 'A',
    explanation:
      'ALGORITHM has 9 distinct letters (6 consonants + 3 vowels). Treating {A, O, I} as 1 block gives 6 + 1 = 7 units arranged in 7! ways, and the 3 vowels arrange internally in 3! ways => 7! × 3!.',
  },
  {
    id: 10,
    category: 'Data Interpretation',
    patternBadge: 'Analytical Ratio Screen',
    question:
      'In a batch of 240 students, the ratio of CSE to ECE students is 5 : 3. If 70% of CSE students and 60% of ECE students clear Round 1, how many total students cleared Round 1?',
    options: [
      { key: 'A', text: '156' },
      { key: 'B', text: '159' },
      { key: 'C', text: '162' },
      { key: 'D', text: '165' },
    ],
    correctAnswer: 'B',
    explanation:
      'CSE = (5/8) × 240 = 150; ECE = (3/8) × 240 = 90. Cleared = (0.70 × 150) + (0.60 × 90) = 105 + 54 = 159 students.',
  },
];

export const CODING_PROBLEMS: CodingProblem[] = [
  {
    id: 'second-largest',
    title: 'Find the Second Largest Distinct Element',
    badge: 'Day-1 Array Warmup',
    difficulty: 'Easy',
    topic: 'Arrays & Single Pass',
    complexity: 'Time: O(N) · Space: O(1)',
    description:
      'Given an integer array arr[] of size N, return the second largest distinct element in the array. If the second largest distinct element does not exist, return -1.',
    constraints: '2 ≤ N ≤ 10^5, 1 ≤ arr[i] ≤ 10^9',
    sampleInput: 'arr = [12, 35, 1, 10, 34, 35]',
    sampleOutput: '34',
    javaCode: `class Solution {
    public static int getSecondLargest(int[] arr) {
        int first = -1, second = -1;
        for (int x : arr) {
            if (x > first) {
                second = first;
                first = x;
            } else if (x > second && x != first) {
                second = x;
            }
        }
        return second;
    }
}`,
    pythonCode: `class Solution:
    def get_second_largest(self, arr: list[int]) -> int:
        first, second = -1, -1
        for x in arr:
            if x > first:
                second = first
                first = x
            elif x > second and x != first:
                second = x
        return second`,
    cppCode: `#include <vector>
using namespace std;

class Solution {
public:
    int getSecondLargest(const vector<int>& arr) {
        int first = -1, second = -1;
        for (int x : arr) {
            if (x > first) {
                second = first;
                first = x;
            } else if (x > second && x != first) {
                second = x;
            }
        }
        return second;
    }
};`,
    testCasesCount: 4,
    runTime: '12ms',
  },
  {
    id: 'longest-unique-substring',
    title: 'Longest Substring Without Repeating Characters',
    badge: 'Microsoft & Amazon OA',
    difficulty: 'Medium',
    topic: 'Sliding Window & Hashing',
    complexity: 'Time: O(N) · Space: O(min(N, Σ))',
    description:
      'Given a string s, find the length of the longest contiguous substring that contains no duplicate characters.',
    constraints: '0 ≤ s.length ≤ 5 × 10^4, s consists of ASCII letters, digits, and symbols',
    sampleInput: 's = "abcabcbb"',
    sampleOutput: '3',
    javaCode: `import java.util.*;

class Solution {
    public int lengthOfLongestSubstring(String s) {
        int[] lastSeen = new int[128];
        Arrays.fill(lastSeen, -1);
        int left = 0, best = 0;
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            if (lastSeen[c] >= left) {
                left = lastSeen[c] + 1;
            }
            lastSeen[c] = right;
            best = Math.max(best, right - left + 1);
        }
        return best;
    }
}`,
    pythonCode: `class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        last_seen: dict[str, int] = {}
        left = 0
        best = 0
        for right, ch in enumerate(s):
            if ch in last_seen and last_seen[ch] >= left:
                left = last_seen[ch] + 1
            last_seen[ch] = right
            best = max(best, right - left + 1)
        return best`,
    cppCode: `#include <string>
#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        vector<int> lastSeen(128, -1);
        int left = 0, best = 0;
        for (int right = 0; right < (int)s.size(); ++right) {
            unsigned char c = s[right];
            if (lastSeen[c] >= left) left = lastSeen[c] + 1;
            lastSeen[c] = right;
            best = max(best, right - left + 1);
        }
        return best;
    }
};`,
    testCasesCount: 6,
    runTime: '9ms',
  },
  {
    id: 'merge-intervals',
    title: 'Merge Overlapping Meeting Intervals',
    badge: 'Oracle & Deloitte Tech Screen',
    difficulty: 'Medium',
    topic: 'Sorting & Intervals',
    complexity: 'Time: O(N log N) · Space: O(N)',
    description:
      'Given an array of intervals where intervals[i] = [start_i, end_i], merge all overlapping intervals and return an array of the non-overlapping intervals covering the input.',
    constraints: '1 ≤ intervals.length ≤ 10^4, 0 ≤ start_i ≤ end_i ≤ 10^4',
    sampleInput: 'intervals = [[1,3],[2,6],[8,10],[15,18]]',
    sampleOutput: '[[1,6],[8,10],[15,18]]',
    javaCode: `import java.util.*;

class Solution {
    public int[][] merge(int[][] intervals) {
        Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
        List<int[]> merged = new ArrayList<>();
        for (int[] curr : intervals) {
            if (merged.isEmpty() || merged.get(merged.size() - 1)[1] < curr[0]) {
                merged.add(curr);
            } else {
                merged.get(merged.size() - 1)[1] = Math.max(merged.get(merged.size() - 1)[1], curr[1]);
            }
        }
        return merged.toArray(new int[merged.size()][]);
    }
}`,
    pythonCode: `class Solution:
    def merge(self, intervals: list[list[int]]) -> list[list[int]]:
        intervals.sort(key=lambda x: x[0])
        merged: list[list[int]] = []
        for start, end in intervals:
            if not merged or merged[-1][1] < start:
                merged.append([start, end])
            else:
                merged[-1][1] = max(merged[-1][1], end)
        return merged`,
    cppCode: `#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    vector<vector<int>> merge(vector<vector<int>>& intervals) {
        sort(intervals.begin(), intervals.end());
        vector<vector<int>> merged;
        for (const auto& curr : intervals) {
            if (merged.empty() || merged.back()[1] < curr[0]) {
                merged.push_back(curr);
            } else {
                merged.back()[1] = max(merged.back()[1], curr[1]);
            }
        }
        return merged;
    }
};`,
    testCasesCount: 5,
    runTime: '14ms',
  },
  {
    id: 'next-greater-circular',
    title: 'Next Greater Element in Circular Array',
    badge: 'TCS Digital & Cisco OA',
    difficulty: 'Medium',
    topic: 'Monotonic Stack',
    complexity: 'Time: O(N) · Space: O(N)',
    description:
      'Given a circular integer array nums, return the next greater number for every element. Wrap around to the start of the array if needed, or output -1 if none exists.',
    constraints: '1 ≤ nums.length ≤ 10^4, -10^9 ≤ nums[i] ≤ 10^9',
    sampleInput: 'nums = [1, 2, 1]',
    sampleOutput: '[2, -1, 2]',
    javaCode: `import java.util.*;

class Solution {
    public int[] nextGreaterElements(int[] nums) {
        int n = nums.length;
        int[] res = new int[n];
        Arrays.fill(res, -1);
        Deque<Integer> stack = new ArrayDeque<>();
        for (int i = 0; i < 2 * n; i++) {
            int curr = nums[i % n];
            while (!stack.isEmpty() && nums[stack.peek()] < curr) {
                res[stack.pop()] = curr;
            }
            if (i < n) stack.push(i);
        }
        return res;
    }
}`,
    pythonCode: `class Solution:
    def nextGreaterElements(self, nums: list[int]) -> list[int]:
        n = len(nums)
        res = [-1] * n
        stack: list[int] = []
        for i in range(2 * n):
            curr = nums[i % n]
            while stack and nums[stack[-1]] < curr:
                res[stack.pop()] = curr
            if i < n:
                stack.append(i)
        return res`,
    cppCode: `#include <vector>
#include <stack>
using namespace std;

class Solution {
public:
    vector<int> nextGreaterElements(vector<int>& nums) {
        int n = nums.size();
        vector<int> res(n, -1);
        stack<int> st;
        for (int i = 0; i < 2 * n; ++i) {
            int curr = nums[i % n];
            while (!st.empty() && nums[st.top()] < curr) {
                res[st.top()] = curr;
                st.pop();
            }
            if (i < n) st.push(i);
        }
        return res;
    }
};`,
    testCasesCount: 5,
    runTime: '15ms',
  },
  {
    id: 'lca-binary-tree',
    title: 'Lowest Common Ancestor of a Binary Tree',
    badge: 'Microsoft & Amazon OA',
    difficulty: 'Medium',
    topic: 'Trees & DFS Recursion',
    complexity: 'Time: O(N) · Space: O(H)',
    description:
      'Given the root of a binary tree and two node references p and q, find their Lowest Common Ancestor (the deepest node that has both p and q as descendants, where a node can be a descendant of itself).',
    constraints: '2 ≤ Nodes ≤ 10^5, All Node.val are unique, p != q',
    sampleInput: 'root = [3,5,1,6,2,0,8,null,null,7,4], p = 5, q = 4',
    sampleOutput: '5',
    javaCode: `class Solution {
    public TreeNode lowestCommonAncestor(TreeNode root, TreeNode p, TreeNode q) {
        if (root == null || root == p || root == q) {
            return root;
        }
        TreeNode left = lowestCommonAncestor(root.left, p, q);
        TreeNode right = lowestCommonAncestor(root.right, p, q);
        if (left != null && right != null) return root;
        return left != null ? left : right;
    }
}`,
    pythonCode: `class Solution:
    def lowestCommonAncestor(self, root: 'TreeNode', p: 'TreeNode', q: 'TreeNode') -> 'TreeNode':
        if not root or root == p or root == q:
            return root
        left = self.lowestCommonAncestor(root.left, p, q)
        right = self.lowestCommonAncestor(root.right, p, q)
        if left and right:
            return root
        return left or right`,
    cppCode: `class Solution {
public:
    TreeNode* lowestCommonAncestor(TreeNode* root, TreeNode* p, TreeNode* q) {
        if (!root || root == p || root == q) return root;
        TreeNode* left = lowestCommonAncestor(root->left, p, q);
        TreeNode* right = lowestCommonAncestor(root->right, p, q);
        if (left && right) return root;
        return left ? left : right;
    }
};`,
    testCasesCount: 5,
    runTime: '16ms',
  },
  {
    id: 'knapsack-dp',
    title: '0/1 Knapsack — Space-Optimized DP',
    badge: 'Goldman Sachs & Microsoft DP',
    difficulty: 'Medium',
    topic: 'Dynamic Programming',
    complexity: 'Time: O(N × W) · Space: O(W)',
    description:
      'Given weights[] and values[] of N items and a knapsack capacity W, compute the maximum total value achievable by selecting each item at most once.',
    constraints: '1 ≤ N ≤ 1000, 1 ≤ W ≤ 1000, 1 ≤ values[i], weights[i] ≤ 1000',
    sampleInput: 'W = 50, weights = [10, 20, 30], values = [60, 100, 120]',
    sampleOutput: '220',
    javaCode: `class Solution {
    public int knapSack(int W, int[] weights, int[] values) {
        int[] dp = new int[W + 1];
        for (int i = 0; i < weights.length; i++) {
            for (int w = W; w >= weights[i]; w--) {
                dp[w] = Math.max(dp[w], values[i] + dp[w - weights[i]]);
            }
        }
        return dp[W];
    }
}`,
    pythonCode: `class Solution:
    def knapSack(self, W: int, weights: list[int], values: list[int]) -> int:
        dp = [0] * (W + 1)
        for wt, val in zip(weights, values):
            for w in range(W, wt - 1, -1):
                dp[w] = max(dp[w], val + dp[w - wt])
        return dp[W]`,
    cppCode: `#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    int knapSack(int W, const vector<int>& weights, const vector<int>& values) {
        vector<int> dp(W + 1, 0);
        for (size_t i = 0; i < weights.size(); ++i) {
            for (int w = W; w >= weights[i]; --w) {
                dp[w] = max(dp[w], values[i] + dp[w - weights[i]]);
            }
        }
        return dp[W];
    }
};`,
    testCasesCount: 6,
    runTime: '21ms',
  },
  {
    id: 'course-schedule-topo',
    title: 'Course Prerequisite Cycle Detection (Kahn BFS)',
    badge: 'Day-0 Graph Sprint',
    difficulty: 'Hard',
    topic: 'Graphs & Topological Sort',
    complexity: 'Time: O(V + E) · Space: O(V + E)',
    description:
      'Given numCourses labeled 0 to numCourses - 1 and prerequisites pairs [a, b] meaning b must be taken before a, return true if you can finish all courses without circular dependency.',
    constraints: '1 ≤ numCourses ≤ 2000, 0 ≤ prerequisites.length ≤ 5000',
    sampleInput: 'numCourses = 4, prerequisites = [[1,0],[2,0],[3,1],[3,2]]',
    sampleOutput: 'true',
    javaCode: `import java.util.*;

class Solution {
    public boolean canFinish(int numCourses, int[][] prerequisites) {
        List<List<Integer>> adj = new ArrayList<>();
        int[] indegree = new int[numCourses];
        for (int i = 0; i < numCourses; i++) adj.add(new ArrayList<>());
        for (int[] pre : prerequisites) {
            adj.get(pre[1]).add(pre[0]);
            indegree[pre[0]]++;
        }
        Queue<Integer> q = new ArrayDeque<>();
        for (int i = 0; i < numCourses; i++) {
            if (indegree[i] == 0) q.offer(i);
        }
        int visited = 0;
        while (!q.isEmpty()) {
            int curr = q.poll();
            visited++;
            for (int next : adj.get(curr)) {
                if (--indegree[next] == 0) q.offer(next);
            }
        }
        return visited == numCourses;
    }
}`,
    pythonCode: `from collections import deque

class Solution:
    def canFinish(self, numCourses: int, prerequisites: list[list[int]]) -> bool:
        adj = [[] for _ in range(numCourses)]
        indegree = [0] * numCourses
        for course, pre in prerequisites:
            adj[pre].append(course)
            indegree[course] += 1
        q = deque(i for i in range(numCourses) if indegree[i] == 0)
        visited = 0
        while q:
            curr = q.popleft()
            visited += 1
            for nxt in adj[curr]:
                indegree[nxt] -= 1
                if indegree[nxt] == 0:
                    q.append(nxt)
        return visited == numCourses`,
    cppCode: `#include <vector>
#include <queue>
using namespace std;

class Solution {
public:
    bool canFinish(int numCourses, vector<vector<int>>& prerequisites) {
        vector<vector<int>> adj(numCourses);
        vector<int> indegree(numCourses, 0);
        for (const auto& pre : prerequisites) {
            adj[pre[1]].push_back(pre[0]);
            indegree[pre[0]]++;
        }
        queue<int> q;
        for (int i = 0; i < numCourses; ++i) {
            if (indegree[i] == 0) q.push(i);
        }
        int visited = 0;
        while (!q.empty()) {
            int curr = q.front();
            q.pop();
            visited++;
            for (int nxt : adj[curr]) {
                if (--indegree[nxt] == 0) q.push(nxt);
            }
        }
        return visited == numCourses;
    }
};`,
    testCasesCount: 5,
    runTime: '18ms',
  },
  {
    id: 'trapping-rain-water',
    title: 'Trapping Rain Water Between Elevation Bars',
    badge: 'Tier-1 Super-Dream OA',
    difficulty: 'Hard',
    topic: 'Two Pointers & Prefix Max',
    complexity: 'Time: O(N) · Space: O(1)',
    description:
      'Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much total water can be trapped after raining.',
    constraints: '1 ≤ height.length ≤ 2 × 10^4, 0 ≤ height[i] ≤ 10^5',
    sampleInput: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]',
    sampleOutput: '6',
    javaCode: `class Solution {
    public int trap(int[] height) {
        int left = 0, right = height.length - 1;
        int leftMax = 0, rightMax = 0, water = 0;
        while (left < right) {
            if (height[left] <= height[right]) {
                leftMax = Math.max(leftMax, height[left]);
                water += leftMax - height[left++];
            } else {
                rightMax = Math.max(rightMax, height[right]);
                water += rightMax - height[right--];
            }
        }
        return water;
    }
}`,
    pythonCode: `class Solution:
    def trap(self, height: list[int]) -> int:
        left, right = 0, len(height) - 1
        left_max, right_max, water = 0, 0, 0
        while left < right:
            if height[left] <= height[right]:
                left_max = max(left_max, height[left])
                water += left_max - height[left]
                left += 1
            else:
                right_max = max(right_max, height[right])
                water += right_max - height[right]
                right -= 1
        return water`,
    cppCode: `#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    int trap(const vector<int>& height) {
        int left = 0, right = (int)height.size() - 1;
        int leftMax = 0, rightMax = 0, water = 0;
        while (left < right) {
            if (height[left] <= height[right]) {
                leftMax = max(leftMax, height[left]);
                water += leftMax - height[left++];
            } else {
                rightMax = max(rightMax, height[right]);
                water += rightMax - height[right--];
            }
        }
        return water;
    }
};`,
    testCasesCount: 7,
    runTime: '11ms',
  },
];

export const INITIAL_APPLICATIONS: ApplicationRecord[] = [
  {
    id: 'app-microsoft',
    companyId: 'microsoft',
    company: 'Microsoft',
    role: 'Software Development Engineer (SDE-1)',
    packageLpa: '₹44 - 51 LPA',
    status: 'OA Scheduled',
    date: 'Nov 03, 2026 · 10:00 AM',
    round: 'Round 1: Online Assessment (Codility / HackerRank)',
    notes: 'Revise Grid DP, LCA on Binary Trees, and sliding window edge cases.',
  },
  {
    id: 'app-deloitte',
    companyId: 'deloitte',
    company: 'Deloitte USI',
    role: 'Technology Analyst',
    packageLpa: '₹9.0 - 11.5 LPA',
    status: 'Shortlisted',
    date: 'Nov 07, 2026',
    round: 'Round 1: Aptitude, Verbal & SQL MCQ',
    notes: 'Prepare cloud service models (IaaS/PaaS/SaaS) and project architecture pitch.',
  },
  {
    id: 'app-tcs',
    companyId: 'tcs',
    company: 'TCS Digital',
    role: 'Systems Engineer / Innovator',
    packageLpa: '₹7.5 - 9.0 LPA',
    status: 'Applied',
    date: 'Nov 12, 2026',
    round: 'Document Verification by TPO',
    notes: 'All semester mark sheets uploaded and verified.',
  },
  {
    id: 'app-accenture',
    companyId: 'accenture',
    company: 'Accenture',
    role: 'Advanced Application Engineering Analyst',
    packageLpa: '₹6.5 LPA',
    status: 'Tech Round',
    date: 'Dec 01, 2026',
    round: 'Fast-Track Technical & Behavioral Interview',
    notes: 'Quantitative score exempted Cognitive Screen. Focus on MERN & Java project walkthrough.',
  },
];

export const INITIAL_STUDY_MODULES: StudyPlanModule[] = [
  {
    id: 'sp-1',
    week: 1,
    dayRange: 'Day 1–2',
    title: 'Binary Trees & BST Traversals (Iterative, Morris, LCA)',
    category: 'DSA Sprint',
    duration: '3.0 hrs',
    completed: true,
  },
  {
    id: 'sp-2',
    week: 1,
    dayRange: 'Day 3–4',
    title: 'Graph BFS/DFS, Cycle Detection & Topological Sort',
    category: 'DSA Sprint',
    duration: '3.0 hrs',
    completed: true,
  },
  {
    id: 'sp-3',
    week: 1,
    dayRange: 'Day 5',
    title: 'Shortest Paths (Dijkstra, 0-1 BFS) & Disjoint Set Union',
    category: 'DSA Sprint',
    duration: '2.5 hrs',
    completed: false,
  },
  {
    id: 'sp-4',
    week: 1,
    dayRange: 'Day 6–7',
    title: 'Full-Length Campus OA Simulation #1 (40 MCQs + 2 Coding)',
    category: 'Mock Gate',
    duration: '2.0 hrs',
    completed: false,
  },
  {
    id: 'sp-5',
    week: 2,
    dayRange: 'Day 8–9',
    title: '1D Dynamic Programming (House Robber, Coin Change, LIS)',
    category: 'DP Remediation',
    duration: '3.0 hrs',
    completed: false,
  },
  {
    id: 'sp-6',
    week: 2,
    dayRange: 'Day 10–11',
    title: '2D Grid & Knapsack DP (0/1, Unbounded, Subset Sum)',
    category: 'DP Remediation',
    duration: '3.5 hrs',
    completed: false,
  },
  {
    id: 'sp-7',
    week: 2,
    dayRange: 'Day 12–13',
    title: 'String & Tree DP (LCS, Edit Distance, Diameter)',
    category: 'DP Remediation',
    duration: '3.0 hrs',
    completed: false,
  },
  {
    id: 'sp-8',
    week: 2,
    dayRange: 'Day 14',
    title: 'Timed Dynamic Programming Blitz (10 Curated Problems)',
    category: 'Mock Gate',
    duration: '2.5 hrs',
    completed: false,
  },
  {
    id: 'sp-9',
    week: 3,
    dayRange: 'Day 15–16',
    title: 'System Design Foundations: Caching, Sharding & Rate Limiting',
    category: 'Architecture',
    duration: '2.5 hrs',
    completed: false,
  },
  {
    id: 'sp-10',
    week: 3,
    dayRange: 'Day 17–18',
    title: 'Advanced SQL Window Functions, B+ Tree Indexes & OS Locks',
    category: 'Core CS',
    duration: '2.5 hrs',
    completed: false,
  },
  {
    id: 'sp-11',
    week: 3,
    dayRange: 'Day 19',
    title: 'Microsoft & Oracle Full-Dress Technical Panel Simulation',
    category: 'Mock Interview',
    duration: '1.5 hrs',
    completed: false,
  },
  {
    id: 'sp-12',
    week: 3,
    dayRange: 'Day 20–21',
    title: 'STAR Behavioral Stories, Project Deep-Dive & Resume Polish',
    category: 'HR & Managerial',
    duration: '2.0 hrs',
    completed: false,
  },
];

export const INTERVIEW_ARCHIVES: InterviewArchive[] = [
  {
    id: 'arch-msft',
    company: 'Microsoft',
    role: 'SDE-1 (Campus Day-0)',
    packageLpa: '₹46 LPA',
    year: '2026-27 Batch',
    verdict: 'Selected',
    difficulty: 'Hard',
    rounds: [
      {
        roundName: 'Round 1 · Online Assessment (90 mins)',
        focus: '2 Medium-Hard Coding Questions on Codility',
        keyQuestions: [
          'Minimum swaps to group all 1s together in a circular binary array',
          'Maximum path sum in a binary tree with negative node values',
        ],
      },
      {
        roundName: 'Round 2 · Technical Interview I (45 mins)',
        focus: 'Trees, Graphs & Clean Production Code',
        keyQuestions: [
          'Serialize and deserialize a Binary Tree without global variables',
          'How does Java ConcurrentHashMap achieve segment/bucket-level locking?',
        ],
      },
      {
        roundName: 'Round 3 · As-Appropriate (AA) Managerial (45 mins)',
        focus: 'Low-Level Design + Resume Project Deep Dive',
        keyQuestions: [
          'Design an LRU Cache with TTL expiration and thread safety',
          'Walk through a production bug or bottleneck in your distributed job queue project',
        ],
      },
    ],
    advice:
      'Think aloud before typing code. Microsoft panelists score heavily on clarifying edge cases (null root, integer overflow) upfront.',
  },
  {
    id: 'arch-oracle',
    company: 'Oracle Server Tech',
    role: 'Member of Technical Staff',
    packageLpa: '₹31.5 LPA',
    year: '2026-27 Batch',
    verdict: 'Selected',
    difficulty: 'Hard',
    rounds: [
      {
        roundName: 'Round 1 · Core CS & Coding Screen',
        focus: 'DBMS Internals, OS Paging, 1 Graph Problem',
        keyQuestions: [
          'Why are B+ Trees preferred over Binary Search Trees and Hash Indexes for disk-backed RDBMS?',
          'Detect cycle in a directed dependency graph and output the cycle nodes',
        ],
      },
      {
        roundName: 'Round 2 · Systems & SQL Optimization',
        focus: 'Query Execution Plans & Concurrency',
        keyQuestions: [
          'Write a query using DENSE_RANK() to fetch top 3 earners per department without correlated subqueries',
          'Explain ACID durability using Write-Ahead Logging (WAL)',
        ],
      },
    ],
    advice:
      'Know database indexing and transaction isolation levels thoroughly—every MTS panelist drills into storage engine fundamentals.',
  },
  {
    id: 'arch-deloitte',
    company: 'Deloitte USI',
    role: 'Technology Analyst',
    packageLpa: '₹10.5 LPA',
    year: '2026-27 Batch',
    verdict: 'Selected',
    difficulty: 'Medium',
    rounds: [
      {
        roundName: 'Round 1 · Quantitative, Verbal & SQL Test',
        focus: 'Speed Aptitude + Joins/Aggregations',
        keyQuestions: [
          'Time-speed-distance & work-rate word problems under 60 seconds/item',
          'LEFT JOIN vs INNER JOIN row cardinality when foreign keys contain NULLs',
        ],
      },
      {
        roundName: 'Round 2 · Techno-Managerial Case Interview',
        focus: 'Resume Architecture + Client Scenario',
        keyQuestions: [
          'How would you migrate an on-premise student portal to cloud with zero downtime?',
          'Tell me about a time a teammate missed a deliverable right before a demo.',
        ],
      },
    ],
    advice:
      'Structure every behavioral answer with Situation, Task, Action, and quantified Result. Communication clarity carries 40% weight.',
  },
];

export const RESOURCE_ITEMS: ResourceItem[] = [
  {
    id: 'res-dsa-patterns',
    title: '14 Core DSA Patterns for Day-0 Product Drives',
    category: 'DSA & Algorithms',
    readTime: '12 min guide',
    updatedAt: 'Updated Oct 2026',
    summary:
      'Decision tree mapping problem constraints (N ≤ 20, N ≤ 10^5, sorted input, tree/DAG) directly to optimal algorithmic templates.',
    content: `14 CORE DSA PATTERNS — QUICK DECISION MATRIX

1. N ≤ 20 → Bitmask DP / Backtracking with Pruning — O(2^N · N)
2. N ≤ 500 → Cubic / Interval DP (Floyd-Warshall, Matrix Chain) — O(N^3)
3. N ≤ 5,000 → 2D DP (Knapsack, LCS, Edit Distance) — O(N^2)
4. N ≤ 10^5 → Sorting + Two Pointers, Sliding Window, Heap, Monotonic Stack, Binary Search on Answer — O(N log N) or O(N)
5. N ≤ 10^9 → Logarithmic Binary Search, Matrix Exponentiation, Math — O(log N)

MUST-REVISE TEMPLATES BEFORE MICROSOFT / ORACLE:
• Monotonic Queue: Sliding Window Maximum in O(N)
• Tarjan / Kahn Topological Sort: Prerequisite & Build Order graphs
• Lowest Common Ancestor & Tree Rerooting
• 0/1 & Unbounded Knapsack 1D Space Optimization (iterate w backwards for 0/1, forwards for Unbounded)`,
  },
  {
    id: 'res-sql-window',
    title: 'Advanced SQL Window Functions & Indexing Handbook',
    category: 'Core CS (DBMS/OS/CN)',
    readTime: '9 min guide',
    updatedAt: 'Updated Oct 2026',
    summary:
      'Side-by-side SQL patterns for RANK, DENSE_RANK, LAG/LEAD, running totals, CTE recursion, and composite B+ Tree index ordering.',
    content: `ADVANCED SQL FOR CAMPUS TECHNICAL INTERVIEWS

1. TOP-N PER GROUP (Oracle / Deloitte Favorite):
WITH RankedSalaries AS (
  SELECT emp_name, dept_id, salary,
         DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rnk
  FROM employees
)
SELECT emp_name, dept_id, salary
FROM RankedSalaries
WHERE rnk <= 3;

2. COMPOSITE INDEX LEFT-PREFIX RULE:
Given CREATE INDEX idx_orders ON orders (customer_id, status, created_at):
• Uses index: WHERE customer_id = 42 AND status = 'PAID'
• Uses partial index: WHERE customer_id = 42 AND created_at > '2026-01-01' (stops range scan after customer_id)
• Skips index: WHERE status = 'PAID' (missing leftmost column customer_id)

3. ISOLATION LEVELS SUMMARY:
• Read Committed: Prevents Dirty Reads (PostgreSQL & Oracle default)
• Repeatable Read: Prevents Dirty + Non-Repeatable Reads (MySQL InnoDB default)
• Serializable: Prevents Phantom Reads via predicate/range locks or SSI`,
  },
  {
    id: 'res-os-concurrency',
    title: 'Operating Systems, Threads & Java Memory Model Notes',
    category: 'Core CS (DBMS/OS/CN)',
    readTime: '10 min guide',
    updatedAt: 'Updated Oct 2026',
    summary:
      'Crisp revision sheet covering process vs thread memory layout, page replacement (LRU), Coffman deadlock prevention, and volatile vs synchronized.',
    content: `OS & CONCURRENCY INTERVIEW REVISION

1. PROCESS VS THREAD MEMORY:
• Shared across threads of same process: Heap, Code/Text segment, Global/Static data, Open file descriptors.
• Private per thread: Stack, Program Counter (PC), CPU Registers.

2. JAVA CONCURRENCY ESSENTIALS:
• volatile: Guarantees visibility across CPU caches and prevents instruction reordering; does NOT guarantee atomicity for compound actions like count++.
• synchronized / ReentrantLock: Guarantees both mutual exclusion (atomicity) and happens-before visibility.
• BlockingQueue: Ideal thread-safe primitive for Producer-Consumer pipelines without manual wait()/notifyAll() pitfalls.

3. VIRTUAL MEMORY & THRASHING:
• TLB (Translation Lookaside Buffer) caches virtual-to-physical frame translations.
• Effective Access Time = hit_ratio × (TLB + Mem) + (1 - hit_ratio) × (TLB + 2 × Mem).`,
  },
  {
    id: 'res-star-playbook',
    title: 'STAR Behavioral & Techno-Managerial Story Matrix',
    category: 'Behavioral & Resume',
    readTime: '7 min guide',
    updatedAt: 'Updated Sep 2026',
    summary:
      'Four battle-tested engineering stories structured around ownership, technical disagreement, tight deadlines, and debugging failure.',
    content: `STAR BEHAVIORAL MATRIX FOR ENGINEERING CANDIDATES

Keep every answer under 90–120 seconds:
• S (Situation - 15%): Crisp context (team size, project goal, constraint).
• T (Task - 15%): Your specific engineering responsibility.
• A (Action - 50%): First-person technical decisions ("I profiled...", "I benchmarked...", "I proposed...").
• R (Result - 20%): Quantified outcome + lesson learned.

HIGH-FREQUENCY PROMPTS:
1. "Tell me about a technical disagreement with a teammate."
   → Focus on data-driven benchmarking (e.g., comparing Redis pub/sub vs PostgreSQL SKIP LOCKED latency) rather than personal friction.
2. "Describe a bug or failure that taught you a lesson."
   → State root cause clearly, how you reproduced it in tests, and what automated safeguard you added.`,
  },
];

export const INITIAL_SETTINGS: PortalSettings = {
  minTargetCtc: 9.0,
  dailyGoalHours: 2.5,
  driveAlerts: true,
  mockReminders: true,
  tpoProfileVisible: true,
};
