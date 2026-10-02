const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// Middleware
// ===============================
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ===============================
// MongoDB Atlas Connection
// ===============================
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error("❌ MONGO_URI is not set in environment variables.");
} else {
    mongoose.connect(MONGO_URI)
        .then(() => {
            console.log("✅ Connected to MongoDB Atlas successfully!");
        })
        .catch((err) => {
            console.error("❌ MongoDB connection error:", err.message);
        });
}

// ===============================
// User Schema
// ===============================
const UserSchema = new mongoose.Schema({
    telegramId: {
        type: String,
        required: true,
        unique: true
    },

    username: {
        type: String,
        default: ""
    },

    score: {
        type: Number,
        default: 0
    },

    currentTask: {
        type: Number,
        default: 0
    },

    usernameClaimed: {
        type: Boolean,
        default: false
    }
});

const User = mongoose.model('User', UserSchema);

// ===============================
// API: Get or Create User
// ===============================
app.get('/api/user/:telegramId', async (req, res) => {
    try {
        const telegramId = req.params.telegramId;

        let user = await User.findOne({ telegramId });

        if (!user) {
            user = new User({
                telegramId
            });

            await user.save();
        }

        res.json({
            success: true,
            user
        });

    } catch (err) {
        console.error("Get user error:", err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ===============================
// API: Update User Data
// ===============================
app.post('/api/user/update', async (req, res) => {
    try {
        const {
            telegramId,
            score,
            currentTask,
            usernameClaimed,
            username
        } = req.body;

        if (!telegramId) {
            return res.status(400).json({
                success: false,
                error: "Telegram ID is required"
            });
        }

        const updateData = {};

        if (score !== undefined) {
            updateData.score = score;
        }

        if (currentTask !== undefined) {
            updateData.currentTask = currentTask;
        }

        if (usernameClaimed !== undefined) {
            updateData.usernameClaimed = usernameClaimed;
        }

        if (username !== undefined) {
            updateData.username = username;
        }

        const user = await User.findOneAndUpdate(
            { telegramId },
            { $set: updateData },
            {
                new: true,
                upsert: true
            }
        );

        res.json({
            success: true,
            user
        });

    } catch (err) {
        console.error("Update user error:", err);

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ===============================
// Fallback to index.html
// ===============================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ===============================
// Start Server
// ===============================
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
