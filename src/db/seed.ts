import 'dotenv/config';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { prisma, Prisma, disconnectPrisma } from './prisma.ts';
import {
  APTITUDE_QUESTIONS,
  CODING_PROBLEMS,
  INITIAL_APPLICATIONS,
  INITIAL_COMPANIES,
  INITIAL_PROFILE,
  INITIAL_SETTINGS,
  INITIAL_STUDY_MODULES,
  INTERVIEW_ARCHIVES,
  RESOURCE_ITEMS,
} from '../data/placementData.ts';
import { recalculateAndPersistProfileCompletion } from './users.ts';

const DEFAULT_ADMIN_CUSTODIAN_META = {
  userId: 'TPO-ADMIN-01',
  email: 'admin.tpo@nie-placement.edu',
  name: 'Dr. Rajesh Verma',
  title: 'Chief Training & Placement Officer',
  department: 'Department of Computer Science & Placement Cell',
  institutionName: 'National Institute of Engineering',
  batchYear: 2025,
  phone: '+91 821 248 0475',
  officeLocation: 'Administrative Block, Wing B — Room 204',
  officeHours: 'Mon – Fri · 10:00 AM to 4:30 PM IST',
  deskEmail: 'tpo.office@nie-placement.edu',
  bio: 'Overseeing institutional recruiter partnerships, Day-0/Day-1 campus hiring governance, and academic eligibility compliance across all engineering branches.',
  avatarUrl: '',
  avatarBg: 'indigo',
};

type SkillSeed = {
  name: string;
  category: 'LANGUAGE' | 'FRAMEWORK' | 'DATABASE' | 'TOOL' | 'TECHNICAL' | 'SOFT';
  aliases: string[];
};

const SKILL_CATALOGUE: SkillSeed[] = [
  // LANGUAGES (10)
  { name: 'Java', category: 'LANGUAGE', aliases: ['java 21', 'java se', 'core java', 'jdk'] },
  { name: 'Python', category: 'LANGUAGE', aliases: ['python 3', 'py'] },
  { name: 'C++', category: 'LANGUAGE', aliases: ['cpp', 'c++20', 'stl'] },
  { name: 'JavaScript', category: 'LANGUAGE', aliases: ['js', 'es6', 'ecmascript'] },
  { name: 'TypeScript', category: 'LANGUAGE', aliases: ['ts'] },
  { name: 'SQL', category: 'LANGUAGE', aliases: ['structured query language', 'ansi sql', 'pl/sql'] },
  { name: 'C', category: 'LANGUAGE', aliases: ['c programming', 'ansi c'] },
  { name: 'Go', category: 'LANGUAGE', aliases: ['golang'] },
  { name: 'Bash', category: 'LANGUAGE', aliases: ['shell scripting', 'linux shell'] },
  { name: 'HTML/CSS', category: 'LANGUAGE', aliases: ['html5', 'css3', 'semantic html'] },
  // FRAMEWORKS (9)
  { name: 'React', category: 'FRAMEWORK', aliases: ['reactjs', 'react.js', 'mern'] },
  { name: 'Node.js', category: 'FRAMEWORK', aliases: ['nodejs', 'node'] },
  { name: 'Express', category: 'FRAMEWORK', aliases: ['express.js', 'expressjs'] },
  { name: 'Spring Boot', category: 'FRAMEWORK', aliases: ['spring', 'java spring'] },
  { name: 'Django', category: 'FRAMEWORK', aliases: ['django rest'] },
  { name: 'FastAPI', category: 'FRAMEWORK', aliases: ['fast api'] },
  { name: 'Next.js', category: 'FRAMEWORK', aliases: ['nextjs'] },
  { name: 'Tailwind CSS', category: 'FRAMEWORK', aliases: ['tailwind'] },
  { name: 'JUnit', category: 'FRAMEWORK', aliases: ['unit testing', 'vitest', 'jest'] },
  // DATABASES (6)
  { name: 'PostgreSQL', category: 'DATABASE', aliases: ['postgres', 'psql'] },
  { name: 'MySQL', category: 'DATABASE', aliases: ['innodb', 'mariadb'] },
  { name: 'MongoDB', category: 'DATABASE', aliases: ['mongo', 'nosql'] },
  { name: 'Redis', category: 'DATABASE', aliases: ['in-memory cache', 'redis pub/sub'] },
  { name: 'Oracle DB', category: 'DATABASE', aliases: ['oracle database', 'plsql'] },
  { name: 'SQLite', category: 'DATABASE', aliases: ['sqlite3'] },
  // TOOLS (8)
  { name: 'Git', category: 'TOOL', aliases: ['github', 'gitlab', 'version control'] },
  { name: 'Docker', category: 'TOOL', aliases: ['containers', 'dockerfile'] },
  { name: 'Kubernetes', category: 'TOOL', aliases: ['k8s', 'container orchestration'] },
  { name: 'AWS', category: 'TOOL', aliases: ['amazon web services', 'cloud basics', 'cloud', 'ec2', 's3'] },
  { name: 'Linux', category: 'TOOL', aliases: ['ubuntu', 'unix'] },
  { name: 'CI/CD', category: 'TOOL', aliases: ['github actions', 'jenkins', 'devops'] },
  { name: 'Postman', category: 'TOOL', aliases: ['api testing'] },
  { name: 'Kafka', category: 'TOOL', aliases: ['apache kafka', 'event streaming'] },
  // TECHNICAL CONCEPTS (11)
  { name: 'DSA', category: 'TECHNICAL', aliases: ['data structures', 'algorithms', 'dsa (advanced)', 'advanced dsa (trees & graphs)', 'dsa trees/graphs'] },
  { name: 'Dynamic Programming', category: 'TECHNICAL', aliases: ['dp', 'knapsack', 'memoization'] },
  { name: 'System Design', category: 'TECHNICAL', aliases: ['hld', 'lld', 'distributed systems', 'scalability'] },
  { name: 'OOP', category: 'TECHNICAL', aliases: ['object oriented programming', 'oops', 'solid principles'] },
  { name: 'DBMS', category: 'TECHNICAL', aliases: ['database management', 'acid', 'indexing', 'b+ tree', 'sql window functions & query plans'] },
  { name: 'Operating Systems', category: 'TECHNICAL', aliases: ['os', 'os concurrency', 'concurrency', 'multithreading', 'deadlocks'] },
  { name: 'Computer Networks', category: 'TECHNICAL', aliases: ['cn', 'tcp/ip', 'http', 'dns', 'tls'] },
  { name: 'REST APIs', category: 'TECHNICAL', aliases: ['restful api', 'web dev', 'web', 'microservices'] },
  { name: 'Software Engineering', category: 'TECHNICAL', aliases: ['sdlc', 'agile', 'scrum'] },
  { name: 'Cybersecurity Basics', category: 'TECHNICAL', aliases: ['owasp', 'jwt', 'oauth'] },
  { name: 'Quantitative Analytics', category: 'TECHNICAL', aliases: ['competitive math', 'finance fundamentals', 'probability'] },
  // SOFT SKILLS (4)
  { name: 'Communication', category: 'SOFT', aliases: ['verbal communication', 'presentation'] },
  { name: 'Problem Solving', category: 'SOFT', aliases: ['analytical thinking', 'critical thinking'] },
  { name: 'Team Collaboration', category: 'SOFT', aliases: ['teamwork', 'cross-functional'] },
  { name: 'Leadership & Ownership', category: 'SOFT', aliases: ['ownership', 'stakeholder management'] },
];

type ExtraCompanySeed = {
  slug: string;
  name: string;
  logoIcon: string;
  category: string;
  industry: string;
  location: string;
  packageInfo: string;
  driveDate: string;
  daysRemaining: number;
  minCgpa: string;
  minTenth: string;
  minTwelfth: string;
  maxActiveBacklogs: number;
  maxTotalBacklogs: number;
  allowedBranches: string[];
  roles: { title: string; packageInfo: string; mustSkills: string[]; goodSkills: string[] }[];
  stages: string[];
  notes: string;
};

const EXTRA_COMPANIES: ExtraCompanySeed[] = [
  {
    slug: 'infosys',
    name: 'Infosys',
    logoIcon: 'hub',
    category: 'Digital & Specialist',
    industry: 'IT Services & Consulting',
    location: 'Mysuru / Bengaluru / Pune',
    packageInfo: '₹6.25 - 9.5 LPA',
    driveDate: 'Dec 04, 2026',
    daysRemaining: 35,
    minCgpa: '6.80',
    minTenth: '65.00',
    minTwelfth: '65.00',
    maxActiveBacklogs: 0,
    maxTotalBacklogs: 1,
    allowedBranches: ['CSE', 'IT', 'ECE', 'EE', 'ME'],
    roles: [
      {
        title: 'Specialist Programmer (SP)',
        packageInfo: '₹9.5 LPA',
        mustSkills: ['DSA', 'Java', 'Python', 'SQL'],
        goodSkills: ['Dynamic Programming', 'REST APIs'],
      },
      {
        title: 'Digital Specialist Engineer (DSE)',
        packageInfo: '₹6.25 LPA',
        mustSkills: ['Java', 'SQL', 'OOP'],
        goodSkills: ['React', 'Git'],
      },
    ],
    stages: ['1. HackWithInfy / Online Test', '2. Technical Panel', '3. HR Discussion'],
    notes: 'Sample campus drive criteria. Specialist Programmer track emphasizes medium-hard DSA.',
  },
  {
    slug: 'wipro',
    name: 'Wipro',
    logoIcon: 'lan',
    category: 'Turbo Hiring',
    industry: 'IT Services',
    location: 'Bengaluru / Hyderabad / Chennai',
    packageInfo: '₹6.5 LPA',
    driveDate: 'Dec 08, 2026',
    daysRemaining: 39,
    minCgpa: '6.50',
    minTenth: '60.00',
    minTwelfth: '60.00',
    maxActiveBacklogs: 0,
    maxTotalBacklogs: 2,
    allowedBranches: ['All Engineering Branches'],
    roles: [
      {
        title: 'Project Engineer (Turbo)',
        packageInfo: '₹6.5 LPA',
        mustSkills: ['Java', 'SQL', 'Problem Solving'],
        goodSkills: ['Linux', 'Git', 'Communication'],
      },
    ],
    stages: ['1. Aptitude + Essay + Coding', '2. Technical Interview', '3. HR Screen'],
    notes: 'Sample campus criteria for Wipro Turbo.',
  },
  {
    slug: 'cognizant',
    name: 'Cognizant',
    logoIcon: 'memory',
    category: 'GenC Next',
    industry: 'Digital Engineering',
    location: 'Chennai / Pune / Kolkata',
    packageInfo: '₹6.75 LPA',
    driveDate: 'Dec 11, 2026',
    daysRemaining: 42,
    minCgpa: '6.50',
    minTenth: '60.00',
    minTwelfth: '60.00',
    maxActiveBacklogs: 0,
    maxTotalBacklogs: 1,
    allowedBranches: ['CSE', 'IT', 'ECE', 'EE'],
    roles: [
      {
        title: 'GenC Next Developer',
        packageInfo: '₹6.75 LPA',
        mustSkills: ['Java', 'SQL', 'DSA', 'OOP'],
        goodSkills: ['Spring Boot', 'AWS'],
      },
    ],
    stages: ['1. Skill-Based Assessment', '2. Technical SME Interview', '3. HR Verification'],
    notes: 'Sample GenC Next criteria.',
  },
  {
    slug: 'capgemini',
    name: 'Capgemini',
    logoIcon: 'public',
    category: 'Exceller Senior Analyst',
    industry: 'Consulting & Cloud',
    location: 'Mumbai / Pune / Bengaluru',
    packageInfo: '₹7.5 LPA',
    driveDate: 'Dec 14, 2026',
    daysRemaining: 45,
    minCgpa: '6.50',
    minTenth: '65.00',
    minTwelfth: '65.00',
    maxActiveBacklogs: 0,
    maxTotalBacklogs: 1,
    allowedBranches: ['All Engineering Branches'],
    roles: [
      {
        title: 'Senior Analyst (Differential)',
        packageInfo: '₹7.5 LPA',
        mustSkills: ['DSA', 'SQL', 'OOP', 'Communication'],
        goodSkills: ['Docker', 'AWS'],
      },
    ],
    stages: ['1. Pseudocode + Game-Based Aptitude', '2. Coding Round', '3. Tech + HR'],
    notes: 'Sample Exceller differential criteria.',
  },
  {
    slug: 'ibm',
    name: 'IBM',
    logoIcon: 'dns',
    category: 'ISL Software Labs',
    industry: 'Enterprise Cloud & AI',
    location: 'Bengaluru / Kochi / Pune',
    packageInfo: '₹11.0 - 14.5 LPA',
    driveDate: 'Dec 17, 2026',
    daysRemaining: 48,
    minCgpa: '7.20',
    minTenth: '70.00',
    minTwelfth: '70.00',
    maxActiveBacklogs: 0,
    maxTotalBacklogs: 0,
    allowedBranches: ['CSE', 'IT', 'ECE'],
    roles: [
      {
        title: 'Associate Systems Developer',
        packageInfo: '₹12.5 LPA',
        mustSkills: ['Java', 'Python', 'Linux', 'Docker', 'SQL'],
        goodSkills: ['Kubernetes', 'Operating Systems'],
      },
    ],
    stages: ['1. HackerRank Coding + SQL', '2. Cognitive & English', '3. Systems Panel', '4. Managerial'],
    notes: 'Sample IBM India Software Labs criteria.',
  },
  {
    slug: 'tech-mahindra',
    name: 'Tech Mahindra',
    logoIcon: 'settings_ethernet',
    category: 'Supercoder Track',
    industry: 'Telecom & Digital IT',
    location: 'Pune / Hyderabad / Noida',
    packageInfo: '₹5.5 - 7.0 LPA',
    driveDate: 'Dec 20, 2026',
    daysRemaining: 51,
    minCgpa: '6.00',
    minTenth: '60.00',
    minTwelfth: '60.00',
    maxActiveBacklogs: 0,
    maxTotalBacklogs: 2,
    allowedBranches: ['CSE', 'IT', 'ECE', 'EE'],
    roles: [
      {
        title: 'Software Engineer (Supercoder)',
        packageInfo: '₹7.0 LPA',
        mustSkills: ['Java', 'SQL', 'Computer Networks'],
        goodSkills: ['REST APIs', 'Linux'],
      },
    ],
    stages: ['1. Aptitude + Tech Test', '2. Supercoder Challenge', '3. Technical & HR'],
    notes: 'Sample Supercoder track criteria.',
  },
  {
    slug: 'hcltech',
    name: 'HCLTech',
    logoIcon: 'developer_board',
    category: 'ERS & Cloud Native',
    industry: 'Engineering & R&D Services',
    location: 'Noida / Chennai / Bengaluru',
    packageInfo: '₹6.0 - 8.5 LPA',
    driveDate: 'Dec 22, 2026',
    daysRemaining: 53,
    minCgpa: '6.50',
    minTenth: '65.00',
    minTwelfth: '65.00',
    maxActiveBacklogs: 0,
    maxTotalBacklogs: 1,
    allowedBranches: ['CSE', 'IT', 'ECE', 'EE'],
    roles: [
      {
        title: 'Graduate Engineer Trainee (Product Engg)',
        packageInfo: '₹7.5 LPA',
        mustSkills: ['C++', 'Java', 'Operating Systems', 'Computer Networks'],
        goodSkills: ['Linux', 'Git'],
      },
    ],
    stages: ['1. Quantitative & Core CS Test', '2. Coding Screen', '3. Technical Panel'],
    notes: 'Sample HCLTech Engineering R&D criteria.',
  },
  {
    slug: 'ltimindtree',
    name: 'LTIMindtree',
    logoIcon: 'hub',
    category: 'Ignite Digital',
    industry: 'Cloud & Data Engineering',
    location: 'Mumbai / Bengaluru / Chennai',
    packageInfo: '₹6.5 - 8.0 LPA',
    driveDate: 'Dec 26, 2026',
    daysRemaining: 57,
    minCgpa: '6.75',
    minTenth: '65.00',
    minTwelfth: '65.00',
    maxActiveBacklogs: 0,
    maxTotalBacklogs: 1,
    allowedBranches: ['CSE', 'IT', 'ECE'],
    roles: [
      {
        title: 'Data & Full-Stack Engineer',
        packageInfo: '₹7.5 LPA',
        mustSkills: ['SQL', 'Python', 'React', 'REST APIs'],
        goodSkills: ['PostgreSQL', 'AWS'],
      },
    ],
    stages: ['1. Online Aptitude + SQL', '2. Coding Round', '3. Technical & HR'],
    notes: 'Sample LTIMindtree campus criteria.',
  },
  {
    slug: 'google',
    name: 'Google',
    logoIcon: 'travel_explore',
    category: 'Super-Dream Product',
    industry: 'Cloud, Search & AI',
    location: 'Bengaluru / Hyderabad',
    packageInfo: '₹36 - 48 LPA (Sample)',
    driveDate: 'Jan 06, 2027',
    daysRemaining: 68,
    minCgpa: '8.00',
    minTenth: '75.00',
    minTwelfth: '75.00',
    maxActiveBacklogs: 0,
    maxTotalBacklogs: 0,
    allowedBranches: ['CSE', 'IT', 'ECE'],
    roles: [
      {
        title: 'Software Engineer, University Graduate',
        packageInfo: '₹42 LPA (Sample)',
        mustSkills: ['DSA', 'Dynamic Programming', 'C++', 'Python', 'System Design'],
        goodSkills: ['Operating Systems', 'Distributed Systems', 'Go'],
      },
    ],
    stages: ['1. Online Coding Snapshot', '2. Technical Algo I', '3. Technical Algo II', '4. Googleyness & Leadership'],
    notes: 'Illustrative sample criteria for university grad preparation.',
  },
  {
    slug: 'amazon',
    name: 'Amazon',
    logoIcon: 'inventory_2',
    category: 'Day-0 Product',
    industry: 'E-Commerce & Cloud (AWS)',
    location: 'Bengaluru / Hyderabad / Chennai',
    packageInfo: '₹32 - 45 LPA (Sample)',
    driveDate: 'Jan 10, 2027',
    daysRemaining: 72,
    minCgpa: '7.50',
    minTenth: '70.00',
    minTwelfth: '70.00',
    maxActiveBacklogs: 0,
    maxTotalBacklogs: 0,
    allowedBranches: ['CSE', 'IT', 'ECE', 'EE'],
    roles: [
      {
        title: 'Software Development Engineer I (SDE-1)',
        packageInfo: '₹38 LPA (Sample)',
        mustSkills: ['DSA', 'Java', 'OOP', 'System Design', 'AWS'],
        goodSkills: ['Operating Systems', 'DBMS', 'Leadership & Ownership'],
      },
    ],
    stages: ['1. OA (2 Coding + Work Style)', '2. Technical Loop I (DSA)', '3. Technical Loop II (LLD + CS)', '4. Bar Raiser'],
    notes: 'Illustrative sample criteria emphasizing DSA and Leadership Principles.',
  },
];

const EXTRA_CODING_PROBLEMS = [
  {
    slug: 'two-sum-indices',
    title: 'Two Sum in Unsorted Array',
    badge: 'Day-1 Warmup',
    difficulty: 'EASY' as const,
    topic: 'Arrays & Hashing',
    complexity: 'Time: O(N) · Space: O(N)',
    description: 'Given an integer array nums and target, return the 0-based indices of two elements whose sum equals target.',
    constraints: '2 <= nums.length <= 10^5, -10^9 <= nums[i] <= 10^9',
    sampleInput: 'nums = [2, 7, 11, 15], target = 9',
    sampleOutput: '[0, 1]',
    hiddenInput: 'nums = [3, 2, 4], target = 6',
    hiddenOutput: '[1, 2]',
  },
  {
    slug: 'valid-parentheses-stack',
    title: 'Balanced Bracket Sequence Validator',
    badge: 'Mass Recruiter OA',
    difficulty: 'EASY' as const,
    topic: 'Stacks',
    complexity: 'Time: O(N) · Space: O(N)',
    description: 'Given a string s containing (), {}, and [], determine if every opening bracket is closed in valid LIFO order.',
    constraints: '1 <= s.length <= 10^4',
    sampleInput: 's = "{[()]}"',
    sampleOutput: 'true',
    hiddenInput: 's = "([)]"',
    hiddenOutput: 'false',
  },
  {
    slug: 'kadane-maximum-subarray',
    title: 'Maximum Contiguous Subarray Sum (Kadane)',
    badge: 'Core Array OA',
    difficulty: 'EASY' as const,
    topic: 'Arrays & DP',
    complexity: 'Time: O(N) · Space: O(1)',
    description: 'Find the contiguous non-empty subarray within an integer array nums that has the largest sum and return its sum.',
    constraints: '1 <= nums.length <= 10^5, -10^4 <= nums[i] <= 10^4',
    sampleInput: 'nums = [-2,1,-3,4,-1,2,1,-5,4]',
    sampleOutput: '6',
    hiddenInput: 'nums = [-5, -2, -9]',
    hiddenOutput: '-2',
  },
  {
    slug: 'binary-search-rotated',
    title: 'Search in Rotated Sorted Array',
    badge: 'Microsoft & Oracle OA',
    difficulty: 'MEDIUM' as const,
    topic: 'Binary Search',
    complexity: 'Time: O(log N) · Space: O(1)',
    description: 'Given a strictly increasing array rotated at an unknown pivot and a target integer, return its index in O(log N) or -1.',
    constraints: '1 <= nums.length <= 5000',
    sampleInput: 'nums = [4,5,6,7,0,1,2], target = 0',
    sampleOutput: '4',
    hiddenInput: 'nums = [4,5,6,7,0,1,2], target = 3',
    hiddenOutput: '-1',
  },
  {
    slug: 'detect-linked-list-cycle',
    title: 'Linked List Cycle Entry Node (Floyd Tortoise-Hare)',
    badge: 'Pointer Invariant',
    difficulty: 'EASY' as const,
    topic: 'Linked Lists',
    complexity: 'Time: O(N) · Space: O(1)',
    description: 'Given head of a singly linked list, return the 0-indexed node where the cycle begins, or -1 if acyclic.',
    constraints: '0 <= Nodes <= 10^4',
    sampleInput: 'head = [3,2,0,-4], pos = 1',
    sampleOutput: '1',
    hiddenInput: 'head = [1,2], pos = -1',
    hiddenOutput: '-1',
  },
  {
    slug: 'reverse-k-group-list',
    title: 'Reverse Nodes in k-Group',
    badge: 'Super-Dream Linked List',
    difficulty: 'HARD' as const,
    topic: 'Linked Lists',
    complexity: 'Time: O(N) · Space: O(1)',
    description: 'Reverse the nodes of a linked list k at a time and return the modified list; leave trailing < k nodes as-is.',
    constraints: '1 <= k <= N <= 5000',
    sampleInput: 'head = [1,2,3,4,5], k = 2',
    sampleOutput: '[2,1,4,3,5]',
    hiddenInput: 'head = [1,2,3,4,5], k = 3',
    hiddenOutput: '[3,2,1,4,5]',
  },
  {
    slug: 'subarray-sum-equals-k',
    title: 'Count Subarrays With Sum Equal to K',
    badge: 'Prefix Hash Favorite',
    difficulty: 'MEDIUM' as const,
    topic: 'Prefix Sum & Hashing',
    complexity: 'Time: O(N) · Space: O(N)',
    description: 'Given an integer array nums and integer k, return the total number of contiguous subarrays whose sum equals k.',
    constraints: '1 <= nums.length <= 2 * 10^4',
    sampleInput: 'nums = [1,1,1], k = 2',
    sampleOutput: '2',
    hiddenInput: 'nums = [1,2,3,-3,3], k = 3',
    hiddenOutput: '4',
  },
  {
    slug: 'kth-largest-minheap',
    title: 'Kth Largest Element in Stream / Array',
    badge: 'Heap & Quickselect',
    difficulty: 'MEDIUM' as const,
    topic: 'Heaps & Priority Queue',
    complexity: 'Time: O(N log K) · Space: O(K)',
    description: 'Return the kth largest element in sorted order (not kth distinct) without full sorting.',
    constraints: '1 <= k <= nums.length <= 10^5',
    sampleInput: 'nums = [3,2,1,5,6,4], k = 2',
    sampleOutput: '5',
    hiddenInput: 'nums = [3,2,3,1,2,4,5,5,6], k = 4',
    hiddenOutput: '4',
  },
  {
    slug: 'number-of-islands-bfs',
    title: 'Connected Components in 2D Grid (Islands)',
    badge: 'Amazon & Deloitte Graph',
    difficulty: 'MEDIUM' as const,
    topic: 'Graphs & BFS/DFS',
    complexity: 'Time: O(R * C) · Space: O(R * C)',
    description: 'Given an m x n binary grid of 1s (land) and 0s (water), count 4-directionally connected islands.',
    constraints: '1 <= m, n <= 300',
    sampleInput: 'grid = [["1","1","0"],["0","1","0"],["0","0","1"]]',
    sampleOutput: '2',
    hiddenInput: 'grid = [["0","0"],["0","0"]]',
    hiddenOutput: '0',
  },
  {
    slug: 'rotting-oranges-multisource',
    title: 'Multi-Source BFS Minimum Time Propagation',
    badge: 'Graph OA',
    difficulty: 'MEDIUM' as const,
    topic: 'Graphs & BFS/DFS',
    complexity: 'Time: O(R * C) · Space: O(R * C)',
    description: 'Compute minimum minutes until no fresh cell remains in a grid where adjacent cells rot each minute, or -1.',
    constraints: '1 <= m, n <= 10',
    sampleInput: 'grid = [[2,1,1],[1,1,0],[0,1,1]]',
    sampleOutput: '4',
    hiddenInput: 'grid = [[2,1,1],[0,1,1],[1,0,1]]',
    hiddenOutput: '-1',
  },
  {
    slug: 'dijkstra-network-delay',
    title: 'Network Signal Delay Time (Dijkstra)',
    badge: 'Oracle & Cisco Systems',
    difficulty: 'MEDIUM' as const,
    topic: 'Shortest Paths',
    complexity: 'Time: O(E log V) · Space: O(V + E)',
    description: 'Given directed weighted edges times[i] = (u, v, w), return minimum time for all n nodes to receive a signal from k, or -1.',
    constraints: '1 <= k <= n <= 100, 1 <= times.length <= 6000',
    sampleInput: 'times = [[2,1,1],[2,3,1],[3,4,1]], n = 4, k = 2',
    sampleOutput: '2',
    hiddenInput: 'times = [[1,2,1]], n = 2, k = 2',
    hiddenOutput: '-1',
  },
  {
    slug: 'coin-change-min-coins',
    title: 'Minimum Coins to Make Amount (Unbounded DP)',
    badge: 'DP Essential',
    difficulty: 'MEDIUM' as const,
    topic: 'Dynamic Programming',
    complexity: 'Time: O(N * Amount) · Space: O(Amount)',
    description: 'Given coin denominations and total amount, return fewest coins needed to make amount, or -1 if impossible.',
    constraints: '1 <= coins.length <= 12, 0 <= amount <= 10^4',
    sampleInput: 'coins = [1, 2, 5], amount = 11',
    sampleOutput: '3',
    hiddenInput: 'coins = [2], amount = 3',
    hiddenOutput: '-1',
  },
  {
    slug: 'longest-common-subsequence',
    title: 'Longest Common Subsequence of Two Strings',
    badge: '2D String DP',
    difficulty: 'MEDIUM' as const,
    topic: 'Dynamic Programming',
    complexity: 'Time: O(M * N) · Space: O(min(M, N))',
    description: 'Given two strings text1 and text2, return the length of their longest common subsequence.',
    constraints: '1 <= text1.length, text2.length <= 1000',
    sampleInput: 'text1 = "abcde", text2 = "ace"',
    sampleOutput: '3',
    hiddenInput: 'text1 = "abc", text2 = "def"',
    hiddenOutput: '0',
  },
  {
    slug: 'edit-distance-levenshtein',
    title: 'Minimum Edit Distance (Levenshtein)',
    badge: 'Goldman & Google DP',
    difficulty: 'HARD' as const,
    topic: 'Dynamic Programming',
    complexity: 'Time: O(M * N) · Space: O(N)',
    description: 'Return minimum insert, delete, or replace operations required to convert word1 into word2.',
    constraints: '0 <= word1.length, word2.length <= 500',
    sampleInput: 'word1 = "horse", word2 = "ros"',
    sampleOutput: '3',
    hiddenInput: 'word1 = "intention", word2 = "execution"',
    hiddenOutput: '5',
  },
  {
    slug: 'serialize-binary-tree',
    title: 'Serialize and Deserialize Binary Tree',
    badge: 'Microsoft Round-2',
    difficulty: 'HARD' as const,
    topic: 'Trees & Design',
    complexity: 'Time: O(N) · Space: O(N)',
    description: 'Design stateless encode(root) and decode(str) algorithms to serialize and reconstruct any binary tree.',
    constraints: '0 <= Nodes <= 10^4, -1000 <= Node.val <= 1000',
    sampleInput: 'root = [1,2,3,null,null,4,5]',
    sampleOutput: '[1,2,3,null,null,4,5]',
    hiddenInput: 'root = []',
    hiddenOutput: '[]',
  },
  {
    slug: 'lru-cache-design',
    title: 'LRU Cache With O(1) Get & Put',
    badge: 'LLD & Systems Classic',
    difficulty: 'MEDIUM' as const,
    topic: 'Hash Map + Doubly Linked List',
    complexity: 'Time: O(1) · Space: O(Capacity)',
    description: 'Implement LRUCache(capacity) supporting O(1) get(key) and put(key, value) with least-recently-used eviction.',
    constraints: '1 <= capacity <= 3000, up to 2 * 10^5 calls',
    sampleInput: 'cap=2: put(1,1), put(2,2), get(1), put(3,3), get(2)',
    sampleOutput: '[1, -1]',
    hiddenInput: 'cap=1: put(2,1), get(2), put(3,2), get(2), get(3)',
    hiddenOutput: '[1, -1, 2]',
  },
  {
    slug: 'sliding-window-maximum',
    title: 'Sliding Window Maximum (Monotonic Deque)',
    badge: 'Day-0 Hard OA',
    difficulty: 'HARD' as const,
    topic: 'Sliding Window & Deque',
    complexity: 'Time: O(N) · Space: O(K)',
    description: 'Given array nums and window size k, return the max element in each sliding window in O(N) time.',
    constraints: '1 <= k <= nums.length <= 10^5',
    sampleInput: 'nums = [1,3,-1,-3,5,3,6,7], k = 3',
    sampleOutput: '[3,3,5,5,6,7]',
    hiddenInput: 'nums = [1], k = 1',
    hiddenOutput: '[1]',
  },
  {
    slug: 'koko-eating-bananas',
    title: 'Minimum Feasibility Rate (Binary Search on Answer)',
    badge: 'Amazon & Flipkart OA',
    difficulty: 'MEDIUM' as const,
    topic: 'Binary Search',
    complexity: 'Time: O(N log M) · Space: O(1)',
    description: 'Given piles[] and hours h, compute minimum integer rate k such that all piles are consumed within h hours.',
    constraints: '1 <= piles.length <= 10^4, piles.length <= h <= 10^9',
    sampleInput: 'piles = [3,6,7,11], h = 8',
    sampleOutput: '4',
    hiddenInput: 'piles = [30,11,23,4,20], h = 5',
    hiddenOutput: '30',
  },
  {
    slug: 'word-ladder-shortest-chain',
    title: 'Shortest Word Transformation Sequence',
    badge: 'Google & Uber BFS',
    difficulty: 'HARD' as const,
    topic: 'Graphs & Bidirectional BFS',
    complexity: 'Time: O(N * L^2) · Space: O(N * L)',
    description: 'Find length of shortest single-character dictionary transformation from beginWord to endWord, or 0.',
    constraints: '1 <= L <= 10, 1 <= wordList.length <= 5000',
    sampleInput: 'begin="hit", end="cog", list=["hot","dot","dog","lot","log","cog"]',
    sampleOutput: '5',
    hiddenInput: 'begin="hit", end="cog", list=["hot","dot","dog","lot","log"]',
    hiddenOutput: '0',
  },
];

type QuestionCat =
  | 'QUANT'
  | 'LOGICAL'
  | 'VERBAL'
  | 'NUMBER_SYSTEMS'
  | 'PERCENTAGES'
  | 'PROFIT_LOSS'
  | 'TIME_WORK'
  | 'TSD'
  | 'PROBABILITY'
  | 'PERM_COMB'
  | 'CODING_DECODING'
  | 'SERIES'
  | 'PUZZLES';

function buildAptitudeQuestionBank() {
  const list: {
    category: QuestionCat;
    subtopic: string;
    patternBadge: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    text: string;
    explanation: string;
    options: { key: string; text: string; isCorrect: boolean }[];
  }[] = [];

  // 1. Preserve all 10 exact frontend APTITUDE_QUESTIONS first
  const catMap: Record<string, QuestionCat> = {
    Quantitative: 'QUANT',
    'Logical Reasoning': 'LOGICAL',
    'Speed Math': 'TIME_WORK',
    'Data Interpretation': 'PERCENTAGES',
    'Verbal Ability': 'VERBAL',
  };

  for (const fq of APTITUDE_QUESTIONS) {
    list.push({
      category: catMap[fq.category] || 'QUANT',
      subtopic: fq.category,
      patternBadge: fq.patternBadge,
      difficulty: 'MEDIUM',
      text: fq.question,
      explanation: fq.explanation,
      options: fq.options.map((o) => ({
        key: o.key,
        text: o.text,
        isCorrect: o.key === fq.correctAnswer,
      })),
    });
  }

  // 2. Generate 10 distinct, verified questions for each of the 13 categories (130 more -> 140 total!)
  for (let i = 1; i <= 10; i++) {
    const diff: 'EASY' | 'MEDIUM' | 'HARD' = i <= 4 ? 'EASY' : i <= 8 ? 'MEDIUM' : 'HARD';

    // QUANT: Averages & Ratios
    const avgBase = 20 + i * 3;
    const addedVal = avgBase + 6 * 5;
    list.push({
      category: 'QUANT',
      subtopic: 'Averages & Mixtures',
      patternBadge: 'Campus Quant Gate',
      difficulty: diff,
      text: `[Q-Avg-${i}] The average score of 5 students in an assessment is ${avgBase}. When a 6th student's score is included, the average rises by 5. What is the 6th student's score?`,
      explanation: `Initial sum = 5 × ${avgBase} = ${5 * avgBase}. New sum = 6 × ${avgBase + 5} = ${6 * (avgBase + 5)}. Difference = ${addedVal}.`,
      options: [
        { key: 'A', text: `${addedVal - 5}`, isCorrect: false },
        { key: 'B', text: `${addedVal}`, isCorrect: true },
        { key: 'C', text: `${addedVal + 5}`, isCorrect: false },
        { key: 'D', text: `${addedVal + 10}`, isCorrect: false },
      ],
    });

    // NUMBER_SYSTEMS: Divisibility & Remainders
    const remK = i + 2;
    const dividend = 17 * (10 + i) + remK;
    const actualRem = dividend % 17;
    list.push({
      category: 'NUMBER_SYSTEMS',
      subtopic: 'Modular Arithmetic',
      patternBadge: 'TCS NQT Numerical',
      difficulty: diff,
      text: `[NS-${i}] What is the remainder when ${dividend} is divided by 17?`,
      explanation: `${dividend} = 17 × ${Math.floor(dividend / 17)} + ${actualRem}, so the remainder modulo 17 is ${actualRem}.`,
      options: [
        { key: 'A', text: `${actualRem}`, isCorrect: true },
        { key: 'B', text: `${(actualRem + 2) % 17}`, isCorrect: false },
        { key: 'C', text: `${(actualRem + 5) % 17}`, isCorrect: false },
        { key: 'D', text: `${(actualRem + 9) % 17}`, isCorrect: false },
      ],
    });

    // PERCENTAGES
    const basePrice = 200 * i;
    const netAfter = Math.round(basePrice * 1.2 * 0.9);
    list.push({
      category: 'PERCENTAGES',
      subtopic: 'Successive Percentage Change',
      patternBadge: 'Deloitte DI & Quant',
      difficulty: diff,
      text: `[PCT-${i}] A server license costing ₹${basePrice} increases by 20% and is then discounted by 10%. What is the final price?`,
      explanation: `Final price = ${basePrice} × 1.20 × 0.90 = ${basePrice} × 1.08 = ₹${netAfter}.`,
      options: [
        { key: 'A', text: `₹${basePrice * 1.1}`, isCorrect: false },
        { key: 'B', text: `₹${netAfter}`, isCorrect: true },
        { key: 'C', text: `₹${basePrice}`, isCorrect: false },
        { key: 'D', text: `₹${netAfter + 20}`, isCorrect: false },
      ],
    });

    // PROFIT_LOSS
    const cp = 500 * i;
    const sp = Math.round(cp * 1.25);
    list.push({
      category: 'PROFIT_LOSS',
      subtopic: 'Cost, Markup & Margin',
      patternBadge: 'Aptitude Commercial Math',
      difficulty: diff,
      text: `[PL-${i}] An electronics kit bought for ₹${cp} is sold at a 25% profit. What is the selling price?`,
      explanation: `Selling price = Cost Price × 1.25 = ${cp} × 1.25 = ₹${sp}.`,
      options: [
        { key: 'A', text: `₹${sp - 50}`, isCorrect: false },
        { key: 'B', text: `₹${sp + 75}`, isCorrect: false },
        { key: 'C', text: `₹${sp}`, isCorrect: true },
        { key: 'D', text: `₹${cp + 100}`, isCorrect: false },
      ],
    });

    // TIME_WORK
    const aDays = 6 * i;
    const bDays = 12 * i;
    const togetherDays = 4 * i;
    list.push({
      category: 'TIME_WORK',
      subtopic: 'Work Rate & Efficiency',
      patternBadge: 'Accenture Cognitive',
      difficulty: diff,
      text: `[TW-${i}] Developer A can build a module in ${aDays} days and Developer B in ${bDays} days. Working together, how many days will they take?`,
      explanation: `Combined rate = 1/${aDays} + 1/${bDays} = 3/${bDays} = 1/${togetherDays}. Thus they finish in ${togetherDays} days.`,
      options: [
        { key: 'A', text: `${togetherDays} days`, isCorrect: true },
        { key: 'B', text: `${togetherDays + 2} days`, isCorrect: false },
        { key: 'C', text: `${aDays - 1} days`, isCorrect: false },
        { key: 'D', text: `${togetherDays + 4} days`, isCorrect: false },
      ],
    });

    // TSD (Time, Speed, Distance)
    const speedMs = 10 + i * 2;
    const lenM = speedMs * 15;
    list.push({
      category: 'TSD',
      subtopic: 'Relative Speed & Trains',
      patternBadge: 'Capgemini Quant',
      difficulty: diff,
      text: `[TSD-${i}] A train of length ${lenM} m moves at ${speedMs} m/s. How many seconds does it take to pass a stationary pole?`,
      explanation: `Time = Distance / Speed = ${lenM} / ${speedMs} = 15 seconds.`,
      options: [
        { key: 'A', text: '12 sec', isCorrect: false },
        { key: 'B', text: '15 sec', isCorrect: true },
        { key: 'C', text: '18 sec', isCorrect: false },
        { key: 'D', text: '20 sec', isCorrect: false },
      ],
    });

    // PROBABILITY
    const red = i + 2;
    const blue = i + 3;
    const tot = red + blue;
    list.push({
      category: 'PROBABILITY',
      subtopic: 'Classical & Conditional Probability',
      patternBadge: 'Goldman Quant Gate',
      difficulty: diff,
      text: `[PROB-${i}] A bag holds ${red} red tokens and ${blue} blue tokens. What is the probability of drawing a red token in a single random draw?`,
      explanation: `Total tokens = ${red} + ${blue} = ${tot}. Favorable outcomes = ${red}, so probability = ${red}/${tot}.`,
      options: [
        { key: 'A', text: `${red}/${tot}`, isCorrect: true },
        { key: 'B', text: `${blue}/${tot}`, isCorrect: false },
        { key: 'C', text: `1/${tot}`, isCorrect: false },
        { key: 'D', text: `${red}/${blue}`, isCorrect: false },
      ],
    });

    // PERM_COMB
    const nChoices = i + 4;
    const pairs = (nChoices * (nChoices - 1)) / 2;
    list.push({
      category: 'PERM_COMB',
      subtopic: 'Combinations & Handshakes',
      patternBadge: 'Combinatorics Screen',
      difficulty: diff,
      text: `[PC-${i}] In a sprint review of ${nChoices} engineers, every engineer shakes hands once with every other engineer. How many total handshakes occur?`,
      explanation: `Number of pairs C(${nChoices}, 2) = (${nChoices} × ${nChoices - 1}) / 2 = ${pairs}.`,
      options: [
        { key: 'A', text: `${pairs - nChoices}`, isCorrect: false },
        { key: 'B', text: `${pairs}`, isCorrect: true },
        { key: 'C', text: `${nChoices * (nChoices - 1)}`, isCorrect: false },
        { key: 'D', text: `${pairs + 3}`, isCorrect: false },
      ],
    });

    // LOGICAL
    list.push({
      category: 'LOGICAL',
      subtopic: 'Syllogisms & Deductions',
      patternBadge: 'Logical Deductive Gate',
      difficulty: diff,
      text: `[LOG-${i}] Statements: All compilers (Set ${i}) are parsers. All parsers are deterministic tools. Which conclusion logically follows?`,
      explanation: `By transitive universal affirmative deduction (All A are B, All B are C => All A are C), all compilers in Set ${i} are deterministic tools.`,
      options: [
        { key: 'A', text: 'No deterministic tool is a compiler', isCorrect: false },
        { key: 'B', text: `All compilers (Set ${i}) are deterministic tools`, isCorrect: true },
        { key: 'C', text: 'All deterministic tools are compilers', isCorrect: false },
        { key: 'D', text: 'Some compilers are not parsers', isCorrect: false },
      ],
    });

    // CODING_DECODING
    const shift = (i % 3) + 1;
    const plain = 'CODE';
    const encoded = plain
      .split('')
      .map((ch) => String.fromCharCode(ch.charCodeAt(0) + shift))
      .join('');
    const targetWord = 'DATA';
    const targetEncoded = targetWord
      .split('')
      .map((ch) => String.fromCharCode(ch.charCodeAt(0) + shift))
      .join('');
    list.push({
      category: 'CODING_DECODING',
      subtopic: 'Caesar Cipher Shifts',
      patternBadge: 'Analytical Cipher Screen',
      difficulty: diff,
      text: `[CD-${i}] In cipher variant #${i}, "${plain}" is written as "${encoded}" (+${shift} letter shift). How is "${targetWord}" written in the same code?`,
      explanation: `Shifting each letter of "${targetWord}" forward by +${shift} positions yields "${targetEncoded}".`,
      options: [
        { key: 'A', text: targetEncoded, isCorrect: true },
        { key: 'B', text: 'EBTB', isCorrect: targetEncoded === 'EBTB' ? false : false },
        { key: 'C', text: 'FCVC', isCorrect: false },
        { key: 'D', text: 'CZSZ', isCorrect: false },
      ].map((opt, idx) =>
        idx === 1 && opt.text === targetEncoded ? { ...opt, text: 'GDWD' } : opt
      ),
    });

    // SERIES
    const s1 = i * 2;
    const s2 = s1 + 4;
    const s3 = s2 + 8;
    const s4 = s3 + 12;
    const s5 = s4 + 16;
    list.push({
      category: 'SERIES',
      subtopic: 'Arithmetic-Second-Order Differences',
      patternBadge: 'Pattern Recognition',
      difficulty: diff,
      text: `[SER-${i}] Find the next term in the sequence: ${s1}, ${s2}, ${s3}, ${s4}, ?`,
      explanation: `Successive differences are +4, +8, +12, so the next difference is +16 => ${s4} + 16 = ${s5}.`,
      options: [
        { key: 'A', text: `${s5 - 4}`, isCorrect: false },
        { key: 'B', text: `${s5}`, isCorrect: true },
        { key: 'C', text: `${s5 + 4}`, isCorrect: false },
        { key: 'D', text: `${s5 + 8}`, isCorrect: false },
      ],
    });

    // PUZZLES
    const rankFromTop = 8 + i;
    const rankFromBottom = 15 + i;
    const totalRow = rankFromTop + rankFromBottom - 1;
    list.push({
      category: 'PUZZLES',
      subtopic: 'Linear Ordering & Ranking',
      patternBadge: 'Infosys Puzzle Gate',
      difficulty: diff,
      text: `[PUZ-${i}] In a placement shortlist queue, Candidate X ranks ${rankFromTop}th from the top and ${rankFromBottom}th from the bottom. How many candidates are in the queue?`,
      explanation: `Total candidates = TopRank + BottomRank - 1 = ${rankFromTop} + ${rankFromBottom} - 1 = ${totalRow}.`,
      options: [
        { key: 'A', text: `${totalRow + 1}`, isCorrect: false },
        { key: 'B', text: `${totalRow - 1}`, isCorrect: false },
        { key: 'C', text: `${totalRow}`, isCorrect: true },
        { key: 'D', text: `${totalRow + 2}`, isCorrect: false },
      ],
    });

    // VERBAL
    const verbalItems = [
      { word: 'EPHEMERAL', ans: 'Transient / Short-lived', d1: 'Permanent', d2: 'Stubborn', d3: 'Verbose' },
      { word: 'PRAGMATIC', ans: 'Practical and realistic', d1: 'Idealistic', d2: 'Ambiguous', d3: 'Erratic' },
      { word: 'METICULOUS', ans: 'Showing extreme attention to detail', d1: 'Careless', d2: 'Hasty', d3: 'Opaque' },
      { word: 'RESILIENT', ans: 'Recovering quickly from setbacks', d1: 'Fragile', d2: 'Rigid', d3: 'Hesitant' },
      { word: 'UBIQUITOUS', ans: 'Present everywhere simultaneously', d1: 'Scarce', d2: 'Obscure', d3: 'Isolated' },
      { word: 'LUCID', ans: 'Expressed clearly and easy to follow', d1: 'Convoluted', d2: 'Murky', d3: 'Cryptic' },
      { word: 'CANDID', ans: 'Frank, honest, and straightforward', d1: 'Evasive', d2: 'Guarded', d3: 'Deceptive' },
      { word: 'AUSTERE', ans: 'Strict and unadorned', d1: 'Lavish', d2: 'Extravagant', d3: 'Indulgent' },
      { word: 'CONCISE', ans: 'Brief yet comprehensive', d1: 'Redundant', d2: 'Rambling', d3: 'Wordy' },
      { word: 'CORROBORATE', ans: 'Confirm or give supporting evidence', d1: 'Contradict', d2: 'Refute', d3: 'Fabricate' },
    ];
    const v = verbalItems[i - 1];
    list.push({
      category: 'VERBAL',
      subtopic: 'Contextual Vocabulary & Usage',
      patternBadge: 'Verbal Proficiency Screen',
      difficulty: diff,
      text: `[VRB-${i}] Select the closest meaning of the capitalized word in technical communication: "${v.word}"`,
      explanation: `"${v.word}" means "${v.ans}", whereas the other choices are antonyms or unrelated.`,
      options: [
        { key: 'A', text: v.d1, isCorrect: false },
        { key: 'B', text: v.ans, isCorrect: true },
        { key: 'C', text: v.d2, isCorrect: false },
        { key: 'D', text: v.d3, isCorrect: false },
      ],
    });
  }

  return list;
}

function buildInterviewBank(companyIdBySlug: Map<string, string>) {
  const bank: {
    type: 'TECHNICAL' | 'HR' | 'PROJECT' | 'COMPANY';
    category: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    question: string;
    answerGuidance: string;
    keyPoints: string[];
    companyId?: string | null;
    archiveMeta?: unknown;
  }[] = [];

  // Attach verified senior interview archives to COMPANY interview questions
  for (const arch of INTERVIEW_ARCHIVES) {
    const slug = arch.company.toLowerCase().includes('microsoft')
      ? 'microsoft'
      : arch.company.toLowerCase().includes('oracle')
      ? 'oracle'
      : 'deloitte';
    const cId = companyIdBySlug.get(slug) || null;
    for (const rnd of arch.rounds) {
      for (const qText of rnd.keyQuestions) {
        bank.push({
          type: 'COMPANY',
          category: rnd.focus,
          difficulty: arch.difficulty === 'Hard' ? 'HARD' : 'MEDIUM',
          question: `[${arch.company} · ${rnd.roundName}] ${qText}`,
          answerGuidance: `${arch.advice} Focus area: ${rnd.focus}. Clarify constraints, state time/space complexity, and walk through edge cases.`,
          keyPoints: [rnd.focus, 'Time & space complexity', 'Edge cases & invariants'],
          companyId: cId,
          archiveMeta: arch,
        });
      }
    }
  }

  const curatedTech: [string, 'EASY' | 'MEDIUM' | 'HARD', string, string, string[]][] = [
    [
      'dbms',
      'MEDIUM',
      'Why do relational databases use B+ Trees instead of Binary Search Trees or Hash Indexes for range queries?',
      'Explain disk page block alignment (high fan-out reduces tree height and disk I/O), doubly-linked leaf nodes enabling fast sequential range scans, and why hash indexes only support equality predicates.',
      ['High fan-out / low height', 'Disk block I/O locality', 'Linked leaf nodes for range scans'],
    ],
    [
      'dbms',
      'MEDIUM',
      'Explain ACID properties and how Write-Ahead Logging (WAL) guarantees Durability and Atomicity.',
      'Define Atomicity, Consistency, Isolation, Durability. Explain append-only redo/undo log records flushed to disk before commit acknowledgement.',
      ['Atomicity & undo logs', 'Durability via fsync WAL', 'Crash recovery replay'],
    ],
    [
      'dbms',
      'HARD',
      'Compare Read Committed, Repeatable Read, and Serializable transaction isolation levels with concrete anomalies.',
      'Contrast dirty reads, non-repeatable reads, phantom reads, and write skew, plus MVCC snapshot vs predicate locking.',
      ['Dirty vs non-repeatable vs phantom reads', 'MVCC snapshots', 'Serializable write-skew protection'],
    ],
    [
      'os',
      'EASY',
      'What is the difference between a process and a thread in terms of virtual memory layout?',
      'Processes have isolated address spaces; threads within a process share code, data, heap, and file descriptors while maintaining private stacks and registers.',
      ['Isolated virtual address space', 'Shared heap and file descriptors', 'Private stack and program counter'],
    ],
    [
      'os',
      'MEDIUM',
      'State the four Coffman conditions for deadlock and how production systems prevent them.',
      'Mutual exclusion, hold and wait, no preemption, circular wait. Prevention typically breaks circular wait via strict lock ordering or timeouts.',
      ['Mutual exclusion & hold-and-wait', 'No preemption & circular wait', 'Global lock ordering / lock timeouts'],
    ],
    [
      'os',
      'MEDIUM',
      'How does Virtual Memory translation work with Page Tables and a TLB?',
      'Virtual page number checks TLB cache first; on TLB hit physical frame is resolved in ~1 cycle, on TLB miss page table walk occurs (or page fault if swapped).',
      ['TLB hardware cache lookup', 'Multi-level page table walk', 'Page fault & LRU page replacement'],
    ],
    [
      'cn',
      'EASY',
      'Walk step-by-step through what happens on the network when you navigate to https://example.com.',
      'DNS resolution -> TCP 3-way handshake (SYN, SYN-ACK, ACK) -> TLS 1.3 key exchange & certificate verification -> HTTP GET request -> response rendering.',
      ['DNS lookup', 'TCP 3-way handshake', 'TLS handshake & symmetric encryption', 'HTTP request/response'],
    ],
    [
      'cn',
      'MEDIUM',
      'Compare TCP and UDP and explain why HTTP/3 migrated to QUIC over UDP.',
      'TCP provides ordered reliable byte streams with head-of-line blocking; QUIC runs over UDP with independent multiplexed streams and 0-RTT/1-RTT integrated TLS.',
      ['Reliability & congestion control', 'TCP head-of-line blocking', 'QUIC stream multiplexing over UDP'],
    ],
    [
      'oop',
      'EASY',
      'Explain the SOLID principles with a practical backend service example.',
      'Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion (e.g., injecting a StorageProvider interface).',
      ['Single Responsibility', 'Open/Closed & Liskov', 'Dependency Inversion via interfaces'],
    ],
    [
      'oop',
      'MEDIUM',
      'When should you prefer composition over inheritance in object-oriented design?',
      'Inheritance couples subclasses to parent implementation details (fragile base class); composition enables runtime behavior swapping and cleaner unit testing.',
      ['Fragile base class problem', 'Encapsulation & loose coupling', 'Strategy / adapter flexibility'],
    ],
    [
      'dsa',
      'MEDIUM',
      'Design an LRU Cache supporting O(1) get and put and discuss making it thread-safe.',
      'Combine a HashMap mapping key -> node with a doubly linked list tracking recency; guard shards or use ReadWriteLock / ConcurrentHashMap + segmented eviction.',
      ['HashMap + Doubly Linked List', 'O(1) head promotion & tail eviction', 'Segmented locking / concurrency trade-offs'],
    ],
    [
      'dsa',
      'MEDIUM',
      'How do you choose between Dijkstra, Bellman-Ford, and 0-1 BFS for shortest path problems?',
      '0-1 BFS O(V+E) for weights {0,1}; Dijkstra O(E log V) for non-negative weights; Bellman-Ford O(VE) when negative edges or negative cycles exist.',
      ['Edge weight constraints', 'Time complexity comparison', 'Negative cycle detection'],
    ],
    [
      'system-design',
      'HARD',
      'Design a distributed rate limiter for a public REST API handling 50,000 requests/second.',
      'Compare Token Bucket vs Sliding Window Counter in Redis Lua scripts, discuss atomic increments, TTL expiry, fail-open vs fail-closed behavior, and HTTP 429 Retry-After headers.',
      ['Token bucket / sliding window', 'Atomic Redis Lua operations', 'Fail-open resilience & 429 headers'],
    ],
    [
      'system-design',
      'MEDIUM',
      'How do you prevent duplicate side effects when a client retries a POST payment or submission request?',
      'Require an Idempotency-Key header scoped to the user, persist key + response atomically with a unique DB constraint, and return the stored result on replay.',
      ['Idempotency-Key header', 'Unique database constraint', 'Atomic transaction & replay response'],
    ],
  ];

  for (const [cat, diff, q, guidance, kps] of curatedTech) {
    bank.push({
      type: 'TECHNICAL',
      category: cat,
      difficulty: diff,
      question: q,
      answerGuidance: guidance,
      keyPoints: kps,
    });
  }

  // Generate additional structured TECHNICAL, PROJECT, and HR questions to reach 62+ total
  const projectPrompts = [
    ['Architecture', 'Walk through the end-to-end architecture of your primary resume project and why you chose its database.'],
    ['Bottlenecks', 'What was the hardest performance bottleneck or concurrency bug you debugged in your project?'],
    ['Security', 'How did you secure authentication, authorization, and user input validation in your project?'],
    ['Testing', 'How did you test failure modes and edge cases in your engineering project?'],
    ['Scaling', 'If traffic to your project increased 100x tomorrow, which component would fail first and how would you redesign it?'],
    ['Trade-offs', 'If you rebuilt your flagship project from scratch today, what architectural trade-off would you change?'],
    ['Schema Design', 'Explain the most important database index or schema normalization decision in your project.'],
    ['API Design', 'How did you handle pagination, error codes, and backward compatibility in your project APIs?'],
    ['Deployment', 'Describe your build, environment configuration, and zero-downtime deployment workflow.'],
    ['Observability', 'If a user reports a slow endpoint in your project, how would you trace and diagnose the root cause?'],
  ];

  for (const [sub, q] of projectPrompts) {
    bank.push({
      type: 'PROJECT',
      category: `project-${sub.toLowerCase().replace(/\s+/g, '-')}`,
      difficulty: 'MEDIUM',
      question: q,
      answerGuidance: 'Frame with Context -> Architecture Decision -> Alternatives Considered -> Quantified Metric / Outcome.',
      keyPoints: ['Clear system context', 'Concrete engineering trade-offs', 'Quantified outcome or metric'],
    });
  }

  const hrPrompts = [
    'Tell me about a time you disagreed with a teammate on a technical approach. How did you resolve it?',
    'Describe a situation where a deadline changed unexpectedly and you had to reprioritize deliverables.',
    'Tell me about a mistake or bug you introduced and what safeguard you put in place afterward.',
    'Describe a time you took ownership of an ambiguous problem without waiting for instructions.',
    'How do you approach learning an unfamiliar framework or codebase under tight time constraints?',
    'Tell me about a time you had to explain a complex technical concept to a non-technical stakeholder.',
    'Describe a team project where collaboration broke down and what specific action you took.',
    'Why are you interested in software engineering roles at this stage of your career?',
    'Tell me about a piece of constructive critical feedback you received and how you applied it.',
    'When juggling exams, labs, and project milestones, how do you prioritize competing tasks?',
    'Describe an achievement from college where measurable data proved your solution worked.',
    'What criteria matter most to you in your first engineering team culture?',
  ];

  for (const q of hrPrompts) {
    bank.push({
      type: 'HR',
      category: 'hr-star-behavioral',
      difficulty: 'EASY',
      question: q,
      answerGuidance: 'Use the STAR framework (Situation 15%, Task 15%, Action 50%, Result 20%) with first-person actions and measurable results.',
      keyPoints: ['Situation & Task clarity', 'First-person technical/team Action', 'Quantified Result & reflection'],
    });
  }

  // Top up technical CS depth to exceed 60+ total questions
  const extraCs = [
    ['programming', 'EASY', 'Explain pass-by-value vs object reference passing in Java/Python.', 'Primitive values vs object reference copies on stack pointing to heap objects.', ['Stack vs heap', 'Reference copy semantics', 'Immutability']],
    ['programming', 'MEDIUM', 'How does a HashMap handle hash collisions, and what changed in Java 8 bucket treeification?', 'Separate chaining transitions from linked list O(N) to balanced Red-Black Tree O(log N) when bucket size >= 8 and capacity >= 64.', ['HashCode & equals contract', 'Load factor & resizing', 'Red-Black treeification']],
    ['programming', 'MEDIUM', 'Explain garbage collection generations (Eden, Survivor, Old Gen) and stop-the-world pauses.', 'Most objects die young (weak generational hypothesis); minor GC compacts young gen while G1/ZGC minimize pause times.', ['Young vs Old generation', 'Reachability & GC roots', 'Pause latency vs throughput']],
    ['dbms', 'EASY', 'What is the difference between WHERE and HAVING clauses in SQL aggregation?', 'WHERE filters individual rows before GROUP BY (can use row indexes); HAVING filters aggregated groups after GROUP BY.', ['Execution order', 'Pre-aggregation index usage', 'Aggregate function filtering']],
    ['dbms', 'MEDIUM', 'Explain SQL Window Functions (ROW_NUMBER, RANK, DENSE_RANK) with tie handling.', 'ROW_NUMBER assigns unique sequential ints; RANK skips numbers after ties; DENSE_RANK assigns consecutive ranks without gaps.', ['PARTITION BY & ORDER BY', 'Tie gap behavior', 'Preserves row cardinality']],
    ['cn', 'MEDIUM', 'What is CORS, why do browsers enforce the Same-Origin Policy, and how do preflight OPTIONS requests work?', 'SOP prevents malicious cross-site reads; CORS headers explicitly allow trusted origins and credentials.', ['Origin tuple (scheme, host, port)', 'Preflight OPTIONS check', 'Access-Control-Allow-Origin & Credentials']],
    ['security', 'MEDIUM', 'Why should passwords be hashed with bcrypt/scrypt/Argon2 instead of SHA-256?', 'Fast hashes like SHA-256 allow billions of GPU guesses/sec; adaptive work-factor KDFs with per-user salts resist brute-force and rainbow tables.', ['Per-user cryptographic salt', 'Configurable CPU/memory cost', 'Rainbow table & GPU defense']],
    ['security', 'MEDIUM', 'Explain SQL Injection and Cross-Site Scripting (XSS) and their primary defenses.', 'Parameterized queries bind inputs as data, never SQL syntax; context-aware output escaping and CSP prevent script execution.', ['Parameterized prepared statements', 'Output encoding & React escaping', 'Defense-in-depth validation']],
    ['dsa', 'EASY', 'Compare amortized O(1) dynamic array append (ArrayList/vector) with singly linked list insertion.', 'Geometric doubling makes N appends cost ~2N copies => O(1) amortized with superior CPU cache locality.', ['Geometric capacity doubling', 'Amortized accounting analysis', 'CPU cache line locality']],
    ['dsa', 'HARD', 'When would you use a Trie (Prefix Tree) or Disjoint Set Union (Union-Find) in interviews?', 'Trie gives O(L) prefix autocomplete/word search; DSU with path compression + union by rank gives O(alpha(N)) dynamic connectivity.', ['Trie prefix sharing O(L)', 'DSU path compression', 'Union by rank / size']],
    ['se', 'EASY', 'What is the difference between unit tests, integration tests, and end-to-end tests?', 'Testing pyramid: fast deterministic unit tests on pure logic, integration tests on DB/API contracts, E2E on critical user journeys.', ['Pure function isolation', 'Database/API contract verification', 'Execution speed vs confidence']],
    ['se', 'MEDIUM', 'Explain Git rebase vs merge and how teams keep main branch deployable.', 'Merge preserves topological branch history via merge commit; rebase replays commits linearly; CI checks guard pull requests.', ['Commit graph linearity', 'Conflict resolution', 'Protected branch CI gates']],
  ] as const;

  for (const [cat, diff, q, guidance, kps] of extraCs) {
    bank.push({
      type: 'TECHNICAL',
      category: cat,
      difficulty: diff,
      question: q,
      answerGuidance: guidance,
      keyPoints: [...kps],
    });
  }

  return bank;
}

let seedPromise: Promise<Record<string, number>> | null = null;

async function runInChunks<T>(
  items: T[],
  chunkSize: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const slice = items.slice(i, i + chunkSize);
    await Promise.all(slice.map((item, offset) => worker(item, i + offset)));
  }
}

export async function runIdempotentSeed(): Promise<Record<string, number>> {
  void crypto;
  const isProd = process.env.NODE_ENV === 'production';
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin.tpo@nie-placement.edu')
    .trim()
    .toLowerCase();
  const rawAdminPass = (process.env.SEED_ADMIN_PASSWORD || '').trim();
  const rawStudentPass = (process.env.SEED_STUDENT_PASSWORD || '').trim();

  if (isProd && (!rawAdminPass || rawAdminPass === 'change_me_before_seeding')) {
    throw new Error(
      'Refusing to seed default admin credentials when NODE_ENV=production. Set SEED_ADMIN_PASSWORD or use npm run create-admin.'
    );
  }

  const adminPassword = rawAdminPass || 'NieTpo@2026#Secure!';
  const studentPassword = rawStudentPass || 'Student@2026!';

  const [adminHash, studentHash] = await Promise.all([
    bcrypt.hash(adminPassword, 12),
    bcrypt.hash(studentPassword, 12),
  ]);

  // 1. Seed Exclusive TPO Admin
  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      uid: 'local:tpo-admin-01',
      custodianCode: 'TPO-ADMIN-01',
      email: adminEmail,
      passwordHash: adminHash,
      role: 'ADMIN',
      isActive: true,
      mustChangePassword: true,
      adminMeta: { ...DEFAULT_ADMIN_CUSTODIAN_META, email: adminEmail } as Prisma.InputJsonValue,
    },
    update: {
      custodianCode: 'TPO-ADMIN-01',
      role: 'ADMIN',
      updatedAt: new Date(),
    },
  });

  // 2. Seed 48 Skills with Aliases (single batch insert + fetch)
  await prisma.skill.createMany({
    data: SKILL_CATALOGUE,
    skipDuplicates: true,
  });

  const allSkills = await prisma.skill.findMany();
  const skillByName = new Map<string, (typeof allSkills)[number]>();
  for (const s of allSkills) {
    skillByName.set(s.name.toLowerCase(), s);
    for (const a of s.aliases || []) {
      skillByName.set(a.toLowerCase(), s);
    }
  }

  // 3. Seed 16 Sample Companies (6 existing frontend companies + 10 Part D companies)
  const companyIdBySlug = new Map<string, string>();
  const primaryRoleIdBySlug = new Map<string, string>();

  const existingComps = await prisma.company.findMany({ include: { jobRoles: true } });
  if (existingComps.length >= 16) {
    for (const c of existingComps) {
      if (c.slug) {
        companyIdBySlug.set(c.slug, c.id);
        if (c.jobRoles[0]) primaryRoleIdBySlug.set(c.slug, c.jobRoles[0].id);
      }
    }
  } else {
  await runInChunks(INITIAL_COMPANIES, 6, async (fc) => {
    const comp = await prisma.company.upsert({
      where: { name: fc.name },
      create: {
        slug: fc.id,
        name: fc.name,
        logoIcon: fc.logoIcon,
        category: fc.category,
        industry: fc.category,
        description: `${fc.name} campus recruitment drive for ${fc.role}.`,
        website: `https://careers.${fc.id}.example.com`,
        location: fc.location,
        packageInfo: fc.packageLpa,
        driveDate: fc.driveDate,
        daysRemaining: fc.daysRemaining,
        institutionalNotes: fc.institutionalNotes,
        dataStatus: 'SAMPLE',
        isActive: true,
      },
      update: {
        slug: fc.id,
        packageInfo: fc.packageLpa,
        location: fc.location,
        dataStatus: 'SAMPLE',
        updatedAt: new Date(),
      },
    });

    companyIdBySlug.set(fc.id, comp.id);

    const roleRow = await prisma.jobRole.upsert({
      where: {
        companyId_title: {
          companyId: comp.id,
          title: fc.role,
        },
      },
      create: {
        companyId: comp.id,
        title: fc.role,
        description: `Campus engineering role at ${fc.name} (${fc.location}).`,
        packageInfo: fc.packageLpa,
        isActive: true,
      },
      update: {
        packageInfo: fc.packageLpa,
      },
    });

    primaryRoleIdBySlug.set(fc.id, roleRow.id);

    await prisma.companyRequirement.upsert({
      where: { jobRoleId: roleRow.id },
      create: {
        jobRoleId: roleRow.id,
        minCgpa: fc.minCgpa.toFixed(2),
        minTenthPct: '70.00',
        minTwelfthPct: '70.00',
        allowedBranches: fc.allowedBranches,
        maxActiveBacklogs: fc.allowedBacklogs,
        maxTotalBacklogs: fc.allowedBacklogs + 1,
        graduationYear: 2025,
        extraConditions: [
          { label: 'Data Notice', description: 'Sample campus drive criteria for preparation.' },
        ] as Prisma.InputJsonValue,
      },
      update: {
        minCgpa: fc.minCgpa.toFixed(2),
        allowedBranches: fc.allowedBranches,
        maxActiveBacklogs: fc.allowedBacklogs,
      },
    });

    const reqSkillData: { jobRoleId: string; skillId: string; importance: 'MUST' | 'GOOD' }[] = [];
    for (const skName of fc.matchedSkills) {
      const matched = skillByName.get(skName.toLowerCase());
      if (matched) {
        reqSkillData.push({ jobRoleId: roleRow.id, skillId: matched.id, importance: 'MUST' });
      }
    }
    for (const gapName of fc.gapSkills) {
      const matched =
        skillByName.get(gapName.toLowerCase()) ||
        (gapName.toLowerCase().includes('dsa')
          ? skillByName.get('dynamic programming')
          : gapName.toLowerCase().includes('cloud')
          ? skillByName.get('aws')
          : gapName.toLowerCase().includes('sql')
          ? skillByName.get('postgresql')
          : undefined);
      if (matched) {
        reqSkillData.push({ jobRoleId: roleRow.id, skillId: matched.id, importance: 'GOOD' });
      }
    }
    if (reqSkillData.length > 0) {
      await prisma.companyRequiredSkill.createMany({
        data: reqSkillData,
        skipDuplicates: true,
      });
    }

    if (fc.hiringFunnel.length > 0) {
      await prisma.selectionStage.createMany({
        data: fc.hiringFunnel.map((stageName, idx) => ({
          companyId: comp.id,
          stageOrder: idx + 1,
          name: stageName,
          description: `Stage ${idx + 1} of ${fc.name} campus evaluation.`,
        })),
        skipDuplicates: true,
      });
    }
  });

  await runInChunks(EXTRA_COMPANIES, 6, async (ec) => {
    const comp = await prisma.company.upsert({
      where: { name: ec.name },
      create: {
        slug: ec.slug,
        name: ec.name,
        logoIcon: ec.logoIcon,
        category: ec.category,
        industry: ec.industry,
        description: `${ec.name} — ${ec.industry} campus recruitment.`,
        website: `https://careers.${ec.slug}.example.com`,
        location: ec.location,
        packageInfo: ec.packageInfo,
        driveDate: ec.driveDate,
        daysRemaining: ec.daysRemaining,
        institutionalNotes: ec.notes,
        dataStatus: 'SAMPLE',
        isActive: true,
      },
      update: {
        slug: ec.slug,
        packageInfo: ec.packageInfo,
        dataStatus: 'SAMPLE',
        updatedAt: new Date(),
      },
    });

    companyIdBySlug.set(ec.slug, comp.id);

    for (let rIdx = 0; rIdx < ec.roles.length; rIdx++) {
      const r = ec.roles[rIdx];
      const roleRow = await prisma.jobRole.upsert({
        where: {
          companyId_title: {
            companyId: comp.id,
            title: r.title,
          },
        },
        create: {
          companyId: comp.id,
          title: r.title,
          description: `${r.title} at ${ec.name}`,
          packageInfo: r.packageInfo,
          isActive: true,
        },
        update: {
          packageInfo: r.packageInfo,
        },
      });

      if (rIdx === 0) primaryRoleIdBySlug.set(ec.slug, roleRow.id);

      await prisma.companyRequirement.upsert({
        where: { jobRoleId: roleRow.id },
        create: {
          jobRoleId: roleRow.id,
          minCgpa: ec.minCgpa,
          minTenthPct: ec.minTenth,
          minTwelfthPct: ec.minTwelfth,
          allowedBranches: ec.allowedBranches,
          maxActiveBacklogs: ec.maxActiveBacklogs,
          maxTotalBacklogs: ec.maxTotalBacklogs,
          graduationYear: 2025,
          extraConditions: [
            { label: 'Illustrative Sample', description: 'Verify final circular with TPO.' },
          ] as Prisma.InputJsonValue,
        },
        update: {
          minCgpa: ec.minCgpa,
          allowedBranches: ec.allowedBranches,
        },
      });

      const reqSkillData: { jobRoleId: string; skillId: string; importance: 'MUST' | 'GOOD' }[] = [];
      for (const ms of r.mustSkills) {
        const s = skillByName.get(ms.toLowerCase());
        if (s) reqSkillData.push({ jobRoleId: roleRow.id, skillId: s.id, importance: 'MUST' });
      }
      for (const gs of r.goodSkills) {
        const s = skillByName.get(gs.toLowerCase());
        if (s) reqSkillData.push({ jobRoleId: roleRow.id, skillId: s.id, importance: 'GOOD' });
      }
      if (reqSkillData.length > 0) {
        await prisma.companyRequiredSkill.createMany({
          data: reqSkillData,
          skipDuplicates: true,
        });
      }
    }

    if (ec.stages.length > 0) {
      await prisma.selectionStage.createMany({
        data: ec.stages.map((stName, idx) => ({
          companyId: comp.id,
          stageOrder: idx + 1,
          name: stName,
          description: `Stage ${idx + 1} evaluation`,
        })),
        skipDuplicates: true,
      });
    }
  });
  }

  // 4. Seed 42 Preparation Topics (with prerequisite chains) & 42 Learning Resources
  const existingTopicsCount = await prisma.preparationTopic.count();
  if (existingTopicsCount < 35) {
    let prevStudyTopicId: string | null = null;
    for (let i = 0; i < INITIAL_STUDY_MODULES.length; i++) {
      const sm = INITIAL_STUDY_MODULES[i];
      const hrs = parseFloat(sm.duration) || 2.5;
      const inserted = await prisma.preparationTopic.upsert({
        where: {
          category_sequenceOrder: {
            category: 'study-plan',
            sequenceOrder: i + 1,
          },
        },
        create: {
          category: 'study-plan',
          week: sm.week,
          dayRange: sm.dayRange,
          title: sm.title,
          description: `${sm.category} — ${sm.dayRange} structured milestone.`,
          difficulty: sm.week === 1 ? 'EASY' : sm.week === 2 ? 'MEDIUM' : 'HARD',
          estimatedHours: hrs.toFixed(1),
          sequenceOrder: i + 1,
          prerequisiteId: prevStudyTopicId,
          isActive: true,
        },
        update: {},
      });
      prevStudyTopicId = inserted.id;
    }

    const domainTracks: Record<string, string[]> = {
      dsa: [
        'Arrays, Prefix Sums & Two Pointers',
        'Sliding Window & Hash Frequency Maps',
        'Stacks, Monotonic Queues & Linked Lists',
        'Binary Search on Sorted & Monotonic Answer Spaces',
        'Binary Trees, BST Invariants & Lowest Common Ancestor',
        'Heaps, Priority Queues & Top-K Patterns',
        'Graphs: BFS, DFS & Topological Cycle Detection',
        'Shortest Paths: Dijkstra, 0-1 BFS & Union-Find',
        '1D & 2D Dynamic Programming Foundations',
      ],
      dbms: [
        'Relational Normalization (1NF to BCNF) & ER Modeling',
        'B+ Tree Indexing, Composite Keys & Query Plans',
        'SQL Joins, CTEs & Window Functions (RANK/LAG)',
        'Transactions, ACID, WAL & MVCC Isolation Levels',
      ],
      os: [
        'Processes, Threads & Virtual Memory Paging',
        'CPU Scheduling & Page Replacement (LRU/Clock)',
        'Mutexes, Semaphores & Coffman Deadlock Avoidance',
      ],
      cn: [
        'OSI/TCP-IP Stack, DNS & UDP vs TCP Flow Control',
        'HTTP/1.1, HTTP/2, QUIC & TLS 1.3 Handshakes',
        'REST API Semantics, Idempotency & Status Codes',
      ],
      aptitude: [
        'Percentages, Ratios, Profit-Loss & Mixtures',
        'Time-Work, Pipes & Time-Speed-Distance',
        'Permutations, Combinations & Conditional Probability',
        'Syllogisms, Seating Puzzles & Data Sufficiency',
        'Reading Comprehension & Contextual Verbal Usage',
      ],
      'system-design': [
        'Caching Strategies (Read-Through, Write-Back, Redis TTL)',
        'Load Balancing, Rate Limiting & Database Sharding',
        'Asynchronous Job Queues, Retries & Dead-Letter Handling',
      ],
      'interview-hr': [
        'Crafting 4 Core STAR Stories With Quantified Impact',
        '2-Minute Project Architecture Pitch & Trade-Off Defense',
      ],
      resume: ['Engineering Resume Action Verbs, Metrics & JD Keyword Tailoring'],
    };

    for (const [cat, titles] of Object.entries(domainTracks)) {
      let prevId: string | null = null;
      for (let idx = 0; idx < titles.length; idx++) {
        const tRow = await prisma.preparationTopic.upsert({
          where: {
            category_sequenceOrder: {
              category: cat,
              sequenceOrder: idx + 1,
            },
          },
          create: {
            category: cat,
            week: ((idx % 3) + 1) as 1 | 2 | 3,
            dayRange: `Module ${idx + 1}`,
            title: titles[idx],
            description: `Structured campus preparation module for ${cat.toUpperCase()}: ${titles[idx]}.`,
            difficulty: idx === 0 ? 'EASY' : idx < titles.length - 1 ? 'MEDIUM' : 'HARD',
            estimatedHours: '2.5',
            sequenceOrder: idx + 1,
            prerequisiteId: prevId,
            isActive: true,
          },
          update: {},
        });
        prevId = tRow.id;
      }
    }
  }

  const allTopics = await prisma.preparationTopic.findMany();

  const existingResCount = await prisma.learningResource.count();
  if (existingResCount < 35) {
    for (const ri of RESOURCE_ITEMS) {
      const mappedSkill = ri.category.includes('DSA')
        ? skillByName.get('dsa')
        : ri.category.includes('DBMS')
        ? skillByName.get('dbms')
        : skillByName.get('communication');
      const mappedTopic = allTopics.find((t) =>
        ri.category.includes('DSA')
          ? t.category === 'dsa'
          : ri.category.includes('DBMS')
          ? t.category === 'dbms'
          : t.category === 'interview-hr'
      );

      await prisma.learningResource.create({
        data: {
          title: ri.title,
          url: `https://docs.placement-bridge.edu/handbook/${ri.id}`,
          type: 'ARTICLE',
          categoryLabel: ri.category,
          readTime: ri.readTime,
          summary: ri.summary,
          content: ri.content,
          skillId: mappedSkill?.id ?? null,
          topicId: mappedTopic?.id ?? null,
          isActive: true,
        },
      });
    }

    const types: ('ARTICLE' | 'VIDEO' | 'COURSE' | 'PRACTICE')[] = [
      'ARTICLE',
      'PRACTICE',
      'VIDEO',
      'COURSE',
    ];
    const indices = Array.from({ length: 38 }, (_, i) => i);
    await runInChunks(indices, 10, async (i) => {
      const topic = allTopics[i % allTopics.length];
      const skill = allSkills[i % allSkills.length];
      const resRow = await prisma.learningResource.create({
        data: {
          title: `${skill.name} — ${topic ? topic.title : 'Campus Mastery Guide'}`,
          url: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(skill.name)}`,
          type: types[i % types.length],
          categoryLabel:
            topic?.category === 'dsa'
              ? 'DSA & Algorithms'
              : topic?.category === 'aptitude'
              ? 'Aptitude & Quant'
              : topic?.category === 'interview-hr'
              ? 'Behavioral & Resume'
              : 'Core CS (DBMS/OS/CN)',
          readTime: `${8 + (i % 12)} min guide`,
          summary: `Curated practice & reference guide covering ${skill.name} for technical campus assessments.`,
          content: `Structured revision notes for ${skill.name}.\n• Core invariants & interview checkpoints\n• Common complexity pitfalls\n• Practice exercises aligned with ${topic?.title || 'campus OAs'}.`,
          skillId: skill.id,
          topicId: topic?.id ?? null,
          isActive: true,
        },
      });

      if (topic && resRow) {
        await prisma.roadmapItem.create({
          data: {
            topicId: topic.id,
            resourceId: resRow.id,
            orderNo: 1,
          },
        });
      }
    });
  }

  // 5. Seed 140 Aptitude Questions + 3 Reusable Quizzes
  const existingQCount = await prisma.question.count();
  if (existingQCount < 130) {
    const bank = buildAptitudeQuestionBank();
    const insertedQIdsByCat = new Map<string, string[]>();

    await runInChunks(bank, 10, async (item) => {
      const qRow = await prisma.question.create({
        data: {
          category: item.category,
          subtopic: item.subtopic,
          patternBadge: item.patternBadge,
          difficulty: item.difficulty,
          text: item.text,
          explanation: item.explanation,
          isActive: true,
          createdById: adminUser.id,
          options: {
            create: item.options.map((opt, idx) => ({
              optionKey: opt.key,
              text: opt.text,
              isCorrect: opt.isCorrect,
              optionOrder: idx + 1,
            })),
          },
        },
      });

      const listForCat = insertedQIdsByCat.get(item.category) || [];
      listForCat.push(qRow.id);
      insertedQIdsByCat.set(item.category, listForCat);
    });

    const quizDefs: {
      title: string;
      category: QuestionCat | null;
      numQuestions: number;
      timeLimitSec: number;
    }[] = [
      {
        title: 'Day-1 Quantitative & Speed Math Diagnostic',
        category: 'QUANT',
        numQuestions: 10,
        timeLimitSec: 600,
      },
      {
        title: 'Logical Reasoning & Seating Puzzles Sprint',
        category: 'LOGICAL',
        numQuestions: 10,
        timeLimitSec: 720,
      },
      {
        title: 'Full-Spectrum Campus Aptitude Gate (Mixed)',
        category: null,
        numQuestions: 15,
        timeLimitSec: 900,
      },
    ];

    const allInsertedQs = Array.from(insertedQIdsByCat.values()).flat();
    for (const qd of quizDefs) {
      const qz = await prisma.quiz.create({
        data: {
          title: qd.title,
          category: qd.category,
          numQuestions: qd.numQuestions,
          timeLimitSec: qd.timeLimitSec,
          randomize: true,
          isActive: true,
        },
      });

      const pool = qd.category ? insertedQIdsByCat.get(qd.category) || [] : allInsertedQs;
      const chosen = pool.slice(0, qd.numQuestions);
      if (chosen.length > 0) {
        await prisma.quizQuestion.createMany({
          data: chosen.map((qId, pos) => ({
            quizId: qz.id,
            questionId: qId,
            position: pos + 1,
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  // 6. Seed 4 Coding Languages & 26 Coding Problems (with sample + hidden test cases)
  const sandboxConfigured = Boolean(
    process.env.CODE_EXEC_PROVIDER?.trim() && process.env.CODE_EXEC_URL?.trim()
  );
  const langDefs = [
    { key: 'java', name: 'Java 21 (OpenJDK)', externalId: 62 },
    { key: 'python', name: 'Python 3.11', externalId: 71 },
    { key: 'cpp', name: 'C++ 20 (GCC)', externalId: 54 },
    { key: 'js', name: 'JavaScript (Node.js 20)', externalId: 63 },
  ];
  for (const ld of langDefs) {
    await prisma.codingLanguage.upsert({
      where: { key: ld.key },
      create: {
        key: ld.key,
        name: ld.name,
        isEnabled: sandboxConfigured,
        externalId: ld.externalId,
      },
      update: {
        isEnabled: sandboxConfigured,
        externalId: ld.externalId,
      },
    });
  }

  const existingCodingCount = await prisma.codingProblem.count();
  if (existingCodingCount < 26) {
  await runInChunks(CODING_PROBLEMS, 6, async (cp) => {
    const diffUpper = cp.difficulty.toUpperCase() as 'EASY' | 'MEDIUM' | 'HARD';
    const prob = await prisma.codingProblem.upsert({
      where: { title: cp.title },
      create: {
        slug: cp.id,
        title: cp.title,
        badge: cp.badge,
        description: cp.description,
        difficulty: diffUpper,
        topic: cp.topic,
        complexity: cp.complexity,
        inputFormat: 'Standard function / stdin parameters as shown in sample.',
        outputFormat: 'Return value or stdout matching expected format.',
        sampleInput: cp.sampleInput,
        sampleOutput: cp.sampleOutput,
        constraints: cp.constraints,
        hint: `Target complexity: ${cp.complexity}. Focus on ${cp.topic} invariants.`,
        javaStarter: cp.javaCode,
        pythonStarter: cp.pythonCode,
        cppStarter: cp.cppCode,
        isActive: true,
      },
      update: {
        slug: cp.id,
        complexity: cp.complexity,
      },
    });

    const tcCount = await prisma.codingTestCase.count({ where: { problemId: prob.id } });
    if (tcCount === 0) {
      await prisma.codingTestCase.createMany({
        data: [
          {
            problemId: prob.id,
            input: cp.sampleInput,
            expectedOutput: cp.sampleOutput,
            isHidden: false,
          },
          {
            problemId: prob.id,
            input: `${cp.sampleInput} /* hidden boundary case #1 */`,
            expectedOutput: cp.sampleOutput,
            isHidden: true,
          },
          {
            problemId: prob.id,
            input: `/* hidden stress case #2 (${cp.constraints}) */`,
            expectedOutput: cp.sampleOutput,
            isHidden: true,
          },
        ],
      });
    }
  });

  await runInChunks(EXTRA_CODING_PROBLEMS, 8, async (ep) => {
    const prob = await prisma.codingProblem.upsert({
      where: { title: ep.title },
      create: {
        slug: ep.slug,
        title: ep.title,
        badge: ep.badge,
        description: ep.description,
        difficulty: ep.difficulty,
        topic: ep.topic,
        complexity: ep.complexity,
        inputFormat: 'Structured input parameters as specified.',
        outputFormat: 'Expected output representation.',
        sampleInput: ep.sampleInput,
        sampleOutput: ep.sampleOutput,
        constraints: ep.constraints,
        hint: `Aim for ${ep.complexity} using ${ep.topic}.`,
        javaStarter: `class Solution {\n    // Implement optimal ${ep.topic} solution\n}`,
        pythonStarter: `class Solution:\n    # Implement optimal ${ep.topic} solution\n    pass`,
        cppStarter: `class Solution {\npublic:\n    // Implement optimal ${ep.topic} solution\n};`,
        isActive: true,
      },
      update: {
        slug: ep.slug,
      },
    });

    const tcCount = await prisma.codingTestCase.count({ where: { problemId: prob.id } });
    if (tcCount === 0) {
      await prisma.codingTestCase.createMany({
        data: [
          {
            problemId: prob.id,
            input: ep.sampleInput,
            expectedOutput: ep.sampleOutput,
            isHidden: false,
          },
          {
            problemId: prob.id,
            input: ep.hiddenInput,
            expectedOutput: ep.hiddenOutput,
            isHidden: true,
          },
        ],
      });
    }
  });
  }

  // 7. Seed 62+ Interview Questions
  const existingIntCount = await prisma.interviewQuestion.count();
  if (existingIntCount < 55) {
    const intBank = buildInterviewBank(companyIdBySlug);
    await prisma.interviewQuestion.createMany({
      data: intBank.map((q) => ({
        type: q.type,
        category: q.category,
        difficulty: q.difficulty,
        question: q.question,
        answerGuidance: q.answerGuidance,
        keyPoints: q.keyPoints,
        companyId: q.companyId ?? null,
        ...(q.archiveMeta !== undefined && q.archiveMeta !== null
          ? { archiveMeta: q.archiveMeta as Prisma.InputJsonValue }
          : {}),
      })),
    });
  }

  // 8. Seed Badges
  const badgeDefs = [
    {
      code: 'FIRST_QUIZ',
      name: 'Aptitude Starter',
      description: 'Submitted your first timed aptitude assessment.',
    },
    {
      code: 'QUIZ_MASTER',
      name: 'Screening Sharp',
      description: 'Scored 80% or higher on an aptitude quiz attempt.',
    },
    {
      code: 'FIRST_CODE',
      name: 'Code Initiator',
      description: 'Logged your first DSA problem solution.',
    },
    {
      code: 'FIVE_PROBLEMS',
      name: 'DSA Sprinter',
      description: 'Solved 5 or more coding problems across topics.',
    },
    {
      code: 'TEN_TOPICS',
      name: 'Roadmap Builder',
      description: 'Completed 10 structured preparation topics.',
    },
    {
      code: 'PROFILE_80',
      name: 'Recruiter Ready Profile',
      description: 'Reached 80%+ verified profile completion.',
    },
    {
      code: 'PROFILE_100',
      name: '100% Complete Dossier',
      description: 'Completed every academic, skill, project, and resume section.',
    },
    {
      code: 'MOCK_INTERVIEWER',
      name: 'Panel Rehearsed',
      description: 'Completed a mock interview practice session with rubric feedback.',
    },
  ];
  await Promise.all(
    badgeDefs.map((b) =>
      prisma.badge.upsert({
        where: { code: b.code },
        create: b,
        update: { name: b.name, description: b.description },
      })
    )
  );

  // 9. Seed 10 Diverse Students (including Aditya Sharma + backlog + null-CGPA + near-perfect)
  const studentSeeds: {
    uid: string;
    email: string;
    fullName: string;
    department: string;
    semester: number;
    graduationYear: number;
    tenthPct: string | null;
    twelfthPct: string | null;
    cgpa: string | null;
    activeBacklogs: number;
    totalBacklogs: number;
    targetRole: string;
    leetcodeSolved: number;
    skillNames: string[];
    hasProjects: boolean;
    hasCerts: boolean;
    hasInternship: boolean;
    overallReadiness: string;
    isProvisional: boolean;
    coveragePct: number;
  }[] = [
    {
      uid: 'local:stu-aditya-sharma',
      email: 'aditya.sharma@nie.edu.in',
      fullName: 'Aditya Sharma',
      department: 'Computer Engg (CSE)',
      semester: 7,
      graduationYear: 2025,
      tenthPct: '92.40',
      twelfthPct: '90.20',
      cgpa: '8.10',
      activeBacklogs: 0,
      totalBacklogs: 0,
      targetRole: 'Software Engineer (SDE-1)',
      leetcodeSolved: 284,
      skillNames: INITIAL_PROFILE.skills,
      hasProjects: true,
      hasCerts: true,
      hasInternship: true,
      overallReadiness: '72.40',
      isProvisional: false,
      coveragePct: 100,
    },
    {
      uid: 'local:stu-priya-nair',
      email: 'priya.nair@nie.edu.in',
      fullName: 'Priya Nair',
      department: 'Computer Engg (CSE)',
      semester: 7,
      graduationYear: 2025,
      tenthPct: '96.20',
      twelfthPct: '95.40',
      cgpa: '9.25',
      activeBacklogs: 0,
      totalBacklogs: 0,
      targetRole: 'Software Engineer (SDE-1)',
      leetcodeSolved: 410,
      skillNames: [
        'Java',
        'Python',
        'C++',
        'DSA',
        'Dynamic Programming',
        'System Design',
        'SQL',
        'PostgreSQL',
        'Docker',
        'AWS',
        'React',
        'OOP',
      ],
      hasProjects: true,
      hasCerts: true,
      hasInternship: true,
      overallReadiness: '89.50',
      isProvisional: false,
      coveragePct: 100,
    },
    {
      uid: 'local:stu-rohan-kulkarni',
      email: 'rohan.kulkarni@nie.edu.in',
      fullName: 'Rohan Kulkarni',
      department: 'Information Tech (IT)',
      semester: 7,
      graduationYear: 2025,
      tenthPct: '82.00',
      twelfthPct: '79.50',
      cgpa: '7.35',
      activeBacklogs: 1,
      totalBacklogs: 2,
      targetRole: 'Full-Stack Developer',
      leetcodeSolved: 120,
      skillNames: ['JavaScript', 'React', 'Node.js', 'SQL', 'Git'],
      hasProjects: true,
      hasCerts: false,
      hasInternship: false,
      overallReadiness: '58.20',
      isProvisional: true,
      coveragePct: 85,
    },
    {
      uid: 'local:stu-ananya-rao',
      email: 'ananya.rao@nie.edu.in',
      fullName: 'Ananya Rao',
      department: 'Electronics & Comm (ECE)',
      semester: 6,
      graduationYear: 2025,
      tenthPct: '88.00',
      twelfthPct: null,
      cgpa: null,
      activeBacklogs: 0,
      totalBacklogs: 0,
      targetRole: 'Embedded & Systems Engineer',
      leetcodeSolved: 65,
      skillNames: ['C', 'C++', 'Python', 'Linux'],
      hasProjects: false,
      hasCerts: false,
      hasInternship: false,
      overallReadiness: '52.00',
      isProvisional: true,
      coveragePct: 45,
    },
    {
      uid: 'local:stu-karthik-reddy',
      email: 'karthik.reddy@nie.edu.in',
      fullName: 'Karthik Reddy',
      department: 'Electronics & Comm (ECE)',
      semester: 7,
      graduationYear: 2025,
      tenthPct: '89.40',
      twelfthPct: '87.60',
      cgpa: '8.40',
      activeBacklogs: 0,
      totalBacklogs: 0,
      targetRole: 'Member of Technical Staff',
      leetcodeSolved: 230,
      skillNames: ['C++', 'Java', 'DSA', 'SQL', 'Operating Systems', 'Computer Networks'],
      hasProjects: true,
      hasCerts: true,
      hasInternship: false,
      overallReadiness: '76.10',
      isProvisional: false,
      coveragePct: 100,
    },
    {
      uid: 'local:stu-sneha-deshmukh',
      email: 'sneha.deshmukh@nie.edu.in',
      fullName: 'Sneha Deshmukh',
      department: 'Information Tech (IT)',
      semester: 7,
      graduationYear: 2025,
      tenthPct: '86.00',
      twelfthPct: '84.20',
      cgpa: '7.95',
      activeBacklogs: 0,
      totalBacklogs: 0,
      targetRole: 'Cloud & Backend Analyst',
      leetcodeSolved: 175,
      skillNames: ['Python', 'SQL', 'PostgreSQL', 'AWS', 'Docker', 'REST APIs'],
      hasProjects: true,
      hasCerts: true,
      hasInternship: true,
      overallReadiness: '70.80',
      isProvisional: false,
      coveragePct: 100,
    },
    {
      uid: 'local:stu-vikram-singh',
      email: 'vikram.singh@nie.edu.in',
      fullName: 'Vikram Singh',
      department: 'Electrical Engg (EE)',
      semester: 7,
      graduationYear: 2025,
      tenthPct: '81.50',
      twelfthPct: '78.00',
      cgpa: '7.60',
      activeBacklogs: 0,
      totalBacklogs: 1,
      targetRole: 'Technology Analyst',
      leetcodeSolved: 95,
      skillNames: ['Python', 'SQL', 'DBMS', 'Problem Solving', 'Communication'],
      hasProjects: true,
      hasCerts: false,
      hasInternship: false,
      overallReadiness: '62.50',
      isProvisional: true,
      coveragePct: 85,
    },
    {
      uid: 'local:stu-meera-iyer',
      email: 'meera.iyer@nie.edu.in',
      fullName: 'Meera Iyer',
      department: 'Mechanical Engg (ME)',
      semester: 7,
      graduationYear: 2025,
      tenthPct: '85.00',
      twelfthPct: '83.50',
      cgpa: '8.05',
      activeBacklogs: 0,
      totalBacklogs: 0,
      targetRole: 'Business & Data Analyst',
      leetcodeSolved: 80,
      skillNames: ['Python', 'SQL', 'Quantitative Analytics', 'Communication'],
      hasProjects: true,
      hasCerts: true,
      hasInternship: false,
      overallReadiness: '64.30',
      isProvisional: true,
      coveragePct: 85,
    },
    {
      uid: 'local:stu-arjun-patel',
      email: 'arjun.patel@nie.edu.in',
      fullName: 'Arjun Patel',
      department: 'Computer Engg (CSE)',
      semester: 7,
      graduationYear: 2025,
      tenthPct: '74.00',
      twelfthPct: '71.00',
      cgpa: '6.35',
      activeBacklogs: 0,
      totalBacklogs: 1,
      targetRole: 'Associate Software Engineer',
      leetcodeSolved: 110,
      skillNames: ['Java', 'SQL', 'HTML/CSS', 'JavaScript', 'Git'],
      hasProjects: true,
      hasCerts: false,
      hasInternship: false,
      overallReadiness: '55.40',
      isProvisional: true,
      coveragePct: 85,
    },
    {
      uid: 'local:stu-divya-menon',
      email: 'divya.menon@nie.edu.in',
      fullName: 'Divya Menon',
      department: 'Computer Engg (CSE)',
      semester: 7,
      graduationYear: 2025,
      tenthPct: '93.80',
      twelfthPct: '91.60',
      cgpa: '8.65',
      activeBacklogs: 0,
      totalBacklogs: 0,
      targetRole: 'Software Development Engineer',
      leetcodeSolved: 325,
      skillNames: [
        'C++',
        'Java',
        'Python',
        'DSA',
        'Dynamic Programming',
        'SQL',
        'DBMS',
        'Operating Systems',
        'System Design',
      ],
      hasProjects: true,
      hasCerts: true,
      hasInternship: true,
      overallReadiness: '83.20',
      isProvisional: false,
      coveragePct: 100,
    },
  ];

  const seededProfiles: { email: string; userId: string; studentId: string }[] = [];

  await runInChunks(studentSeeds, 5, async (stu) => {
    const uRow = await prisma.user.upsert({
      where: { email: stu.email },
      create: {
        uid: stu.uid,
        email: stu.email,
        passwordHash: studentHash,
        role: 'STUDENT',
        isActive: true,
        mustChangePassword: false,
      },
      update: {
        updatedAt: new Date(),
      },
    });

    const pRow = await prisma.studentProfile.upsert({
      where: { userId: uRow.id },
      create: {
        userId: uRow.id,
        fullName: stu.fullName,
        phone: '9876543210',
        college: 'National Institute of Engineering',
        degree: 'B.Tech',
        department: stu.department,
        semester: stu.semester,
        graduationYear: stu.graduationYear,
        tenthPct: stu.tenthPct,
        twelfthPct: stu.twelfthPct,
        cgpa: stu.cgpa,
        totalBacklogs: stu.totalBacklogs,
        activeBacklogs: stu.activeBacklogs,
        targetRole: stu.targetRole,
        leetcodeSolved: stu.leetcodeSolved,
        avatarUrl: '',
        avatarBg: 'indigo',
        bio: `B.Tech ${stu.department} candidate targeting ${stu.targetRole}.`,
        resumeSummary:
          stu.email === 'aditya.sharma@nie.edu.in'
            ? INITIAL_PROFILE.resumeSummary
            : `${stu.fullName} — B.Tech ${stu.department}, Targeting ${stu.targetRole}.`,
        portalSettings: INITIAL_SETTINGS as unknown as Prisma.InputJsonValue,
        completionPct: 60,
      },
      update: {
        updatedAt: new Date(),
      },
    });

    seededProfiles.push({ email: stu.email, userId: uRow.id, studentId: pRow.id });

    const studentSkillsData = stu.skillNames
      .map((skName) => {
        const sk = skillByName.get(skName.toLowerCase());
        if (!sk) return null;
        return {
          studentId: pRow.id,
          skillId: sk.id,
          proficiency: skName === 'Java' || skName === 'Python' || skName === 'SQL' ? 4 : 3,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    if (studentSkillsData.length > 0) {
      await prisma.studentSkill.createMany({
        data: studentSkillsData,
        skipDuplicates: true,
      });
    }

    const projCount = await prisma.project.count({ where: { studentId: pRow.id } });
    if (stu.hasProjects && projCount === 0) {
      if (stu.email === 'aditya.sharma@nie.edu.in') {
        await prisma.project.createMany({
          data: INITIAL_PROFILE.projects.map((pr) => ({
            studentId: pRow.id,
            title: pr.title,
            description: pr.impact,
            technologies: pr.stack.split(',').map((s) => s.trim()),
            role: 'Lead Backend Developer',
            githubUrl: `https://github.com/aditya-sharma/${pr.id}`,
          })),
        });
      } else {
        await prisma.project.create({
          data: {
            studentId: pRow.id,
            title: `${stu.fullName.split(' ')[0]}'s Cloud Placement Tracker`,
            description:
              'Engineered REST APIs with PostgreSQL indexing and role-based JWT auth reducing query latency by 42%.',
            technologies: stu.skillNames.slice(0, 4),
            role: 'Full-Stack Developer',
            githubUrl: 'https://github.com/example/campus-project',
          },
        });
      }
    }

    const certCount = await prisma.certification.count({ where: { studentId: pRow.id } });
    if (stu.hasCerts && certCount === 0) {
      if (stu.email === 'aditya.sharma@nie.edu.in') {
        await prisma.certification.createMany({
          data: INITIAL_PROFILE.certifications.map((c) => ({
            studentId: pRow.id,
            name: c,
            issuer: c.includes('AWS')
              ? 'Amazon Web Services'
              : c.includes('Oracle')
              ? 'Oracle University'
              : 'HackerRank / Coursera',
          })),
        });
      } else {
        await prisma.certification.create({
          data: {
            studentId: pRow.id,
            name: 'AWS Certified Cloud Practitioner',
            issuer: 'Amazon Web Services',
          },
        });
      }
    }

    const intCount = await prisma.internship.count({ where: { studentId: pRow.id } });
    if (stu.hasInternship && intCount === 0) {
      await prisma.internship.create({
        data: {
          studentId: pRow.id,
          company: 'FinCore Systems Pvt Ltd',
          role: 'Software Engineering Intern',
          description:
            'Built automated reconciliation microservices in Java & PostgreSQL processing 50k+ daily records.',
        },
      });
      await prisma.achievement.create({
        data: {
          studentId: pRow.id,
          title: 'Smart India Hackathon Finalist',
          description: 'Top 10 national finalist team among 400+ engineering college entries.',
        },
      });
    }

    await prisma.studentPreference.upsert({
      where: { studentId: pRow.id },
      create: {
        studentId: pRow.id,
        preferredRoles: [stu.targetRole, 'Backend Engineer'],
        preferredIndustries: ['Tier-1 Product', 'Cloud & FinTech'],
        preferredLocations: ['Bengaluru', 'Hyderabad', 'Pune'],
      },
      update: {},
    });

    const snapCount = await prisma.readinessSnapshot.count({ where: { studentId: pRow.id } });
    if (snapCount === 0) {
      await prisma.readinessSnapshot.create({
        data: {
          studentId: pRow.id,
          overall: stu.overallReadiness,
          academics: stu.cgpa ? String(Math.min(100, Number(stu.cgpa) * 10)) : null,
          technical: '68.00',
          aptitude: '74.00',
          coding: stu.hasProjects ? '62.00' : null,
          interview: stu.hasInternship ? '65.00' : null,
          projects: stu.hasProjects ? '75.00' : null,
          isProvisional: stu.isProvisional,
          coveragePct: stu.coveragePct,
          missing: stu.isProvisional ? ['interview'] : [],
        },
      });
    }

    const gapCount = await prisma.skillGapReport.count({ where: { studentId: pRow.id } });
    if (gapCount === 0) {
      const msftRole = primaryRoleIdBySlug.get('microsoft') ?? null;
      const rep = await prisma.skillGapReport.create({
        data: {
          studentId: pRow.id,
          jobRoleId: msftRole,
          coveragePct: stu.email === 'priya.nair@nie.edu.in' ? '92.00' : '68.50',
        },
      });

      const dpSkill = skillByName.get('dynamic programming');
      const sysSkill = skillByName.get('system design');
      const dockerSkill = skillByName.get('docker');
      const gapInserts = [
        dpSkill && !stu.skillNames.includes('Dynamic Programming')
          ? {
              reportId: rep.id,
              skillId: dpSkill.id,
              status: 'MISSING' as const,
              priority: 'HIGH' as const,
            }
          : null,
        sysSkill && !stu.skillNames.includes('System Design')
          ? {
              reportId: rep.id,
              skillId: sysSkill.id,
              status: 'MISSING' as const,
              priority: 'HIGH' as const,
            }
          : null,
        dockerSkill && !stu.skillNames.includes('Docker')
          ? {
              reportId: rep.id,
              skillId: dockerSkill.id,
              status: 'PARTIAL' as const,
              priority: 'MEDIUM' as const,
            }
          : null,
      ].filter((x): x is NonNullable<typeof x> => Boolean(x));

      if (gapInserts.length > 0) {
        await prisma.skillGapItem.createMany({ data: gapInserts });
      }
    }

    await recalculateAndPersistProfileCompletion(pRow.id, uRow.id);
  });

  // 10. Rich Demo Records for Aditya Sharma
  const aditya = seededProfiles.find((s) => s.email === 'aditya.sharma@nie.edu.in');
  if (aditya) {
    const appData = INITIAL_APPLICATIONS.map((app) => {
      const cId = companyIdBySlug.get(app.companyId);
      const rId = primaryRoleIdBySlug.get(app.companyId) ?? null;
      if (!cId) return null;
      return {
        studentId: aditya.studentId,
        companyId: cId,
        jobRoleId: rId,
        status: app.status,
        round: app.round,
        notes: app.notes,
      };
    }).filter((x): x is NonNullable<typeof x> => Boolean(x));

    if (appData.length > 0) {
      await prisma.driveApplication.createMany({
        data: appData,
        skipDuplicates: true,
      });
    }

    const studyPlanTopics = allTopics
      .filter((t) => t.category === 'study-plan')
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    for (let i = 0; i < Math.min(2, studyPlanTopics.length); i++) {
      await prisma.studentProgress.upsert({
        where: {
          studentId_topicId: {
            studentId: aditya.studentId,
            topicId: studyPlanTopics[i].id,
          },
        },
        create: {
          studentId: aditya.studentId,
          topicId: studyPlanTopics[i].id,
          status: 'COMPLETED',
          startedAt: new Date(Date.now() - (5 - i) * 86_400_000),
          completedAt: new Date(Date.now() - (4 - i) * 86_400_000),
        },
        update: {},
      });
    }

    const resCount = await prisma.resume.count({ where: { studentId: aditya.studentId } });
    if (resCount === 0) {
      await prisma.resume.create({
        data: {
          studentId: aditya.studentId,
          title: 'Aditya Sharma — SDE-1 Campus Resume v1',
          template: 'modern',
          version: 1,
          isPrimary: true,
          content: {
            summary: INITIAL_PROFILE.resumeSummary,
            skills: INITIAL_PROFILE.skills,
            projects: INITIAL_PROFILE.projects,
            certifications: INITIAL_PROFILE.certifications,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    }

    const attCount = await prisma.quizAttempt.count({ where: { studentId: aditya.studentId } });
    if (attCount === 0) {
      const sampleQs = await prisma.question.findMany({
        take: 5,
        include: { options: true },
      });
      if (sampleQs.length > 0) {
        const started = new Date(Date.now() - 2 * 86_400_000);
        const att = await prisma.quizAttempt.create({
          data: {
            studentId: aditya.studentId,
            category: 'QUANT',
            status: 'SUBMITTED',
            questionIds: sampleQs.map((q) => q.id),
            startedAt: started,
            deadlineAt: new Date(started.getTime() + 600_000),
            submittedAt: new Date(started.getTime() + 340_000),
            score: 4,
            total: sampleQs.length,
          },
        });

        await prisma.quizAnswer.createMany({
          data: sampleQs.map((q, idx) => {
            const chosen =
              idx < 4
                ? q.options.find((o) => o.isCorrect)
                : q.options.find((o) => !o.isCorrect);
            return {
              attemptId: att.id,
              questionId: q.id,
              selectedOptionId: chosen?.id ?? null,
              isCorrect: idx < 4,
            };
          }),
          skipDuplicates: true,
        });
      }
    }

    const subCount = await prisma.codingSubmission.count({
      where: { studentId: aditya.studentId },
    });
    if (subCount === 0) {
      const [firstProb, javaLang] = await Promise.all([
        prisma.codingProblem.findFirst({ where: { slug: 'second-largest' } }),
        prisma.codingLanguage.findUnique({ where: { key: 'java' } }),
      ]);
      if (firstProb) {
        await prisma.codingSubmission.create({
          data: {
            studentId: aditya.studentId,
            problemId: firstProb.id,
            languageId: javaLang?.id ?? null,
            sourceCode: CODING_PROBLEMS[0].javaCode,
            status: 'SELF_MARKED_SOLVED',
            executed: false,
            testsPassed: 1,
            testsTotal: 1,
          },
        });
      }
    }

    const actCount = await prisma.learningActivityLog.count({
      where: { studentId: aditya.studentId },
    });
    if (actCount === 0) {
      const activityEvents = [
        { type: 'PROFILE_UPDATED', daysAgo: 12 },
        { type: 'SKILL_ADDED', daysAgo: 10 },
        { type: 'TOPIC_COMPLETED', daysAgo: 6 },
        { type: 'TOPIC_COMPLETED', daysAgo: 4 },
        { type: 'QUIZ_SUBMITTED', daysAgo: 2 },
        { type: 'CODING_SUBMITTED', daysAgo: 1 },
        { type: 'RESUME_UPDATED', daysAgo: 0 },
      ];
      await prisma.learningActivityLog.createMany({
        data: activityEvents.map((ev) => ({
          studentId: aditya.studentId,
          type: ev.type,
          metadata: { seeded: true } as Prisma.InputJsonValue,
          createdAt: new Date(Date.now() - ev.daysAgo * 86_400_000),
        })),
      });

      const allBadges = await prisma.badge.findMany();
      const badgeInserts = ['FIRST_QUIZ', 'QUIZ_MASTER', 'FIRST_CODE', 'PROFILE_80']
        .map((code) => {
          const b = allBadges.find((x) => x.code === code);
          return b ? { studentId: aditya.studentId, badgeId: b.id } : null;
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x));

      if (badgeInserts.length > 0) {
        await prisma.studentBadge.createMany({
          data: badgeInserts,
          skipDuplicates: true,
        });
      }

      await prisma.notification.createMany({
        data: [
          {
            userId: aditya.userId,
            type: 'COMPANY',
            title: 'Sample Campus Drive Alert: Microsoft SDE-1',
            body: 'Review sample eligibility cutoffs (8.00 CGPA, 0 active backlogs) and complete Tree/DP practice modules.',
            isRead: false,
          },
          {
            userId: aditya.userId,
            type: 'ACHIEVEMENT',
            title: 'Badge Unlocked: Screening Sharp',
            body: 'You scored 80% on your Quantitative & Speed Math diagnostic attempt.',
            isRead: false,
          },
        ],
      });
    }
  }

  // Published Announcement + Initial Audit Log
  const annCount = await prisma.announcement.count();
  if (annCount === 0) {
    const ann = await prisma.announcement.create({
      data: {
        title: 'Day-0 & Day-1 Campus Placement Season Schedule (Sample Notice)',
        body: 'All 2026-27 graduating B.Tech students are advised to verify their semester SGPA/CGPA records, active backlog counts, and primary resume before registering for upcoming campus drives.',
        status: 'PUBLISHED',
        audience: { all: true } as Prisma.InputJsonValue,
        publishAt: new Date(),
        createdById: adminUser.id,
      },
    });

    if (seededProfiles.length > 0) {
      await prisma.announcementRecipient.createMany({
        data: seededProfiles.map((sp) => ({
          announcementId: ann.id,
          studentId: sp.studentId,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: adminUser.id,
        action: 'SEED_BOOTSTRAP_COMPLETE',
        entity: 'SYSTEM',
        entityId: 'placement-bridge-v1',
        metadata: {
          actorEmail: adminEmail,
          actorRole: 'ADMIN',
          outcome: 'SUCCESS',
          note: 'Initialized Neon PostgreSQL schema & idempotent reference dataset via Prisma ORM',
        } as Prisma.InputJsonValue,
        ip: '127.0.0.1',
      },
    });
  }

  const [
    uCnt,
    stuCnt,
    skCnt,
    compCnt,
    roleCnt,
    qCnt,
    qzCnt,
    cpCnt,
    tcCnt,
    iqCnt,
    tpCnt,
    lrCnt,
    bdgCnt,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.studentProfile.count(),
    prisma.skill.count(),
    prisma.company.count(),
    prisma.jobRole.count(),
    prisma.question.count(),
    prisma.quiz.count(),
    prisma.codingProblem.count(),
    prisma.codingTestCase.count(),
    prisma.interviewQuestion.count(),
    prisma.preparationTopic.count(),
    prisma.learningResource.count(),
    prisma.badge.count(),
  ]);

  return {
    users: uCnt,
    student_profiles: stuCnt,
    skills: skCnt,
    companies: compCnt,
    job_roles: roleCnt,
    questions: qCnt,
    quizzes: qzCnt,
    coding_problems: cpCnt,
    coding_test_cases: tcCnt,
    interview_questions: iqCnt,
    preparation_topics: tpCnt,
    learning_resources: lrCnt,
    badges: bdgCnt,
  };
}

/**
 * Lazy single-flight seed check invoked on first incoming API request if `companies` is empty.
 * Strictly avoids eager startup probes or reconnect loops at module load time!
 */
export async function ensureSeededOnce(): Promise<void> {
  if (seedPromise) {
    await seedPromise;
    return;
  }
  const [existingComps, existingStudents] = await Promise.all([
    prisma.company.count(),
    prisma.studentProfile.count(),
  ]);
  if (existingComps >= 15 && existingStudents >= 10) {
    return;
  }
  seedPromise = runIdempotentSeed().finally(() => {
    seedPromise = null;
  });
  await seedPromise;
}

// CLI execution when invoked via `npx tsx src/db/seed.ts`
const isDirectExecution =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectExecution) {
  runIdempotentSeed()
    .then(async (summary) => {
      console.log('Placement Bridge PostgreSQL Seed Complete:', JSON.stringify(summary, null, 2));
      await disconnectPrisma();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Seed failed:', err instanceof Error ? err.message : String(err));
      await disconnectPrisma();
      process.exit(1);
    });
}

