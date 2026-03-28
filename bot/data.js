const fs   = require('fs');
const path = require('path');

const DATA_DIR   = path.join(__dirname, 'data');
const BUGS_FILE  = path.join(DATA_DIR, 'bugs.json');
const NOTES_FILE = path.join(DATA_DIR, 'notes.txt');

function ensureFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BUGS_FILE))  fs.writeFileSync(BUGS_FILE, '[]', 'utf8');
  if (!fs.existsSync(NOTES_FILE)) fs.writeFileSync(NOTES_FILE, '', 'utf8');
}

function loadBugs() {
  try { return JSON.parse(fs.readFileSync(BUGS_FILE, 'utf8')); }
  catch { return []; }
}

function saveBugs(bugs) {
  fs.writeFileSync(BUGS_FILE, JSON.stringify(bugs, null, 2), 'utf8');
}

function generateId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createBug(text, reporter, channelId) {
  const bugs = loadBugs();
  const now  = new Date().toISOString();
  const bug  = {
    id: generateId(),
    text,
    reporter,
    status: 'open',
    channelId,
    messageId: null,
    createdAt: now,
    updatedAt: now,
  };
  bugs.unshift(bug);
  saveBugs(bugs);
  return bug;
}

function updateBug(id, fields) {
  const bugs = loadBugs();
  const idx  = bugs.findIndex(b => b.id === id);
  if (idx === -1) return null;
  bugs[idx] = { ...bugs[idx], ...fields, updatedAt: new Date().toISOString() };
  saveBugs(bugs);
  return bugs[idx];
}

function deleteBug(id) {
  const bugs    = loadBugs();
  const filtered = bugs.filter(b => b.id !== id);
  if (filtered.length === bugs.length) return false;
  saveBugs(filtered);
  return true;
}

function getBug(id) {
  return loadBugs().find(b => b.id === id) ?? null;
}

function getAllBugs() {
  return loadBugs();
}

function appendNote(text, author) {
  const line = `[${new Date().toLocaleString('nl-NL')}] ${author}: ${text}\n`;
  fs.appendFileSync(NOTES_FILE, line, 'utf8');
  return line.trim();
}

module.exports = { ensureFiles, createBug, updateBug, deleteBug, getBug, getAllBugs, appendNote };
