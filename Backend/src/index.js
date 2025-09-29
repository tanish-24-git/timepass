const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); // npm i cors
const aiRoutes = require('./routes/aiRoutes');

dotenv.config();
const app = express();
app.use(cors()); // Allow extension to call
app.use(express.json());
app.use('/api', aiRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));