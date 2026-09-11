import express from 'express';
import { db, storage } from '../config/firebase.js';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '../middleware/auth.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Upgrade to creator
router.post('/upgrade', verifyToken, async (req, res) => {
  try {
    const { creatorName, bio, category } = req.body;

    const creator = {
      creatorId: req.userId,
      userId: req.userId,
      creatorName,
      bio,
      category,
      status: 'active',
      followers: 0,
      totalViews: 0,
      premiumStatus: 'none', // none, active, trial, past_due, cancelled
      premiumExpiresAt: null,
      monetizationStatus: 'not_eligible', // not_eligible, eligible, approved, suspended
      monetizationApprovedAt: null,
      verificationStatus: 'unverified', // unverified, verified
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection('creators').doc(req.userId).set(creator);
    
    // Update user role
    await db.collection('users').doc(req.userId).update({
      role: 'CREATOR',
    });

    res.status(201).json({ message: 'Creator account created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get creator profile
router.get('/:creatorId', async (req, res) => {
  try {
    const creatorDoc = await db.collection('creators').doc(req.params.creatorId).get();
    
    if (!creatorDoc.exists) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const creator = creatorDoc.data();
    
    // Get creator videos count
    const videosSnapshot = await db.collection('videos')
      .where('creatorId', '==', req.params.creatorId)
      .where('status', '==', 'approved')
      .get();

    creator.videoCount = videosSnapshot.size;

    res.json(creator);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload video
router.post('/upload/video', verifyToken, async (req, res) => {
  try {
    const { title, description, category, tags, visibility, type } = req.body;
    const videoId = uuidv4();

    // Check if user is a creator
    const userDoc = await db.collection('users').doc(req.userId).get();
    if (userDoc.data().role !== 'CREATOR' && userDoc.data().role !== 'PREMIUM_CREATOR') {
      return res.status(403).json({ error: 'Must be a creator to upload videos' });
    }

    // Run AI analysis on metadata
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `Analyze this video metadata and provide suggestions:
Title: ${title}\nDescription: ${description}\n\nProvide:
1. Title quality score (0-100)
2. Hook strength (0-100)
3. Description quality (0-100)
4. Potential audience
5. Content category recommendation
6. 3 improvement suggestions`;

    const aiAnalysis = await model.generateContent(prompt);
    const analysisText = aiAnalysis.response.text();

    const video = {
      videoId,
      creatorId: req.userId,
      title,
      titleLower: title.toLowerCase(),
      description,
      category,
      tags: tags || [],
      type, // short, long
      visibility,
      status: 'pending', // pending, approved, rejected
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      aiAnalysis: analysisText,
      createdAt: new Date(),
      updatedAt: new Date(),
      approvedAt: null,
      rejectedReason: null,
    };

    await db.collection('videos').doc(videoId).set(video);

    res.status(201).json({
      videoId,
      message: 'Video uploaded successfully. Awaiting moderation.',
      aiAnalysis,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get creator dashboard data
router.get('/:creatorId/dashboard', verifyToken, async (req, res) => {
  try {
    if (req.userId !== req.params.creatorId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const creatorDoc = await db.collection('creators').doc(req.userId).get();
    if (!creatorDoc.exists) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const creator = creatorDoc.data();

    // Get recent videos
    const videosSnapshot = await db.collection('videos')
      .where('creatorId', '==', req.userId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const videos = videosSnapshot.docs.map(doc => doc.data());

    // Get analytics
    const analytics = {
      totalViews: videos.reduce((sum, v) => sum + (v.views || 0), 0),
      totalLikes: videos.reduce((sum, v) => sum + (v.likes || 0), 0),
      totalComments: videos.reduce((sum, v) => sum + (v.comments || 0), 0),
    };

    res.json({
      creator,
      videos,
      analytics,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Creator Coach
router.post('/:creatorId/ai-coach', verifyToken, async (req, res) => {
  try {
    if (req.userId !== req.params.creatorId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { videoId } = req.body;
    const videoDoc = await db.collection('videos').doc(videoId).get();
    
    if (!videoDoc.exists) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = videoDoc.data();
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `Act as a professional YouTube/content creator coach. Analyze this video content and provide detailed improvements:

Title: ${video.title}
Description: ${video.description}
Category: ${video.category}
Type: ${video.type}

Provide:
1. Hook strength analysis
2. Title effectiveness score
3. Description quality assessment
4. 3 alternative title suggestions
5. 3 hook suggestions
6. 5 thumbnail concepts
7. Suggested short-form clip ideas
8. Social media caption suggestions
9. Key retention risks
10. Overall improvement checklist

Note: Use cautious language like "Potential", "Recommendation", "Estimated" rather than guarantees.`;

    const analysis = await model.generateContent(prompt);
    
    res.json({
      coachAnalysis: analysis.response.text(),
      videoId,
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get creator videos
router.get('/:creatorId/videos', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const snapshot = await db.collection('videos')
      .where('creatorId', '==', req.params.creatorId)
      .where('status', '==', 'approved')
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit) + 1)
      .get();

    const videos = snapshot.docs.slice(offset).slice(0, limit).map(doc => doc.data());
    const hasMore = snapshot.docs.length > parseInt(limit);

    res.json({ videos, hasMore });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
