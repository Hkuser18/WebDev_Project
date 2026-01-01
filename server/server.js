//server dependencies and setup
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'dev-secret-webdev-project',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Serve site static files (parent folder)
app.use(express.static(path.join(__dirname, '..')));

const USERS_FILE = path.join(__dirname, 'users.json');

function readUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}

//write users to file
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

//function to return user info without sensitive data
function safeUser(user) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    imageUrl: user.imageUrl || null
  };
}

//--Auth API--

// Register - POST new user to /api/register
app.post('/api/register', (req, res) => {
  const { username, firstName, imageUrl, password } = req.body;
  if (!username || !password || !firstName) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const users = readUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: 'Username exists' });
  }
  const hashed = bcrypt.hashSync(password, 10);
  const user = { id: uuidv4(), username, firstName, imageUrl: imageUrl || null, passwordHash: hashed, playlists: [] };
  users.push(user);
  writeUsers(users);
  return res.json({ ok: true });
});

// Login - POST to /api/login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing' });
  const users = readUsers();
  const user = users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid' });
  if (!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'Invalid' });
  req.session.userId = user.id;
  return res.json({ user: safeUser(user) });
});

// Logout - POST to /api/logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Get current user - GET to /api/current
app.get('/api/current', (req, res) => {
  const userId = req.session.userId;
  if (!userId) 
    return res.json({ user: null });
  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) 
    return res.json({ user: null });
  return res.json({ user: safeUser(user) });
});

//--Playlists APIs--

//middleman to check auth
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Get all playlists for current user, GET to /api/playlists
app.get('/api/playlists', requireAuth, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.id === req.session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ playlists: user.playlists || [] });
});

// Create a new playlist, POST to /api/playlists
app.post('/api/playlists', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.session.userId);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const pl = { id: uuidv4(), name, videos: [] };
  users[idx].playlists = users[idx].playlists || [];
  users[idx].playlists.push(pl);
  writeUsers(users);
  return res.json({ playlist: pl });
});

// Add video to playlist, POST to /api/playlists/:id/add
app.post('/api/playlists/:id/add', requireAuth, (req, res) => {
  const plId = req.params.id;
  const { video } = req.body; // video: { id, title, img, type }
  if (!video || !video.id) return res.status(400).json({ error: 'Invalid video' });
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.session.userId);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  users[idx].playlists = users[idx].playlists || [];
  const pl = users[idx].playlists.find(p => p.id === plId);
  if (!pl) return res.status(404).json({ error: 'Playlist not found' });
  if (!pl.videos.some(v => v.id === video.id)) {
    pl.videos.push({ ...video, dateAdded: new Date().toISOString() });
    writeUsers(users);
  }
  return res.json({ ok: true });
});

// Remove video from playlist, POST to /api/playlists/:id/remove
app.post('/api/playlists/:id/remove', requireAuth, (req, res) => {
  const plId = req.params.id;
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ error: 'videoId required' });
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.session.userId);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const pl = users[idx].playlists.find(p => p.id === plId);
  if (!pl) return res.status(404).json({ error: 'Playlist not found' });
  pl.videos = (pl.videos || []).filter(v => v.id !== videoId);
  writeUsers(users);
  return res.json({ ok: true });
});

// Delete a playlist, POST to /api/playlists/:id/delete
app.post('/api/playlists/:id/delete', requireAuth, (req, res) => {
  const plId = req.params.id;
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.session.userId);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  users[idx].playlists = (users[idx].playlists || []).filter(p => p.id !== plId);
  writeUsers(users);
  return res.json({ ok: true });
});

// rate a song in playlist, POST to /api/playlists/:id/rate
app.post('/api/playlists/:id/rate', requireAuth, (req, res) => {
  const plId = req.params.id;
  const { videoId } = req.body;
  if (!videoId) return res.status(400).json({ error: 'videoId required' });
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.session.userId);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const pl = users[idx].playlists.find(p => p.id === plId);
  if (!pl) return res.status(404).json({ error: 'Playlist not found' });
  for (let v of pl.videos) {
    if (v.id === videoId) {
      v.rating = req.body.rating;
      break;
    }
  }
  writeUsers(users);
  return res.json({ ok: true });
});

// Upload MP3s, POST to /api/upload
const upload = multer({ dest: path.join(__dirname, 'uploads/') });
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  // Keep filename and return public path
  const url = `/server/uploads/${req.file.filename}`;
  return res.json({ url });
});

//start server
app.listen(PORT, () => console.log('Server listening on port', PORT));
