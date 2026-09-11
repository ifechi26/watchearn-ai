import express from 'express';
import { auth, db } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    // Create user document in Firestore
    const userData = {
      id: userRecord.uid,
      email,
      name,
      username: `user_${uuidv4().slice(0, 8)}`,
      role: 'USER',
      status: 'active',
      premiumStatus: 'none',
      createdAt: new Date(),
      lastActive: new Date(),
      referralCode: `ref_${uuidv4().slice(0, 10)}`,
      country: '',
      timezone: 'UTC',
      notificationPreferences: {
        email: true,
        inApp: true,
      },
    };

    await db.collection('users').doc(userRecord.uid).set(userData);

    res.status(201).json({
      message: 'User registered successfully',
      userId: userRecord.uid,
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(400).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get user profile
router.get('/profile/:userId', async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.params.userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userDoc.data());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put('/profile/:userId', async (req, res) => {
  try {
    const { name, username, country, timezone, notificationPreferences } = req.body;
    
    const updates = {};
    if (name) updates.name = name;
    if (username) updates.username = username;
    if (country) updates.country = country;
    if (timezone) updates.timezone = timezone;
    if (notificationPreferences) updates.notificationPreferences = notificationPreferences;
    
    updates.lastActive = new Date();

    await db.collection('users').doc(req.params.userId).update(updates);
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
