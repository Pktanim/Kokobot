const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve static files from the current directory (where index.html is located)
app.use(express.static(path.join(__dirname)));

// MongoDB Atlas Connection (Optional/Ready for database)
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://<username>:<password>@cluster.mongodb.net/kokobot?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("Connected to MongoDB Atlas successfully!");
}).catch((err) => {
    console.error("MongoDB connection error:", err);
});

// Sample API Route
app.get('/api/status', (req, res) => {
    res.json({ status: "success", message: "Kokobot Backend is running with full features!" });
});

// Fallback to index.html for frontend routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
