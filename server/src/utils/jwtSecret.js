export const getJwtSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  // The repository is public, so a default secret would let anyone forge an admin token.
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production');
  return 'hostelmate-local-development-secret';
};
