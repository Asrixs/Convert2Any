/**
 * Turn whatever a conversion threw into one sentence for the queue.
 *
 * Pipeline errors carry an internal "Convert2Any:" prefix so they stand out
 * in logs; the person reading the queue needs neither that nor a stack trace.
 * Library errors keep their own wording — it is the most specific detail
 * available — except pdf.js password errors, which get a next step.
 */
export function userFacingMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';

  if (name === 'PasswordException') {
    // pdf.js: code 1 means no password was given, 2 means it was wrong.
    const code = (err as { code?: number }).code;
    return code === 2
      ? 'That password does not open this PDF.'
      : 'This PDF is password-protected. Enter its password, or remove it with Unlock PDF first.';
  }

  const message = raw.replace(/^Convert2Any:\s*/, '').trim();
  if (message === '') return 'Conversion failed for an unknown reason.';
  return message.charAt(0).toUpperCase() + message.slice(1);
}
