import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().trim().min(1, 'validation.required').email('validation.email'),
  password: z.string().min(1, 'validation.required'),
});

export const signUpSchema = z
  .object({
    confirmPassword: z.string().min(1, 'validation.required'),
    email: z.string().trim().min(1, 'validation.required').email('validation.email'),
    password: z.string().min(8, 'validation.passwordLength'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'validation.passwordMatch',
    path: ['confirmPassword'],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
