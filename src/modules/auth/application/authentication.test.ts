import { describe, expect, it } from 'vitest';

import { secretFromTotpUri } from './authentication';

describe('secretFromTotpUri', () => {
  it('extracts the manual-entry secret from an otpauth URI', () => {
    expect(
      secretFromTotpUri(
        'otpauth://totp/Valery:admin?secret=JBSWY3DPEHPK3PXP&issuer=Valery',
      ),
    ).toBe('JBSWY3DPEHPK3PXP');
  });
});
