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


/* =====================================================
   KOKO SETTINGS
===================================================== */

const BOT_USERNAME = "koko_mini_bot";

/*
 * Telegram channel
 *
 * KOKO Bot must be ADMIN of this channel
 * so Telegram Bot API can check membership.
 */
const CHANNEL_USERNAME = "@tripsgame";

const CHANNEL_REWARD = 100;

const DAILY_REWARD = 100;

const USERNAME_REWARD = 100;


/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended:true
    })
);

app.use(
    express.static(
        path.join(
            __dirname
        )
    )
);


/* =====================================================
   MONGODB
===================================================== */

mongoose
    .connect(
        MONGO_URI
    )
    .then(
        () => {
            console.log(
                "MongoDB connected successfully."
            );
        }
    )
    .catch(
        error => {
            console.error(
                "MongoDB connection error:",
                error
            );
        }
    );


/* =====================================================
   USER SCHEMA
===================================================== */

const UserSchema =
    new mongoose.Schema(

        {

            telegramId:{
                type:String,
                required:true,
                unique:true,
                index:true
            },

            username:{
                type:String,
                default:""
            },

            appUsername:{
                type:String,
                default:"",
                unique:true,
                sparse:true,
                index:true
            },

            score:{
                type:Number,
                default:0
            },

            currentTask:{
                type:Number,
                default:0
            },

            usernameClaimed:{
                type:Boolean,
                default:false
            },

            referredBy:{
                type:String,
                default:""
            },

            referralCount:{
                type:Number,
                default:0
            },


            /* DAILY CHECK-IN */

            dailyCheckinDate:{
                type:String,
                default:""
            },

            dailyCheckinPending:{
                type:Boolean,
                default:false
            },


            /* CHANNEL TASK */

            channelTaskClaimed:{
                type:Boolean,
                default:false
            },

            channelTaskPending:{
                type:Boolean,
                default:false
            },

            channelTaskVerified:{
                type:Boolean,
                default:false
            },

            channelTaskAdCompleted:{
                type:Boolean,
                default:false
            }

        },

        {
            timestamps:true
        }

    );


const User =
    mongoose.model(
        "User",
        UserSchema
    );


/* =====================================================
   HELPERS
===================================================== */

function getToday(){

    const now =
        new Date();

    const year =
        now.getUTCFullYear();

    const month =
        String(
            now.getUTCMonth() + 1
        ).padStart(
            2,
            "0"
        );

    const day =
        String(
            now.getUTCDate()
        ).padStart(
            2,
            "0"
        );

    return (
        year +
        "-" +
        month +
        "-" +
        day
    );
}


async function getOrCreateUser(
    telegramId
){

    if(!telegramId){

        return null;

    }

    let user =
        await User.findOne({
            telegramId
        });

    if(!user){

        user =
            await User.create({

                telegramId,

                score:0,

                currentTask:0

            });

    }

    return user;

}


/* =====================================================
   TELEGRAM BOT API
===================================================== */

async function telegramApi(
    method,
    body
){

    if(!BOT_TOKEN){

        throw new Error(
            "BOT_TOKEN is missing."
        );

    }

    const response =
        await fetch(
            "https://api.telegram.org/bot" +
            BOT_TOKEN +
            "/" +
            method,
            {

                method:"POST",

                headers:{
                    "Content-Type":
                        "application/json"
                },

                body:JSON.stringify(
                    body || {}
                )

            }
        );

    const data =
        await response.json();

    return data;

}


/* =====================================================
   CHECK TELEGRAM CHANNEL MEMBERSHIP
===================================================== */

async function isChannelMember(
    telegramId
){

    try{

        const result =
            await telegramApi(
                "getChatMember",
                {

                    chat_id:
                        CHANNEL_USERNAME,

                    user_id:
                        Number(
                            telegramId
                        )

                }
            );

        if(
            !result ||
            !result.ok
        ){

            console.error(
                "Telegram membership check failed:",
                result
            );

            return false;

        }

        const status =
            result.result &&
            result.result.status;

        /*
         * Valid channel members:
         *
         * creator
         * administrator
         * member
         *
         * Restricted users can also still
         * be members when Telegram returns
         * restricted.
         */

        if(
            status === "creator" ||
            status === "administrator" ||
            status === "member" ||
            status === "restricted"
        ){

            return true;

        }

        return false;

    }catch(error){

        console.error(
            "Channel membership error:",
            error
        );

        return false;

    }

}


/* =====================================================
   HOME
===================================================== */

app.get(
    "/",
    (req,res) => {

        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );

    }
);


/* =====================================================
   GET USER
===================================================== */

app.get(
    "/api/user/:telegramId",
    async (req,res) => {

        try{

            const telegramId =
                String(
                    req.params.telegramId
                );

            const user =
                await getOrCreateUser(
                    telegramId
                );

            if(!user){

                return res.status(400).json({
                    success:false,
                    error:"Invalid Telegram ID."
                });

            }


            const today =
                getToday();

            const claimedToday =
                user.dailyCheckinDate ===
                today;


            res.json({

                success:true,

                user:{

                    telegramId:
                        user.telegramId,

                    username:
                        user.username,

                    appUsername:
                        user.appUsername,

                    score:
                        user.score,

                    currentTask:
                        user.currentTask,

                    usernameClaimed:
                        user.usernameClaimed,

                    referralCount:
                        user.referralCount

                },

                dailyCheckin:{

                    claimedToday,

                    pending:
                        !!user.dailyCheckinPending

                },

                channelTask:{

                    claimed:
                        !!user.channelTaskClaimed,

                    pending:
                        !!user.channelTaskPending,

                    verified:
                        !!user.channelTaskVerified

                }

            });

        }catch(error){

            console.error(
                "GET USER ERROR:",
                error
            );

            res.status(500).json({

                success:false,

                error:
                    "Server error."

            });

        }

    }
);


/* =====================================================
   UPDATE USER
===================================================== */

app.post(
    "/api/user/update",
    async (req,res) => {

        try{

            const {

                telegramId,

                score,

                currentTask,

                usernameClaimed

            } = req.body;

            if(!telegramId){

                return res.status(400).json({

                    success:false,

                    error:
                        "Telegram ID required."

                });

            }

            const user =
                await getOrCreateUser(
                    String(
                        telegramId
                    )
                );

            if(
                typeof score ===
                "number"
            ){

                user.score =
                    Math.max(
                        0,
                        Math.floor(
                            score
                        )
                    );

            }

            if(
                typeof currentTask ===
                "number"
            ){

                user.currentTask =
                    Math.max(
                        0,
                        Math.min(
                            10,
                            Math.floor(
                                currentTask
                            )
                        )
                    );

            }

            if(
                typeof usernameClaimed ===
                "boolean"
            ){

                user.usernameClaimed =
                    usernameClaimed;

            }

            await user.save();

            res.json({

                success:true,

                score:
                    user.score,

                currentTask:
                    user.currentTask

            });

        }catch(error){

            console.error(
                "UPDATE USER ERROR:",
                error
            );

            res.status(500).json({

                success:false,

                error:
                    "Unable to save user."

            });

        }

    }
);


/* =====================================================
   REFERRAL
===================================================== */

app.get(
    "/api/referral/:telegramId",
    async (req,res) => {

        try{

            const telegramId =
                String(
                    req.params.telegramId
                );

            const user =
                await getOrCreateUser(
                    telegramId
                );

            const referralLink =
                "https://t.me/" +
                BOT_USERNAME +
                "?start=" +
                encodeURIComponent(
                    telegramId
                );

            res.json({

                success:true,

                referralLink,

                referralCount:
                    user.referralCount || 0

            });

        }catch(error){

            console.error(
                "REFERRAL ERROR:",
                error
            );

            res.status(500).json({

                success:false,

                error:
                    "Unable to load referral."

            });

        }

    }
);


/* =====================================================
   DAILY CHECK-IN STATUS
===================================================== */

app.get(
    "/api/daily-checkin/:telegramId",
    async (req,res) => {

        try{

            const telegramId =
                String(
                    req.params.telegramId
                );

            const user =
                await getOrCreateUser(
                    telegramId
                );

            const today =
                getToday();

            res.json({

                success:true,

                claimedToday:
                    user.dailyCheckinDate ===
                    today,

                pending:
                    !!user.dailyCheckinPending

            });

        }catch(error){

            console.error(error);

            res.status(500).json({

                success:false,

                error:
                    "Unable to load daily check-in."

            });

        }

    }
);


/* =====================================================
   DAILY CHECK-IN START
===================================================== */

app.post(
    "/api/daily-checkin/start",
    async (req,res) => {

        try{

            const telegramId =
                String(
                    req.body.telegramId || ""
                );

            if(!telegramId){

                return res.status(400).json({

                    success:false,

                    error:
                        "Telegram ID required."

                });

            }

            const user =
                await getOrCreateUser(
                    telegramId
                );

            const today =
                getToday();

            if(
                user.dailyCheckinDate ===
                today
            ){

                return res.status(409).json({

                    success:false,

                    claimedToday:true,

                    error:
                        "Daily Check-in already completed today."

                });

            }

            user.dailyCheckinPending =
                true;

            await user.save();

            res.json({

                success:true,

                pending:true

            });

        }catch(error){

            console.error(
                "DAILY START ERROR:",
                error
            );

            res.status(500).json({

                success:false,

                error:
                    "Unable to start Daily Check-in."

            });

        }

    }
);


/* =====================================================
   DAILY CHECK-IN CLAIM
===================================================== */

app.post(
    "/api/daily-checkin/claim",
    async (req,res) => {

        try{

            const telegramId =
                String(
                    req.body.telegramId || ""
                );

            const user =
                await getOrCreateUser(
                    telegramId
                );

            const today =
                getToday();

            if(
                user.dailyCheckinDate ===
                today
            ){

                return res.status(409).json({

                    success:false,

                    claimedToday:true,

                    error:
                        "Already claimed today."

                });

            }

            if(
                !user.dailyCheckinPending
            ){

                return res.status(400).json({

                    success:false,

                    error:
                        "Daily Check-in was not started."

                });

            }

            user.score +=
                DAILY_REWARD;

            user.dailyCheckinDate =
                today;

            user.dailyCheckinPending =
                false;

            await user.save();

            res.json({

                success:true,

                score:
                    user.score

            });

        }catch(error){

            console.error(
                "DAILY CLAIM ERROR:",
                error
            );

            res.status(500).json({

                success:false,

                error:
                    "Unable to claim."

            });

        }

    }
);


/* =====================================================
   USERNAME CHECK
===================================================== */

app.post(
    "/api/username/check",
    async (req,res) => {

        try{

            let username =
                String(
                    req.body.username || ""
                )
                .trim()
                .toLowerCase();

            const telegramId =
                String(
                    req.body.telegramId || ""
                );

            if(
                !/^[a-z0-9_]{3,20}$/.test(
                    username
                )
            ){

                return res.json({

                    success:true,

                    available:false

                });

            }

            const existing =
                await User.findOne({

                    appUsername:
                        username,

                    telegramId:{
                        $ne:
                            telegramId
                    }

                });

            res.json({

                success:true,

                available:
                    !existing

            });

        }catch(error){

            console.error(
                "USERNAME CHECK ERROR:",
                error
            );

            res.status(500).json({

                success:false,

                available:false

            });

        }

    }
);


/* =====================================================
   USERNAME RESERVE / CLAIM
===================================================== */

app.post(
    "/api/username/claim",
    async (req,res) => {

        try{

            const {

                telegramId,

                username,

                action

            } = req.body;

            const cleanUsername =
                String(
                    username || ""
                )
                .replace(/^@/,"")
                .trim()
                .toLowerCase();

            if(!telegramId){

                return res.status(400).json({

                    success:false,

                    error:
                        "Telegram ID required."

                });

            }

            if(
                !/^[a-z0-9_]{3,20}$/.test(
                    cleanUsername
                )
            ){

                return res.status(400).json({

                    success:false,

                    error:
                        "Invalid username."

                });

            }

            const user =
                await getOrCreateUser(
                    String(
                        telegramId
                    )
                );


            /* RESERVE */

            if(
                action ===
                "reserve"
            ){

                if(user.usernameClaimed){

                    return res.status(400).json({

                        success:false,

                        error:
                            "Username already claimed."

                    });

                }

                const existing =
                    await User.findOne({

                        appUsername:
                            cleanUsername,

                        telegramId:{
                            $ne:
                                String(
                                    telegramId
                                )
                        }

                    });

                if(existing){

                    return res.status(409).json({

                        success:false,

                        error:
                            "Username already taken."

                    });

                }

                user.appUsername =
                    cleanUsername;

                await user.save();

                return res.json({

                    success:true,

                    username:
                        cleanUsername

                });

            }


            /* CLAIM */

            if(
                action ===
                "claim"
            ){

                if(user.usernameClaimed){

                    return res.status(409).json({

                        success:false,

                        error:
                            "Username already claimed."

                    });

                }

                if(
                    user.appUsername !==
                    cleanUsername
                ){

                    return res.status(400).json({

                        success:false,

                        error:
                            "Username reservation mismatch."

                    });

                }

                user.usernameClaimed =
                    true;

                user.score +=
                    USERNAME_REWARD;

                await user.save();

                return res.json({

                    success:true,

                    username:
                        user.appUsername,

                    score:
                        user.score

                });

            }


            return res.status(400).json({

                success:false,

                error:
                    "Invalid action."

            });

        }catch(error){

            console.error(
                "USERNAME CLAIM ERROR:",
                error
            );

            res.status(500).json({

                success:false,

                error:
                    "Unable to process username."

            });

        }

    }
);


/* =====================================================
   CHANNEL TASK STATUS
===================================================== */

app.get(
    "/api/channel-task/status/:telegramId",
    async (req,res) => {

        try{

            const telegramId =
                String(
                    req.params.telegramId
                );

            const user =
                await getOrCreateUser(
                    telegramId
                );

            res.json({

                success:true,

                claimed:
                    !!user.channelTaskClaimed,

                pending:
                    !!user.channelTaskPending,

                verified:
                    !!user.channelTaskVerified

            });

        }catch(error){

            console.error(
                "CHANNEL STATUS ERROR:",
                error
            );

            res.status(500).json({

                success:false,

                error:
                    "Unable to load channel task."

            });

        }

    }
);


/* =====================================================
   CHANNEL TASK VERIFY (Updated for Frontend Direct Verify Flow)
===================================================== */

app.post(
    "/api/channel-task/verify",
    async (req,res) => {

        try{

            const telegramId =
                String(
                    req.body.telegramId || ""
                );

            if(!telegramId){

                return res.status(400).json({

                    success:false,

                    error:
                        "Telegram ID required."

                });

            }

            const user =
                await getOrCreateUser(
                    telegramId
                );

            if(
                user.channelTaskClaimed
            ){

                return res.status(409).json({

                    success:false,

                    claimed:true,

                    error:
                        "Channel task already completed."

                });

            }


            /*
             * Real Telegram membership check.
             */

            const member =
                await isChannelMember(
                    telegramId
                );

            if(!member){

                return res.status(403).json({

                    success:false,

                    isJoined:false,

                    error:
                        "You have not joined the KOKO Community channel yet. Please join @tripsgame first."

                });

            }


            user.channelTaskVerified =
                true;

            user.channelTaskPending =
                true;

            user.channelTaskAdCompleted =
                false;

            await user.save();

            res.json({

                success:true,

                isJoined:true,

                verified:true,

                pending:true

            });

        }catch(error){

            console.error(
                "CHANNEL VERIFY ERROR:",
                error
            );

            res.status(500).json({

                success:false,

                error:
                    "Unable to verify channel membership."

            });

        }

    }
);


/* =====================================================
   CHANNEL TASK CLAIM
===================================================== */

app.post(
    "/api/channel-task/claim",
    async (req,res) => {

        try{

            const telegramId =
                String(
                    req.body.telegramId || ""
                );

            if(!telegramId){

                return res.status(400).json({

                    success:false,

                    error:
                        "Telegram ID required."

                });

            }

            const user =
                await getOrCreateUser(
                    telegramId
                );

            if(
                user.channelTaskClaimed
            ){

                return res.status(409).json({

                    success:false,

                    error:
                        "Channel reward already claimed."

                });

            }


            /*
             * Check membership AGAIN before
             * giving the reward.
             */

            const member =
                await isChannelMember(
                    telegramId
                );

            if(!member){

                user.channelTaskVerified =
                    false;

                await user.save();

                return res.status(403).json({

                    success:false,

                    error:
                        "Channel membership could not be verified."

                });

            }


            /*
             * Reward
             */

            user.score +=
                CHANNEL_REWARD;

            user.channelTaskClaimed =
                true;

            user.channelTaskPending =
                false;

            user.channelTaskVerified =
                false;

            user.channelTaskAdCompleted =
                false;

            await user.save();

            res.json({

                success:true,

                score:
                    user.score,

                reward:
                    CHANNEL_REWARD

            });

        }catch(error){

            console.error(
                "CHANNEL CLAIM ERROR:",
                error
            );

            res.status(500).json({

                success:false,

                error:
                    "Unable to claim channel reward."

            });

        }

    }
);


/* =====================================================
   TELEGRAM /START
===================================================== */

app.post(
    "/telegram-webhook",
    async (req,res) => {

        try{

            const update =
                req.body;

            if(
                !update ||
                !update.message
            ){

                return res.sendStatus(200);

            }

            const message =
                update.message;

            const telegramUser =
                message.from;

            if(
                !telegramUser ||
                !telegramUser.id
            ){

                return res.sendStatus(200);

            }

            const telegramId =
                String(
                    telegramUser.id
                );

            let user =
                await getOrCreateUser(
                    telegramId
                );

            user.username =
                telegramUser.username ||
                "";

            /*
             * Handle /start referral
             */

            const text =
                String(
                    message.text || ""
                );

            if(
                text.startsWith("/start")
            ){

                const parts =
                    text.split(
                        /\s+/
                    );

                const referralId =
                    parts[1]
                        ? String(
                            parts[1]
                        )
                        : "";

                if(
                    referralId &&
                    referralId !==
                        telegramId &&
                    !user.referredBy
                ){

                    const referrer =
                        await User.findOne({
                            telegramId:
                                referralId
                        });

                    if(referrer){

                        user.referredBy =
                            referralId;

                        referrer.referralCount =
                            (referrer.referralCount || 0) +
                            1;

                        await referrer.save();

                    }

                }

            }

            await user.save();

            /*
             * Send Web App button
             */

            await telegramApi(
                "sendMessage",
                {

                    chat_id:
                        telegramId,

                    text:
                        "🎉 Welcome to KOKO Memory Match!\n\nPlay tasks, watch rewarded ads and earn KOKO Coins.",

                    reply_markup:{

                        inline_keyboard:[

                            [

                                {

                                    text:
                                        "🚀 Open KOKO",

                                    web_app:{
                                        url:
                                            WEB_APP_URL
                                    }

                                }

                            ]

                        ]

                    }

                }
            );

            res.sendStatus(200);

        }catch(error){

            console.error(
                "TELEGRAM WEBHOOK ERROR:",
                error
            );

            res.sendStatus(200);

        }

    }
);


/* =====================================================
   SET TELEGRAM WEBHOOK
===================================================== */

async function setupTelegramWebhook(){

    if(!BOT_TOKEN){

        console.log(
            "BOT_TOKEN not configured. Telegram webhook skipped."
        );

        return;

    }

    try{

        const webhookUrl =
            WEB_APP_URL.replace(
                /\/$/,
                ""
            ) +
            "/telegram-webhook";

        const result =
            await telegramApi(
                "setWebhook",
                {

                    url:
                        webhookUrl

                }
            );

        console.log(
            "Telegram webhook result:",
            result
        );

    }catch(error){

        console.error(
            "Webhook setup error:",
            error
        );

    }

}


/* =====================================================
   HEALTH
===================================================== */

app.get(
    "/health",
    (req,res) => {

        res.json({

            success:true,

            app:"KOKO",

            channel:
                CHANNEL_USERNAME,

            status:"online"

        });

    }
);


/* =====================================================
   START SERVER
===================================================== */

app.listen(
    PORT,
    async () => {

        console.log(
            "KOKO server running on port " +
            PORT
        );

        await setupTelegramWebhook();

    }
);
