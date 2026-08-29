import { useRouter } from 'expo-router';

import { SignUpScreen } from '@/screens/auth/sign-up';

export default function SignUpRoute() {
  const router = useRouter();

  return <SignUpScreen onBackToSignIn={() => router.replace('/sign-in')} />;
}
