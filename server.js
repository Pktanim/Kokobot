const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// Environment Variables
// ===============================
const MONGO_URI = process.env.MONGO_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL =
    process.env.WEB_APP_URL || 'https://kokobot-9v3t.onrender.com';

// ===============================
// Middleware
// ===============================
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ===============================
// MongoDB Atlas Connection
// ===============================
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
    },

    // Referral System
    referredBy: {
        type: String,
        default: null
    },

    referralCount: {
        type: Number,
        default: 0
    }
});

const User = mongoose.model('User', UserSchema);

// ===============================
// Telegram Message Helper
// ===============================
async function sendTelegramMessage(
    chatId,
    text,
    replyMarkup = null
) {
    if (!BOT_TOKEN) {
        console.error("❌ BOT_TOKEN is not set.");
        return;
    }

    try {
        const response = await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                })
            }
        );

        const data = await response.json();

        if (!data.ok) {
            console.error(
                "❌ Telegram API error:",
                data.description
            );
        }
    } catch (err) {
        console.error(
            "❌ Telegram request error:",
            err.message
        );
    }
}

// ===============================
// Telegram Webhook
// ===============================
app.post('/telegram/webhook', async (req, res) => {
    try {
        const update = req.body;

        console.log("📩 Telegram update received");

        if (!update || !update.message) {
            console.log("⚠️ Update has no message");
            return res.sendStatus(200);
        }

        const message = update.message;
        const chatId = message.chat.id;
        const telegramUser = message.from;

        const telegramId = String(telegramUser.id);

        const username = telegramUser.username
            ? `@${telegramUser.username}`
            : "";

        const text = message.text || "";

        console.log(
            `👤 Telegram User: ${telegramId}`
        );

        console.log(
            `💬 Message: ${text}`
        );

        // ===============================
        // /start Handler
        // ===============================
        if (text.startsWith('/start')) {

            console.log("🚀 /start command detected");

            const parts = text.trim().split(/\s+/);

            const startParameter =
                parts.length > 1
                    ? parts[1]
                    : null;

            console.log(
                `🔗 Start Parameter: ${startParameter || "NONE"}`
            );

            // Find current user
            let user = await User.findOne({
                telegramId
            });

            // ===============================
            // NEW USER
            // ===============================
            if (!user) {

                console.log(
                    `🆕 New user detected: ${telegramId}`
                );

                user = new User({
                    telegramId,
                    username
                });

                // ===============================
                // REFERRAL CHECK
                // ===============================
                if (startParameter) {

                    console.log(
                        `🔍 Checking referrer: ${startParameter}`
                    );

                    // Prevent self referral
                    if (startParameter === telegramId) {

                        console.log(
                            "⚠️ Self referral blocked"
                        );

                    } else {

                        const referrer =
                            await User.findOne({
                                telegramId:
                                    startParameter
                            });

                        if (referrer) {

                            user.referredBy =
                                referrer.telegramId;

                            await User.updateOne(
                                {
                                    telegramId:
                                        referrer.telegramId
                                },
                                {
                                    $inc: {
                                        referralCount: 1
                                    }
                                }
                            );

                            console.log(
                                `✅ Referral added: ${referrer.telegramId} → ${telegramId}`
                            );

                        } else {

                            console.log(
                                `⚠️ Referrer not found in MongoDB: ${startParameter}`
                            );
                        }
                    }
                }

                // Save new user
                await user.save();

                console.log(
                    `💾 New user saved: ${telegramId}`
                );

            } else {

                // ===============================
                // EXISTING USER
                // ===============================

                console.log(
                    `👤 Existing user: ${telegramId}`
                );

                // Update username if changed
                if (
                    username &&
                    user.username !== username
                ) {
                    user.username = username;
                    await user.save();
                }

                console.log(
                    "ℹ️ Existing user referral count will NOT increase."
                );
            }

            // ===============================
            // OPEN KOKO BUTTON
            // ===============================
            const replyMarkup = {
                inline_keyboard: [
                    [
                        {
                            text: "🎮 Open KOKO",
                            web_app: {
                                url: WEB_APP_URL
                            }
                        }
                    ]
                ]
            };

            await sendTelegramMessage(
                chatId,
                `👋 <b>Welcome to KOKO!</b>\n\n🎮 Play Memory Match\n🪙 Complete tasks and earn coins\n👥 Invite friends and grow your referrals!`,
                replyMarkup
            );

            return res.sendStatus(200);
        }

        // Ignore other messages
        res.sendStatus(200);

    } catch (err) {

        console.error(
            "❌ Telegram webhook error:",
            err
        );

        // Always return 200 to Telegram
        res.sendStatus(200);
    }
});

// ===============================
// API: Get or Create User
// ===============================
app.get('/api/user/:telegramId', async (req, res) => {
    try {

        const telegramId =
            req.params.telegramId;

        let user =
            await User.findOne({
                telegramId
            });

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

        console.error(
            "Get user error:",
            err
        );

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
            updateData.usernameClaimed =
                usernameClaimed;
        }

        if (username !== undefined) {
            updateData.username = username;
        }

        const user =
            await User.findOneAndUpdate(
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

        console.error(
            "Update user error:",
            err
        );

        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ===============================
// API: Get Referral Data
// ===============================
app.get(
    '/api/referral/:telegramId',
    async (req, res) => {

        try {

            const telegramId =
                req.params.telegramId;

            const user =
                await User.findOne({
                    telegramId
                });

            if (!user) {

                return res.status(404).json({
                    success: false,
                    error: "User not found"
                });
            }

            const referralLink =
                `https://t.me/koko_mini_bot?start=${telegramId}`;

            res.json({
                success: true,
                referralLink,
                referralCount:
                    user.referralCount || 0,
                referredBy:
                    user.referredBy || null
            });

        } catch (err) {

            console.error(
                "Referral error:",
                err
            );

            res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }
);

// ===============================
// Telegram Webhook Setup
// ===============================
async function setupTelegramWebhook() {

    if (!BOT_TOKEN) {

        console.log(
            "⚠️ BOT_TOKEN not set. Telegram bot webhook not configured."
        );

        return;
    }

    try {

        const webhookUrl =
            `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'kokobot-9v3t.onrender.com'}/telegram/webhook`;

        const response =
            await fetch(
                `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/json'
                    },
                    body: JSON.stringify({
                        url: webhookUrl
                    })
                }
            );

        const data =
            await response.json();

        if (data.ok) {

            console.log(
                "✅ Telegram webhook connected successfully!"
            );

            console.log(
                `🔗 Webhook: ${webhookUrl}`
            );

        } else {

            console.error(
                "❌ Telegram webhook error:",
                data.description
            );
        }

    } catch (err) {

        console.error(
            "❌ Webhook setup error:",
            err.message
        );
    }
}

// ===============================
// Fallback to index.html
// ===============================
app.get('*', (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            'index.html'
        )
    );
});

// ===============================
// Start Server
// ===============================
app.listen(PORT, async () => {

    console.log(
        `🚀 Server is running on port ${PORT}`
    );

    await setupTelegramWebhook();
});
