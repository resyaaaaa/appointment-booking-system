const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/api/message', (req, res) => {
    res.json({ message: "Hello from the Node.js backend!" });
});

app.set('port', PORT);
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
