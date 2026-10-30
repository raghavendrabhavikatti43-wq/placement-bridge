import { env, getCapabilityFlags } from '../config/env.ts';

export interface SandboxExecutionInput {
  languageKey: string;
  externalLanguageId?: number | null;
  sourceCode: string;
  stdin: string;
  limits?: {
    timeSec?: number;
    memoryKb?: number;
  };
}

export interface SandboxExecutionResult {
  executed: boolean;
  status: 'PASSED' | 'FAILED' | 'ERROR' | 'PRACTICE';
  stdout: string;
  stderr: string;
  timeMs: number | null;
  memoryKb: number | null;
}

/**
 * Part A Section 7 — Code Execution Policy
 * NEVER executes user-submitted code in the Node process or on the app server!
 * Default mode is PRACTICE unless a trusted external sandbox (e.g. Judge0 via CODE_EXEC_URL) is configured.
 */
export async function executeInTrustedSandbox(
  input: SandboxExecutionInput
): Promise<SandboxExecutionResult> {
  const { executionEnabled } = getCapabilityFlags();
  if (!executionEnabled) {
    return {
      executed: false,
      status: 'PRACTICE',
      stdout: '',
      stderr: 'External code execution sandbox is not configured. Submission recorded in PRACTICE mode.',
      timeMs: null,
      memoryKb: null,
    };
  }

  if (input.sourceCode.length > 64_000) {
    return {
      executed: false,
      status: 'ERROR',
      stdout: '',
      stderr: 'Source code exceeds maximum 64 KB limit.',
      timeMs: null,
      memoryKb: null,
    };
  }

  // Judge0-compatible external sandbox HTTP adapter with strict AbortController timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (env.CODE_EXEC_API_KEY) {
      headers['X-Auth-Token'] = env.CODE_EXEC_API_KEY;
    }

    const res = await fetch(
      `${env.CODE_EXEC_URL.replace(/\/$/, '')}/submissions?base64_encoded=false&wait=true`,
      {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          language_id: input.externalLanguageId || 71,
          source_code: input.sourceCode,
          stdin: input.stdin,
          cpu_time_limit: input.limits?.timeSec ?? 2,
          memory_limit: input.limits?.memoryKb ?? 128_000,
          enable_network: false,
        }),
      }
    );

    if (!res.ok) {
      return {
        executed: false,
        status: 'ERROR',
        stdout: '',
        stderr: `Sandbox provider returned HTTP ${res.status}`,
        timeMs: null,
        memoryKb: null,
      };
    }

    const data = (await res.json()) as {
      stdout?: string | null;
      stderr?: string | null;
      compile_output?: string | null;
      time?: string | null;
      memory?: number | null;
      status?: { id?: number; description?: string };
    };

    const statusId = data.status?.id ?? 0;
    return {
      executed: true,
      status: statusId === 3 ? 'PASSED' : statusId >= 6 ? 'ERROR' : 'FAILED',
      stdout: (data.stdout || '').trim(),
      stderr: (data.stderr || data.compile_output || '').trim(),
      timeMs: data.time ? Math.round(Number(data.time) * 1000) : null,
      memoryKb: data.memory ?? null,
    };
  } catch (err) {
    return {
      executed: false,
      status: 'ERROR',
      stdout: '',
      stderr: err instanceof Error ? err.message : 'Sandbox request timed out or failed.',
      timeMs: null,
      memoryKb: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
