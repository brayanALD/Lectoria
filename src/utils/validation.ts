export const MIN_PASSWORD_LENGTH = 6;
export const MAX_DISPLAY_NAME_LENGTH = 60;
export const MAX_NICKNAME_LENGTH = 30;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export function isValidDisplayName(name: string): boolean {
  const length = name.trim().length;
  return length > 0 && length <= MAX_DISPLAY_NAME_LENGTH;
}

/** El apodo es opcional: vacío es válido. */
export function isValidNickname(nickname: string): boolean {
  return nickname.trim().length <= MAX_NICKNAME_LENGTH;
}
