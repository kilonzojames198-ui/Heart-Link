const { getDb } = require('../config/db');

exports.getDashboard = async (req, res) => {
  const db = await getDb();
  const stats = {
    totalUsers:    db.prepare("SELECT COUNT(*) AS c FROM users WHERE role!='admin'").get().c,
    activeToday:   db.prepare("SELECT COUNT(*) AS c FROM users WHERE date(created_at)=date('now') AND role!='admin'").get().c,
    totalMatches:  db.prepare("SELECT COUNT(*) AS c FROM matches").get().c,
    totalMessages: db.prepare("SELECT COUNT(*) AS c FROM messages").get().c,
    totalPayments: db.prepare("SELECT COUNT(*) AS c FROM payments WHERE status='confirmed'").get().c,
    revenue:       db.prepare("SELECT COALESCE(SUM(amount_usd),0) AS s FROM payments WHERE status='confirmed'").get().s,
    plusUsers:     db.prepare("SELECT COUNT(*) AS c FROM users WHERE plan='plus'").get().c,
    vipUsers:      db.prepare("SELECT COUNT(*) AS c FROM users WHERE plan='vip'").get().c,
    pendingReports:db.prepare("SELECT COUNT(*) AS c FROM reports WHERE status='pending'").get().c,
  };
  const recentUsers = db.prepare("SELECT id,name,email,plan,role,is_active,created_at FROM users WHERE role!='admin' ORDER BY created_at DESC LIMIT 10").all();
  const recentPayments = db.prepare("SELECT p.*,u.name,u.email FROM payments p JOIN users u ON p.user_id=u.id ORDER BY p.created_at DESC LIMIT 10").all();
  const reports = db.prepare("SELECT r.*,ru.name AS reporter_name,rd.name AS reported_name FROM reports r JOIN users ru ON r.reporter_id=ru.id JOIN users rd ON r.reported_id=rd.id ORDER BY r.created_at DESC LIMIT 20").all();
  res.render('pages/admin/dashboard', { title:'Admin Dashboard', stats, recentUsers, recentPayments, reports });
};

exports.getUsers = async (req, res) => {
  const db = await getDb();
  const q  = req.query.q || '';
  let users;
  if (q) {
    users = db.prepare("SELECT * FROM users WHERE role!='admin' AND (name LIKE ? OR email LIKE ?) ORDER BY created_at DESC").all(`%${q}%`,`%${q}%`);
  } else {
    users = db.prepare("SELECT * FROM users WHERE role!='admin' ORDER BY created_at DESC").all();
  }
  res.render('pages/admin/users', { title:'Manage Users', users, q });
};

exports.toggleUser = async (req, res) => {
  const db = await getDb();
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(parseInt(req.params.id));
  if (!user || user.role==='admin') return res.redirect('/admin/users');
  db.prepare('UPDATE users SET is_active=? WHERE id=?').run(user.is_active ? 0 : 1, user.id);
  res.redirect('/admin/users');
};

exports.deleteUser = async (req, res) => {
  const db = await getDb();
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(parseInt(req.params.id));
  if (!user || user.role==='admin') return res.redirect('/admin/users');
  db.prepare('DELETE FROM users WHERE id=?').run(user.id);
  res.redirect('/admin/users');
};

exports.resolveReport = async (req, res) => {
  const db = await getDb();
  db.prepare("UPDATE reports SET status='resolved' WHERE id=?").run(parseInt(req.params.id));
  res.redirect('/admin');
};

exports.getPayments = async (req, res) => {
  const db = await getDb();
  const payments = db.prepare("SELECT p.*,u.name,u.email FROM payments p JOIN users u ON p.user_id=u.id ORDER BY p.created_at DESC").all();
  const total = db.prepare("SELECT COALESCE(SUM(amount_usd),0) AS s FROM payments WHERE status='confirmed'").get().s;
  res.render('pages/admin/payments', { title:'Payments', payments, total });
};
