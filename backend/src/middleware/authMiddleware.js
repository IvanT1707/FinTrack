const jwt = require('jsonwebtoken');

function createAuthMiddleware(jwtSecret) {
  return function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Authorization token is required' });
    }

    try {
      req.user = jwt.verify(token, jwtSecret);
      if (req.user.type === 'refresh') {
        return res.status(401).json({ message: 'Access token required' });
      }
      return next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  };
}

module.exports = {
  createAuthMiddleware
};
