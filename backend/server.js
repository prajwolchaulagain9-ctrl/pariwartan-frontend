




require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');


const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error('MONGO_URI is not set. Create backend/.env from backend/.env.example');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set. Create backend/.env from backend/.env.example');

const CORS_ORIGIN = process.env.CORS_ORIGIN ?
process.env.CORS_ORIGIN.split(',') :
['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'];
const PORT = parseInt(process.env.PORT || '5001', 10);


const SMTP_HOST = (process.env.SMTP_HOST || '').trim();
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = (process.env.SMTP_USER || '').trim();
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = (process.env.SMTP_FROM || '').trim();
const OTP_EXPIRES_MINUTES = Math.max(1, parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10));
const OTP_RESEND_SECONDS = Math.max(15, parseInt(process.env.OTP_RESEND_SECONDS || '60', 10));
const OTP_MAX_ATTEMPTS = Math.max(1, parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10));
const OTP_ENABLED = true;
const SMTP_ENABLED = !!(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM);
const OTP_PURPOSES = { REGISTER: 'register', LOGIN: 'login' };

if (!SMTP_ENABLED) {
  console.warn('SMTP is not fully configured. OTP emails will not be sent; dev OTP code will be returned in API responses.');
}


const IMAGEKIT_PUBLIC_KEY = process.env.IMAGEKIT_PUBLIC_KEY;
const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY;
const IMAGEKIT_ENDPOINT_RAW = (process.env.IMAGEKIT_URL_ENDPOINT || '').trim();
const IMAGEKIT_ENABLED = !!(IMAGEKIT_PUBLIC_KEY && IMAGEKIT_PRIVATE_KEY && IMAGEKIT_ENDPOINT_RAW);

let IMAGEKIT_URL_ENDPOINT = '';
let IMAGEKIT_FOLDER_PREFIX = 'pariwartan';

if (IMAGEKIT_ENABLED) {
  try {
    const parsed = new URL(IMAGEKIT_ENDPOINT_RAW);
    IMAGEKIT_URL_ENDPOINT = `${parsed.protocol}//${parsed.host}`;
    const endpointPath = parsed.pathname.replace(/^\/+|\/+$/g, '');
    if (endpointPath) IMAGEKIT_FOLDER_PREFIX = endpointPath;
  } catch {
    IMAGEKIT_URL_ENDPOINT = IMAGEKIT_ENDPOINT_RAW.replace(/\/+$/, '');
  }
}

let imagekit;
if (IMAGEKIT_ENABLED) {
  const { ImageKit } = require('@imagekit/nodejs');
  imagekit = new ImageKit({
    publicKey: IMAGEKIT_PUBLIC_KEY,
    privateKey: IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: IMAGEKIT_URL_ENDPOINT
  });
  console.log(`ImageKit enabled for file uploads. endpoint=${IMAGEKIT_URL_ENDPOINT}, folderPrefix=${IMAGEKIT_FOLDER_PREFIX}`);
}


const uploadsDir = path.join(__dirname, 'uploads');
const complaintsDir = path.join(uploadsDir, 'complaints');
const profilesDir = path.join(uploadsDir, 'profiles');
[uploadsDir, complaintsDir, profilesDir].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const ALLOWED_PROFILE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

function generateFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}


const getIP = (req) => {
  let ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket?.remoteAddress;
  if (ip && ip.includes('::ffff:')) return ip.split(':').pop();
  return ip;
};

const generateFingerprint = (f) => {
  if (!f) return null;
  const data = `${f.width}|${f.height}|${f.userAgent}|${f.platform}|${f.timezone}|${f.language}|${f.pixelRatio}|${f.colorDepth}|${f.hardwareConcurrency || 'N'}|${f.canvas || 'NC'}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};


const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  profilePic: { type: String, default: '' },
  ecoPoints: { type: Number, default: 0 },
  badges: [{ type: String }],
  equippedBadge: { type: String, default: '' },
  clubJoinedOnce: { type: Boolean, default: false },
  ipAddress: String,
  deviceId: String,
  deviceFootprint: Object,
  fingerprintHash: { type: String, unique: true, sparse: true },
  isBanned: { type: Boolean, default: false },
  banType: { type: String, enum: ['none', 'temporary', 'permanent'], default: 'none' },
  banExpiry: Date,
  banReason: { type: String, default: '' },
  currentWard: String,
  lastJoinedAt: Date,
  lastUsernameChange: Date,
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const adminSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  permissions: {
    viewComplaints: { type: Boolean, default: false },
    approveComplaint: { type: Boolean, default: false },
    resolveComplaint: { type: Boolean, default: false },
    removeComplaint: { type: Boolean, default: false },
    addCampaigns: { type: Boolean, default: false },
    deleteCampaign: { type: Boolean, default: false },
    viewLogs: { type: Boolean, default: false },
    manageAdmins: { type: Boolean, default: false },
    manageUsers: { type: Boolean, default: false },
    manageClubs: { type: Boolean, default: false },
    broadcastNotification: { type: Boolean, default: false }
  },
  organizerDetails: { name: String, twitter: String, instagram: String, website: String },
  createdAt: { type: Date, default: Date.now }
});
const Admin = mongoose.model('Admin', adminSchema);

const emailOtpSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  purpose: { type: String, enum: [OTP_PURPOSES.REGISTER, OTP_PURPOSES.LOGIN], required: true, index: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: OTP_MAX_ATTEMPTS },
  consumed: { type: Boolean, default: false },
  metadata: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now, index: true }
});
emailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const EmailOtp = mongoose.model('EmailOtp', emailOtpSchema);

const suggestionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: String,
  description: String,
  type: String,
  status: { type: String, default: 'Pending' },
  upvotes: { type: Number, default: 0 },
  upvotedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  wada: String,
  city: String,
  lat: Number,
  lng: Number,
  timestamp: { type: Date, default: Date.now },
  official: { name: String, title: String, photo: String },
  rejectionReason: { type: String, default: '' },
  complaintId: { type: String, unique: true, sparse: true },
  adminReplyId: { type: String, default: '' },
  markerType: { type: String, default: 'General' },
  images: [{ type: String }],
  timeline: [{ status: String, timestamp: { type: Date, default: Date.now }, by: String }],
  afterImages: [{ type: String }]
});
const Suggestion = mongoose.model('Suggestion', suggestionSchema);

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.model('Counter', counterSchema);

const discussionSchema = new mongoose.Schema({
  suggestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Suggestion', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: String,
  profilePic: String,
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});
const Discussion = mongoose.model('Discussion', discussionSchema);

const campaignSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  image: String,
  target: String,
  location: String,
  motives: [String],
  organizerSocial: { instagram: String, twitter: String, website: String },
  status: { type: String, default: 'Active' },
  startDate: { type: Date },
  endDate: { type: Date },
  mapUrl: String,
  timestamp: { type: Date, default: Date.now }
});
const Campaign = mongoose.model('Campaign', campaignSchema);

const registrationSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  email: String,
  contact: String,
  address: String,
  timestamp: { type: Date, default: Date.now }
});
const CampaignRegistration = mongoose.model('CampaignRegistration', registrationSchema);

const adminLogSchema = new mongoose.Schema({
  adminName: String,
  action: String,
  targetId: String,
  details: String,
  timestamp: { type: Date, default: Date.now }
});
const AdminLog = mongoose.model('AdminLog', adminLogSchema);

const clubSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  wada: { type: String, required: true },
  city: { type: String, required: true },
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    role: { type: String, default: 'Member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  rules: { type: String, default: 'Be respectful to all members.' },
  goal: { type: String, default: 'Improve our local community.' },
  socials: { instagram: String, twitter: String },
  level: { type: Number, default: 1 },
  lastEditedAt: { type: Date },
  timestamp: { type: Date, default: Date.now }
});
const Club = mongoose.model('Club', clubSchema);

const noticeSchema = new mongoose.Schema({
  clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: String,
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: { type: String, default: 'General' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isPinned: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});
const Notice = mongoose.model('Notice', noticeSchema);

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});
notificationSchema.index({ userId: 1, timestamp: -1 });
const Notification = mongoose.model('Notification', notificationSchema);


async function createNotification(userId, type, title, message) {
  try {await Notification.create({ userId, type, title, message });} catch {}
}

const smtpTransporter = SMTP_ENABLED ?
nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: { user: SMTP_USER, pass: SMTP_PASS }
}) :
null;

const normalizeEmail = (email) => String(email || '').
normalize('NFKC').
replace(/[\u200B-\u200D\uFEFF]/g, '').
trim().
toLowerCase().
slice(0, 100);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hashOtpCode = (code) => crypto.createHash('sha256').update(`${code}|${JWT_SECRET}`).digest('hex');
const createSixDigitCode = () => String(Math.floor(100000 + Math.random() * 900000));

function buildOtpEmailHtml({ code, purpose }) {
  const action = purpose === OTP_PURPOSES.REGISTER ? 'complete your registration' : 'sign in to your account';
  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;background:#eef2f7;padding:28px;">
    <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dde6f2;">
      <div style="padding:22px 24px;background:linear-gradient(135deg,#0891b2,#16a34a);color:#ffffff;">
        <h2 style="margin:0;font-size:22px;">Pariwartan Verification Code</h2>
        <p style="margin:6px 0 0;opacity:0.95;">Use this code to ${action}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 10px;color:#1f2937;">Your 6-digit code is:</p>
        <div style="font-size:36px;letter-spacing:8px;font-weight:700;color:#111827;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:14px 16px;display:inline-block;">${code}</div>
        <p style="margin:14px 0 0;color:#4b5563;">This code expires in ${OTP_EXPIRES_MINUTES} minute(s).</p>
        <p style="margin:8px 0 0;color:#6b7280;font-size:13px;">If you did not request this code, you can ignore this email safely.</p>
      </div>
    </div>
  </div>`;
}

async function sendOtpEmail({ to, code, purpose }) {
  if (!smtpTransporter) {
    console.log(`[DEV OTP] ${purpose} code for ${to}: ${code}`);
    return false;
  }

  await smtpTransporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: `Pariwartan verification code: ${code}`,
    text: `Your Pariwartan verification code is ${code}. It expires in ${OTP_EXPIRES_MINUTES} minute(s).`,
    html: buildOtpEmailHtml({ code, purpose })
  });
  return true;
}

async function issueOtpCode({ email, purpose, metadata = {} }) {
  const now = Date.now();
  const recent = await EmailOtp.findOne({ email, purpose, consumed: false, expiresAt: { $gt: new Date(now) } }).sort({ createdAt: -1 });
  if (recent) {
    const secondsLeft = OTP_RESEND_SECONDS - Math.floor((now - new Date(recent.createdAt).getTime()) / 1000);
    if (secondsLeft > 0) {
      const err = new Error(`Please wait ${secondsLeft}s before requesting a new code.`);
      err.statusCode = 429;
      throw err;
    }
  }

  await EmailOtp.updateMany({ email, purpose, consumed: false }, { $set: { consumed: true } });

  const code = createSixDigitCode();
  const expiresAt = new Date(now + OTP_EXPIRES_MINUTES * 60 * 1000);
  await EmailOtp.create({ email, purpose, codeHash: hashOtpCode(code), expiresAt, maxAttempts: OTP_MAX_ATTEMPTS, metadata });
  try {
    await sendOtpEmail({ to: email, code, purpose });
  } catch {
    const err = new Error('Could not send verification code. Please try again in a moment.');
    err.statusCode = 502;
    throw err;
  }
  return code;
}

async function verifyOtpCode({ email, purpose, code }) {
  const otp = await EmailOtp.findOne({ email, purpose, consumed: false }).sort({ createdAt: -1 });
  if (!otp) {
    const err = new Error('No active verification code found. Request a new code.');
    err.statusCode = 400;
    throw err;
  }

  if (otp.expiresAt <= new Date()) {
    otp.consumed = true;
    await otp.save();
    const err = new Error('Verification code has expired.');
    err.statusCode = 400;
    throw err;
  }

  const ok = otp.codeHash === hashOtpCode(String(code || '').trim());
  if (!ok) {
    otp.attempts += 1;
    if (otp.attempts >= otp.maxAttempts) otp.consumed = true;
    await otp.save();
    const err = new Error('Invalid verification code.');
    err.statusCode = 400;
    throw err;
  }

  otp.consumed = true;
  await otp.save();
}

async function seedSuperAdmin() {
  const superUser = 'sohailk2064';
  const hashed = bcrypt.hashSync('SoilCanCook@123', 10);
  await Admin.findOneAndUpdate(
    { username: superUser },
    { $set: { password: hashed, permissions: { viewComplaints: true, approveComplaint: true, resolveComplaint: true, removeComplaint: true, addCampaigns: true, deleteCampaign: true, viewLogs: true, manageAdmins: true, manageUsers: true, manageClubs: true, broadcastNotification: true } } },
    { upsert: true, returnDocument: 'after' }
  );
  console.log('Super-Admin sohailk2064 synced.');
}

async function logAdminAction(adminName, action, targetId, details) {
  try {await new AdminLog({ adminName, action, targetId: String(targetId), details }).save();}
  catch (err) {console.error('Logging error:', err);}
}

async function getNextId(counterId, prefix) {
  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}-${counter.seq.toString().padStart(8, '0')}`;
}

const isSuperAdmin = (admin) => admin.username === 'sohailk2064';
const hasPermission = (admin, perm) => isSuperAdmin(admin) || admin.permissions?.[perm];

const BADGE_DEFS = [
{ id: 'eco_10', label: 'Seedling', desc: 'Earn 10 eco points', icon: 'Sprout', target: 10, threshold: (u) => u.ecoPoints >= 10 },
{ id: 'eco_25', label: 'Green Thumb', desc: 'Earn 25 eco points', icon: 'Leaf', target: 25, threshold: (u) => u.ecoPoints >= 25 },
{ id: 'eco_50', label: 'Eco Starter', desc: 'Earn 50 eco points', icon: 'Trees', target: 50, threshold: (u) => u.ecoPoints >= 50 },
{ id: 'eco_100', label: 'Eco Warrior', desc: 'Earn 100 eco points', icon: 'Award', target: 100, threshold: (u) => u.ecoPoints >= 100 },
{ id: 'eco_250', label: 'Change Maker', desc: 'Earn 250 eco points', icon: 'Target', target: 250, threshold: (u) => u.ecoPoints >= 250 },
{ id: 'eco_500', label: 'Impact Leader', desc: 'Earn 500 eco points', icon: 'Trophy', target: 500, threshold: (u) => u.ecoPoints >= 500 },
{ id: 'eco_1000', label: 'Eco Legend', desc: 'Earn 1,000 eco points', icon: 'Mountain', target: 1000, threshold: (u) => u.ecoPoints >= 1000 },
{ id: 'eco_2500', label: 'Eco Champion', desc: 'Earn 2,500 eco points', icon: 'Crown', target: 2500, threshold: (u) => u.ecoPoints >= 2500 },
{ id: 'eco_5000', label: 'Eco Titan', desc: 'Earn 5,000 eco points', icon: 'Sparkles', target: 5000, threshold: (u) => u.ecoPoints >= 5000 },
{ id: 'club_member', label: 'Community Member', desc: 'Join a Ward Club', icon: 'Users', target: 0, threshold: (u) => u.clubJoinedOnce }];


async function checkAndAwardBadges(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    const newBadges = BADGE_DEFS.filter((b) => !user.badges.includes(b.id) && b.threshold(user)).map((b) => b.id);
    if (newBadges.length > 0) {
      await User.findByIdAndUpdate(userId, { $push: { badges: { $each: newBadges } } });
      for (const b of newBadges) {
        const def = BADGE_DEFS.find((d) => d.id === b);
        createNotification(userId, 'badge_earned', 'Badge Earned!', `You earned the "${def.label}" badge! ${def.desc}`);
      }
    }
  } catch (err) {console.error('Badge check error:', err);}
}

async function handleBanClubTransfer(userId) {
  const clubs = await Club.find({ creatorId: userId });
  for (const club of clubs) {
    const others = club.members.filter((m) => m.userId.toString() !== userId.toString());
    if (others.length > 0) {
      const newPres = others[0];
      club.creatorId = newPres.userId;
      const m = club.members.find((m) => m.userId.toString() === newPres.userId.toString());
      if (m) m.role = 'President';
      club.members = club.members.filter((m) => m.userId.toString() !== userId.toString());
      await club.save();
      await logAdminAction('System', 'CLUB_OWNERSHIP_TRANSFERRED', club._id, `Ban-triggered transfer to ${newPres.username} for club ${club.name}`);
    } else {
      await Club.findByIdAndDelete(club._id);
      await logAdminAction('System', 'CLUB_DELETED_ON_BAN', club._id, `Sole member banned: Deleted club ${club.name}`);
    }
  }
}

async function handleDeleteUserClubs(userId) {
  const clubs = await Club.find({ creatorId: userId });
  for (const club of clubs) {
    const others = club.members.filter((m) => m.userId.toString() !== userId.toString());
    if (others.length > 0) {
      const newPres = others[0];
      club.creatorId = newPres.userId;
      const m = club.members.find((m) => m.userId.toString() === newPres.userId.toString());
      if (m) m.role = 'President';
      club.members = club.members.filter((m) => m.userId.toString() !== userId.toString());
      await club.save();
    } else {
      await Club.findByIdAndDelete(club._id);
    }
  }
}


function setupSocketIO(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: CORS_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {next(new Error('Invalid token'));}
  });

  io.on('connection', (socket) => {
    socket.on('join_discussion', (suggestionId) => {
      if (typeof suggestionId === 'string' && /^[a-f0-9]{24}$/i.test(suggestionId))
      socket.join(suggestionId);
    });
    socket.on('send_message', async (data) => {
      try {
        const safeData = {
          suggestionId: data.suggestionId,
          userId: socket.user.id,
          username: socket.user.username,
          profilePic: data.profilePic,
          text: typeof data.text === 'string' ? data.text.trim().slice(0, 2000) : ''
        };
        if (!safeData.text || !safeData.suggestionId) return;
        const msg = await new Discussion(safeData).save();
        io.to(safeData.suggestionId).emit('receive_message', msg);
      } catch (err) {console.error('Socket error:', err);}
    });
  });

  return io;
}


async function initMongoDB() {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB Connected.');


  const ipUsers = await User.find({ ipAddress: { $regex: '^::ffff:' } });
  for (const u of ipUsers) {u.ipAddress = u.ipAddress.replace(/^::ffff:/, '');await u.save();}


  const legacyUsers = await User.find({ fingerprintHash: { $exists: false }, deviceFootprint: { $exists: true, $ne: null } });
  for (const u of legacyUsers) {
    u.fingerprintHash = generateFingerprint(u.deviceFootprint);
    try {await u.save();} catch {}
  }

  await seedSuperAdmin();
}




async function startFastifyServer() {
  const Fastify = require('fastify');
  const { pipeline } = require('stream/promises');

  const fastify = Fastify({ logger: false, bodyLimit: 1048576, trustProxy: true });


  await fastify.register(require('@fastify/cors'), { origin: CORS_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'] });
  await fastify.register(require('@fastify/helmet'), { crossOriginResourcePolicy: { policy: 'cross-origin' } });
  await fastify.register(require('@fastify/formbody'));
  await fastify.register(require('@fastify/multipart'), { limits: { fileSize: 5 * 1024 * 1024, files: 3 } });
  await fastify.register(require('@fastify/rate-limit'), { global: false });
  await fastify.register(require('@fastify/static'), {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false
  });


  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      done(null, body ? JSON.parse(body) : {});
    } catch (err) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });



  async function saveUploadedFile(part, destDir, allowedExts) {
    const ext = path.extname(part.filename || '').toLowerCase();
    if (!allowedExts.includes(ext)) throw new Error('Only image files are allowed');
    if (IMAGEKIT_ENABLED) {
      const buffer = await part.toBuffer();
      if (buffer.length > 5 * 1024 * 1024) throw new Error('File too large (max 5MB)');
      const folder = `${IMAGEKIT_FOLDER_PREFIX}/${destDir === complaintsDir ? 'complaints' : 'profiles'}`;
      const fileName = generateFilename(part.filename);
      const dataUri = `data:${part.mimetype || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
      try {
        const result = await imagekit.files.upload({ file: dataUri, fileName, folder });
        return result?.url || `${IMAGEKIT_URL_ENDPOINT}/${folder}/${fileName}`;
      } catch (err) {

        const filepath = path.join(destDir, fileName);
        fs.writeFileSync(filepath, buffer);
        console.warn('ImageKit upload failed, falling back to local uploads:', err?.message || err);
        return `/uploads/${destDir === complaintsDir ? 'complaints' : 'profiles'}/${fileName}`;
      }
    }
    const filename = generateFilename(part.filename);
    const filepath = path.join(destDir, filename);
    await pipeline(part.file, fs.createWriteStream(filepath));
    if (part.file.truncated) {
      try {fs.unlinkSync(filepath);} catch {}
      throw new Error('File too large (max 5MB)');
    }
    return `/uploads/${destDir === complaintsDir ? 'complaints' : 'profiles'}/${filename}`;
  }


  async function authenticateToken(request, reply) {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) return reply.code(401).send({ message: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return reply.code(401).send({ message: 'User not found' });
      if (user.isBanned) {
        if (user.banType === 'permanent') return reply.code(403).send({ banned: true, reason: user.banReason, type: 'permanent' });
        if (user.banType === 'temporary' && user.banExpiry > new Date()) return reply.code(403).send({ banned: true, reason: user.banReason, type: 'temporary', expiry: user.banExpiry });
        user.isBanned = false;user.banType = 'none';await user.save();
      }
      request.user = decoded;
    } catch (err) {
      return reply.code(401).send({ message: err.name === 'JsonWebTokenError' ? 'Invalid token' : 'Unauthorized' });
    }
  }

  async function authenticateAdmin(request, reply) {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) return reply.code(401).send({ message: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded.adminId) throw new Error('Not admin');
      const admin = await Admin.findById(decoded.adminId);
      if (!admin) throw new Error('Admin not found');
      request.admin = admin;
    } catch (err) {
      if (err?.name === 'TokenExpiredError') return reply.code(401).send({ message: 'Admin token expired' });
      if (err?.name === 'JsonWebTokenError') return reply.code(401).send({ message: 'Invalid admin token' });
      return reply.code(403).send({ message: 'Admin access required' });
    }
  }

  async function optionalAuthenticate(request) {
    const token = request.headers.authorization?.split(' ')[1];
    if (!token) return;
    try {request.user = jwt.verify(token, JWT_SECRET);} catch {}
  }

  const authRateLimitOpts = {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '15 minutes',
        errorResponseBuilder: () => ({ message: 'Too many attempts. Please try again in 15 minutes.' })
      }
    }
  };






  fastify.post('/api/admin/login', authRateLimitOpts, async (request, reply) => {
    const { username, password } = request.body || {};
    const admin = await Admin.findOne({ username });
    if (admin && bcrypt.compareSync(password, admin.password)) {
      const token = jwt.sign({ adminId: admin._id, username: admin.username }, JWT_SECRET, { expiresIn: '1d' });
      return { token, user: { id: admin._id, username: admin.username, permissions: admin.permissions } };
    }
    return reply.code(401).send({ message: 'Invalid Admin Credentials' });
  });


  fastify.post('/api/auth/register/request-code', { ...authRateLimitOpts }, async (request, reply) => {
    if (!OTP_ENABLED) return reply.code(503).send({ message: 'OTP is disabled.' });
    try {
      const { username, email, password } = request.body || {};
      const trimmedUser = String(username || '').trim().slice(0, 30);
      const safeEmail = normalizeEmail(email);
      if (!trimmedUser || !safeEmail || !password) return reply.code(400).send({ message: 'Username, email, and password are required' });
      if (!EMAIL_REGEX.test(safeEmail)) return reply.code(400).send({ message: 'Invalid email format' });
      if (String(password).length < 6) return reply.code(400).send({ message: 'Password must be at least 6 characters' });

      if (await User.findOne({ email: safeEmail })) return reply.code(400).send({ message: 'Email already in use' });
      if (await User.findOne({ username: trimmedUser })) return reply.code(400).send({ message: 'Username already taken' });

      const devCode = await issueOtpCode({ email: safeEmail, purpose: OTP_PURPOSES.REGISTER, metadata: { username: trimmedUser } });
      const response = { message: 'Verification code sent to your email.' };
      if (!SMTP_ENABLED && process.env.NODE_ENV !== 'production') response.devCode = devCode;
      return reply.send(response);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ message: err.message || 'Could not send verification code' });
    }
  });

  fastify.post('/api/auth/register/verify-code', { ...authRateLimitOpts }, async (request, reply) => {
    if (!OTP_ENABLED) return reply.code(503).send({ message: 'OTP is disabled.' });
    try {
      const { username, email, password, code, deviceId, deviceFootprint } = request.body || {};
      const trimmedUser = String(username || '').trim().slice(0, 30);
      const safeEmail = normalizeEmail(email);
      if (!trimmedUser || !safeEmail || !password || !code) return reply.code(400).send({ message: 'Username, email, password, and code are required' });
      if (!EMAIL_REGEX.test(safeEmail)) return reply.code(400).send({ message: 'Invalid email format' });
      if (String(password).length < 6) return reply.code(400).send({ message: 'Password must be at least 6 characters' });

      await verifyOtpCode({ email: safeEmail, purpose: OTP_PURPOSES.REGISTER, code });

      if (await User.findOne({ email: safeEmail })) return reply.code(400).send({ message: 'Email already in use' });
      if (await User.findOne({ username: trimmedUser })) return reply.code(400).send({ message: 'Username already taken' });

      const ipAddress = getIP(request);
      let parsedFootprint = deviceFootprint;
      if (typeof deviceFootprint === 'string') {
        try {parsedFootprint = JSON.parse(deviceFootprint);} catch {parsedFootprint = null;}
      }
      const fingerprintHash = generateFingerprint(parsedFootprint);

      if (fingerprintHash) {
        const ex = await User.findOne({ fingerprintHash });
        if (ex) return reply.code(403).send({ message: 'Security Alert: Multiple accounts detected from this hardware.' });
      }
      if (deviceId) {
        const ex = await User.findOne({ deviceId });
        if (ex) return reply.code(403).send({ message: 'Security Alert: A profile is already linked to this device.' });
      }
      const ipCount = await User.countDocuments({ ipAddress });
      if (ipCount >= 10) return reply.code(403).send({ message: 'Maximum citizen registration reached for this IP network.' });

      const hashed = bcrypt.hashSync(password, 10);
      const newUser = new User({
        username: trimmedUser,
        email: safeEmail,
        password: hashed,
        profilePic: '',
        ipAddress,
        deviceId,
        deviceFootprint: parsedFootprint || {},
        fingerprintHash
      });
      await newUser.save();

      const token = jwt.sign({ id: newUser._id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
      return reply.code(201).send({ token, user: { id: newUser._id, username: newUser.username, profilePic: newUser.profilePic, ecoPoints: newUser.ecoPoints, currentWard: newUser.currentWard } });
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ message: err.message || 'Verification failed' });
    }
  });

  fastify.post('/api/auth/login/request-code', { ...authRateLimitOpts }, async (request, reply) => {
    if (!OTP_ENABLED) return reply.code(503).send({ message: 'OTP is disabled.' });
    try {
      const { email, password } = request.body || {};
      const safeEmail = normalizeEmail(email);
      if (!safeEmail || !password) return reply.code(400).send({ message: 'Email and password are required' });

      const user = await User.findOne({ email: safeEmail });
      if (!user || !bcrypt.compareSync(password, user.password)) return reply.code(401).send({ message: 'Invalid Credentials' });
      if (user.isBanned) {
        if (user.banType === 'permanent') return reply.code(403).send({ banned: true, reason: user.banReason, type: 'permanent' });
        if (user.banType === 'temporary' && user.banExpiry && user.banExpiry > new Date()) return reply.code(403).send({ banned: true, reason: user.banReason, type: 'temporary', expiry: user.banExpiry });
      }

      const devCode = await issueOtpCode({ email: safeEmail, purpose: OTP_PURPOSES.LOGIN, metadata: { userId: String(user._id) } });
      const response = { message: 'Verification code sent to your email.' };
      if (!SMTP_ENABLED && process.env.NODE_ENV !== 'production') response.devCode = devCode;
      return reply.send(response);
    } catch (err) {
      return reply.code(err.statusCode || 500).send({ message: err.message || 'Could not send verification code' });
    }
  });

  fastify.post('/api/auth/login/verify-code', { ...authRateLimitOpts }, async (request, reply) => {
    if (!OTP_ENABLED) return reply.code(503).send({ message: 'OTP is disabled.' });
    try {
      const { email, code, deviceId, deviceFootprint } = request.body || {};
      const safeEmail = normalizeEmail(email);
      if (!safeEmail || !code) return reply.code(400).send({ message: 'Email and code are required' });

      await verifyOtpCode({ email: safeEmail, purpose: OTP_PURPOSES.LOGIN, code });

      const user = await User.findOne({ email: safeEmail });
      if (!user) return reply.code(401).send({ message: 'Invalid Credentials' });

      const ipAddress = getIP(request);
      let parsedFootprint = deviceFootprint;
      if (typeof deviceFootprint === 'string') {
        try {parsedFootprint = JSON.parse(deviceFootprint);} catch {parsedFootprint = null;}
      }

      user.ipAddress = ipAddress;
      if (deviceId) user.deviceId = deviceId;
      if (parsedFootprint) user.deviceFootprint = parsedFootprint;
      await user.save();

      if (user.isBanned) {
        if (user.banType === 'permanent') return reply.code(403).send({ banned: true, reason: user.banReason, type: 'permanent' });
        if (user.banType === 'temporary' && user.banExpiry && user.banExpiry > new Date()) return reply.code(403).send({ banned: true, reason: user.banReason, type: 'temporary', expiry: user.banExpiry });
        if (user.banType === 'temporary' && (!user.banExpiry || user.banExpiry <= new Date())) {
          user.isBanned = false;
          user.banType = 'none';
          user.banExpiry = undefined;
          await user.save();
        }
      }

      const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      return reply.send({ token, user: { id: user._id, username: user.username, profilePic: user.profilePic, ecoPoints: user.ecoPoints, currentWard: user.currentWard } });
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ message: err.message || 'Verification failed' });
    }
  });

  fastify.post('/api/auth/register', { ...authRateLimitOpts }, async (request, reply) => {
    try {
      const parts = request.parts();
      const fields = {};
      let profilePicPath = '';

      for await (const part of parts) {
        if (part.type === 'file') {
          if (part.fieldname === 'profilePic' && part.filename) {
            profilePicPath = await saveUploadedFile(part, profilesDir, ALLOWED_PROFILE_EXTS);
          } else {
            await part.toBuffer();
          }
        } else {
          fields[part.fieldname] = part.value;
        }
      }

      const { username, email, password, deviceId } = fields;
      let deviceFootprint = null;
      try {deviceFootprint = JSON.parse(fields.deviceFootprint || 'null');} catch {}
      const ipAddress = getIP(request);
      const fingerprintHash = generateFingerprint(deviceFootprint);

      if (!username || !email || !password) return reply.code(400).send({ message: 'Username, email, and password are required' });
      if (password.length < 6) return reply.code(400).send({ message: 'Password must be at least 6 characters' });
      const safeEmail = email.trim().toLowerCase().slice(0, 100);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) return reply.code(400).send({ message: 'Invalid email format' });

      if (fingerprintHash) {
        const ex = await User.findOne({ fingerprintHash });
        if (ex) return reply.code(403).send({ message: 'Security Alert: Multiple accounts detected from this hardware.' });
      }
      if (deviceId) {
        const ex = await User.findOne({ deviceId });
        if (ex) return reply.code(403).send({ message: 'Security Alert: A profile is already linked to this device.' });
      }
      const ipCount = await User.countDocuments({ ipAddress });
      if (ipCount >= 10) return reply.code(403).send({ message: 'Maximum citizen registration reached for this IP network.' });

      const hashed = bcrypt.hashSync(password, 10);
      const newUser = new User({
        username: username.trim().slice(0, 30),
        email: safeEmail,
        password: hashed,
        profilePic: profilePicPath,
        ipAddress, deviceId,
        deviceFootprint: deviceFootprint || {},
        fingerprintHash
      });
      await newUser.save();
      const token = jwt.sign({ id: newUser._id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
      return reply.code(201).send({ token, user: { id: newUser._id, username: newUser.username, profilePic: newUser.profilePic, ecoPoints: newUser.ecoPoints, currentWard: newUser.currentWard } });
    } catch {
      return reply.code(400).send({ message: 'Registration failed. User might already exist.' });
    }
  });


  fastify.post('/api/auth/login', authRateLimitOpts, async (request, reply) => {
    try {
      const { email, password, deviceId, deviceFootprint } = request.body || {};
      const user = await User.findOne({ email });
      const ipAddress = getIP(request);
      if (user && bcrypt.compareSync(password, user.password)) {
        user.ipAddress = ipAddress;
        if (deviceId) user.deviceId = deviceId;
        if (deviceFootprint) user.deviceFootprint = deviceFootprint;
        await user.save();
        if (user.isBanned) {
          if (user.banType === 'permanent') return reply.code(403).send({ banned: true, reason: user.banReason, type: 'permanent' });
          if (user.banType === 'temporary' && user.banExpiry && user.banExpiry > new Date()) return reply.code(403).send({ banned: true, reason: user.banReason, type: 'temporary', expiry: user.banExpiry });
          if (user.banType === 'temporary' && (!user.banExpiry || user.banExpiry <= new Date())) {user.isBanned = false;user.banType = 'none';user.banExpiry = undefined;await user.save();}
        }
        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        return { token, user: { id: user._id, username: user.username, profilePic: user.profilePic, ecoPoints: user.ecoPoints, currentWard: user.currentWard } };
      }
      return reply.code(401).send({ message: 'Invalid Credentials' });
    } catch (err) {return reply.code(500).send({ message: err.message });}
  });


  fastify.get('/api/suggestions', async () => {
    return Suggestion.find({ status: { $nin: ['Pending', 'Rejected'] } }).sort({ upvotes: -1, timestamp: -1 }).populate('userId', 'username profilePic');
  });

  fastify.get('/api/admin/suggestions', { preHandler: authenticateAdmin }, async (request, reply) => {
    const canViewComplaints =
    hasPermission(request.admin, 'viewComplaints') ||
    hasPermission(request.admin, 'approveComplaint') ||
    hasPermission(request.admin, 'resolveComplaint') ||
    hasPermission(request.admin, 'removeComplaint');
    if (!canViewComplaints) return reply.code(403).send({ message: 'No permission' });
    return Suggestion.find().sort({ timestamp: -1 });
  });

  fastify.get('/api/me/suggestions', { preHandler: authenticateToken }, async (request) => {
    return Suggestion.find({ userId: request.user.id }).sort({ timestamp: -1 }).populate('userId', 'username profilePic');
  });

  fastify.post('/api/suggestions', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const parts = request.parts();
      const fields = {};
      const images = [];
      for await (const part of parts) {
        if (part.type === 'file') {
          if (part.fieldname === 'images' && part.filename) {
            images.push(await saveUploadedFile(part, complaintsDir, ALLOWED_IMAGE_EXTS));
          } else {await part.toBuffer();}
        } else {fields[part.fieldname] = part.value;}
      }
      const safeTitle = typeof fields.title === 'string' ? fields.title.trim().slice(0, 150) : '';
      const safeDesc = typeof fields.description === 'string' ? fields.description.trim().slice(0, 2000) : '';
      if (!safeTitle || !safeDesc) return reply.code(400).send({ message: 'Title and description are required' });
      const complaintId = await getNextId('complaint', 'CMP');
      const s = new Suggestion({ userId: request.user.id, title: safeTitle, description: safeDesc, lat: fields.lat, lng: fields.lng, type: fields.type, wada: fields.wada, city: fields.city, complaintId, markerType: fields.markerType, images, timeline: [{ status: 'Pending', timestamp: new Date(), by: 'System' }] });
      await s.save();
      await checkAndAwardBadges(request.user.id);
      return reply.code(201).send(s);
    } catch (err) {return reply.code(400).send({ message: err.message });}
  });


  fastify.get('/api/admin/users', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (request.admin.username !== 'sohailk2064') return reply.code(403).send({ message: 'Forbidden' });
    return Admin.find({ username: { $ne: 'sohailk2064' } });
  });

  fastify.post('/api/admin/users', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (!hasPermission(request.admin, 'manageAdmins')) return reply.code(403).send({ message: 'Forbidden' });
    try {
      const { username, password, permissions, organizerDetails } = request.body || {};
      if (await Admin.findOne({ username })) return reply.code(400).send({ message: 'Username already taken' });
      const newAdmin = new Admin({ username, password: bcrypt.hashSync(password, 10), permissions, organizerDetails });
      await newAdmin.save();
      await logAdminAction(request.admin.username, 'CREATE_ADMIN', newAdmin._id, `Created admin ${username}`);
      return reply.code(201).send(newAdmin);
    } catch (err) {return reply.code(500).send({ message: err.message });}
  });


  fastify.delete('/api/admin/users/:id', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (!hasPermission(request.admin, 'manageAdmins')) return reply.code(403).send({ message: 'Forbidden' });
    try {
      const deleted = await Admin.findByIdAndDelete(request.params.id);
      if (!deleted) return reply.code(404).send({ message: 'Admin not found' });
      await logAdminAction(request.admin.username, 'DELETE_ADMIN', request.params.id, `Deleted admin: ${deleted.username}`);
      return reply.send({ message: 'Admin deleted successfully' });
    } catch (err) {return reply.code(500).send({ message: err.message });}
  });


  fastify.get('/api/admin/platform-users', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (!hasPermission(request.admin, 'manageUsers')) return reply.code(403).send({ message: 'Forbidden' });
    try {
      const users = await User.find().select('-password').sort({ createdAt: -1 });
      const clubs = await Club.find();
      return users.map((u) => {
        const obj = u.toObject();
        const c = clubs.find((c) => c.members.some((m) => m.userId.toString() === u._id.toString()));
        obj.clubStatus = c ? `Member of ${c.name}` : 'No Club';
        return obj;
      });
    } catch (err) {return reply.code(500).send({ message: err.message });}
  });

  fastify.post('/api/admin/platform-users/:id/ban', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (!hasPermission(request.admin, 'manageUsers')) return reply.code(403).send({ message: 'Forbidden' });
    try {
      const { banType, durationDays, reason } = request.body || {};
      const update = { isBanned: banType !== 'none', banType, banReason: reason || '' };
      if (banType === 'temporary' && durationDays) {update.banExpiry = new Date();update.banExpiry.setDate(update.banExpiry.getDate() + parseInt(durationDays));} else
      if (banType === 'none') {update.banExpiry = null;update.banReason = '';} else
      {update.banExpiry = null;}
      const user = await User.findByIdAndUpdate(request.params.id, update, { new: true });
      if (banType === 'permanent') await handleBanClubTransfer(request.params.id);
      await logAdminAction(request.admin.username, 'BAN_USER', request.params.id, `Status: ${banType}${reason ? ' - Reason: ' + reason : ''}`);
      return reply.send(user);
    } catch (err) {return reply.code(500).send({ message: err.message });}
  });

  fastify.delete('/api/admin/platform-users/:id', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (!hasPermission(request.admin, 'manageUsers')) return reply.code(403).send({ message: 'Forbidden' });
    try {
      await handleDeleteUserClubs(request.params.id);
      const user = await User.findByIdAndDelete(request.params.id);
      await logAdminAction(request.admin.username, 'DELETE_USER', request.params.id, `Deleted user: ${user?.username}`);
      return reply.send({ message: 'User deleted' });
    } catch (err) {return reply.code(500).send({ message: err.message });}
  });


  fastify.get('/api/admin/all-clubs', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (!hasPermission(request.admin, 'manageClubs')) return reply.code(403).send({ message: 'Forbidden' });
    return Club.find().sort({ timestamp: -1 });
  });

  fastify.delete('/api/admin/clubs/:id', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (!hasPermission(request.admin, 'manageClubs')) return reply.code(403).send({ message: 'Forbidden' });
    try {
      const club = await Club.findByIdAndDelete(request.params.id);
      if (club?.members) {
        for (const m of club.members) createNotification(m.userId, 'club_deleted', 'Club Deleted', `The club "${club.name}" was deleted by an administrator.`);
      }
      await logAdminAction(request.admin.username, 'DELETE_CLUB_MANAGER', request.params.id, `Deleted club: ${club?.name}`);
      return reply.send({ message: 'Club deleted' });
    } catch (err) {return reply.code(500).send({ message: err.message });}
  });

  fastify.delete('/api/admin/clubs/:id/members/:userId', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (!hasPermission(request.admin, 'manageClubs')) return reply.code(403).send({ message: 'Forbidden' });
    try {
      const club = await Club.findById(request.params.id);
      if (!club) return reply.code(404).send({ message: 'Club not found' });
      if (club.creatorId.toString() === request.params.userId) return reply.code(400).send({ message: 'Cannot kick the President. Delete the club instead.' });
      club.members = club.members.filter((m) => m.userId.toString() !== request.params.userId);
      await club.save();
      createNotification(request.params.userId, 'club_kicked', 'Removed from Club', `You have been removed from the club "${club.name}" by an administrator.`);
      await logAdminAction(request.admin.username, 'KICK_MEMBER_MANAGER', request.params.id, `Kicked member ${request.params.userId} from ${club.name}`);
      return reply.send({ message: 'Member kicked' });
    } catch (err) {return reply.code(500).send({ message: err.message });}
  });


  fastify.get('/api/campaigns', async () => Campaign.find().sort({ timestamp: -1 }));

  fastify.post('/api/campaigns/:id/register', { preHandler: optionalAuthenticate }, async (request, reply) => {
    try {
      const { name, email, contact, address } = request.body || {};
      await new CampaignRegistration({ campaignId: request.params.id, userId: request.user?.id, name, email, contact, address }).save();
      return reply.code(201).send({ message: 'Registered successfully' });
    } catch (err) {return reply.code(400).send({ message: err.message });}
  });

  fastify.get('/api/admin/campaigns/:id/registrations', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (!request.admin.permissions.addCampaigns) return reply.code(403).send({ message: 'No permission' });
    return CampaignRegistration.find({ campaignId: request.params.id }).sort({ timestamp: -1 });
  });

  fastify.post('/api/admin/campaigns', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (!request.admin.permissions.addCampaigns) return reply.code(403).send({ message: 'No permission' });
    const { title, description, image, target, location, mapUrl, motives, organizerSocial, startDate, endDate } = request.body || {};
    const campaign = new Campaign({ title, description, image, target, location, mapUrl, motives, organizerSocial, startDate, endDate });
    await campaign.save();
    await logAdminAction(request.admin.username, 'ADD_CAMPAIGN', campaign._id, `Added campaign: ${title}`);
    return reply.code(201).send(campaign);
  });

  fastify.delete('/api/admin/campaigns/:id', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (!request.admin.permissions.deleteCampaign) return reply.code(403).send({ message: 'No permission' });
    try {
      const campaign = await Campaign.findByIdAndDelete(request.params.id);
      await logAdminAction(request.admin.username, 'DELETE_CAMPAIGN', request.params.id, `Deleted campaign: ${campaign?.title}`);
      return reply.send({ message: 'Deleted' });
    } catch (err) {return reply.code(500).send({ message: err.message });}
  });


  fastify.get('/api/admin/logs', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (!request.admin.permissions.viewLogs) return reply.code(403).send({ message: 'No permission' });
    return AdminLog.find().sort({ timestamp: -1 }).limit(100);
  });


  fastify.patch('/api/suggestions/:id/status', { preHandler: authenticateAdmin }, async (request, reply) => {
    try {
      const { status, rejectionReason } = request.body || {};
      if ((status === 'Approved' || status === 'Rejected' || status === 'Progress' || status === 'Pending') && !request.admin.permissions.approveComplaint) return reply.code(403).send({ message: 'No permission' });
      if (status === 'Resolved' && !request.admin.permissions.resolveComplaint) return reply.code(403).send({ message: 'No permission to resolve' });

      const update = { status, $push: { timeline: { status, timestamp: new Date(), by: request.admin.username } } };
      if (rejectionReason !== undefined) update.rejectionReason = rejectionReason;
      if (status === 'Rejected') update.adminReplyId = await getNextId('adminreply', 'ADM');

      const old = await Suggestion.findById(request.params.id);
      const s = await Suggestion.findByIdAndUpdate(request.params.id, update, { new: true });
      if (!s) return reply.code(404).send({ message: 'Suggestion not found' });

      if (old.status === 'Pending' && status === 'Progress') {
        await User.findByIdAndUpdate(s.userId, { $inc: { ecoPoints: 3 } });
        createNotification(s.userId, 'eco_points', 'Eco Points Earned', `You earned 3 eco points! Your report "${s.title}" is now in progress.`);
      }
      const msgs = {
        Approved: `Your report "${s.title}" has been approved.`,
        Rejected: `Your report "${s.title}" was rejected.${rejectionReason ? ' Reason: ' + rejectionReason : ''}`,
        Resolved: `Your report "${s.title}" has been resolved!`,
        Progress: `Your report "${s.title}" is now in progress.`,
        Pending: `Your report "${s.title}" has been moved back to pending review.`
      };
      if (msgs[status]) createNotification(s.userId, `complaint_${status.toLowerCase()}`, `Report ${status}`, msgs[status]);
      await checkAndAwardBadges(s.userId);
      await logAdminAction(request.admin.username, `UPDATE_STATUS_${status.toUpperCase()}`, request.params.id, `Changed status to ${status}`);
      return reply.send(s);
    } catch (err) {return reply.code(400).send({ message: err.message });}
  });


  fastify.patch('/api/suggestions/:id/upvote', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const s = await Suggestion.findById(request.params.id);
      if (!s) return reply.code(404).send({ message: 'Not found' });
      const voted = s.upvotedBy.some((id) => id.toString() === request.user.id);
      if (voted) {s.upvotes = Math.max(0, s.upvotes - 1);s.upvotedBy = s.upvotedBy.filter((id) => id.toString() !== request.user.id);} else
      {s.upvotes += 1;s.upvotedBy.push(request.user.id);}
      await s.save();
      return reply.send(s);
    } catch (err) {return reply.code(500).send({ message: err.message });}
  });


  fastify.delete('/api/suggestions/:id', { preHandler: authenticateAdmin }, async (request, reply) => {
    try {
      if (!request.admin.permissions.removeComplaint) return reply.code(403).send({ message: 'No permission' });
      const s = await Suggestion.findByIdAndDelete(request.params.id);
      if (s?.images?.length) {
        for (const img of s.images) {
          const full = path.resolve(__dirname, img.replace(/^[\\/]+/, ''));
          if (full.startsWith(uploadsDir)) fs.unlink(full, () => {});
        }
      }
      if (s) createNotification(s.userId, 'complaint_deleted', 'Report Deleted', `Your report "${s.title}" was removed by an administrator.`);
      await logAdminAction(request.admin.username, 'DELETE_COMPLAINT', request.params.id, `Deleted complaint: ${s?.title}`);
      return reply.send({ message: 'Deleted' });
    } catch (err) {return reply.code(500).send({ message: err.message });}
  });


  fastify.get('/api/suggestions/:id/comments', async (request) => {
    return Discussion.find({ suggestionId: request.params.id }).sort({ timestamp: 1 });
  });


  fastify.get('/api/user/profile', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      await checkAndAwardBadges(request.user.id);
      return reply.send(await User.findById(request.user.id).select('-password'));
    } catch {return reply.code(500).send({ message: 'Error fetching profile' });}
  });

  fastify.put('/api/user/profile', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { username, oldPassword, newPassword } = request.body || {};
      const user = await User.findById(request.user.id);
      if (oldPassword && newPassword) {
        if (!bcrypt.compareSync(oldPassword, user.password)) return reply.code(401).send({ message: 'Incorrect old password' });
        if (newPassword.length < 6) return reply.code(400).send({ message: 'New password must be at least 6 characters' });
        user.password = bcrypt.hashSync(newPassword, 10);
        createNotification(user._id, 'password_changed', 'Password Changed', "Your password was changed. If this wasn't you, contact support.");
      }
      if (username) {
        const trimmed = username.trim().slice(0, 30);
        if (trimmed && trimmed !== user.username) {
          if (user.lastUsernameChange) {
            const days = (new Date() - new Date(user.lastUsernameChange)) / 86400000;
            if (days < 30) return reply.code(400).send({ message: `You can change your username again in ${Math.ceil(30 - days)} days.` });
          }
          if (await User.findOne({ username: trimmed })) return reply.code(400).send({ message: 'Username already taken' });
          createNotification(user._id, 'username_changed', 'Username Changed', `Your username was changed to "${trimmed}".`);
          user.username = trimmed;
          user.lastUsernameChange = new Date();
        }
      }
      await user.save();
      const r = user.toObject();delete r.password;
      return reply.send(r);
    } catch {return reply.code(500).send({ message: 'Error updating profile' });}
  });

  fastify.post('/api/user/profile-pic', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data?.filename) return reply.code(400).send({ message: 'No image uploaded' });
      const fn = await saveUploadedFile(data, profilesDir, ALLOWED_PROFILE_EXTS);
      const user = await User.findById(request.user.id);
      if (user.profilePic?.startsWith('/uploads/profiles/')) {
        const old = path.resolve(__dirname, user.profilePic.replace(/^[\\/]+/, ''));
        if (old.startsWith(profilesDir)) fs.unlink(old, () => {});
      }

      user.profilePic = fn;
      await user.save();
      createNotification(user._id, 'profile_pic_changed', 'Profile Picture Updated', 'Your profile picture was updated successfully.');
      return reply.send({ profilePic: user.profilePic });
    } catch {return reply.code(500).send({ message: 'Error uploading picture' });}
  });


  fastify.post('/api/suggestions/:id/after-images', { preHandler: authenticateAdmin }, async (request, reply) => {
    try {
      if (!request.admin.permissions.resolveComplaint) return reply.code(403).send({ message: 'No permission' });
      const s = await Suggestion.findById(request.params.id);
      if (!s) return reply.code(404).send({ message: 'Not found' });
      const parts = request.parts();
      const paths = [];
      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'afterImages' && part.filename) {
          paths.push(await saveUploadedFile(part, complaintsDir, ALLOWED_IMAGE_EXTS));
        } else if (part.type === 'file') {await part.toBuffer();}
      }
      s.afterImages.push(...paths);
      await s.save();
      await logAdminAction(request.admin.username, 'UPLOAD_AFTER_IMAGES', request.params.id, `Uploaded ${paths.length} after image(s)`);
      return reply.send(s);
    } catch (err) {return reply.code(400).send({ message: err.message });}
  });


  fastify.get('/api/health', async () => ({ status: 'ok' }));


  fastify.get('/api/badges', async () => BADGE_DEFS.map((b) => ({ id: b.id, label: b.label, desc: b.desc, icon: b.icon, target: b.target })));

  fastify.get('/api/leaderboard', async () => {
    const users = await User.find({}, 'username profilePic ecoPoints badges equippedBadge').sort({ ecoPoints: -1 }).limit(50).lean();
    return users.map((u, i) => ({ rank: i + 1, username: u.username, profilePic: u.profilePic, ecoPoints: u.ecoPoints || 0, badges: u.badges || [], equippedBadge: u.equippedBadge || '' }));
  });

  fastify.patch('/api/user/badge', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { badgeId } = request.body || {};
      const user = await User.findById(request.user.id);
      if (badgeId && !user.badges.includes(badgeId)) return reply.code(400).send({ message: 'Badge not earned yet' });
      user.equippedBadge = badgeId || '';
      await user.save();
      return reply.send({ equippedBadge: user.equippedBadge });
    } catch {return reply.code(500).send({ message: 'Failed to update badge' });}
  });


  fastify.get('/api/notifications', { preHandler: authenticateToken }, async (request) => {
    return Notification.find({ userId: request.user.id }).sort({ timestamp: -1 }).limit(50);
  });

  fastify.get('/api/notifications/unread-count', { preHandler: authenticateToken }, async (request) => {
    try {
      return { count: await Notification.countDocuments({ userId: request.user.id, read: false }) };
    } catch {return { count: 0 };}
  });

  fastify.patch('/api/notifications/read-all', { preHandler: authenticateToken }, async (request) => {
    await Notification.updateMany({ userId: request.user.id, read: false }, { read: true });
    return { message: 'All marked as read' };
  });

  fastify.patch('/api/notifications/:id/read', { preHandler: authenticateToken }, async (request) => {
    await Notification.findOneAndUpdate({ _id: request.params.id, userId: request.user.id }, { read: true });
    return { message: 'Marked as read' };
  });


  fastify.post('/api/admin/broadcast-notification', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (!hasPermission(request.admin, 'broadcastNotification')) return reply.code(403).send({ message: 'Forbidden' });
    try {
      const { title, message } = request.body || {};
      if (!title || !message) return reply.code(400).send({ message: 'Title and message are required' });
      const users = await User.find({}, '_id');
      await Notification.insertMany(users.map((u) => ({ userId: u._id, type: 'announcement', title, message })));
      await logAdminAction(request.admin.username, 'BROADCAST_NOTIFICATION', 'all', `Broadcast "${title}" to ${users.length} users`);
      return reply.send({ message: `Notification sent to ${users.length} users` });
    } catch {return reply.code(500).send({ message: 'Failed to broadcast' });}
  });

  fastify.get('/api/admin/broadcast-history', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (!hasPermission(request.admin, 'broadcastNotification')) return reply.code(403).send({ message: 'Forbidden' });
    try {
      return Notification.aggregate([
      { $match: { type: 'announcement' } },
      { $group: { _id: { title: '$title', message: '$message' }, timestamp: { $first: '$timestamp' }, count: { $sum: 1 } } },
      { $sort: { timestamp: -1 } }, { $limit: 20 },
      { $project: { _id: 0, title: '$_id.title', message: '$_id.message', timestamp: 1, recipientCount: '$count' } }]
      );
    } catch {return [];}
  });


  fastify.delete('/api/admin/broadcast-notification', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (!hasPermission(request.admin, 'broadcastNotification')) return reply.code(403).send({ message: 'Forbidden' });
    try {
      const { title, message } = request.body || {};
      if (!title || !message) return reply.code(400).send({ message: 'Title and message are required' });
      const result = await Notification.deleteMany({ type: 'announcement', title, message });
      await logAdminAction(request.admin.username, 'DELETE_BROADCAST', 'all', `Deleted broadcast "${title}" (${result.deletedCount} removed)`);
      return reply.send({ message: `Broadcast deleted (${result.deletedCount} notifications removed)` });
    } catch {return reply.code(500).send({ message: 'Failed to delete broadcast' });}
  });


  fastify.get('/api/clubs', async (request) => {
    const { wada } = request.query;
    return Club.find(wada ? { wada } : {}).sort({ timestamp: -1 });
  });

  fastify.post('/api/clubs', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { name, description, wada, city, rules, goal, socials } = request.body || {};
      const existing = await Club.findOne({ 'members.userId': request.user.id });
      if (existing) return reply.code(400).send({ message: 'You are already a member of another Ward Club. Exit your current group before creating a new one.' });
      const newClub = new Club({ name, description, wada, city, rules, goal, socials, creatorId: request.user.id, members: [{ userId: request.user.id, username: request.user.username, role: 'President' }] });
      await newClub.save();
      const user = await User.findById(request.user.id);user.currentWard = wada;await user.save();
      await new Notice({ clubId: newClub._id, userId: request.user.id, username: request.user.username, title: `Welcome to ${name}!`, content: 'This is our club notice board. Check here for official updates and announcements.', category: 'General', isPinned: true }).save();
      return reply.code(201).send(newClub);
    } catch (err) {return reply.code(400).send({ message: err.message });}
  });

  fastify.post('/api/clubs/:id/join', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const club = await Club.findById(request.params.id);
      if (!club) return reply.code(404).send({ message: 'Club not found' });
      const user = await User.findById(request.user.id);
      if (user.currentWard && user.currentWard !== club.wada) return reply.code(403).send({ message: `You are locked to Ward ${user.currentWard}. Leave your current club to change wards.` });
      if (club.members.some((m) => m.userId.toString() === request.user.id)) return reply.code(400).send({ message: 'Already a member' });
      if (!user.clubJoinedOnce) {
        await User.findByIdAndUpdate(request.user.id, { $inc: { ecoPoints: 50 }, $set: { clubJoinedOnce: true } });
        createNotification(request.user.id, 'eco_points', 'Eco Points Earned', 'You earned 50 eco points for joining your first Ward Club!');
      }
      club.members.push({ userId: request.user.id, username: request.user.username, role: 'Member' });
      user.lastJoinedAt = new Date();user.currentWard = club.wada;
      await club.save();await user.save();
      await checkAndAwardBadges(request.user.id);
      return reply.send(club);
    } catch (err) {return reply.code(400).send({ message: err.message });}
  });

  fastify.post('/api/clubs/:id/leave', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const club = await Club.findById(request.params.id);
      if (!club) return reply.code(404).send({ message: 'Club not found' });
      const user = await User.findById(request.user.id);
      const idx = club.members.findIndex((m) => m.userId.toString() === request.user.id);
      if (idx === -1) return reply.code(400).send({ message: 'Not a member' });
      if (user.lastJoinedAt) {
        const hrs = (new Date() - new Date(user.lastJoinedAt)) / 3600000;
        if (hrs < 24) return reply.code(403).send({ message: `Anti-Hopping Shield active. You must stay for 24 hours. (${Math.ceil(24 - hrs)}h remaining)` });
      }
      if (club.members[idx].role === 'President') {
        if (club.members.length === 1) {
          await Club.findByIdAndDelete(request.params.id);
          await Notice.deleteMany({ clubId: request.params.id });
          user.currentWard = null;await user.save();
          return reply.send({ message: 'Last resident left. Club deleted and ward unlocked.' });
        }
        return reply.code(400).send({ message: 'Presidents with members must transfer ownership before leaving.' });
      }
      club.members.splice(idx, 1);await club.save();
      user.currentWard = null;await user.save();
      return reply.send({ message: 'Left the club community.' });
    } catch (err) {return reply.code(400).send({ message: err.message });}
  });

  fastify.post('/api/clubs/:id/transfer', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { newPresidentId } = request.body || {};
      const club = await Club.findById(request.params.id);
      if (!club) return reply.code(404).send({ message: 'Ward Club not found' });
      if (club.creatorId.toString() !== request.user.id) return reply.code(403).send({ message: 'Only current President can transfer leadership' });
      const target = club.members.find((m) => m.userId.toString() === newPresidentId);
      if (!target) return reply.code(400).send({ message: 'New President must be an active member' });
      club.members.forEach((m) => {
        if (m.userId.toString() === request.user.id) m.role = 'Member';
        if (m.userId.toString() === newPresidentId) m.role = 'President';
      });
      club.creatorId = newPresidentId;
      await club.save();
      return reply.send({ message: 'Leadership transferred. New President assigned.' });
    } catch (err) {return reply.code(500).send({ message: err.message });}
  });

  fastify.post('/api/clubs/:id/promote', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { memberId } = request.body || {};
      const club = await Club.findById(request.params.id);
      if (!club) return reply.code(404).send({ message: 'Club not found' });
      if (club.creatorId.toString() !== request.user.id) return reply.code(403).send({ message: 'Only the President can promote members' });
      if (club.members.some((m) => m.role === 'Vice President')) return reply.code(400).send({ message: 'Already has a Vice President. Demote first.' });
      const m = club.members.find((m) => m.userId.toString() === memberId);
      if (!m) return reply.code(400).send({ message: 'Member not found' });
      if (m.role !== 'Member') return reply.code(400).send({ message: 'User already holds a leadership rank' });
      m.role = 'Vice President';await club.save();
      return reply.send({ message: `${m.username} promoted to Vice President` });
    } catch (err) {return reply.code(500).send({ message: err.message });}
  });

  fastify.post('/api/clubs/:id/demote', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const { memberId } = request.body || {};
      const club = await Club.findById(request.params.id);
      if (!club) return reply.code(404).send({ message: 'Club not found' });
      if (club.creatorId.toString() !== request.user.id) return reply.code(403).send({ message: 'Only the President can demote members' });
      const m = club.members.find((m) => m.userId.toString() === memberId);
      if (!m) return reply.code(400).send({ message: 'Member not found' });
      if (m.role === 'President') return reply.code(400).send({ message: 'Cannot demote the President. Use Transfer instead.' });
      m.role = 'Member';await club.save();
      return reply.send({ message: `${m.username} demoted to Member` });
    } catch (err) {return reply.code(500).send({ message: err.message });}
  });

  fastify.put('/api/clubs/:id', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const club = await Club.findById(request.params.id);
      if (!club) return reply.code(404).send({ message: 'Club not found' });
      if (club.creatorId.toString() !== request.user.id) return reply.code(403).send({ message: 'Only the President can edit club info' });
      if (club.lastEditedAt) {
        const days = (new Date() - new Date(club.lastEditedAt)) / 86400000;
        if (days < 30) return reply.code(400).send({ message: `Cooldown active. You can edit again in ${Math.ceil(30 - days)} days.` });
      }
      const { name, description, rules, goal, socials } = request.body || {};
      if (name) club.name = name;
      if (description) club.description = description;
      if (rules) club.rules = rules;
      if (goal) club.goal = goal;
      if (socials) club.socials = socials;
      club.lastEditedAt = new Date();
      await club.save();
      return reply.send(club);
    } catch (err) {return reply.code(400).send({ message: err.message });}
  });


  fastify.get('/api/clubs/:id/notices', async (request) => {
    return Notice.find({ clubId: request.params.id }).sort({ isPinned: -1, timestamp: -1 });
  });

  fastify.post('/api/clubs/:id/notices', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const club = await Club.findById(request.params.id);
      if (!club) return reply.code(404).send({ message: 'Club not found' });
      if (!club.members.some((m) => m.userId.toString() === request.user.id)) return reply.code(403).send({ message: 'Only members can post notices' });
      const { title, content, category } = request.body || {};
      const notice = new Notice({ clubId: request.params.id, userId: request.user.id, username: request.user.username, title, content, category });
      await notice.save();
      return reply.code(201).send(notice);
    } catch (err) {return reply.code(400).send({ message: err.message });}
  });

  fastify.put('/api/notices/:id', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const notice = await Notice.findById(request.params.id);
      if (!notice) return reply.code(404).send({ message: 'Notice not found' });
      const club = await Club.findById(notice.clubId);
      if (!club) return reply.code(404).send({ message: 'Club not found' });
      const isPresident = club.creatorId.toString() === request.user.id;
      const isAuthor = notice.userId.toString() === request.user.id;
      if (!isPresident && !isAuthor) return reply.code(403).send({ message: 'Unauthorized' });
      const { title, content, category, isPinned } = request.body || {};
      if (title) notice.title = title;
      if (content) notice.content = content;
      if (category) notice.category = category;
      if (isPinned !== undefined && isPresident) notice.isPinned = isPinned;
      await notice.save();
      return reply.send(notice);
    } catch (err) {return reply.code(400).send({ message: err.message });}
  });

  fastify.delete('/api/notices/:id', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const notice = await Notice.findById(request.params.id);
      if (!notice) return reply.code(404).send({ message: 'Notice not found' });
      const club = await Club.findById(notice.clubId);
      if (!(club && club.creatorId.toString() === request.user.id) && notice.userId.toString() !== request.user.id) return reply.code(403).send({ message: 'Unauthorized' });
      await Notice.findByIdAndDelete(request.params.id);
      return reply.send({ message: 'Notice removed' });
    } catch (err) {return reply.code(400).send({ message: err.message });}
  });

  fastify.patch('/api/notices/:id/like', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const notice = await Notice.findById(request.params.id);
      if (!notice) return reply.code(404).send({ message: 'Not found' });
      const idx = notice.likes.findIndex((id) => id.toString() === request.user.id);
      if (idx === -1) notice.likes.push(request.user.id);else
      notice.likes.splice(idx, 1);
      await notice.save();
      return reply.send(notice);
    } catch (err) {return reply.code(400).send({ message: err.message });}
  });

  fastify.patch('/api/notices/:id/pin', { preHandler: authenticateToken }, async (request, reply) => {
    try {
      const notice = await Notice.findById(request.params.id);
      if (!notice) return reply.code(404).send({ message: 'Not found' });
      const club = await Club.findById(notice.clubId);
      if (!club || club.creatorId.toString() !== request.user.id) return reply.code(403).send({ message: 'Only the President can pin notices' });
      notice.isPinned = !notice.isPinned;
      await notice.save();
      return reply.send(notice);
    } catch (err) {return reply.code(400).send({ message: err.message });}
  });


  await initMongoDB();
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[FASTIFY] Pariwartan server running on port ${PORT}`);
  setupSocketIO(fastify.server);
}




function startExpressServer() {
  const express = require('express');
  const cors = require('cors');
  const helmet = require('helmet');
  const rateLimit = require('express-rate-limit');
  const multer = require('multer');
  const http = require('http');

  const app = express();
  const server = http.createServer(app);

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: CORS_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'] }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use('/uploads', express.static(uploadsDir));


  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { message: 'Too many attempts. Try again in 15 minutes.' } });
  app.use(['/api/auth/login', '/api/auth/register', '/api/admin/login'], authLimiter);


  const mkFilter = (exts) => (_, f, cb) => exts.includes(path.extname(f.originalname).toLowerCase()) ? cb(null, true) : cb(new Error('Only image files allowed'));
  const makeStorage = (dest) => IMAGEKIT_ENABLED ?
  multer.memoryStorage() :
  multer.diskStorage({ destination: (_, __, cb) => cb(null, dest), filename: (_, f, cb) => cb(null, generateFilename(f.originalname)) });
  const upload = multer({ storage: makeStorage(complaintsDir), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: mkFilter(ALLOWED_IMAGE_EXTS) });
  const profileUpload = multer({ storage: makeStorage(profilesDir), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: mkFilter(ALLOWED_PROFILE_EXTS) });

  async function expressFileUrl(file, folder) {
    if (IMAGEKIT_ENABLED) {
      const dataUri = `data:${file.mimetype || 'application/octet-stream'};base64,${file.buffer.toString('base64')}`;
      const result = await imagekit.files.upload({ file: dataUri, fileName: generateFilename(file.originalname), folder: `pariwartan/${folder}` });
      return result.url;
    }
    return `/uploads/${folder}/${file.filename}`;
  }


  const auth = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return res.status(401).json({ message: 'User not found' });
      if (user.isBanned) {
        if (user.banType === 'permanent') return res.status(403).json({ banned: true, reason: user.banReason, type: 'permanent' });
        if (user.banType === 'temporary' && user.banExpiry > new Date()) return res.status(403).json({ banned: true, reason: user.banReason, type: 'temporary', expiry: user.banExpiry });
        user.isBanned = false;user.banType = 'none';await user.save();
      }
      req.user = decoded;next();
    } catch (err) {res.status(401).json({ message: err.name === 'JsonWebTokenError' ? 'Invalid token' : 'Unauthorized' });}
  };

  const authAdmin = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded.adminId) throw new Error('Not admin');
      const admin = await Admin.findById(decoded.adminId);
      if (!admin) throw new Error('Not found');
      req.admin = admin;next();
    } catch {res.status(403).json({ message: 'Admin access required' });}
  };

  const optAuth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return next();
    try {req.user = jwt.verify(token, JWT_SECRET);} catch {}
    next();
  };


  app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (admin && bcrypt.compareSync(password, admin.password)) {
      const token = jwt.sign({ adminId: admin._id, username: admin.username }, JWT_SECRET, { expiresIn: '1d' });
      return res.json({ token, user: { id: admin._id, username: admin.username, permissions: admin.permissions } });
    }
    res.status(401).json({ message: 'Invalid Admin Credentials' });
  });

  app.post('/api/auth/register', profileUpload.single('profilePic'), async (req, res) => {
    try {
      const { username, email, password, deviceId } = req.body;
      let deviceFootprint = null;
      try {deviceFootprint = JSON.parse(req.body.deviceFootprint || 'null');} catch {}
      const ipAddress = getIP(req);
      const fingerprintHash = generateFingerprint(deviceFootprint);
      const profilePic = req.file ? await expressFileUrl(req.file, 'profiles') : '';
      if (!username || !email || !password) return res.status(400).json({ message: 'Username, email, and password are required' });
      if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
      const safeEmail = email.trim().toLowerCase().slice(0, 100);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) return res.status(400).json({ message: 'Invalid email format' });
      if (fingerprintHash && (await User.findOne({ fingerprintHash }))) return res.status(403).json({ message: 'Security Alert: Multiple accounts detected from this hardware.' });
      if (deviceId && (await User.findOne({ deviceId }))) return res.status(403).json({ message: 'Security Alert: A profile is already linked to this device.' });
      if ((await User.countDocuments({ ipAddress })) >= 10) return res.status(403).json({ message: 'Maximum citizen registration reached for this IP network.' });
      const newUser = new User({ username: username.trim().slice(0, 30), email: safeEmail, password: bcrypt.hashSync(password, 10), profilePic, ipAddress, deviceId, deviceFootprint: deviceFootprint || {}, fingerprintHash });
      await newUser.save();
      const token = jwt.sign({ id: newUser._id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({ token, user: { id: newUser._id, username: newUser.username, profilePic: newUser.profilePic, ecoPoints: newUser.ecoPoints, currentWard: newUser.currentWard } });
    } catch {res.status(400).json({ message: 'Registration failed. User might already exist.' });}
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password, deviceId, deviceFootprint } = req.body;
      const user = await User.findOne({ email });
      const ipAddress = getIP(req);
      if (user && bcrypt.compareSync(password, user.password)) {
        user.ipAddress = ipAddress;
        if (deviceId) user.deviceId = deviceId;
        if (deviceFootprint) user.deviceFootprint = deviceFootprint;
        await user.save();
        if (user.isBanned) {
          if (user.banType === 'permanent') return res.status(403).json({ banned: true, reason: user.banReason, type: 'permanent' });
          if (user.banType === 'temporary' && user.banExpiry && user.banExpiry > new Date()) return res.status(403).json({ banned: true, reason: user.banReason, type: 'temporary', expiry: user.banExpiry });
          if (user.banType === 'temporary' && (!user.banExpiry || user.banExpiry <= new Date())) {user.isBanned = false;user.banType = 'none';await user.save();}
        }
        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ token, user: { id: user._id, username: user.username, profilePic: user.profilePic, ecoPoints: user.ecoPoints, currentWard: user.currentWard } });
      }
      res.status(401).json({ message: 'Invalid Credentials' });
    } catch (err) {res.status(500).json({ message: err.message });}
  });

  app.get('/api/suggestions', async (req, res) => {try {res.json(await Suggestion.find({ status: { $nin: ['Pending', 'Rejected'] } }).sort({ upvotes: -1, timestamp: -1 }).populate('userId', 'username profilePic'));} catch (err) {res.status(500).json({ message: err.message });}});
  app.get('/api/admin/suggestions', authAdmin, async (req, res) => {if (!req.admin.permissions.viewComplaints) return res.status(403).json({ message: 'No permission' });try {res.json(await Suggestion.find().sort({ timestamp: -1 }));} catch (err) {res.status(500).json({ message: err.message });}});
  app.get('/api/me/suggestions', auth, async (req, res) => {try {res.json(await Suggestion.find({ userId: req.user.id }).sort({ timestamp: -1 }).populate('userId', 'username profilePic'));} catch (err) {res.status(500).json({ message: err.message });}});
  app.post('/api/suggestions', auth, upload.array('images', 3), async (req, res) => {
    try {
      const safeTitle = typeof req.body.title === 'string' ? req.body.title.trim().slice(0, 150) : '';
      const safeDesc = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 2000) : '';
      if (!safeTitle || !safeDesc) return res.status(400).json({ message: 'Title and description are required' });
      const complaintId = await getNextId('complaint', 'CMP');
      const images = await Promise.all((req.files || []).map((f) => expressFileUrl(f, 'complaints')));
      const s = new Suggestion({ userId: req.user.id, title: safeTitle, description: safeDesc, lat: req.body.lat, lng: req.body.lng, type: req.body.type, wada: req.body.wada, city: req.body.city, complaintId, markerType: req.body.markerType, images, timeline: [{ status: 'Pending', timestamp: new Date(), by: 'System' }] });
      await s.save();await checkAndAwardBadges(req.user.id);res.status(201).json(s);
    } catch (err) {res.status(400).json({ message: err.message });}
  });

  app.get('/api/admin/users', authAdmin, async (req, res) => {if (req.admin.username !== 'sohailk2064') return res.status(403).json({ message: 'Forbidden' });res.json(await Admin.find({ username: { $ne: 'sohailk2064' } }));});
  app.post('/api/admin/users', authAdmin, async (req, res) => {
    if (!hasPermission(req.admin, 'manageAdmins')) return res.status(403).json({ message: 'Forbidden' });
    try {const { username, password, permissions, organizerDetails } = req.body;if (await Admin.findOne({ username })) return res.status(400).json({ message: 'Username already taken' });const a = new Admin({ username, password: bcrypt.hashSync(password, 10), permissions, organizerDetails });await a.save();await logAdminAction(req.admin.username, 'CREATE_ADMIN', a._id, `Created admin ${username}`);res.status(201).json(a);} catch (err) {res.status(500).json({ message: err.message });}
  });
  app.delete('/api/admin/users/:id', authAdmin, async (req, res) => {
    if (!hasPermission(req.admin, 'manageAdmins')) return res.status(403).json({ message: 'Forbidden' });
    try {const deleted = await Admin.findByIdAndDelete(req.params.id);if (!deleted) return res.status(404).json({ message: 'Admin not found' });await logAdminAction(req.admin.username, 'DELETE_ADMIN', req.params.id, `Deleted admin: ${deleted.username}`);res.json({ message: 'Admin deleted successfully' });} catch (err) {res.status(500).json({ message: err.message });}
  });

  app.get('/api/admin/platform-users', authAdmin, async (req, res) => {
    if (!hasPermission(req.admin, 'manageUsers')) return res.status(403).json({ message: 'Forbidden' });
    try {const users = await User.find().select('-password').sort({ createdAt: -1 });const clubs = await Club.find();res.json(users.map((u) => {const o = u.toObject();const c = clubs.find((c) => c.members.some((m) => m.userId.toString() === u._id.toString()));o.clubStatus = c ? `Member of ${c.name}` : 'No Club';return o;}));} catch (err) {res.status(500).json({ message: err.message });}
  });
  app.post('/api/admin/platform-users/:id/ban', authAdmin, async (req, res) => {
    if (!hasPermission(req.admin, 'manageUsers')) return res.status(403).json({ message: 'Forbidden' });
    try {
      const { banType, durationDays, reason } = req.body;
      const update = { isBanned: banType !== 'none', banType, banReason: reason || '' };
      if (banType === 'temporary' && durationDays) {update.banExpiry = new Date();update.banExpiry.setDate(update.banExpiry.getDate() + parseInt(durationDays));} else
      if (banType === 'none') {update.banExpiry = null;update.banReason = '';} else
      {update.banExpiry = null;}
      const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
      if (banType === 'permanent') await handleBanClubTransfer(req.params.id);
      await logAdminAction(req.admin.username, 'BAN_USER', req.params.id, `Status: ${banType}${reason ? ' - Reason: ' + reason : ''}`);
      res.json(user);
    } catch (err) {res.status(500).json({ message: err.message });}
  });
  app.delete('/api/admin/platform-users/:id', authAdmin, async (req, res) => {if (!hasPermission(req.admin, 'manageUsers')) return res.status(403).json({ message: 'Forbidden' });try {await handleDeleteUserClubs(req.params.id);const u = await User.findByIdAndDelete(req.params.id);await logAdminAction(req.admin.username, 'DELETE_USER', req.params.id, `Deleted user: ${u?.username}`);res.json({ message: 'User deleted' });} catch (err) {res.status(500).json({ message: err.message });}});

  app.get('/api/admin/all-clubs', authAdmin, async (req, res) => {if (!hasPermission(req.admin, 'manageClubs')) return res.status(403).json({ message: 'Forbidden' });try {res.json(await Club.find().sort({ timestamp: -1 }));} catch (err) {res.status(500).json({ message: err.message });}});
  app.delete('/api/admin/clubs/:id', authAdmin, async (req, res) => {
    if (!hasPermission(req.admin, 'manageClubs')) return res.status(403).json({ message: 'Forbidden' });
    try {const club = await Club.findByIdAndDelete(req.params.id);if (club?.members) {for (const m of club.members) createNotification(m.userId, 'club_deleted', 'Club Deleted', `The club "${club.name}" was deleted by an administrator.`);}await logAdminAction(req.admin.username, 'DELETE_CLUB_MANAGER', req.params.id, `Deleted club: ${club?.name}`);res.json({ message: 'Club deleted' });} catch (err) {res.status(500).json({ message: err.message });}
  });
  app.delete('/api/admin/clubs/:id/members/:userId', authAdmin, async (req, res) => {
    if (!hasPermission(req.admin, 'manageClubs')) return res.status(403).json({ message: 'Forbidden' });
    try {const club = await Club.findById(req.params.id);if (!club) return res.status(404).json({ message: 'Club not found' });if (club.creatorId.toString() === req.params.userId) return res.status(400).json({ message: 'Cannot kick the President.' });club.members = club.members.filter((m) => m.userId.toString() !== req.params.userId);await club.save();createNotification(req.params.userId, 'club_kicked', 'Removed from Club', `You were removed from "${club.name}" by an administrator.`);await logAdminAction(req.admin.username, 'KICK_MEMBER_MANAGER', req.params.id, `Kicked ${req.params.userId} from ${club.name}`);res.json({ message: 'Member kicked' });} catch (err) {res.status(500).json({ message: err.message });}
  });

  app.get('/api/campaigns', async (req, res) => {try {res.json(await Campaign.find().sort({ timestamp: -1 }));} catch (err) {res.status(500).json({ message: err.message });}});
  app.post('/api/campaigns/:id/register', optAuth, async (req, res) => {try {await new CampaignRegistration({ campaignId: req.params.id, userId: req.user?.id, ...req.body }).save();res.status(201).json({ message: 'Registered successfully' });} catch (err) {res.status(400).json({ message: err.message });}});
  app.get('/api/admin/campaigns/:id/registrations', authAdmin, async (req, res) => {if (!req.admin.permissions.addCampaigns) return res.status(403).json({ message: 'No permission' });res.json(await CampaignRegistration.find({ campaignId: req.params.id }).sort({ timestamp: -1 }));});
  app.post('/api/admin/campaigns', authAdmin, async (req, res) => {if (!req.admin.permissions.addCampaigns) return res.status(403).json({ message: 'No permission' });const c = new Campaign(req.body);await c.save();await logAdminAction(req.admin.username, 'ADD_CAMPAIGN', c._id, `Added: ${c.title}`);res.status(201).json(c);});
  app.delete('/api/admin/campaigns/:id', authAdmin, async (req, res) => {if (!req.admin.permissions.deleteCampaign) return res.status(403).json({ message: 'No permission' });const c = await Campaign.findByIdAndDelete(req.params.id);await logAdminAction(req.admin.username, 'DELETE_CAMPAIGN', req.params.id, `Deleted: ${c?.title}`);res.json({ message: 'Deleted' });});
  app.get('/api/admin/logs', authAdmin, async (req, res) => {if (!req.admin.permissions.viewLogs) return res.status(403).json({ message: 'No permission' });res.json(await AdminLog.find().sort({ timestamp: -1 }).limit(100));});

  app.patch('/api/suggestions/:id/status', authAdmin, async (req, res) => {
    try {
      const { status, rejectionReason } = req.body;
      if (['Approved', 'Rejected', 'Progress', 'Pending'].includes(status) && !req.admin.permissions.approveComplaint) return res.status(403).json({ message: 'No permission' });
      if (status === 'Resolved' && !req.admin.permissions.resolveComplaint) return res.status(403).json({ message: 'No permission to resolve' });
      const update = { status, $push: { timeline: { status, timestamp: new Date(), by: req.admin.username } } };
      if (rejectionReason !== undefined) update.rejectionReason = rejectionReason;
      if (status === 'Rejected') update.adminReplyId = await getNextId('adminreply', 'ADM');
      const old = await Suggestion.findById(req.params.id);
      const s = await Suggestion.findByIdAndUpdate(req.params.id, update, { new: true });
      if (!s) return res.status(404).json({ message: 'Not found' });
      if (old.status === 'Pending' && status === 'Progress') {await User.findByIdAndUpdate(s.userId, { $inc: { ecoPoints: 3 } });createNotification(s.userId, 'eco_points', 'Eco Points Earned', `You earned 3 eco points! Your report is now in progress.`);}
      const msgs = { Approved: `Your report "${s.title}" has been approved.`, Rejected: `Your report "${s.title}" was rejected.${rejectionReason ? ' Reason: ' + rejectionReason : ''}`, Resolved: `Your report "${s.title}" has been resolved!`, Progress: `Your report "${s.title}" is now in progress.`, Pending: `Your report "${s.title}" has been moved back to pending.` };
      if (msgs[status]) createNotification(s.userId, `complaint_${status.toLowerCase()}`, `Report ${status}`, msgs[status]);
      await checkAndAwardBadges(s.userId);
      await logAdminAction(req.admin.username, `UPDATE_STATUS_${status.toUpperCase()}`, req.params.id, `Changed to ${status}`);
      res.json(s);
    } catch (err) {res.status(400).json({ message: err.message });}
  });

  app.patch('/api/suggestions/:id/upvote', auth, async (req, res) => {try {const s = await Suggestion.findById(req.params.id);if (!s) return res.status(404).json({ message: 'Not found' });const v = s.upvotedBy.some((id) => id.toString() === req.user.id);if (v) {s.upvotes = Math.max(0, s.upvotes - 1);s.upvotedBy = s.upvotedBy.filter((id) => id.toString() !== req.user.id);} else {s.upvotes++;s.upvotedBy.push(req.user.id);}await s.save();res.json(s);} catch (err) {res.status(500).json({ message: err.message });}});
  app.delete('/api/suggestions/:id', authAdmin, async (req, res) => {
    try {if (!req.admin.permissions.removeComplaint) return res.status(403).json({ message: 'No permission' });const s = await Suggestion.findByIdAndDelete(req.params.id);if (s?.images?.length) {for (const img of s.images) {const fp = path.resolve(__dirname, img.replace(/^[\\/]+/, ''));if (fp.startsWith(uploadsDir)) fs.unlink(fp, () => {});}}if (s) createNotification(s.userId, 'complaint_deleted', 'Report Deleted', `Your report "${s.title}" was removed.`);await logAdminAction(req.admin.username, 'DELETE_COMPLAINT', req.params.id, `Deleted: ${s?.title}`);res.json({ message: 'Deleted' });} catch (err) {res.status(500).json({ message: err.message });}
  });
  app.get('/api/suggestions/:id/comments', async (req, res) => {try {res.json(await Discussion.find({ suggestionId: req.params.id }).sort({ timestamp: 1 }));} catch (err) {res.status(500).json({ message: err.message });}});

  app.get('/api/user/profile', auth, async (req, res) => {try {await checkAndAwardBadges(req.user.id);res.json(await User.findById(req.user.id).select('-password'));} catch {res.status(500).json({ message: 'Error fetching profile' });}});
  app.put('/api/user/profile', auth, async (req, res) => {
    try {
      const { username, oldPassword, newPassword } = req.body;
      const user = await User.findById(req.user.id);
      if (oldPassword && newPassword) {if (!bcrypt.compareSync(oldPassword, user.password)) return res.status(401).json({ message: 'Incorrect old password' });if (newPassword.length < 6) return res.status(400).json({ message: 'Min 6 chars' });user.password = bcrypt.hashSync(newPassword, 10);}
      if (username) {const t = username.trim().slice(0, 30);if (t && t !== user.username) {if (user.lastUsernameChange) {const d = (new Date() - new Date(user.lastUsernameChange)) / 86400000;if (d < 30) return res.status(400).json({ message: `Change again in ${Math.ceil(30 - d)} days.` });}if (await User.findOne({ username: t })) return res.status(400).json({ message: 'Username already taken' });user.username = t;user.lastUsernameChange = new Date();}}
      await user.save();const r = user.toObject();delete r.password;res.json(r);
    } catch {res.status(500).json({ message: 'Error updating profile' });}
  });
  app.post('/api/user/profile-pic', auth, profileUpload.single('profilePic'), async (req, res) => {
    try {if (!req.file) return res.status(400).json({ message: 'No image uploaded' });const user = await User.findById(req.user.id);if (user.profilePic?.startsWith('/uploads/profiles/')) {const old = path.resolve(__dirname, user.profilePic.replace(/^[\\/]+/, ''));if (old.startsWith(profilesDir)) fs.unlink(old, () => {});}user.profilePic = await expressFileUrl(req.file, 'profiles');await user.save();res.json({ profilePic: user.profilePic });} catch {res.status(500).json({ message: 'Error uploading' });}
  });
  app.post('/api/suggestions/:id/after-images', authAdmin, upload.array('afterImages', 3), async (req, res) => {
    try {if (!req.admin.permissions.resolveComplaint) return res.status(403).json({ message: 'No permission' });const s = await Suggestion.findById(req.params.id);if (!s) return res.status(404).json({ message: 'Not found' });const paths = await Promise.all((req.files || []).map((f) => expressFileUrl(f, 'complaints')));s.afterImages.push(...paths);await s.save();await logAdminAction(req.admin.username, 'UPLOAD_AFTER_IMAGES', req.params.id, `Uploaded ${paths.length} after image(s)`);res.json(s);} catch (err) {res.status(400).json({ message: err.message });}
  });

  app.get('/api/badges', (req, res) => res.json(BADGE_DEFS.map((b) => ({ id: b.id, label: b.label, desc: b.desc, icon: b.icon, target: b.target }))));
  app.get('/api/leaderboard', async (req, res) => {try {const users = await User.find({}, 'username profilePic ecoPoints badges equippedBadge').sort({ ecoPoints: -1 }).limit(50).lean();res.json(users.map((u, i) => ({ rank: i + 1, username: u.username, profilePic: u.profilePic, ecoPoints: u.ecoPoints || 0, badges: u.badges || [], equippedBadge: u.equippedBadge || '' })));} catch {res.status(500).json({ message: 'Server error' });}});
  app.patch('/api/user/badge', auth, async (req, res) => {try {const { badgeId } = req.body;const user = await User.findById(req.user.id);if (badgeId && !user.badges.includes(badgeId)) return res.status(400).json({ message: 'Badge not earned yet' });user.equippedBadge = badgeId || '';await user.save();res.json({ equippedBadge: user.equippedBadge });} catch {res.status(500).json({ message: 'Failed' });}});

  app.get('/api/notifications', auth, async (req, res) => {try {res.json(await Notification.find({ userId: req.user.id }).sort({ timestamp: -1 }).limit(50));} catch {res.status(500).json({ message: 'Error' });}});
  app.get('/api/notifications/unread-count', auth, async (req, res) => {try {res.json({ count: await Notification.countDocuments({ userId: req.user.id, read: false }) });} catch {res.json({ count: 0 });}});
  app.patch('/api/notifications/read-all', auth, async (req, res) => {await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });res.json({ message: 'All marked as read' });});
  app.patch('/api/notifications/:id/read', auth, async (req, res) => {await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { read: true });res.json({ message: 'Marked as read' });});

  app.post('/api/admin/broadcast-notification', authAdmin, async (req, res) => {
    if (!hasPermission(req.admin, 'broadcastNotification')) return res.status(403).json({ message: 'Forbidden' });
    try {const { title, message } = req.body;if (!title || !message) return res.status(400).json({ message: 'Title and message required' });const users = await User.find({}, '_id');await Notification.insertMany(users.map((u) => ({ userId: u._id, type: 'announcement', title, message })));await logAdminAction(req.admin.username, 'BROADCAST_NOTIFICATION', 'all', `Broadcast "${title}" to ${users.length}`);res.json({ message: `Sent to ${users.length} users` });} catch {res.status(500).json({ message: 'Failed' });}
  });
  app.get('/api/admin/broadcast-history', authAdmin, async (req, res) => {
    if (!hasPermission(req.admin, 'broadcastNotification')) return res.status(403).json({ message: 'Forbidden' });
    try {res.json(await Notification.aggregate([{ $match: { type: 'announcement' } }, { $group: { _id: { title: '$title', message: '$message' }, timestamp: { $first: '$timestamp' }, count: { $sum: 1 } } }, { $sort: { timestamp: -1 } }, { $limit: 20 }, { $project: { _id: 0, title: '$_id.title', message: '$_id.message', timestamp: 1, recipientCount: '$count' } }]));} catch {res.json([]);}
  });
  app.delete('/api/admin/broadcast-notification', authAdmin, async (req, res) => {
    if (!hasPermission(req.admin, 'broadcastNotification')) return res.status(403).json({ message: 'Forbidden' });
    try {const { title, message } = req.body;if (!title || !message) return res.status(400).json({ message: 'Title and message required' });const result = await Notification.deleteMany({ type: 'announcement', title, message });await logAdminAction(req.admin.username, 'DELETE_BROADCAST', 'all', `Deleted "${title}" (${result.deletedCount} removed)`);res.json({ message: `Deleted (${result.deletedCount} notifications removed)` });} catch {res.status(500).json({ message: 'Failed' });}
  });

  app.get('/api/clubs', async (req, res) => {try {const { wada } = req.query;res.json(await Club.find(wada ? { wada } : {}).sort({ timestamp: -1 }));} catch (err) {res.status(500).json({ message: err.message });}});
  app.post('/api/clubs', auth, async (req, res) => {
    try {
      const { name, description, wada, city, rules, goal, socials } = req.body;
      if (await Club.findOne({ 'members.userId': req.user.id })) return res.status(400).json({ message: 'You are already in another Ward Club.' });
      const club = new Club({ name, description, wada, city, rules, goal, socials, creatorId: req.user.id, members: [{ userId: req.user.id, username: req.user.username, role: 'President' }] });
      await club.save();
      const user = await User.findById(req.user.id);user.currentWard = wada;await user.save();
      await new Notice({ clubId: club._id, userId: req.user.id, username: req.user.username, title: `Welcome to ${name}!`, content: 'This is our club notice board.', category: 'General', isPinned: true }).save();
      res.status(201).json(club);
    } catch (err) {res.status(400).json({ message: err.message });}
  });
  app.post('/api/clubs/:id/join', auth, async (req, res) => {
    try {const club = await Club.findById(req.params.id);if (!club) return res.status(404).json({ message: 'Club not found' });const user = await User.findById(req.user.id);if (user.currentWard && user.currentWard !== club.wada) return res.status(403).json({ message: `Locked to Ward ${user.currentWard}. Leave first.` });if (club.members.some((m) => m.userId.toString() === req.user.id)) return res.status(400).json({ message: 'Already a member' });if (!user.clubJoinedOnce) {await User.findByIdAndUpdate(req.user.id, { $inc: { ecoPoints: 50 }, $set: { clubJoinedOnce: true } });createNotification(req.user.id, 'eco_points', 'Eco Points Earned', 'You earned 50 eco points for joining your first Ward Club!');}club.members.push({ userId: req.user.id, username: req.user.username, role: 'Member' });user.lastJoinedAt = new Date();user.currentWard = club.wada;await club.save();await user.save();await checkAndAwardBadges(req.user.id);res.json(club);} catch (err) {res.status(400).json({ message: err.message });}
  });
  app.post('/api/clubs/:id/leave', auth, async (req, res) => {
    try {const club = await Club.findById(req.params.id);if (!club) return res.status(404).json({ message: 'Club not found' });const user = await User.findById(req.user.id);const idx = club.members.findIndex((m) => m.userId.toString() === req.user.id);if (idx === -1) return res.status(400).json({ message: 'Not a member' });if (user.lastJoinedAt) {const h = (new Date() - new Date(user.lastJoinedAt)) / 3600000;if (h < 24) return res.status(403).json({ message: `Anti-Hopping Shield active. (${Math.ceil(24 - h)}h remaining)` });}if (club.members[idx].role === 'President') {if (club.members.length === 1) {await Club.findByIdAndDelete(req.params.id);await Notice.deleteMany({ clubId: req.params.id });user.currentWard = null;await user.save();return res.json({ message: 'Last resident left. Club deleted.' });}return res.status(400).json({ message: 'Transfer ownership before leaving.' });}club.members.splice(idx, 1);await club.save();user.currentWard = null;await user.save();res.json({ message: 'Left the club.' });} catch (err) {res.status(400).json({ message: err.message });}
  });
  app.post('/api/clubs/:id/transfer', auth, async (req, res) => {try {const { newPresidentId } = req.body;const club = await Club.findById(req.params.id);if (!club) return res.status(404).json({ message: 'Not found' });if (club.creatorId.toString() !== req.user.id) return res.status(403).json({ message: 'Only President can transfer' });const t = club.members.find((m) => m.userId.toString() === newPresidentId);if (!t) return res.status(400).json({ message: 'Must be an active member' });club.members.forEach((m) => {if (m.userId.toString() === req.user.id) m.role = 'Member';if (m.userId.toString() === newPresidentId) m.role = 'President';});club.creatorId = newPresidentId;await club.save();res.json({ message: 'Leadership transferred.' });} catch (err) {res.status(500).json({ message: err.message });}});
  app.post('/api/clubs/:id/promote', auth, async (req, res) => {try {const { memberId } = req.body;const club = await Club.findById(req.params.id);if (!club) return res.status(404).json({ message: 'Not found' });if (club.creatorId.toString() !== req.user.id) return res.status(403).json({ message: 'Only President can promote' });if (club.members.some((m) => m.role === 'Vice President')) return res.status(400).json({ message: 'Already has VP' });const m = club.members.find((m) => m.userId.toString() === memberId);if (!m || m.role !== 'Member') return res.status(400).json({ message: 'Invalid member' });m.role = 'Vice President';await club.save();res.json({ message: `${m.username} promoted` });} catch (err) {res.status(500).json({ message: err.message });}});
  app.post('/api/clubs/:id/demote', auth, async (req, res) => {try {const { memberId } = req.body;const club = await Club.findById(req.params.id);if (!club) return res.status(404).json({ message: 'Not found' });if (club.creatorId.toString() !== req.user.id) return res.status(403).json({ message: 'Only President can demote' });const m = club.members.find((m) => m.userId.toString() === memberId);if (!m) return res.status(400).json({ message: 'Not found' });if (m.role === 'President') return res.status(400).json({ message: 'Cannot demote President' });m.role = 'Member';await club.save();res.json({ message: `${m.username} demoted` });} catch (err) {res.status(500).json({ message: err.message });}});
  app.put('/api/clubs/:id', auth, async (req, res) => {try {const club = await Club.findById(req.params.id);if (!club) return res.status(404).json({ message: 'Not found' });if (club.creatorId.toString() !== req.user.id) return res.status(403).json({ message: 'Only President can edit' });if (club.lastEditedAt) {const d = (new Date() - new Date(club.lastEditedAt)) / 86400000;if (d < 30) return res.status(400).json({ message: `Edit again in ${Math.ceil(30 - d)} days.` });}const { name, description, rules, goal, socials } = req.body;if (name) club.name = name;if (description) club.description = description;if (rules) club.rules = rules;if (goal) club.goal = goal;if (socials) club.socials = socials;club.lastEditedAt = new Date();await club.save();res.json(club);} catch (err) {res.status(400).json({ message: err.message });}});

  app.get('/api/clubs/:id/notices', async (req, res) => {try {res.json(await Notice.find({ clubId: req.params.id }).sort({ isPinned: -1, timestamp: -1 }));} catch (err) {res.status(500).json({ message: err.message });}});
  app.post('/api/clubs/:id/notices', auth, async (req, res) => {try {const club = await Club.findById(req.params.id);if (!club) return res.status(404).json({ message: 'Not found' });if (!club.members.some((m) => m.userId.toString() === req.user.id)) return res.status(403).json({ message: 'Only members can post' });const { title, content, category } = req.body;const n = new Notice({ clubId: req.params.id, userId: req.user.id, username: req.user.username, title, content, category });await n.save();res.status(201).json(n);} catch (err) {res.status(400).json({ message: err.message });}});
  app.put('/api/notices/:id', auth, async (req, res) => {try {const n = await Notice.findById(req.params.id);if (!n) return res.status(404).json({ message: 'Not found' });const club = await Club.findById(n.clubId);const isP = club && club.creatorId.toString() === req.user.id;const isA = n.userId.toString() === req.user.id;if (!isP && !isA) return res.status(403).json({ message: 'Unauthorized' });const { title, content, category, isPinned } = req.body;if (title) n.title = title;if (content) n.content = content;if (category) n.category = category;if (isPinned !== undefined && isP) n.isPinned = isPinned;await n.save();res.json(n);} catch (err) {res.status(400).json({ message: err.message });}});
  app.delete('/api/notices/:id', auth, async (req, res) => {try {const n = await Notice.findById(req.params.id);if (!n) return res.status(404).json({ message: 'Not found' });const club = await Club.findById(n.clubId);if (!(club && club.creatorId.toString() === req.user.id) && n.userId.toString() !== req.user.id) return res.status(403).json({ message: 'Unauthorized' });await Notice.findByIdAndDelete(req.params.id);res.json({ message: 'Removed' });} catch (err) {res.status(400).json({ message: err.message });}});
  app.patch('/api/notices/:id/like', auth, async (req, res) => {try {const n = await Notice.findById(req.params.id);if (!n) return res.status(404).json({ message: 'Not found' });const idx = n.likes.findIndex((id) => id.toString() === req.user.id);if (idx === -1) n.likes.push(req.user.id);else n.likes.splice(idx, 1);await n.save();res.json(n);} catch (err) {res.status(400).json({ message: err.message });}});
  app.patch('/api/notices/:id/pin', auth, async (req, res) => {try {const n = await Notice.findById(req.params.id);if (!n) return res.status(404).json({ message: 'Not found' });const club = await Club.findById(n.clubId);if (!club || club.creatorId.toString() !== req.user.id) return res.status(403).json({ message: 'Only President can pin' });n.isPinned = !n.isPinned;await n.save();res.json(n);} catch (err) {res.status(400).json({ message: err.message });}});


  app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ message: 'Not Found', error: 'Frontend build not found' });
    }
  });


  initMongoDB().then(() => {
    server.listen(PORT, '0.0.0.0', () => console.log(`[EXPRESS FALLBACK] Pariwartan server running on port ${PORT}`));
    setupSocketIO(server);
  }).catch((err) => {console.error('MongoDB Connection Error:', err);process.exit(1);});

  return app;
}




startFastifyServer().catch((err) => {
  console.error('==============================');
  console.error('[FASTIFY FAILED]', err.message);
  console.error('Falling back to Express...');
  console.error('==============================');
  startExpressServer();
});