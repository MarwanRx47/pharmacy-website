const fs = require('fs');
const path = require('path');

const localeFiles = {
  en: path.join(__dirname, '../locales/en.json'),
  ar: path.join(__dirname, '../locales/ar.json'),
  ckb: path.join(__dirname, '../locales/ckb.json')
};

const locales = {};
for (const [key, filePath] of Object.entries(localeFiles)) {
  try {
    locales[key] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Failed to load locale ${key}:`, err);
    locales[key] = {};
  }
}

function translate(lang, key) {
  const dictionary = locales[lang] || locales.en;
  return dictionary[key] || locales.en[key] || key;
}

function i18nMiddleware(req, res, next) {
  let lang = req.session.lang || req.cookies?.lang || 'en';
  if (!['en', 'ar', 'ckb'].includes(lang)) lang = 'en';
  req.lang = lang;
  res.locals.lang = lang;
  res.locals.dir = ['ar', 'ckb'].includes(lang) ? 'rtl' : 'ltr';
  res.locals.t = (key) => translate(lang, key);
  next();
}

module.exports = { i18nMiddleware, translate };
