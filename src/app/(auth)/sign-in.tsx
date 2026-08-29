import { useRouter } from 'expo-router';

import { SignInScreen } from '@/screens/auth/sign-in';

export default function SignInRoute() {
  const router = useRouter();

  return <SignInScreen onCreateAccount={() => router.push('/sign-up')} />;
}
