const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Debug environment variables
console.log('MONGO_URI:', process.env.MONGO_URI || 'Not set');
console.log('PORT:', process.env.PORT || 'Not set');

// ✅ Configure CORS properly
const allowedOrigins = [
  'http://localhost:3000', // local dev
  'https://mern-screen-recorder-green.vercel.app' // your Vercel frontend
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);

app.use(express.json());

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// MongoDB connection
if (!process.env.MONGO_URI) {
  console.error('Error: MONGO_URI is not defined in .env file');
  process.exit(1);
}
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Mongoose schema
const recordingSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  filepath: { type: String, required: true },
  filesize: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Recording = mongoose.model('Recording', recordingSchema);

// Upload recording
app.post('/api/recordings', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const { originalname, filename, size } = req.file;
  const relativeFilepath = `uploads/${filename}`;
  try {
    const recording = new Recording({
      filename: originalname,
      filepath: relativeFilepath,
      filesize: size,
    });
    await recording.save();
    res.status(201).json({
      message: 'Recording uploaded successfully',
      recording: {
        id: recording._id,
        filename: recording.filename,
        filesize: recording.filesize,
        createdAt: recording.createdAt,
      },
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ message: 'DB error', error: err.message });
  }
});

// Get all recordings
app.get('/api/recordings', async (req, res) => {
  try {
    const recordings = await Recording.find().select(
      'filename filesize createdAt'
    );

    // ✅ Use your Render domain instead of localhost
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

    const response = recordings.map((rec) => ({
      id: rec._id,
      filename: rec.filename,
      filesize: rec.filesize,
      createdAt: rec.createdAt,
      url: `${baseUrl}/api/recordings/${rec._id}`,
    }));
    res.json(response);
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ message: 'DB error', error: err.message });
  }
});

// Serve a recording by ID
app.get('/api/recordings/:id', async (req, res) => {
  try {
    const recording = await Recording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ message: 'Recording not found' });
    }
    res.sendFile(recording.filepath, { root: __dirname }, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).json({
          message: 'Error serving file',
          error: err.message,
        });
      }
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(404).json({ message: 'Recording not found' });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
