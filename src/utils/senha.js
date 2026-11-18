// Senhas: nunca são guardadas em texto. Usamos scrypt (já vem no Node) com um "sal" aleatório por usuário.
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const gerarHash = async senha => {
  const sal = crypto.randomBytes(16);
  const hash = await scrypt(String(senha), sal, 64);
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
};

const conferir = async (senha, guardado) => {
  if (!guardado) return false;
  const [tipo, salHex, hashHex] = String(guardado).split('$');
  if (tipo !== 'scrypt' || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const hash = await scrypt(String(senha), Buffer.from(salHex, 'hex'), esperado.length);
  return crypto.timingSafeEqual(hash, esperado);
};

const sha256 = texto => crypto.createHash('sha256').update(String(texto)).digest('hex');
const tokenAleatorio = () => crypto.randomBytes(32).toString('hex');
const codigoNumerico = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

module.exports = { gerarHash, conferir, sha256, tokenAleatorio, codigoNumerico };
