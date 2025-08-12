module.exports = (req, res) => {
  res.status(200).json({ ok: true, worker: "renewals", ranAt: new Date().toISOString() });
};