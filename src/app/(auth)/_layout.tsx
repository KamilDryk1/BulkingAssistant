import { Stack } from 'expo-router/stack';

export const unstable_settings = {
  anchor: 'sign-in',
};

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
