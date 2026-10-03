const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 10000;

const BOT_TOKEN = process.env.BOT_TOKEN;

const MONGO_URI = process.env.MONGO_URI;

const WEB_APP_URL =
    process.env.WEB_APP_URL ||
    "https://kokobot-9v3t.onrender.com";


// =====================================================
// BASIC MIDDLEWARE
// =====================================================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(
    express.static(
        path.join(__dirname)
    )
);


// =====================================================
// MONGODB USER SCHEMA
// =====================================================

const UserSchema = new mongoose.Schema(
    {
        telegramId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        username: {
            type: String,
            default: ""
        },

        appUsername: {
            type: String,
            default: undefined
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

        referredBy: {
            type: String,
            default: ""
        },

        referralCount: {
            type: Number,
            default: 0
        },


        // =============================================
        // DAILY CHECK-IN
        // =============================================

        dailyCheckInDate: {
            type: String,
            default: ""
        },

        dailyCheckInPending: {
            type: Boolean,
            default: false
        },

        dailyCheckInPendingDate: {
            type: String,
            default: ""
        },

        // Old field kept
        dailyCheckinClaimedAt: {
            type: Date,
            default: null
        }
    },

    {
        timestamps: true
    }
);


// =====================================================
// UNIQUE APP USERNAME
// =====================================================

UserSchema.index(
    {
        appUsername: 1
    },
    {
        unique: true,
        sparse: true
    }
);


const User =
    mongoose.model(
        "User",
        UserSchema
    );


// =====================================================
// HELPER FUNCTIONS
// =====================================================

function normalizeTelegramId(value) {

    return String(
        value || ""
    ).trim();

}


function normalizeAppUsername(username) {

    return String(
        username || ""
    )
        .trim()
        .replace(/^@/, "")
        .toLowerCase();

}


function isValidAppUsername(username) {

    return /^[a-z0-9_]{3,20}$/.test(
        username
    );

}


// =====================================================
// BANGLADESH DATE
// =====================================================

function getBangladeshDate() {

    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Asia/Dhaka",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(
        new Date()
    );

}


// =====================================================
// TELEGRAM API HELPER
// =====================================================

async function telegramRequest(
    method,
    body = {}
) {

    if (!BOT_TOKEN) {

        throw new Error(
            "BOT_TOKEN is missing"
        );

    }


    const response =
        await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(body)
            }
        );


    return response.json();

}


async function sendTelegramMessage(
    chatId,
    text,
    extra = {}
) {

    return telegramRequest(
        "sendMessage",
        {
            chat_id: chatId,
            text,
            ...extra
        }
    );

}


// =====================================================
// HOME / FRONTEND
// =====================================================

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );

    }
);


// =====================================================
// USER API
// =====================================================

app.get(
    "/api/user/:telegramId",
    async (req, res) => {

        try {

            const telegramId =
                normalizeTelegramId(
                    req.params.telegramId
                );


            if (!telegramId) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Telegram ID is required."

                });

            }


            const user =
                await User.findOne({
                    telegramId
                });


            if (!user) {

                return res.status(404).json({

                    success: false,

                    error:
                        "User not found."

                });

            }


            const today =
                getBangladeshDate();


            const claimedToday =
                user.dailyCheckInDate ===
                today;


            const pendingToday =
                user.dailyCheckInPending === true &&
                user.dailyCheckInPendingDate ===
                today;


            res.json({

                success: true,

                user: {

                    telegramId:
                        user.telegramId,

                    username:
                        user.username,

                    appUsername:
                        user.appUsername || "",

                    score:
                        user.score,

                    currentTask:
                        user.currentTask,

                    usernameClaimed:
                        !!user.usernameClaimed,

                    referredBy:
                        user.referredBy || "",

                    referralCount:
                        user.referralCount || 0

                },


                dailyCheckin: {

                    claimedToday,

                    pending:
                        pendingToday,

                    claimedAt:
                        user.dailyCheckinClaimedAt ||
                        null

                }

            });

        }

        catch (error) {

            console.error(
                "GET USER ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                error:
                    "Server error."

            });

        }

    }
);


// =====================================================
// UPDATE USER
// =====================================================

app.post(
    "/api/user/update",
    async (req, res) => {

        try {

            const {
                telegramId,
                username,
                score,
                currentTask
            } = req.body;


            const id =
                normalizeTelegramId(
                    telegramId
                );


            if (!id) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Telegram ID is required."

                });

            }


            const update = {};


            if (
                typeof username ===
                "string"
            ) {

                update.username =
                    username;

            }


            if (
                typeof score ===
                "number" &&
                Number.isFinite(score)
            ) {

                update.score =
                    score;

            }


            if (
                typeof currentTask ===
                "number" &&
                Number.isFinite(
                    currentTask
                )
            ) {

                update.currentTask =
                    currentTask;

            }


            const user =
                await User.findOneAndUpdate(

                    {
                        telegramId:
                            id
                    },

                    {
                        $set:
                            update
                    },

                    {
                        new: true,

                        upsert: true,

                        setDefaultsOnInsert:
                            true
                    }

                );


            res.json({

                success: true,

                score:
                    user.score,

                currentTask:
                    user.currentTask

            });

        }

        catch (error) {

            console.error(
                "UPDATE USER ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                error:
                    "Unable to update user."

            });

        }

    }
);


// =====================================================
// USERNAME CHECK
// =====================================================

app.post(
    "/api/username/check",
    async (req, res) => {

        try {

            const username =
                normalizeAppUsername(
                    req.body.username
                );


            if (
                !isValidAppUsername(
                    username
                )
            ) {

                return res.status(400).json({

                    success: false,

                    available: false,

                    error:
                        "Username must be 3-20 characters and use only letters, numbers, or underscore."

                });

            }


            const existingUser =
                await User.findOne({
                    appUsername:
                        username
                });


            if (existingUser) {

                return res.json({

                    success: true,

                    available: false,

                    error:
                        "Please choose another username"

                });

            }


            return res.json({

                success: true,

                available: true,

                username

            });

        }

        catch (error) {

            console.error(
                "USERNAME CHECK ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                available: false,

                error:
                    "Unable to check username."

            });

        }

    }
);


// =====================================================
// USERNAME CLAIM / RESERVE
// =====================================================

app.post(
    "/api/username/claim",
    async (req, res) => {

        try {

            const {
                telegramId,
                username,
                action
            } = req.body;


            const id =
                normalizeTelegramId(
                    telegramId
                );


            const normalizedUsername =
                normalizeAppUsername(
                    username
                );


            if (!id) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Telegram ID is required."

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
                        "Invalid username."

                });

            }


            // =========================================
            // RESERVE USERNAME
            // =========================================

            if (
                action === "reserve"
            ) {

                const user =
                    await User.findOne({
                        telegramId:
                            id
                    });


                if (!user) {

                    return res.status(404).json({

                        success: false,

                        error:
                            "User not found."

                    });

                }


                if (
                    user.appUsername &&
                    user.appUsername !==
                    normalizedUsername
                ) {

                    return res.status(400).json({

                        success: false,

                        error:
                            "Username is already reserved."

                    });

                }


                if (
                    user.appUsername ===
                    normalizedUsername
                ) {

                    return res.json({

                        success: true,

                        reserved: true,

                        username:
                            normalizedUsername,

                        usernameClaimed:
                            !!user.usernameClaimed

                    });

                }


                try {

                    const reservedUser =
                        await User.findOneAndUpdate(

                            {
                                telegramId:
                                    id,

                                $or: [

                                    {
                                        appUsername:
                                            {
                                                $exists:
                                                    false
                                            }
                                    },

                                    {
                                        appUsername:
                                            null
                                    },

                                    {
                                        appUsername:
                                            ""
                                    }

                                ]
                            },

                            {
                                $set: {

                                    appUsername:
                                        normalizedUsername,

                                    usernameClaimed:
                                        false

                                }
                            },

                            {
                                new: true
                            }

                        );


                    if (!reservedUser) {

                        return res.status(409).json({

                            success: false,

                            error:
                                "Please choose another username"

                        });

                    }


                    return res.json({

                        success: true,

                        reserved: true,

                        username:
                            reservedUser.appUsername,

                        usernameClaimed:
                            !!reservedUser.usernameClaimed

                    });

                }

                catch (error) {

                    if (
                        error &&
                        error.code ===
                        11000
                    ) {

                        return res.status(409).json({

                            success: false,

                            error:
                                "Please choose another username"

                        });

                    }

                    throw error;

                }

            }


            // =========================================
            // CLAIM +100 COINS
            // =========================================

            if (
                action === "claim"
            ) {

                const user =
                    await User.findOneAndUpdate(

                        {
                            telegramId:
                                id,

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

                                score:
                                    100

                            }
                        },

                        {
                            new: true
                        }

                    );


                if (!user) {

                    return res.status(400).json({

                        success: false,

                        error:
                            "Username task is not ready to claim."

                    });

                }


                return res.json({

                    success: true,

                    claimed: true,

                    username:
                        user.appUsername,

                    score:
                        user.score

                });

            }


            return res.status(400).json({

                success: false,

                error:
                    "Invalid action."

            });

        }

        catch (error) {

            console.error(
                "USERNAME CLAIM ERROR:",
                error
            );


            if (
                error &&
                error.code ===
                11000
            ) {

                return res.status(409).json({

                    success: false,

                    error:
                        "Please choose another username"

                });

            }


            res.status(500).json({

                success: false,

                error:
                    "Unable to process username task."

            });

        }

    }
);


// =====================================================
// REFERRAL API
// =====================================================

app.get(
    "/api/referral/:telegramId",
    async (req, res) => {

        try {

            const telegramId =
                normalizeTelegramId(
                    req.params.telegramId
                );


            const user =
                await User.findOne({
                    telegramId
                });


            if (!user) {

                return res.status(404).json({

                    success: false,

                    error:
                        "User not found."

                });

            }


            res.json({

                success: true,

                referralCount:
                    user.referralCount || 0,

                referredBy:
                    user.referredBy || ""

            });

        }

        catch (error) {

            console.error(
                "REFERRAL ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                error:
                    "Unable to load referral data."

            });

        }

    }
);


// =====================================================
// DAILY CHECK-IN STATUS
// =====================================================

app.get(
    "/api/daily-check-in/:telegramId",
    async (req, res) => {

        try {

            const telegramId =
                normalizeTelegramId(
                    req.params.telegramId
                );


            if (!telegramId) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Telegram ID is required."

                });

            }


            const user =
                await User.findOne({
                    telegramId
                });


            if (!user) {

                return res.status(404).json({

                    success: false,

                    error:
                        "User not found."

                });

            }


            const today =
                getBangladeshDate();


            if (
                user.dailyCheckInPending &&
                user.dailyCheckInPendingDate !==
                today
            ) {

                user.dailyCheckInPending =
                    false;

                user.dailyCheckInPendingDate =
                    "";

                await user.save();

            }


            const claimedToday =
                user.dailyCheckInDate ===
                today;


            const pending =
                user.dailyCheckInPending === true &&
                user.dailyCheckInPendingDate ===
                today;


            return res.json({

                success: true,

                claimedToday,

                pending,

                claimedAt:
                    user.dailyCheckinClaimedAt ||
                    null,

                score:
                    user.score

            });

        }

        catch (error) {

            console.error(
                "DAILY CHECK-IN STATUS ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                error:
                    "Unable to load Daily Check-in status."

            });

        }

    }
);


// =====================================================
// DAILY CHECK-IN START
// =====================================================

app.post(
    "/api/daily-check-in/start",
    async (req, res) => {

        try {

            const telegramId =
                normalizeTelegramId(
                    req.body.telegramId
                );


            if (!telegramId) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Telegram ID is required."

                });

            }


            const today =
                getBangladeshDate();


            const user =
                await User.findOne({
                    telegramId
                });


            if (!user) {

                return res.status(404).json({

                    success: false,

                    error:
                        "User not found."

                });

            }


            if (
                user.dailyCheckInDate ===
                today
            ) {

                return res.status(409).json({

                    success: false,

                    claimedToday: true,

                    error:
                        "Daily Check-in already completed today."

                });

            }


            if (
                user.dailyCheckInPending &&
                user.dailyCheckInPendingDate !==
                today
            ) {

                user.dailyCheckInPending =
                    false;

                user.dailyCheckInPendingDate =
                    "";

            }


            if (
                user.dailyCheckInPending &&
                user.dailyCheckInPendingDate ===
                today
            ) {

                await user.save();

                return res.json({

                    success: true,

                    pending: true,

                    claimedToday: false

                });

            }


            user.dailyCheckInPending =
                true;

            user.dailyCheckInPendingDate =
                today;


            await user.save();


            return res.json({

                success: true,

                pending: true,

                claimedToday: false

            });

        }

        catch (error) {

            console.error(
                "DAILY CHECK-IN START ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                error:
                    "Unable to start Daily Check-in."

            });

        }

    }
);


// =====================================================
// DAILY CHECK-IN CLAIM
// =====================================================

app.post(
    "/api/daily-check-in/claim",
    async (req, res) => {

        try {

            const telegramId =
                normalizeTelegramId(
                    req.body.telegramId
                );


            if (!telegramId) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Telegram ID is required."

                });

            }


            const today =
                getBangladeshDate();


            const user =
                await User.findOneAndUpdate(

                    {
                        telegramId,

                        dailyCheckInPending:
                            true,

                        dailyCheckInPendingDate:
                            today,

                        $or: [

                            {
                                dailyCheckInDate:
                                    {
                                        $exists:
                                            false
                                    }
                            },

                            {
                                dailyCheckInDate:
                                    ""
                            },

                            {
                                dailyCheckInDate:
                                    {
                                        $ne:
                                            today
                                    }
                            }

                        ]
                    },

                    {
                        $set: {

                            dailyCheckInDate:
                                today,

                            dailyCheckInPending:
                                false,

                            dailyCheckInPendingDate:
                                "",

                            dailyCheckinClaimedAt:
                                new Date()

                        },

                        $inc: {

                            score:
                                100

                        }

                    },

                    {
                        new: true
                    }

                );


            if (!user) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Daily Check-in is not ready to claim."

                });

            }


            return res.json({

                success: true,

                claimed: true,

                score:
                    user.score,

                claimedToday: true

            });

        }

        catch (error) {

            console.error(
                "DAILY CHECK-IN CLAIM ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                error:
                    "Unable to claim Daily Check-in."

            });

        }

    }
);


// =====================================================
// COMPATIBILITY DAILY CHECK-IN ROUTES
// =====================================================

app.get(
    "/api/daily-checkin/:telegramId",
    async (req, res) => {

        try {

            const telegramId =
                normalizeTelegramId(
                    req.params.telegramId
                );


            const user =
                await User.findOne({
                    telegramId
                });


            if (!user) {

                return res.status(404).json({

                    success: false,

                    error:
                        "User not found."

                });

            }


            const today =
                getBangladeshDate();


            if (
                user.dailyCheckInPending &&
                user.dailyCheckInPendingDate !==
                today
            ) {

                user.dailyCheckInPending =
                    false;

                user.dailyCheckInPendingDate =
                    "";

                await user.save();

            }


            res.json({

                success: true,

                claimedToday:
                    user.dailyCheckInDate ===
                    today,

                pending:
                    user.dailyCheckInPending ===
                    true &&
                    user.dailyCheckInPendingDate ===
                    today,

                claimedAt:
                    user.dailyCheckinClaimedAt ||
                    null,

                score:
                    user.score

            });

        }

        catch (error) {

            console.error(
                "DAILY CHECK-IN COMPAT STATUS ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                error:
                    "Server error."

            });

        }

    }
);


app.post(
    "/api/daily-checkin/start",
    async (req, res) => {

        try {

            const telegramId =
                normalizeTelegramId(
                    req.body.telegramId
                );


            const today =
                getBangladeshDate();


            const user =
                await User.findOne({
                    telegramId
                });


            if (!user) {

                return res.status(404).json({

                    success: false,

                    error:
                        "User not found."

                });

            }


            if (
                user.dailyCheckInDate ===
                today
            ) {

                return res.status(409).json({

                    success: false,

                    claimedToday: true,

                    error:
                        "Daily Check-in already completed today."

                });

            }


            if (
                user.dailyCheckInPending &&
                user.dailyCheckInPendingDate ===
                today
            ) {

                return res.json({

                    success: true,

                    pending: true

                });

            }


            user.dailyCheckInPending =
                true;

            user.dailyCheckInPendingDate =
                today;


            await user.save();


            res.json({

                success: true,

                pending: true

            });

        }

        catch (error) {

            console.error(
                "COMPAT DAILY START ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                error:
                    "Unable to start Daily Check-in."

            });

        }

    }
);


app.post(
    "/api/daily-checkin/claim",
    async (req, res) => {

        try {

            const telegramId =
                normalizeTelegramId(
                    req.body.telegramId
                );


            const today =
                getBangladeshDate();


            const user =
                await User.findOneAndUpdate(

                    {
                        telegramId,

                        dailyCheckInPending:
                            true,

                        dailyCheckInPendingDate:
                            today,

                        $or: [

                            {
                                dailyCheckInDate:
                                    {
                                        $exists:
                                            false
                                    }
                            },

                            {
                                dailyCheckInDate:
                                    ""
                            },

                            {
                                dailyCheckInDate:
                                    {
                                        $ne:
                                            today
                                    }
                            }

                        ]
                    },

                    {
                        $set: {

                            dailyCheckInDate:
                                today,

                            dailyCheckInPending:
                                false,

                            dailyCheckInPendingDate:
                                "",

                            dailyCheckinClaimedAt:
                                new Date()

                        },

                        $inc: {

                            score:
                                100

                        }

                    },

                    {
                        new: true
                    }

                );


            if (!user) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Daily Check-in is not ready to claim."

                });

            }


            res.json({

                success: true,

                claimed: true,

                score:
                    user.score,

                claimedToday: true

            });

        }

        catch (error) {

            console.error(
                "COMPAT DAILY CLAIM ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                error:
                    "Unable to claim Daily Check-in."

            });

        }

    }
);


// =====================================================
// TELEGRAM WEBHOOK
// =====================================================

app.post(
    "/telegram/webhook",
    async (req, res) => {

        try {

            const update =
                req.body;


            if (
                !update ||
                !update.message
            ) {

                return res.sendStatus(
                    200
                );

            }


            const message =
                update.message;


            if (!message.from) {

                return res.sendStatus(
                    200
                );

            }


            const telegramId =
                String(
                    message.from.id
                );


            const telegramUsername =
                message.from.username ||
                "";


            const text =
                typeof message.text ===
                "string"
                    ? message.text.trim()
                    : "";


            // =========================================
            // START COMMAND
            // =========================================

            if (
                text === "/start" ||
                text.startsWith("/start ")
            ) {

                const parts =
                    text.split(
                        /\s+/
                    );


                const startParameter =
                    parts.length > 1
                        ? parts[1]
                        : "";


                let user =
                    await User.findOne({
                        telegramId
                    });


                // =====================================
                // NEW USER
                // =====================================

                if (!user) {

                    let referredBy = "";


                    if (
                        startParameter &&
                        startParameter.startsWith(
                            "ref_"
                        )
                    ) {

                        referredBy =
                            startParameter
                                .replace(
                                    "ref_",
                                    ""
                                )
                                .trim();

                    }


                    // Prevent self referral
                    if (
                        referredBy &&
                        referredBy ===
                            telegramId
                    ) {

                        referredBy = "";

                    }


                    user =
                        await User.create({

                            telegramId,

                            username:
                                telegramUsername,

                            referredBy

                        });


                    // Increment referrer
                    if (referredBy) {

                        await User.findOneAndUpdate(

                            {
                                telegramId:
                                    referredBy
                            },

                            {
                                $inc: {

                                    referralCount:
                                        1

                                }
                            }

                        );

                    }

                }

                else {

                    if (
                        telegramUsername &&
                        user.username !==
                            telegramUsername
                    ) {

                        user.username =
                            telegramUsername;

                        await user.save();

                    }

                }


                // =====================================
                // OPEN MINI APP
                // =====================================

                const keyboard = {

                    inline_keyboard: [

                        [

                            {

                                text:
                                    "🎮 Open KOKO",

                                web_app: {

                                    url:
                                        WEB_APP_URL

                                }

                            }

                        ]

                    ]

                };


                await sendTelegramMessage(

                    telegramId,

                    "Welcome to KOKO! 🎮\n\nTap the button below to open the Mini App.",

                    {
                        reply_markup:
                            keyboard
                    }

                );

            }


            return res.sendStatus(
                200
            );

        }

        catch (error) {

            console.error(
                "TELEGRAM WEBHOOK ERROR:",
                error
            );


            return res.sendStatus(
                200
            );

        }

    }
);


// =====================================================
// WEBHOOK SETUP
// =====================================================

app.get(
    "/set-webhook",
    async (req, res) => {

        try {

            if (!BOT_TOKEN) {

                return res.status(500).json({

                    success: false,

                    error:
                        "BOT_TOKEN is missing."

                });

            }


            const webhookUrl =
                `${WEB_APP_URL}/telegram/webhook`;


            const result =
                await telegramRequest(

                    "setWebhook",

                    {
                        url:
                            webhookUrl
                    }

                );


            res.json({

                success: true,

                webhookUrl,

                telegram:
                    result

            });

        }

        catch (error) {

            console.error(
                "WEBHOOK SET ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// WEBHOOK INFO
// =====================================================

app.get(
    "/webhook-info",
    async (req, res) => {

        try {

            const result =
                await telegramRequest(
                    "getWebhookInfo"
                );


            res.json(
                result
            );

        }

        catch (error) {

            console.error(
                "WEBHOOK INFO ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
    "/health",
    (req, res) => {

        res.json({

            success: true,

            status:
                "KOKO server is running",

            time:
                new Date().toISOString()

        });

    }
);


// =====================================================
// FALLBACK FOR MINI APP
// =====================================================

app.get(
    "*",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );

    }
);


// =====================================================
// MONGODB CONNECTION + SERVER START
// =====================================================

async function startServer() {

    try {

        if (!MONGO_URI) {

            throw new Error(
                "MONGO_URI environment variable is missing."
            );

        }


        await mongoose.connect(
            MONGO_URI
        );


        console.log(
            "✅ MongoDB connected successfully."
        );


        await User.init();


        console.log(
            "✅ MongoDB indexes initialized."
        );


        app.listen(
            PORT,
            () => {

                console.log(
                    `🚀 KOKO server running on port ${PORT}`
                );


                console.log(
                    `🌐 Web App: ${WEB_APP_URL}`
                );


                console.log(
                    "🇧🇩 Daily Check-in timezone: Asia/Dhaka"
                );

            }
        );

    }

    catch (error) {

        console.error(
            "❌ SERVER START ERROR:",
            error
        );


        process.exit(
            1
        );

    }

}


startServer();
