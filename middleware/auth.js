module.exports = {
  ensureAdmin: (req, res, next) => {
    if (req.session?.isAdmin) {
      return next();
    }
    res.redirect('/auth/login');
  },
  ensureAuth: (req, res, next) => {
    if (req.session?.userId) {
      return next();
    }
    res.redirect('/auth/login');
  }
};
