import { describe, expect, it } from 'vitest';
import { userFacingMessage } from './errors';

describe('userFacingMessage', () => {
  it('drops the internal prefix and never includes a stack trace', () => {
    const err = new Error('Convert2Any: wrong password for this PDF');
    expect(userFacingMessage(err)).toBe('Wrong password for this PDF');
    expect(userFacingMessage(err)).not.toContain('at ');
  });

  it('gives pdf.js password errors a next step', () => {
    const need = Object.assign(new Error('No password given'), { name: 'PasswordException', code: 1 });
    const wrong = Object.assign(new Error('Incorrect Password'), { name: 'PasswordException', code: 2 });
    expect(userFacingMessage(need)).toMatch(/Unlock PDF/);
    expect(userFacingMessage(wrong)).toBe('That password does not open this PDF.');
  });

  it('copes with things that are not errors', () => {
    expect(userFacingMessage('plain text')).toBe('Plain text');
    expect(userFacingMessage(undefined)).toMatch(/unknown reason/);
  });
});
