import express from "express";
import admin from "firebase-admin";
import crypto from "crypto";
import cors from "cors";
const app = express();
app.use(cors({
  origin: true,
  credentials: true,
  allowedHeaders: ["Content-Type", "X-Telegram-Init-Data"]
}));
app.use(express.json());

/* =========================
   FIREBASE ADMIN
========================= */

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL:
      "https://koko-4a57f-default-rtdb.firebaseio.com"
  });
}

const db = admin.database();

/* =========================
   TELEGRAM INIT DATA VERIFY
========================= */

function verifyTelegramInitData(initData) {
  const BOT_TOKEN = process.env.BOT_TOKEN;

  if (!BOT_TOKEN || !initData) {
    return null;
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");

    if (!hash) return null;

    params.delete("hash");

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (calculatedHash !== hash) {
      return null;
    }

    const user = params.get("user");

    if (!user) return null;

    return JSON.parse(user);
  } catch (error) {
    console.error("Telegram verification error:", error);
    return null;
  }
}

/* =========================
   GET TELEGRAM USER
========================= */

function getTelegramUser(req) {
  const initData =
    req.headers["x-telegram-init-data"] ||
    req.body?.initData;

  return verifyTelegramInitData(initData);
}

/* =========================
   HOME / HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "KOKO Backend",
    status: "running"
  });
});

/* =========================
   GET / CREATE USER
========================= */

app.post("/api/user", async (req, res) => {
  try {
    const telegramUser = getTelegramUser(req);

    if (!telegramUser) {
      return res.status(401).json({
        ok: false,
        error: "Invalid Telegram data"
      });
    }

    const userId = String(telegramUser.id);

    const ref = db.ref(`users/${userId}`);
    const snapshot = await ref.get();

    if (!snapshot.exists()) {
      await ref.set({
        id: userId,
        firstName: telegramUser.first_name || "",
        lastName: telegramUser.last_name || "",
        username: telegramUser.username || "",
        languageCode: telegramUser.language_code || "",
        photoUrl: telegramUser.photo_url || "",
        coins: 0,
        referralCount: 0,
        referredBy: null,
        completedTasks: 0,
        picClaimed: false,
        usernameClaimed: false,
        ref1Claimed: false,
        ref2Claimed: false,
        ref3Claimed: false,
        ref4Claimed: false,
        ref5Claimed: false,
        joinedAt: Date.now(),
        updatedAt: Date.now()
      });
    } else {
      await ref.update({
        firstName: telegramUser.first_name || "",
        lastName: telegramUser.last_name || "",
        username: telegramUser.username || "",
        photoUrl: telegramUser.photo_url || "",
        updatedAt: Date.now()
      });
    }

    const userSnapshot = await ref.get();

    res.json({
      ok: true,
      user: userSnapshot.val()
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Server error"
    });
  }
});

/* =========================
   REFERRAL
========================= */

app.post("/api/referral", async (req, res) => {
  try {
    const telegramUser = getTelegramUser(req);

    if (!telegramUser) {
      return res.status(401).json({
        ok: false,
        error: "Invalid Telegram data"
      });
    }

    const currentUserId = String(telegramUser.id);
    const startParam = req.body?.startParam || "";

    if (!startParam.startsWith("ref_")) {
      return res.json({
        ok: true,
        counted: false
      });
    }

    const referrerId = startParam.replace("ref_", "");

    if (!referrerId || referrerId === currentUserId) {
      return res.json({
        ok: true,
        counted: false
      });
    }

    const referrerRef = db.ref(`users/${referrerId}`);
    const referredRef = db.ref(`users/${currentUserId}`);

    const referrerSnapshot = await referrerRef.get();

    if (!referrerSnapshot.exists()) {
      return res.json({
        ok: true,
        counted: false
      });
    }

    const referredSnapshot = await referredRef.get();
    const referredUser = referredSnapshot.val() || {};

    if (referredUser.referredBy) {
      return res.json({
        ok: true,
        counted: false
      });
    }

    const referralRef = db.ref(
      `referrals/${referrerId}/${currentUserId}`
    );

    const existingReferral = await referralRef.get();

    if (existingReferral.exists()) {
      return res.json({
        ok: true,
        counted: false
      });
    }

    await db.ref(`users/${referrerId}`).transaction((user) => {
      if (!user) return user;

      user.referralCount =
        Number(user.referralCount || 0) + 1;

      user.updatedAt = Date.now();

      return user;
    });

    await referredRef.update({
      referredBy: referrerId,
      updatedAt: Date.now()
    });

    await referralRef.set({
      userId: currentUserId,
      firstName: telegramUser.first_name || "",
      lastName: telegramUser.last_name || "",
      username: telegramUser.username || "",
      joinedAt: Date.now()
    });

    res.json({
      ok: true,
      counted: true
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Referral error"
    });
  }
});

/* =========================
   USER DATA
========================= */

app.get("/api/user-data", async (req, res) => {
  try {
    const telegramUser = getTelegramUser(req);

    if (!telegramUser) {
      return res.status(401).json({
        ok: false,
        error: "Invalid Telegram data"
      });
    }

    const userId = String(telegramUser.id);

    const snapshot = await db
      .ref(`users/${userId}`)
      .get();

    res.json({
      ok: true,
      user: snapshot.val() || null
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Server error"
    });
  }
});

/* =========================
   CLAIM TASK
========================= */

app.post("/api/claim-task", async (req, res) => {
  try {
    const telegramUser = getTelegramUser(req);

    if (!telegramUser) {
      return res.status(401).json({
        ok: false,
        error: "Invalid Telegram data"
      });
    }

    const userId = String(telegramUser.id);
    const task = req.body?.task;

    const rewards = {
      pic: 100,
      username: 100,
      ref1: 100,
      ref2: 200,
      ref3: 300,
      ref4: 400,
      ref5: 500
    };

    if (!rewards[task]) {
      return res.status(400).json({
        ok: false,
        error: "Invalid task"
      });
    }

    const userRef = db.ref(`users/${userId}`);

    let result = {
      claimed: false,
      reward: 0
    };

    await userRef.transaction((user) => {
      if (!user) return user;

      const claimKey = `${task}Claimed`;

      if (user[claimKey]) {
        return user;
      }

      if (task === "ref1" && Number(user.referralCount || 0) < 1) {
        return user;
      }

      if (task === "ref2" && Number(user.referralCount || 0) < 2) {
        return user;
      }

      if (task === "ref3" && Number(user.referralCount || 0) < 3) {
        return user;
      }

      if (task === "ref4" && Number(user.referralCount || 0) < 4) {
        return user;
      }

      if (task === "ref5" && Number(user.referralCount || 0) < 5) {
        return user;
      }

      if (task === "pic" && !user.photoUrl) {
        return user;
      }

      if (task === "username" && !user.username) {
        return user;
      }

      user.coins =
        Number(user.coins || 0) + rewards[task];

      user[claimKey] = true;
      user.updatedAt = Date.now();

      result.claimed = true;
      result.reward = rewards[task];

      return user;
    });

    const snapshot = await userRef.get();

    res.json({
      ok: true,
      claimed: result.claimed,
      reward: result.reward,
      user: snapshot.val()
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Task claim error"
    });
  }
});

/* =========================
   GAME COMPLETE
========================= */

app.post("/api/game-complete", async (req, res) => {
  try {
    const telegramUser = getTelegramUser(req);

    if (!telegramUser) {
      return res.status(401).json({
        ok: false,
        error: "Invalid Telegram data"
      });
    }

    const userId = String(telegramUser.id);

    const userRef = db.ref(`users/${userId}`);

    let rewarded = false;

    await userRef.transaction((user) => {
      if (!user) return user;

      const completed =
        Number(user.completedTasks || 0);

      if (completed >= 10) {
        return user;
      }

      user.completedTasks = completed + 1;
      user.coins =
        Number(user.coins || 0) + 100;

      user.updatedAt = Date.now();

      rewarded = true;

      return user;
    });

    const snapshot = await userRef.get();

    res.json({
      ok: true,
      rewarded,
      user: snapshot.val()
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Game completion error"
    });
  }
});

/* =========================
   REFERRAL LIST
========================= */

app.get("/api/referrals", async (req, res) => {
  try {
    const telegramUser = getTelegramUser(req);

    if (!telegramUser) {
      return res.status(401).json({
        ok: false,
        error: "Invalid Telegram data"
      });
    }

    const userId = String(telegramUser.id);

    const snapshot = await db
      .ref(`referrals/${userId}`)
      .get();

    res.json({
      ok: true,
      referrals: snapshot.val() || {}
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Referral list error"
    });
  }
});

/* =========================
   VERCEL EXPORT
========================= */

export default app;
