import { FirebaseError } from 'firebase/app';

const authErrorMap: Record<string, string> = {
  'auth/invalid-email': 'Invalid email format.',
  'auth/invalid-credential': 'Invalid credentials.',
  'auth/invalid-login-credentials': 'Invalid email or password.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/user-not-found': 'No account found for this email.',
  'auth/email-already-in-use': 'Email already in use.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-api-key': 'Firebase API key is invalid for this project.',
  'auth/configuration-not-found': 'Firebase Auth configuration is missing for this project.',
  'auth/network-request-failed': 'Network request failed. Check your internet or proxy settings.',
  'auth/unauthorized-domain': 'Current domain is not authorized in Firebase.',
  'auth/operation-not-allowed': 'Sign-in provider is disabled in Firebase console.',
  'auth/missing-phone-number': 'Enter a valid phone number to continue.',
  'auth/invalid-phone-number': 'Phone number format is invalid. Use country code, for example +1...',
  'auth/invalid-verification-code': 'SMS ver+ification code is invalid.',
  'auth/invalid-verification-id': 'SMS verification session expired. Request a new code.',
  'auth/captcha-check-failed': 'reCAPTCHA verification failed. Try again.',
  'auth/internal-error': 'Firebase returned an internal error. Retry in a few moments.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment before trying again.',
};

export function getFirebaseAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return authErrorMap[error.code] ?? `${error.code}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Authentication failed.';
}
