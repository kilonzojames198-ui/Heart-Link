const bcrypt    = require('bcryptjs');
const { getDb } = require('../config/db');

exports.getRegister = (req, res) =>
  res.render('pages/register', { title: 'Join HeartLink', error: null });

exports.postRegister = async (req, res) => {
  const db = await getDb();
  const { name, email, password, age, gender, interested_in, bio, interests } = req.body;

  if (!name || !email || !password || !age || !gender)
    return res.render('pages/register', { title: 'Join HeartLink', error: 'Please fill in all required fields.' });

  if (password.length < 6)
    return res.render('pages/register', { title: 'Join HeartLink', error: 'Password must be at least 6 characters.' });

  if (db.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase().trim()))
    return res.render('pages/register', { title: 'Join HeartLink', error: 'An account with that email already exists.' });

  const hashed = await bcrypt.hash(password, 10);
  const interestsJson = JSON.stringify(interests
    ? (Array.isArray(interests) ? interests : [interests]) : []);
  const avatar = req.file ? `/uploads/${req.file.filename}` : null;

  const result = db.prepare(
    `INSERT INTO users (name,email,password,age,gender,interested_in,bio,interests,avatar)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(name.trim(), email.toLowerCase().trim(), hashed,
        parseInt(age), gender, interested_in||'everyone', bio||'', interestsJson, avatar);

  req.session.userId   = result.lastInsertRowid;
  req.session.userName = name.trim();
  req.session.userRole = 'user';
  res.redirect('/dashboard');
};

exports.getLogin = (req, res) =>
  res.render('pages/login', { title: 'Sign In', error: null });

exports.postLogin = async (req, res) => {
  const db    = await getDb();
  const email = (req.body.email || '').toLowerCase().trim();
  const pass  = (req.body.password || '');

  if (!email || !pass)
    return res.render('pages/login', { title: 'Sign In', error: 'Please enter your email and password.' });

  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user)
    return res.render('pages/login', { title: 'Sign In', error: 'No account found with that email. Please register first.' });

  if (!user.is_active)
    return res.render('pages/login', { title: 'Sign In', error: 'Your account has been suspended. Contact support.' });

  const match = await bcrypt.compare(pass, user.password);
  if (!match)
    return res.render('pages/login', { title: 'Sign In', error: 'Incorrect password. Please try again.' });

  req.session.userId   = user.id;
  req.session.userName = user.name;
  req.session.userRole = user.role || 'user';

  if (user.role === 'admin') return res.redirect('/admin');
  res.redirect('/dashboard');
};

exports.logout = (req, res) => req.session.destroy(() => res.redirect('/'));
