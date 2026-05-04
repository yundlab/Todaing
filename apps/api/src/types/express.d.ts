/* eslint-disable no-unused-vars -- ambient merge: Express/Request are type positions only */
export {};

declare global {
  namespace Express {
    interface Request {
      /** `requireAuth` 이후 세션 사용자 id (Prisma `User.id`) */
      userId?: string;
    }
  }
}
