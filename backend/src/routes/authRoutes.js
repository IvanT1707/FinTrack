const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createAuthRouter(jwtSecret) {
  const router = express.Router();

  router.post('/register', async (req, res) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      const fullName = String(req.body.full_name || '').trim();

      if (!email || !password || !fullName) {
        return res.status(400).json({ message: 'Email, password and full name are required' });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must contain at least 8 characters' });
      }

      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ message: 'User with this email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({ email, passwordHash, fullName });
      return res.status(201).json({ id: user.id, email: user.email, full_name: user.fullName });
    } catch (error) {
      return res.status(500).json({ message: 'Registration failed', error: error.message });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const user = await User.findOne({ where: { email } });
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const accessToken = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, jwtSecret, { expiresIn: '7d' });
      await RefreshToken.create({
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      return res.status(200).json({
        access_token: accessToken,
        refresh_token: refreshToken,
        user: { id: user.id, email: user.email, full_name: user.fullName }
      });
    } catch (error) {
      return res.status(500).json({ message: 'Login failed', error: error.message });
    }
  });

  router.post('/refresh', async (req, res) => {
    try {
      const refreshToken = String(req.body.refresh_token || '');
      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token is required' });
      }

      const decoded = jwt.verify(refreshToken, jwtSecret);
      if (decoded.type !== 'refresh') {
        return res.status(401).json({ message: 'Invalid refresh token' });
      }

      const storedToken = await RefreshToken.findOne({
        where: { token: refreshToken, userId: decoded.userId, expiresAt: { [Op.gt]: new Date() } }
      });
      if (!storedToken) {
        return res.status(401).json({ message: 'Refresh token is invalid or expired' });
      }

      const user = await User.findByPk(decoded.userId);
      if (!user) return res.status(401).json({ message: 'User not found' });
      return res.status(200).json({ access_token: jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '15m' }) });
    } catch (error) {
      return res.status(401).json({ message: 'Refresh token is invalid or expired' });
    }
  });

  router.post('/logout', async (req, res) => {
    try {
      const refreshToken = String(req.body.refresh_token || '');
      if (!refreshToken) return res.status(400).json({ message: 'Refresh token is required' });
      await RefreshToken.destroy({ where: { token: refreshToken } });
      return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      return res.status(500).json({ message: 'Logout failed', error: error.message });
    }
  });

  return router;
}

module.exports = { createAuthRouter };
