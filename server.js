const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const MONGO_URI = 'mongodb+srv://pktanim235_db_user:0JoHNrTdh5DcHB1A@cluster0.fspyebc.mongodb.net/?appName=Cluster0';

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected Successfully!'))
.catch((err) => console.log('Database Connection Error:', err));

app.get('/', (req, res) => {
    res.send('Telegram Mini App Backend is Running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
