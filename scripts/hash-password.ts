import bcrypt from "bcryptjs";

const password = process.argv.slice(2).join(" ");

if (!password) {
  console.error('Uso: npm run auth:hash -- "a-sua-palavra-passe"');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(hash);
