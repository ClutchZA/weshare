module.exports = async (req, res) => {
  // TODO: verify PayFast IPN signature + amount + source
  res.status(200).send('OK');
};