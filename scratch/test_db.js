const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../backend/.env' });

const test = async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'sowjanya',
    database: process.env.DB_NAME || 'multivendor'
  });

  const [rows, fields] = await connection.query('SELECT price FROM Products LIMIT 1');
  console.log('Original Value:', rows[0]);
  console.log('Original Fields Type:', fields[0].columnType, fields[0].name);

  await connection.end();

  const connectionWithCast = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'sowjanya',
    database: process.env.DB_NAME || 'multivendor',
    typeCast: function (field, next) {
      if (field.type === 'NEWDECIMAL' || field.type === 'DECIMAL') {
        const val = field.string();
        return val === null ? null : parseFloat(val);
      }
      return next();
    }
  });

  const [rowsCast] = await connectionWithCast.query('SELECT price FROM Products LIMIT 1');
  console.log('Cast Value:', rowsCast[0]);
  await connectionWithCast.end();
};

test().catch(console.error);
