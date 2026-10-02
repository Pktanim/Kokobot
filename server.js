const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// MongoDB Atlas Connection
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Connected to MongoDB Atlas successfully!");
}).catch((err) => {
    console.error("MongoDB connection error:", err);
});

// User Schema & Model
const UserSchema = new mongoose.Schema({
    telegramId: { type: String, required: true, unique: true },
    username: { type: String, default: "" },
    score: { type: Number, default: 0 },
    currentTask: { type: Number, default: 0 },
    referralCount: { type: Number, default: 0 },
    usernameClaimed: { type: Boolean, default: false },
    refClaimed: { type: Boolean, default: false }
});
const User = mongoose.model('User', UserSchema);

// API: Get or Create User Data (with Referral Support)
app.get('/api/user/:telegramId', async (req, res) => {
    try {
        const telegramId = req.params.telegramId;
        const referrerId = req.query.ref; // ইউআরএল থেকে রেফারার আইডি ধরবে (যেমন: ?ref=12345)

        let user = await User.findOne({ telegramId });
        
        if (!user) {
            // নতুন ইউজার তৈরি করা হচ্ছে
            user = new User({ telegramId });
            await user.save();

            // যদি রেফারার আইডি থাকে এবং তা নিজের আইডি না হয়, তবে যার লিংক সেটার রেফারেল কাউন্ট বাড়াবে
            if (referrerId && referrerId !== telegramId) {
                await User.findOneAndUpdate(
                    { telegramId: referrerId },
                    { $inc: { referralCount: 1 } }
                );
            }
        }

        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: Direct Referral Increment Route
app.post('/api/user/referral/:referrerId', async (req, res) => {
    try {
        const referrerId = req.params.referrerId;
        await User.findOneAndUpdate(
            { telegramId: referrerId },
            { $inc: { referralCount: 1 } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API: Update User Data
app.post('/api/user/update', async (req, res) => {
    try {
        const { telegramId, score, currentTask, referralCount, usernameClaimed, refClaimed, username } = req.body;
        if (!telegramId) {
            return res.status(400).json({ success: false, error: "Telegram ID is required" });
        }
        let user = await User.findOneAndUpdate(
            { telegramId },
            { score, currentTask, referralCount, usernameClaimed, refClaimed, username },
            { new: true, upsert: true }
        );
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Fallback to index.html for frontend routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
