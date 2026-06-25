import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

const APP_NAME = 'HR System'

export function generateTwoFactorSecret(email: string) {
  const secret = speakeasy.generateSecret({
    name: `${APP_NAME} (${email})`,
    length: 20,
  })
  return {
    base32: secret.base32,
    otpauthUrl: secret.otpauth_url ?? '',
  }
}

export async function generateQRCode(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl)
}

export function verifyTwoFactorToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // allow 1 step before/after for clock drift
  })
}
