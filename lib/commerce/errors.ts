export class CommerceError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}
