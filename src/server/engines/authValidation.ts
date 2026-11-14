import { z } from 'zod';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const loginValidationSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email({ message: 'Please enter a valid email address' })
    .max(180),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, { message: 'Password must be at least 6 characters long' })
    .max(128),
});

export interface LoginValidationResult {
  isValid: boolean;
  error: string | null;
  cleanEmail: string;
  cleanPassword: string;
}

/**
 * Validates login credentials format before database lookup.
 * Enforces email format, non-empty password, and minimum length.
 */
export function validateLoginCredentials(
  email?: unknown,
  password?: unknown
): LoginValidationResult {
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const cleanPassword = typeof password === 'string' ? password : '';

  if (!cleanEmail) {
    return {
      isValid: false,
      error: 'Please enter your student Email ID.',
      cleanEmail: '',
      cleanPassword: '',
    };
  }

  if (!EMAIL_REGEX.test(cleanEmail)) {
    return {
      isValid: false,
      error: 'Please enter a valid student Email ID (e.g., student@nie.edu.in).',
      cleanEmail,
      cleanPassword: '',
    };
  }

  if (!cleanPassword) {
    return {
      isValid: false,
      error: 'Password cannot be blank.',
      cleanEmail,
      cleanPassword: '',
    };
  }

  if (cleanPassword.length < 6) {
    return {
      isValid: false,
      error: 'Password must be at least 6 characters long.',
      cleanEmail,
      cleanPassword,
    };
  }

  return {
    isValid: true,
    error: null,
    cleanEmail,
    cleanPassword,
  };
}
