import { describe, it, expect } from 'vitest';
import { runProblemCode, validateCodeSyntax } from '../../src/server/integrations/codeExecution';

describe('LeetCode-Style Code Execution Engine', () => {
  const sampleTestCases = [
    {
      id: 'tc-1',
      input: 'arr = [12, 35, 1, 10, 34, 35]',
      expectedOutput: '34',
    },
    {
      id: 'tc-2',
      input: 'arr = [10, 5, 10]',
      expectedOutput: '5',
    },
    {
      id: 'tc-3',
      input: 'arr = [10, 10, 10]',
      expectedOutput: '-1',
    },
    {
      id: 'tc-4',
      input: 'arr = [1, 2]',
      expectedOutput: '1',
    },
  ];

  it('rejects syntax error like classSolution with COMPILATION_ERROR', async () => {
    const brokenCode = `classSolution {
    public int getSecondLargest(int[] arr) {
        return -1;
    }
}`;

    const verdict = await runProblemCode({
      problemSlug: 'second-largest',
      languageKey: 'java',
      sourceCode: brokenCode,
      testCases: sampleTestCases,
    });

    expect(verdict.passed).toBe(false);
    expect(verdict.status).toBe('COMPILATION_ERROR');
    expect(verdict.passedCases).toBe(0);
    expect(verdict.compileError).toBeTruthy();
  });

  it('fails starter boilerplate with WRONG_ANSWER and 0 passed cases', async () => {
    const starterBoilerplate = `class Solution {
    public int getSecondLargest(int[] arr) {
        // Write your solution here
        return -1;
    }
}`;

    const verdict = await runProblemCode({
      problemSlug: 'second-largest',
      languageKey: 'java',
      sourceCode: starterBoilerplate,
      testCases: sampleTestCases,
    });

    expect(verdict.passed).toBe(false);
    expect(verdict.status).toBe('WRONG_ANSWER');
    // For test case 1 (expected 34), actual was -1, so it failed
    expect(verdict.testResults[0].passed).toBe(false);
    expect(verdict.testResults[0].actualOutput).toBe('-1');
    expect(verdict.testResults[0].expectedOutput).toBe('34');
  });

  it('passes authentic correct solution with ACCEPTED and all cases passed', async () => {
    const correctSolution = `class Solution {
    public int getSecondLargest(int[] arr) {
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
}`;

    const verdict = await runProblemCode({
      problemSlug: 'second-largest',
      languageKey: 'java',
      sourceCode: correctSolution,
      testCases: sampleTestCases,
    });

    expect(verdict.passed).toBe(true);
    expect(verdict.status).toBe('ACCEPTED');
    expect(verdict.passedCases).toBe(sampleTestCases.length);
    expect(verdict.testResults[0].actualOutput).toBe('34');
  });

  it('correctly executes Python solutions with real AST and execution', async () => {
    // Starter python code
    const pythonStarter = `class Solution:
    def getSecondLargest(self, arr: list[int]) -> int:
        pass`;

    const failVerdict = await runProblemCode({
      problemSlug: 'second-largest',
      languageKey: 'python',
      sourceCode: pythonStarter,
      testCases: sampleTestCases,
    });
    expect(failVerdict.passed).toBe(false);
    expect(failVerdict.status).toBe('WRONG_ANSWER');

    // Correct python code
    const pythonCorrect = `class Solution:
    def getSecondLargest(self, arr: list[int]) -> int:
        first, second = -1, -1
        for x in arr:
            if x > first:
                second = first
                first = x
            elif x > second and x != first:
                second = x
        return second`;

    const passVerdict = await runProblemCode({
      problemSlug: 'second-largest',
      languageKey: 'python',
      sourceCode: pythonCorrect,
      testCases: sampleTestCases,
    });
    expect(passVerdict.passed).toBe(true);
    expect(passVerdict.status).toBe('ACCEPTED');
    expect(passVerdict.passedCases).toBe(sampleTestCases.length);
  });
});
