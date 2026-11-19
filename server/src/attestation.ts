export interface AttestationVerificationResult {
  valid: boolean;
  error?: string;
  platform?: 'android' | 'ios' | 'web' | 'unknown';
}

export interface AttestationVerifier {
  verify(token?: string, challenge?: string): Promise<AttestationVerificationResult>;
}

/**
 * Default / Development Attestation Verifier.
 * Always passes unless attestation is strictly enabled in production.
 */
export class NoopAttestationVerifier implements AttestationVerifier {
  async verify(): Promise<AttestationVerificationResult> {
    return { valid: true, platform: 'unknown' };
  }
}

/**
 * Production Platform Attestation Verifier interface with Play Integrity & App Attest slots.
 * Behind env flag ENABLE_PLATFORM_ATTESTATION (defaults to false).
 */
export class PlatformAttestationVerifier implements AttestationVerifier {
  private readonly enabled: boolean;

  constructor() {
    this.enabled = process.env.ENABLE_PLATFORM_ATTESTATION === 'true';
  }

  async verify(token?: string, challenge?: string): Promise<AttestationVerificationResult> {
    if (!this.enabled) {
      return { valid: true, platform: 'unknown' };
    }

    if (!token) {
      return {
        valid: false,
        error: 'Missing platform attestation token.',
      };
    }

    // TODO: Google Play Integrity API verification slot (Android)
    // - Verify token with Google Play Developer API (playintegrity.googleapis.com)
    // - Check appRecognitionVerdict === 'PLAY_RECOGNIZED'
    // - Check deviceRecognitionVerdict contains 'MEETS_DEVICE_INTEGRITY'
    // - Validate nonce === challenge
    // Required Env: GOOGLE_PLAY_INTEGRITY_KEY, GOOGLE_CLOUD_PROJECT_NUMBER

    // TODO: Apple DeviceCheck / App Attest verification slot (iOS)
    // - Validate assertion and attestation object via Apple App Attest service
    // - Check clientDataHash matches sha256(challenge)
    // - Check counter > previousCounter to prevent replay attacks
    // Required Env: APPLE_TEAM_ID, APPLE_BUNDLE_ID

    // Do NOT fake-verify: if enabled and not implemented, fail closed
    return {
      valid: false,
      error: 'Platform attestation service not yet configured with Google/Apple credentials.',
    };
  }
}

export function createAttestationVerifier(): AttestationVerifier {
  if (process.env.ENABLE_PLATFORM_ATTESTATION === 'true') {
    return new PlatformAttestationVerifier();
  }
  return new NoopAttestationVerifier();
}
