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

// API: Get or Create User Data
app.get('/api/user/:telegramId', async (req, res) => {
    try {
        const telegramId = req.params.telegramId;
        let user = await User.findOne({ telegramId });
        if (!user) {
            user = new User({ telegramId });
            await user.save();
        }
        res.json({ success: true, user });
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

// Sample API Route
app.get('/api/status', (req, res) => {
    res.json({ status: "success", message: "Kokobot Backend is running with full database features!" });
});

// Fallback to index.html for frontend routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
