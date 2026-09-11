# WatchEarn AI

**Watch. Discover. Create. Earn.**

A professional video-sharing and creator monetization platform where users discover original content and eligible Premium Creators earn from advertising revenue through the WatchEarn AI Creator Revenue Program.

## Features

### For Users
- 🎬 Discover original videos across multiple categories
- 📱 Mobile-first experience optimized for Android
- 🎯 Personalized video recommendations
- 💬 Comment and engage with creators
- ⭐ Like and save favorite videos
- 👥 Follow creators and get notifications
- 🎁 Participate in platform activities

### For Creators
- 📤 Upload and manage videos
- 🎨 AI-powered content optimization
- 💰 Premium Creator subscription
- 📊 Detailed analytics dashboard
- 💵 Eligible Premium Creators can earn 60% of eligible revenue
- 🤖 AI Creator Coach for content improvement
- 📈 Track estimated and finalized earnings

### For Administrators
- 👥 User and creator management
- 📺 Video moderation and approval
- 💰 Revenue tracking and management
- 💳 Withdrawal and payout management
- ⚠️ Fraud detection and monitoring
- ⚙️ Configurable platform settings
- 📊 Comprehensive analytics and reporting

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js/Express
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage
- **AI**: Google Gemini API
- **Payments**: Paystack/Flutterwave (configurable)
- **Ads**: Google Ad Manager (when integrated)

## Installation

### Prerequisites
- Node.js 18+
- Firebase project with Firestore enabled
- Gemini API key
- Payment provider credentials (for production)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ifechi26/watchearn-ai.git
   cd watchearn-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase and API credentials
   ```

4. **Firebase setup**
   - Create a Firebase project at console.firebase.google.com
   - Enable Firestore, Authentication, and Storage
   - Download service account key and place in `server/config/`
   - Update `.env` with Firebase credentials

5. **Start development**
   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000

## Project Structure

```
watchearn-ai/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── stores/        # Zustand state management
│   │   ├── lib/           # Utility functions
│   │   ├── types/         # TypeScript types
│   │   ├── services/      # API services
│   │   └── App.tsx        # Main app component
│   ├── index.css          # Global styles
│   └── main.tsx           # Entry point
├── server/                # Node.js backend
│   ├── config/            # Configuration files
│   ├── controllers/       # Request handlers
│   ├── middleware/        # Express middleware
│   ├── models/            # Data models
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── utils/             # Utility functions
│   └── index.js           # Server entry point
├── public/                # Static assets
├── .env.example           # Environment variables template
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
├── vite.config.ts         # Vite config
├── tailwind.config.js     # Tailwind CSS config
└── README.md              # This file
```

## Important Compliance Notes

### Revenue Share Clarity
- The 60/40 revenue split applies **only** to eligible revenue under the WatchEarn AI Creator Revenue Program
- This is **NOT** Google's universal revenue share
- All creator earnings are calculated from eligible revenue actually attributed to the platform
- Estimated revenue is clearly distinguished from finalized revenue

### Artificial Engagement Prevention
- The platform does NOT reward users for generating YouTube views, likes, comments, or subscriptions
- YouTube links are optional external references only
- All rewards are based on legitimate on-platform activities
- Ad revenue is attributed using legitimate advertising reporting

### Monetization Requirements
- Only Premium Creators can participate in the Creator Revenue Program
- Premium Creators must meet platform-configured eligibility requirements
- Revenue is calculated server-side only
- Real advertising integration only activates when proper Google approvals and credentials are in place

## Configuration

### Admin Settings

Administrators can configure:
- Creator Premium subscription price
- Monetization eligibility requirements
- Creator share percentage (default: 60%)
- Platform share percentage (default: 40%)
- Minimum withdrawal amount
- Revenue finalization delay
- Eligible content categories
- Payment provider settings
- Fraud detection thresholds

### Revenue Example

If eligible platform revenue attributed to a creator is ₦100,000:
- Creator receives: ₦60,000 (60%)
- Platform receives: ₦40,000 (40%)

## API Documentation

API endpoints are documented in `server/routes/`

## Security

- Firebase Security Rules prevent unauthorized data access
- Users cannot modify their own balance or payment status
- All financial calculations happen server-side
- Admin operations require proper authorization
- API keys and secrets stored in environment variables
- HTTPS enforced in production

## Payment Integration

### For Development
- Payment workflows are implemented but require provider credentials
- Use test/sandbox credentials for testing

### For Production
- Integrate with Paystack, Flutterwave, or other supported provider
- Configure payment provider keys in admin settings
- Enable real payment processing only after verification
- Ensure PCI compliance and proper payment processing procedures

## Deployment

### Firebase Hosting + Cloud Run

```bash
# Build frontend
npm run build

# Deploy
firebase deploy
```

### Environment Variables for Production

Set in Cloud Run or deployment platform:
- All FIREBASE_* variables
- GEMINI_API_KEY
- Payment provider credentials
- Database credentials

## Troubleshooting

### Common Issues

1. **Firebase authentication fails**
   - Verify Firebase config in .env
   - Check Firebase project settings
   - Ensure authentication is enabled

2. **Videos not loading**
   - Check Firebase Storage bucket permissions
   - Verify Firestore rules allow read access

3. **Revenue calculations incorrect**
   - Verify server-side calculations
   - Check revenue event logs in admin dashboard
   - Review Firebase Firestore data

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

## License

Proprietary - WatchEarn AI

## Compliance

This platform complies with:
- GDPR (where applicable)
- CCPA (where applicable)
- Local payment regulations
- Advertising standards
- Content policies
- Creator rights and protections
