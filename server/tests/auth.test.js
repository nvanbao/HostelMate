import { jest } from '@jest/globals';

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: jest.fn(),
  },
}));

jest.unstable_mockModule('../db.js', () => ({
  queryOne: jest.fn(),
}));

describe('Auth Middleware', () => {
  let mockReq, mockRes, mockNext;
  let authenticateToken, optionalAuthToken;
  let jwt, db;

  beforeAll(async () => {
    jwt = (await import('jsonwebtoken')).default;
    db = await import('../db.js');
    const auth = await import('../src/middleware/auth.js');
    authenticateToken = auth.authenticateToken;
    optionalAuthToken = auth.optionalAuthToken;
  });

  beforeEach(() => {
    mockReq = {
      cookies: {},
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should return 401 if no token is provided', async () => {
      await authenticateToken(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
    });

    it('should return 401 on invalid token', async () => {
      mockReq.cookies.token = 'invalid-token';
      jwt.verify.mockImplementation(() => { throw new Error('Invalid'); });
      await authenticateToken(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should authenticate TENANT', async () => {
      mockReq.cookies.token = 'tenant-token';
      jwt.verify.mockReturnValue({ id: 't1', role: 'TENANT' });
      db.queryOne.mockResolvedValue({ id: 't1', username: 't1' });
      await authenticateToken(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail TENANT if deleted', async () => {
      mockReq.cookies.token = 'tenant-token';
      jwt.verify.mockReturnValue({ id: 't1', role: 'TENANT' });
      db.queryOne.mockResolvedValue(null);
      await authenticateToken(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should authenticate ADMIN', async () => {
      mockReq.cookies.token = 'admin-token';
      jwt.verify.mockReturnValue({ id: 'a1', role: 'ADMIN', token_version: 1 });
      db.queryOne.mockResolvedValue({ token_version: 1 });
      await authenticateToken(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail ADMIN if token version mismatch', async () => {
      mockReq.cookies.token = 'admin-token';
      jwt.verify.mockReturnValue({ id: 'a1', role: 'ADMIN', token_version: 1 });
      db.queryOne.mockResolvedValue({ token_version: 2 });
      await authenticateToken(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('optionalAuthToken', () => {
    it('should call next if no token', async () => {
      await optionalAuthToken(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next if token invalid', async () => {
      mockReq.cookies.token = 'invalid-token';
      jwt.verify.mockImplementation(() => { throw new Error('Invalid'); });
      await optionalAuthToken(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should authenticate TENANT', async () => {
      mockReq.cookies.token = 'tenant-token';
      jwt.verify.mockReturnValue({ id: 't1', role: 'TENANT' });
      db.queryOne.mockResolvedValue({ id: 't1', username: 't1' });
      await optionalAuthToken(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user.id).toBe('t1');
    });

    it('should authenticate ADMIN', async () => {
      mockReq.cookies.token = 'admin-token';
      jwt.verify.mockReturnValue({ id: 'a1', role: 'ADMIN', token_version: 1 });
      db.queryOne.mockResolvedValue({ token_version: 1 });
      await optionalAuthToken(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user.id).toBe('a1');
    });
  });
});
