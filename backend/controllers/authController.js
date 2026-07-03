const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

exports.register = async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ message: 'full_name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userId = await User.create({ full_name, email, password_hash, role: 'user' });
    const user = await User.findById(userId);
    const token = generateToken(user);

    res.status(201).json({ message: 'Registration successful.', token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required.' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    delete user.password_hash;

    res.json({ message: 'Login successful.', token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching profile.' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { full_name, email } = req.body;
    if (!full_name || !email) {
      return res.status(400).json({ message: 'full_name and email are required.' });
    }
    await User.updateProfile(req.user.id, { full_name, email });
    const user = await User.findById(req.user.id);
    res.json({ message: 'Profile updated.', user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating profile.' });
  }
};
