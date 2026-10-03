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
    process.env.WEB_APP_URL ||
    'https://kokobot-9v3t.onrender.com';

// ===============================
// Middleware
// ===============================
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ===============================
// User Schema
// ===============================
const UserSchema = new mongoose.Schema({

    telegramId: {
        type: String,
        required: true,
        unique: true
    },

    // Telegram username
    username: {
        type: String,
        default: ""
    },

    // KOKO custom username
    // Unique index is created below.
    appUsername: {
        type: String
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

// ===============================
// MongoDB Unique Username Index
// ===============================
// IMPORTANT:
// appUsername index is declared ONLY here.
// This prevents duplicate schema index warning.
UserSchema.index(
    { appUsername: 1 },
    {
        unique: true,
        sparse: true
    }
);

const User = mongoose.model('User', UserSchema);

// ===============================
// MongoDB Atlas Connection
// ===============================
if (!MONGO_URI) {

    console.error(
        "❌ MONGO_URI is not set in environment variables."
    );

} else {

    mongoose.connect(MONGO_URI)
        .then(async () => {

            console.log(
                "✅ Connected to MongoDB Atlas successfully!"
            );

            try {

                await User.init();

                console.log(
                    "✅ MongoDB username unique index is ready!"
                );

            } catch (indexErr) {

                console.error(
                    "❌ MongoDB index error:",
                    indexErr.message
                );
            }

        })
        .catch((err) => {

            console.error(
                "❌ MongoDB connection error:",
                err.message
            );

        });
}

// ===============================
// Username Normalizer
// ===============================
function normalizeAppUsername(username) {

    if (typeof username !== 'string') {
        return '';
    }

    let value = username.trim();

    // Remove @ if user enters @tanim
    if (value.startsWith('@')) {
        value = value.substring(1);
    }

    // Username is case-insensitive
    value = value.toLowerCase();

    return value;
}

// ===============================
// Username Validator
// ===============================
function isValidAppUsername(username) {

    // 3-20 characters
    // letters, numbers and underscore only
    const usernameRegex = /^[a-z0-9_]{3,20}$/;

    return usernameRegex.test(username);
}

// ===============================
// Telegram Message Helper
// ===============================
async function sendTelegramMessage(
    chatId,
    text,
    replyMarkup = null
) {

    if (!BOT_TOKEN) {

        console.error(
            "❌ BOT_TOKEN is not set."
        );

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

        console.log(
            "📩 Telegram update received"
        );

        if (!update || !update.message) {

            console.log(
                "⚠️ Update has no message"
            );

            return res.sendStatus(200);
        }

        const message = update.message;
        const chatId = message.chat.id;
        const telegramUser = message.from;

        const telegramId =
            String(telegramUser.id);

        const username =
            telegramUser.username
                ? `@${telegramUser.username}`
                : "";

        const text =
            message.text || "";

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

            console.log(
                "🚀 /start command detected"
            );

            const parts =
                text.trim().split(/\s+/);

            const startParameter =
                parts.length > 1
                    ? parts[1]
                    : null;

            console.log(
                `🔗 Start Parameter: ${startParameter || "NONE"}`
            );

            // Find current user
            let user =
                await User.findOne({
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

                // Update Telegram username if changed
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

// ======================================================
// API: Get or Create User
// ======================================================
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

// ======================================================
// API: Update User Data
// ======================================================
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

            updateData.currentTask =
                currentTask;
        }

        if (usernameClaimed !== undefined) {

            updateData.usernameClaimed =
                usernameClaimed;
        }

        if (username !== undefined) {

            updateData.username =
                username;
        }

        const user =
            await User.findOneAndUpdate(
                { telegramId },

                {
                    $set: updateData
                },

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

// ======================================================
// USERNAME SYSTEM
// ======================================================

// ======================================================
// API: Check Username Availability
// ======================================================
app.post(
    '/api/username/check',
    async (req, res) => {

        try {

            const {
                telegramId,
                username
            } = req.body;

            if (!telegramId) {

                return res.status(400).json({
                    success: false,
                    available: false,
                    error: "Telegram ID is required"
                });
            }

            const normalizedUsername =
                normalizeAppUsername(username);

            // Empty username
            if (!normalizedUsername) {

                return res.status(400).json({
                    success: false,
                    available: false,
                    error: "Username is required"
                });
            }

            // Validate username
            if (
                !isValidAppUsername(
                    normalizedUsername
                )
            ) {

                return res.status(400).json({
                    success: false,
                    available: false,
                    error:
                        "Username must be 3-20 characters and use only letters, numbers and underscore."
                });
            }

            // Check current user
            const currentUser =
                await User.findOne({
                    telegramId
                });

            if (!currentUser) {

                return res.status(404).json({
                    success: false,
                    available: false,
                    error: "User not found"
                });
            }

            // If current user already owns this username
            if (
                currentUser.appUsername &&
                currentUser.appUsername ===
                normalizedUsername
            ) {

                return res.json({
                    success: true,
                    available: true,
                    alreadyOwned:
                        !!currentUser.usernameClaimed,
                    reserved:
                        !currentUser.usernameClaimed,
                    username:
                        currentUser.appUsername
                });
            }

            // Check MongoDB
            const existingUser =
                await User.findOne({
                    appUsername:
                        normalizedUsername
                });

            if (existingUser) {

                console.log(
                    `❌ Username already taken: ${normalizedUsername}`
                );

                return res.status(409).json({
                    success: false,
                    available: false,
                    error:
                        "Please choose another username"
                });
            }

            console.log(
                `✅ Username available: ${normalizedUsername}`
            );

            return res.json({
                success: true,
                available: true,
                username:
                    normalizedUsername
            });

        } catch (err) {

            console.error(
                "Username check error:",
                err
            );

            return res.status(500).json({
                success: false,
                available: false,
                error:
                    "Server error while checking username"
            });
        }
    }
);

// ======================================================
// API: Username Reserve / Claim
// ======================================================
// FLOW:
//
// action = "reserve"
// ------------------
// Saves/reserves username immediately.
// NO coins are given.
//
// action = "claim"
// ----------------
// Confirms reserved username and gives +100 coins.
//
// Frontend flow:
// Task → Set → Reserve → Ad → Claim → +100 → Done
// ======================================================
app.post(
    '/api/username/claim',
    async (req, res) => {

        try {

            const {
                telegramId,
                username,
                action
            } = req.body;

            // ===============================
            // Basic Validation
            // ===============================
            if (!telegramId) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Telegram ID is required"
                });
            }

            if (!username) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Username is required"
                });
            }

            const normalizedUsername =
                normalizeAppUsername(username);

            if (!normalizedUsername) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Username is required"
                });
            }

            if (
                !isValidAppUsername(
                    normalizedUsername
                )
            ) {

                return res.status(400).json({
                    success: false,
                    error:
                        "Username must be 3-20 characters and use only letters, numbers and underscore."
                });
            }

            // ===============================
            // Find User
            // ===============================
            const user =
                await User.findOne({
                    telegramId:
                        String(telegramId)
                });

            if (!user) {

                return res.status(404).json({
                    success: false,
                    error:
                        "User not found"
                });
            }

            // ==================================================
            // ACTION: RESERVE
            // ==================================================
            if (action === 'reserve') {

                // Already fully claimed
                if (user.usernameClaimed) {

                    return res.status(400).json({
                        success: false,
                        error:
                            "Username already claimed"
                    });
                }

                // User already has a reserved username
                if (
                    user.appUsername &&
                    !user.usernameClaimed
                ) {

                    // Same username
                    if (
                        user.appUsername ===
                        normalizedUsername
                    ) {

                        console.log(
                            `ℹ️ Username already reserved: ${normalizedUsername} by ${telegramId}`
                        );

                        return res.json({
                            success: true,
                            reserved: true,
                            username:
                                user.appUsername,
                            score:
                                user.score
                        });
                    }

                    // User is trying to reserve another username
                    return res.status(409).json({
                        success: false,
                        error:
                            "Please choose another username"
                    });
                }

                // ==================================================
                // ATOMIC RESERVATION
                // ==================================================
                // This prevents two users from reserving
                // the same username at the same time.
                const reservedUser =
                    await User.findOneAndUpdate(

                        {
                            telegramId:
                                String(telegramId),

                            usernameClaimed:
                                false,

                            $or: [
                                {
                                    appUsername: {
                                        $exists: false
                                    }
                                },
                                {
                                    appUsername: null
                                },
                                {
                                    appUsername: ''
                                }
                            ]
                        },

                        {
                            $set: {
                                appUsername:
                                    normalizedUsername
                            }
                        },

                        {
                            new: true
                        }
                    );

                // Reservation failed
                if (!reservedUser) {

                    return res.status(409).json({
                        success: false,
                        error:
                            "Please choose another username"
                    });
                }

                console.log(
                    `🔒 Username reserved: ${normalizedUsername} by ${telegramId}`
                );

                // IMPORTANT:
                // No coins here.
                return res.json({

                    success: true,

                    reserved: true,

                    username:
                        reservedUser.appUsername,

                    usernameClaimed:
                        reservedUser.usernameClaimed,

                    score:
                        reservedUser.score
                });
            }

            // ==================================================
            // ACTION: CLAIM
            // ==================================================
            if (action === 'claim') {

                // Already claimed
                if (user.usernameClaimed) {

                    if (
                        user.appUsername ===
                        normalizedUsername
                    ) {

                        return res.json({
                            success: true,
                            alreadyClaimed: true,
                            username:
                                user.appUsername,
                            usernameClaimed:
                                true,
                            score:
                                user.score
                        });
                    }

                    return res.status(409).json({
                        success: false,
                        error:
                            "Username has already been claimed"
                    });
                }

                // ==================================================
                // Verify that this username belongs to this user
                // ==================================================
                if (
                    !user.appUsername ||
                    user.appUsername !==
                    normalizedUsername
                ) {

                    return res.status(409).json({
                        success: false,
                        error:
                            "Username reservation not found"
                    });
                }

                // ==================================================
                // ATOMIC CLAIM + REWARD
                // ==================================================
                const claimedUser =
                    await User.findOneAndUpdate(

                        {
                            telegramId:
                                String(telegramId),

                            appUsername:
                                normalizedUsername,

                            usernameClaimed:
                                false
                        },

                        {
                            $set: {
                                usernameClaimed:
                                    true
                            },

                            $inc: {
                                score: 100
                            }
                        },

                        {
                            new: true
                        }
                    );

                if (!claimedUser) {

                    return res.status(409).json({
                        success: false,
                        error:
                            "Unable to claim username"
                    });
                }

                console.log(
                    `✅ Username claimed: ${normalizedUsername} by ${telegramId}`
                );

                console.log(
                    `🪙 +100 coins awarded to ${telegramId}`
                );

                return res.json({

                    success: true,

                    username:
                        claimedUser.appUsername,

                    usernameClaimed:
                        claimedUser.usernameClaimed,

                    score:
                        claimedUser.score
                });
            }

            // ==================================================
            // Invalid Action
            // ==================================================
            return res.status(400).json({
                success: false,
                error:
                    "Invalid action"
            });

        } catch (err) {

            // MongoDB duplicate key error
            if (
                err &&
                err.code === 11000
            ) {

                console.log(
                    `❌ Duplicate username blocked by MongoDB: ${req.body.username}`
                );

                return res.status(409).json({
                    success: false,
                    error:
                        "Please choose another username"
                });
            }

            console.error(
                "Username reserve/claim error:",
                err
            );

            return res.status(500).json({
                success: false,
                error:
                    "Server error"
            });
        }
    }
);

// ======================================================
// API: Get Referral Data
// ======================================================
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
                    error:
                        "User not found"
                });
            }

            const referralLink =
                `https://t.me/koko_mini_bot?start=${telegramId}`;

            return res.json({

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

            return res.status(500).json({
                success: false,
                error: err.message
            });
        }
    }
);

// ======================================================
// Telegram Webhook Setup
// ======================================================
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

// ======================================================
// Fallback to index.html
// ======================================================
app.get('*', (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            'index.html'
        )
    );
});

// ======================================================
// Start Server
// ======================================================
app.listen(PORT, async () => {

    console.log(
        `🚀 Server is running on port ${PORT}`
    );

    await setupTelegramWebhook();
});
