
import express from 'express';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,        
  user: process.env.DB_USER,              
  password: process.env.DB_PASS,
  database: process.env.DB_NAME, 
  waitForConnections: true,
  connectionLimit: 10,       
  queueLimit: 0
});

export default pool;

async function testarConexao() {
    try {
        const connection = await pool.getConnection();
        console.log('Conexão com o MySQL realizada com sucesso!');
        connection.release(); 
    } catch (erro) {
        console.error('Erro ao conectar no banco de dados:', erro);
    }
}

testarConexao();