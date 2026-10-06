// Configuração lida pelo sequelize-cli (npm run migrate). Usa as mesmas variáveis do .env da API.
require('dotenv').config()

const base = {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false
}

module.exports = { development: base, test: base, production: base }
