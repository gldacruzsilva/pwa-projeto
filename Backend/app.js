import express from 'express';
import db from './banco.js'; 
import cors from 'cors';
import { validarCodigoBarras } from './codigoBarras.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '3mb' }));

/* ==========================================
   RELATÓRIOS E LOGIN
   ========================================== */
app.get('/relatorios/produtos', async (req, res) => {
    try {
        const { inicio, fim } = req.query;
        const sql = `
            SELECT 
                p.nome AS product, 
                SUM(iv.qtde) AS quantity, 
                SUM(iv.qtde * iv.preco_vendido) AS revenue
            FROM ItemVenda iv
            JOIN Comanda v ON v.codc = iv.codc
            JOIN Produto p ON p.codp = iv.codp AND p.lote = iv.lote
            WHERE v.data_venda >= ? AND v.data_venda <= ?
            GROUP BY p.codp, p.nome
            ORDER BY quantity DESC LIMIT 5
        `;
        const [results] = await db.execute(sql, [`${inicio} 00:00:00`, `${fim} 23:59:59`]);
        res.status(200).json(results);
    } catch (erro) {
        console.error('Erro ao buscar produtos para relatório:', erro);
        res.status(500).json({ erro: 'Erro interno' });
    }
});

app.get('/relatorios/vendas', async (req, res) => {
    try {
        const [linhas] = await db.execute("SELECT codc, numero_exibicao, data_operacional, nick, valor_total, data_venda, status FROM Comanda ORDER BY data_venda DESC");
        res.status(200).json(linhas);
    } catch (erro) { 
        console.error('Erro ao buscar relatório de vendas:', erro);
        res.status(500).json({ mensagem: 'Erro interno' }); 
    }
});

app.get('/relatorios/pagamentos', async (req, res) => {
    try {
        const { inicio, fim } = req.query;
        const sql = `
            SELECT tp.descricao AS tipo_pagamento, SUM(p.valor) as total
            FROM Pagamento p
            JOIN Comanda c ON p.codc = c.codc
            JOIN TipoPagamento tp ON tp.codtp = p.codtp
            WHERE c.data_venda >= ? AND c.data_venda <= ?
            GROUP BY tp.codtp, tp.descricao
        `;
        const [results] = await db.execute(sql, [`${inicio} 00:00:00`, `${fim} 23:59:59`]);
        res.status(200).json(results);
    } catch (erro) { 
        console.error('Erro ao buscar total de pagamentos:', erro);
        res.status(500).json({ erro: 'Erro interno' }); 
    }
});

app.get('/relatorios/produtos/:nome/pagamentos', async (req, res) => {
    try {
        const { nome } = req.params;
        const { inicio, fim } = req.query;
        const sql = `
            SELECT
                tp.descricao AS name,
                SUM(iv.qtde * iv.preco_vendido * (pg.valor / v.valor_total)) AS value,
                SUM(iv.qtde * (pg.valor / v.valor_total)) AS units
            FROM ItemVenda iv
            JOIN Comanda v ON iv.codc = v.codc
            JOIN Pagamento pg ON v.codc = pg.codc
            JOIN TipoPagamento tp ON tp.codtp = pg.codtp
            JOIN Produto p ON p.codp = iv.codp AND p.lote = iv.lote
            WHERE p.nome = ? AND v.data_venda >= ? AND v.data_venda <= ? AND v.valor_total > 0
            GROUP BY tp.codtp, tp.descricao
        `;
        const [results] = await db.execute(sql, [nome, `${inicio} 00:00:00`, `${fim} 23:59:59`]);
        res.status(200).json(results);
    } catch (erro) { 
        console.error('Erro ao buscar pagamentos do produto:', erro);
        res.status(500).json({ erro: 'Erro interno' }); 
    }
});

app.get('/relatorios/movimentacao-diaria', async (req, res) => {
    try {
        const data = typeof req.query.data === 'string' ? req.query.data : '';
        const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(data)
            && Number.isFinite(new Date(`${data}T00:00:00Z`).getTime())
            && new Date(`${data}T00:00:00Z`).toISOString().slice(0, 10) === data;

        if (!dataValida) {
            return res.status(400).json({ mensagem: 'Informe uma data válida no formato AAAA-MM-DD.' });
        }

        const [comandas] = await db.execute(`
            SELECT codc, numero_exibicao, data_operacional, nick, valor_total,
                   DATE_FORMAT(data_venda, '%Y-%m-%d %H:%i:%s') AS data_venda,
                   status
            FROM Comanda
            WHERE data_venda >= ? AND data_venda < DATE_ADD(?, INTERVAL 1 DAY)
            ORDER BY data_venda ASC, codc ASC
        `, [`${data} 00:00:00`, `${data} 00:00:00`]);

        const [itens] = await db.execute(`
            SELECT iv.codc, iv.codp, p.nome AS produto_nome, iv.lote, iv.qtde, iv.preco_vendido
            FROM ItemVenda iv
            JOIN Comanda c ON c.codc = iv.codc
            LEFT JOIN Produto p ON p.codp = iv.codp AND p.lote = iv.lote
            WHERE c.data_venda >= ? AND c.data_venda < DATE_ADD(?, INTERVAL 1 DAY)
            ORDER BY iv.codc ASC, p.nome ASC, iv.codp ASC
        `, [`${data} 00:00:00`, `${data} 00:00:00`]);

        const [pagamentos] = await db.execute(`
            SELECT pg.codpag,
                   DATE_FORMAT(pg.data, '%Y-%m-%d %H:%i:%s') AS data,
                   tp.descricao AS tipo_pagamento, pg.valor, pg.codc,
                   c.numero_exibicao, c.data_operacional, c.nick
            FROM Pagamento pg
            LEFT JOIN Comanda c ON c.codc = pg.codc
            JOIN TipoPagamento tp ON tp.codtp = pg.codtp
            WHERE pg.data >= ? AND pg.data < DATE_ADD(?, INTERVAL 1 DAY)
            ORDER BY pg.data ASC, pg.codpag ASC
        `, [`${data} 00:00:00`, `${data} 00:00:00`]);

        const [estoque] = await db.execute(`
            SELECT
                se.codse, se.qtde,
                DATE_FORMAT(se.data, '%Y-%m-%d %H:%i:%s') AS data,
                se.codp, se.lote, se.descricao,
                p.nome AS produto_nome, u.nome AS usuario_nome,
                (
                    SELECT anterior.qtde
                    FROM SaldoEstoque anterior
                    WHERE anterior.codp = se.codp
                      AND anterior.lote = se.lote
                      AND (
                        anterior.data < se.data
                        OR (anterior.data = se.data AND anterior.codse < se.codse)
                      )
                    ORDER BY anterior.data DESC, anterior.codse DESC
                    LIMIT 1
                ) AS estoque_anterior
            FROM SaldoEstoque se
            LEFT JOIN Produto p ON p.codp = se.codp AND p.lote = se.lote
            LEFT JOIN Usuario u ON u.codu = se.codu
            WHERE se.data >= ? AND se.data < DATE_ADD(?, INTERVAL 1 DAY)
            ORDER BY se.data ASC, se.codse ASC
        `, [`${data} 00:00:00`, `${data} 00:00:00`]);

        res.status(200).json({ data, comandas, itens, pagamentos, estoque });
    } catch (erro) {
        console.error('Erro ao gerar relatório diário de movimentação:', erro);
        res.status(500).json({ mensagem: 'Erro ao buscar movimentações do dia.' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { nome, senha } = req.body;
        const [linhas] = await db.execute('SELECT codu, nome, tipo FROM Usuario WHERE nome = ? AND senha = ?', [nome, senha]);
        if (linhas.length === 0) return res.status(401).json({ mensagem: 'Usuário ou senha incorretos' });
        res.status(200).json(linhas[0]);
    } catch (erro) { 
        console.error('Erro no login:', erro);
        res.status(500).json({ mensagem: 'Erro interno' }); 
    }
});

/* ==========================================
   ROTAS DE HISTÓRICO E AUDITORIA
   ========================================== */
app.get('/auditoria/estoque', async (req, res) => {
    try {
        const sql = `
            SELECT 
                se.codse, se.qtde, se.data, se.descricao, se.lote,
                p.codp, p.nome AS produto_nome,
                u.codu, u.nome AS usuario_nome, u.tipo AS usuario_tipo
            FROM SaldoEstoque se
            LEFT JOIN Produto p ON se.codp = p.codp AND se.lote = p.lote
            LEFT JOIN Usuario u ON se.codu = u.codu
            ORDER BY se.data DESC, se.codse DESC
        `;
        const [linhas] = await db.execute(sql);
        res.status(200).json(linhas);
    } catch (erro) { 
        console.error('Erro ao buscar histórico de estoque:', erro);
        res.status(500).json({ mensagem: 'Erro ao buscar auditoria' }); 
    }
});

app.get('/auditoria/ativos', async (req, res) => {
    try {
        const sql = `
            SELECT 
                sa.codsa AS codse, sa.qtde, sa.data_hora AS data, sa.descricao,
                a.coda AS codp, a.nome AS produto_nome,
                u.codu, u.nome AS usuario_nome, u.tipo AS usuario_tipo
            FROM SaldoAtivo sa
            LEFT JOIN Ativo a ON sa.coda = a.coda
            LEFT JOIN Usuario u ON sa.codu = u.codu
            ORDER BY sa.data_hora DESC, sa.codsa DESC
        `;
        const [linhas] = await db.execute(sql);
        res.status(200).json(linhas);
    } catch (erro) { 
        console.error('Erro ao buscar histórico de ativos:', erro);
        res.status(500).json({ mensagem: 'Erro interno' }); 
    }
});

app.delete('/auditoria/estoque/:tipo/:id', async (req, res) => {
    try {
        const { tipo, id } = req.params;
        if (tipo === 'ativo') {
            await db.execute('DELETE FROM SaldoAtivo WHERE codsa = ?', [id]);
        } else {
            await db.execute('DELETE FROM SaldoEstoque WHERE codse = ?', [id]);
        }
        res.status(200).json({ mensagem: 'Registro excluído com sucesso.' });
    } catch (erro) { 
        console.error('Erro ao excluir registro de auditoria:', erro);
        res.status(500).json({ mensagem: 'Erro interno ao excluir.' }); 
    }
});

app.delete('/auditoria/estoque', async (req, res) => {
    try {
        await db.execute('DELETE FROM SaldoEstoque');
        await db.execute('DELETE FROM SaldoAtivo'); 
        res.status(200).json({ mensagem: 'Histórico limpo com sucesso.' });
    } catch (erro) { 
        console.error('Erro ao limpar todo o histórico:', erro);
        res.status(500).json({ mensagem: 'Erro ao limpar' }); 
    }
});

/* ==========================================
   ROTAS DE ESTOQUE E PRODUTOS
   ========================================== */
app.get('/produtos', async (req, res) => {
    try {
        const { status } = req.query;
        let sql = 'SELECT codp, nome, preco_venda, preco_custo, qtde_estoque, lote, status, imagem FROM Produto';
        let params = [];
        
        if (status !== undefined && status !== 'all') {
            sql += ' WHERE status = ?';
            params.push(Number(status));
        } else {
            sql += ' WHERE status = 1 OR status IS NULL'; 
        }
        
        const [linhas] = await db.execute(sql, params);
        res.json(linhas);
    } catch (erro) {
        console.error('Erro ao buscar produtos:', erro);
        res.status(500).json({ mensagem: 'Erro interno ao buscar produtos.' });
    }
});

app.get('/produtos/mais-vendidos', async (req, res) => {
    try {
        const [produtos] = await db.execute(`
            SELECT p.codp, p.nome, p.preco_venda, p.qtde_estoque, p.lote, p.imagem,
                   COALESCE(v.quantidade_vendida, 0) AS quantidade_vendida
            FROM Produto p
            LEFT JOIN (
                SELECT iv.codp, iv.lote, SUM(iv.qtde) AS quantidade_vendida
                FROM ItemVenda iv
                JOIN Comanda c ON c.codc = iv.codc
                WHERE c.status = 0
                GROUP BY iv.codp, iv.lote
            ) v ON v.codp = p.codp AND v.lote = p.lote
            WHERE p.status = 1 OR p.status IS NULL
            ORDER BY quantidade_vendida DESC, p.nome ASC, p.codp ASC, p.lote ASC
            LIMIT 6
        `);
        res.status(200).json(produtos);
    } catch (erro) {
        console.error('Erro ao buscar produtos mais vendidos:', erro);
        res.status(500).json({ mensagem: 'Erro ao buscar produtos mais vendidos.' });
    }
});

app.post('/produtos', async (req, res) => {
    try {
        let { codp, nome = '', preco_venda = 0, qtde_estoque = 0, preco_custo = 0, lote = '1', imagem = null, descricao = 'ENTRADA: Cadastro Inicial', codu = 1 } = req.body;

        if (!nome || nome.trim() === '') return res.status(400).json({ mensagem: 'Nome do produto é obrigatório.' });
        if (!validarImagemProduto(imagem)) return res.status(400).json({ mensagem: 'Imagem inválida ou muito grande.' });

        if (codp === undefined || codp === null || String(codp).trim() === '') {
            return res.status(400).json({ detalhe: 'O código de barras é obrigatório.' });
        }

        codp = String(codp).trim();
        const validacaoCodigo = validarCodigoBarras(codp);
        if (!validacaoCodigo.valido) {
            console.warn('[POST /produtos] Código de barras rejeitado:', {
                codigoRecebido: codp,
                tamanho: validacaoCodigo.tamanho ?? codp.length,
                digitoRecebido: validacaoCodigo.digitoInformado ?? codp.at(-1) ?? null,
                digitoEsperado: validacaoCodigo.digitoCalculado ?? null,
                motivo: validacaoCodigo.mensagem
            });
            return res.status(400).json({ detalhe: `Código de barras inválido: ${validacaoCodigo.mensagem}` });
        }

        // Bloqueia a reutilização do código para outro produto.
        {
            const [produtoExistente] = await db.execute('SELECT nome FROM Produto WHERE codp = ? LIMIT 1', [codp]);
            
            if (produtoExistente.length > 0) {
                const nomeNoBanco = String(produtoExistente[0].nome).trim().toLowerCase();
                const nomeNovo = String(nome).trim().toLowerCase();

                if (nomeNoBanco !== nomeNovo) {
                    return res.status(400).json({ 
                        detalhe: `O código de barras "${codp}" já pertence ao produto "${produtoExistente[0].nome}". Use outro código para cadastrar a "${nome}".` 
                    });
                }
            }
        }

        const sql = 'INSERT INTO Produto (codp, nome, preco_venda, qtde_estoque, preco_custo, lote, status, imagem) VALUES (?, ?, ?, ?, ?, ?, 1, ?)';
        await db.execute(sql, [codp, nome.trim(), Number(preco_venda ?? 0), Number(qtde_estoque ?? 0), Number(preco_custo ?? 0), lote, imagem]);
        
        const descSegura = (descricao || 'ENTRADA: Cadastro Inicial').substring(0, 40);
        await db.execute('INSERT INTO SaldoEstoque (qtde, data, codp, codu, descricao, lote) VALUES (?, NOW(), ?, ?, ?, ?)', 
            [Number(qtde_estoque ?? 0), codp, Number(codu ?? 1), descSegura, lote]);

        res.status(201).json({ mensagem: 'Produto cadastrado com sucesso!', codp: codp });
    } catch (erro) {
        console.error('Erro no POST /produtos:', erro);
        if (erro.code === 'ER_DUP_ENTRY') return res.status(400).json({ detalhe: 'Este lote já existe no sistema para este produto!' });
        res.status(500).json({ mensagem: 'Erro interno.', detalhe: erro.message });
    }
});

app.put('/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params; 
        const { nome, preco, preco_venda, qtde_estoque, preco_custo, lote, lote_original, imagem, descricao = 'Movimentação', codu = 1 } = req.body;
        if (imagem !== undefined && !validarImagemProduto(imagem)) {
            return res.status(400).json({ mensagem: 'Imagem inválida ou muito grande.' });
        }

        const [produtoAtual] = await db.execute(
            'SELECT nome, preco_venda, qtde_estoque, preco_custo, lote, imagem FROM Produto WHERE codp = ? AND lote = ?',
            [id, lote_original ?? ''] 
        );
        
        if (produtoAtual.length === 0) return res.status(404).json({ mensagem: 'Produto não encontrado no lote especificado.' });
        
        const p = produtoAtual[0];
        
        const nomeFinal = nome !== undefined ? nome : p.nome;
        const qtdeFinal = qtde_estoque !== undefined ? qtde_estoque : p.qtde_estoque;
        const custoFinal = preco_custo !== undefined ? preco_custo : p.preco_custo;
        const loteFinal = lote !== undefined ? lote : p.lote;
        const precoFinal = preco !== undefined ? preco : (preco_venda !== undefined ? preco_venda : p.preco_venda);
        const imagemFinal = imagem !== undefined ? imagem : p.imagem;

        let textoAuditoria = descricao;
        let registrarAuditoria = false;

        if (qtdeFinal === p.qtde_estoque) {
            let alteracoes = [];
            if (nomeFinal !== p.nome) alteracoes.push(`${p.nome}->${nomeFinal}`);
            if (Number(precoFinal) !== Number(p.preco_venda)) alteracoes.push(`R$${p.preco_venda}->${precoFinal}`);
            
            if (alteracoes.length > 0) {
                textoAuditoria = `EDIT: ${alteracoes.join(' | ')}`;
                registrarAuditoria = true; 
            }
        } else {
            registrarAuditoria = true;
        }

        const sql = 'UPDATE Produto SET nome = ?, preco_venda = ?, qtde_estoque = ?, preco_custo = ?, lote = ?, imagem = ? WHERE codp = ? AND lote = ?';
        await db.execute(sql, [
            nomeFinal ?? null, 
            precoFinal ?? null, 
            qtdeFinal ?? null, 
            custoFinal ?? null, 
            loteFinal ?? null,
            imagemFinal ?? null,
            id, 
            lote_original ?? ''
        ]);
        
        if (registrarAuditoria) {
            const descSegura = textoAuditoria.substring(0, 40);
            await db.execute(
                `INSERT INTO SaldoEstoque (qtde, data, codp, codu, descricao, lote) VALUES (?, NOW(), ?, ?, ?, ?)`, 
                [qtdeFinal ?? null, id, codu ?? null, descSegura ?? null, loteFinal ?? null]
            ); 
        }

        res.status(200).json({ mensagem: 'Produto atualizado!', id_atualizado: id });
    } catch (erro) { 
        console.error(`Erro no PUT /produtos/${req.params.id}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno.' }); 
    }
});

function validarImagemProduto(imagem) {
    if (imagem === null || imagem === '') return true;
    return typeof imagem === 'string'
        && imagem.length <= 2_500_000
        && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(imagem);
}

app.delete('/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params; 
        const { lote } = req.query;
        const [resultado] = await db.execute('UPDATE Produto SET status = 0 WHERE codp = ? AND lote = ?', [id, lote]);
        
        if (resultado.affectedRows === 0) return res.status(404).json({ mensagem: 'Produto não encontrado.' });
        res.status(200).json({ mensagem: 'Produto movido para a lixeira (inativado)!' });
    } catch (erro) { 
        console.error(`Erro no DELETE /produtos/${req.params.id}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno.' }); 
    }
});

app.put('/produtos/:id/reativar', async (req, res) => {
    try {
        const { id } = req.params;
        const { lote } = req.body;
        const [resultado] = await db.execute('UPDATE Produto SET status = 1 WHERE codp = ? AND lote = ?', [id, lote]);
        
        if (resultado.affectedRows === 0) return res.status(404).json({ mensagem: 'Produto não encontrado.' });
        res.status(200).json({ mensagem: 'Produto reativado com sucesso!' });
    } catch (erro) { 
        console.error(`Erro no PUT reativar /produtos/${req.params.id}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno.' }); 
    }
});

/* ==========================================
   ROTAS DE ATIVOS
   ========================================== */
app.get('/bens', async (req, res) => {
    try {
        const { status } = req.query;
        let sql = 'SELECT * FROM Ativo';
        let params = [];

        if (status !== undefined && status !== 'all') {
            sql += ' WHERE status = ?';
            params.push(Number(status));
        } else {
            sql += ' WHERE status = 1 OR status IS NULL';
        }

        const [linhas] = await db.execute(sql, params); 
        res.status(200).json(linhas);
    } catch (erro) { 
        console.error('Erro no GET /bens:', erro);
        res.status(500).json({ mensagem: 'Erro ao buscar ativos.' }); 
    }
});

app.put('/bens/:id', async (req, res) => {
    const coda = req.params.id;
    const { nome, qtde, valor, descricao, codu = 1 } = req.body;
    try {
        const [ativoAntigo] = await db.execute('SELECT nome, qtde, valor FROM Ativo WHERE coda = ?', [coda]);
        if (ativoAntigo.length === 0) return res.status(404).json({ mensagem: 'Ativo não encontrado.' });

        const p = ativoAntigo[0];
        let textoAuditoria = descricao || 'Atualização';
        let registrarAuditoria = false;

        if (Number(qtde) === Number(p.qtde)) {
            let alteracoes = [];
            if (nome && nome !== p.nome) alteracoes.push(`${p.nome}->${nome}`);
            if (valor !== undefined && Number(valor) !== Number(p.valor)) alteracoes.push(`R$${Number(p.valor).toFixed(2)}->R$${Number(valor).toFixed(2)}`);

            if (alteracoes.length > 0) {
                textoAuditoria = `EDIT: ${alteracoes.join(' | ')}`;
                registrarAuditoria = true; 
            }
        } else {
            registrarAuditoria = true;
        }

        await db.execute('UPDATE Ativo SET nome = ?, qtde = ?, valor = ? WHERE coda = ?', [nome, qtde, valor, coda]);

        if (registrarAuditoria) {
            const descSegura = textoAuditoria.substring(0, 95); 
            await db.execute(
                'INSERT INTO SaldoAtivo (data_hora, qtde, codu, descricao, coda) VALUES (NOW(), ?, ?, ?, ?)', 
                [qtde, codu, descSegura, coda]
            );
        }

        res.status(200).json({ mensagem: 'Ativo atualizado com sucesso!' });
    } catch (erro) { 
        console.error(`Erro no PUT /bens/${req.params.id}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno ao editar ativo.', detalhe: erro.message }); 
    }
});

app.post('/bens', async (req, res) => {
    const { nome, qtde, valor, descricao = 'ENTRADA: Novo ativo', codu = 1 } = req.body;
    const descSegura = descricao.substring(0, 38);

    try {
        const [resultado] = await db.execute(
            'INSERT INTO Ativo (qtde, valor, nome, status) VALUES (?, ?, ?, 1)', 
            [qtde ?? null, valor ?? null, nome ?? null]
        );

        const novoCoda = resultado.insertId; 

        try {
            await db.execute(
                'INSERT INTO SaldoAtivo (data_hora, qtde, codu, descricao, coda) VALUES (NOW(), ?, ?, ?, ?)', 
                [qtde ?? null, codu ?? null, descSegura ?? null, novoCoda]
            );

            res.status(201).json({ 
                mensagem: 'Ativo cadastrado com sucesso!',
                codigoGerado: novoCoda 
            });
        } catch (erroAuditoria) {
            try {
                await db.execute('DELETE FROM Ativo WHERE coda = ?', [novoCoda]);
            } catch (erroRollback) {
                console.error('Falha crítica ao deletar o ativo:', erroRollback);
            }
            res.status(500).json({ mensagem: 'Falha na auditoria', detalhe: erroAuditoria.message });
        }
    } catch (erroAtivo) {
        console.error('Erro no POST /bens:', erroAtivo);
        res.status(500).json({ mensagem: 'Erro ao cadastrar o ativo.', detalhe: erroAtivo.message });
    }
});

app.delete('/bens/:id', async (req, res) => {
    try {
        const { id } = req.params; 
        const [resultado] = await db.execute('UPDATE Ativo SET status = 0 WHERE coda = ?', [id]);
        if (resultado.affectedRows === 0) return res.status(404).json({ mensagem: 'Ativo não encontrado.' });
        res.status(200).json({ mensagem: 'Ativo movido para a lixeira!' });
    } catch (erro) { 
        console.error(`Erro no DELETE /bens/${req.params.id}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno ao inativar.', detalhe: erro.message }); 
    }
});

app.put('/bens/:id/reativar', async (req, res) => {
    try {
        const { id } = req.params;
        const [resultado] = await db.execute('UPDATE Ativo SET status = 1 WHERE coda = ?', [id]);
        if (resultado.affectedRows === 0) return res.status(404).json({ mensagem: 'Ativo não encontrado.' });
        res.status(200).json({ mensagem: 'Ativo restaurado com sucesso!' });
    } catch (erro) { 
        console.error(`Erro no PUT /bens/${req.params.id}/reativar:`, erro);
        res.status(500).json({ mensagem: 'Erro interno ao reativar.' }); 
    }
});

/* ==========================================
   ROTAS DE COMANDAS E ITENS
   ========================================== */
async function atualizarTotalComanda(codc) {
    try {
        const [result] = await db.execute('SELECT SUM(qtde * preco_vendido) as total FROM ItemVenda WHERE codc = ?', [codc]);
        const novoTotal = result[0].total || 0;
        await db.execute('UPDATE Comanda SET valor_total = ? WHERE codc = ?', [novoTotal, codc]);
    } catch (erro) {
        console.error('Erro ao atualizar total da comanda:', erro);
    }
}

app.get('/comandas', async (req, res) => {
    try {
        const sql = `
            SELECT 
                v.codc, v.numero_exibicao, v.data_operacional, v.nick, v.valor_total, v.data_venda, v.status,
                COALESCE(SUM(p.valor), 0) AS valor_pago
            FROM Comanda v
            LEFT JOIN Pagamento p ON v.codc = p.codc
            WHERE v.status = 1
            GROUP BY v.codc, v.numero_exibicao, v.data_operacional, v.nick, v.valor_total, v.data_venda, v.status
            ORDER BY v.data_venda DESC
        `;
        const [linhas] = await db.execute(sql);
        res.status(200).json(linhas);
    } catch (erro) { 
        console.error('Erro no GET /comandas:', erro);
        res.status(500).json({ mensagem: 'Erro interno' }); 
    }
});

app.post('/comandas', async (req, res) => {
    let connection;
    let transactionStarted = false;
    try {
        const { nick } = req.body;
        if (!nick || nick.trim() === '') return res.status(400).json({ mensagem: 'Nome obrigatório.' });
        const nickFormatado = nick.trim();
        const [comandaExistente] = await db.execute("SELECT codc FROM Comanda WHERE nick = ? AND status = 1", [nickFormatado]);
        if (comandaExistente.length > 0) return res.status(400).json({ mensagem: 'Já existe comanda ativa.' });

        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const [periodos] = await connection.execute(`
            SELECT DATE_FORMAT(
                DATE(IF(TIME(NOW()) < '06:00:00', DATE_SUB(CURDATE(), INTERVAL 1 DAY), CURDATE())),
                '%Y-%m-%d'
            ) AS data_operacional
        `);
        const dataOperacional = periodos[0].data_operacional;

        await connection.execute(`
            INSERT INTO ContadorComanda (data_operacional, ultimo_numero)
            VALUES (?, 1)
            ON DUPLICATE KEY UPDATE ultimo_numero = ultimo_numero + 1
        `, [dataOperacional]);
        const [contadores] = await connection.execute(
            'SELECT ultimo_numero FROM ContadorComanda WHERE data_operacional = ?',
            [dataOperacional]
        );
        const numeroExibicao = Number(contadores[0].ultimo_numero);

        const [resultado] = await connection.execute(
            'INSERT INTO Comanda (numero_exibicao, data_operacional, valor_total, nick, status) VALUES (?, ?, 0.00, ?, 1)',
            [numeroExibicao, dataOperacional, nickFormatado]
        );

        await connection.commit();
        transactionStarted = false;
        res.status(201).json({
            mensagem: 'Criada!',
            codc: resultado.insertId,
            numero_exibicao: numeroExibicao,
            data_operacional: dataOperacional
        });
    } catch (erro) { 
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (erroRollback) {
                console.error('Erro ao desfazer a criação da comanda:', erroRollback);
            }
        }
        console.error('Erro no POST /comandas:', erro);
        res.status(500).json({ mensagem: 'Erro interno' }); 
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/comandas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [resultado] = await db.execute('DELETE FROM Comanda WHERE codc = ?', [id]);
        res.status(200).json({ mensagem: 'Comanda excluída!' });
    } catch (erro) { 
        console.error(`Erro no DELETE /comandas/${req.params.id}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno' }); 
    }
});

app.get('/comandas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [venda] = await db.execute('SELECT codc, numero_exibicao, data_operacional, nick, valor_total, data_venda, status FROM Comanda WHERE codc = ?', [id]);
        if (venda.length === 0) return res.status(404).json({ mensagem: 'Não encontrada' });

        const [itens] = await db.execute(`
            SELECT iv.codp, p.nome, SUM(iv.qtde) AS qtde, iv.preco_vendido AS valor_unit, iv.lote
            FROM ItemVenda iv JOIN Produto p ON iv.codp = p.codp AND iv.lote = p.lote
            WHERE iv.codc = ? GROUP BY iv.codp, p.nome, iv.preco_vendido, iv.lote
        `, [id]);

        const [pagamentos] = await db.execute('SELECT SUM(valor) as total_pago FROM Pagamento WHERE codc = ?', [id]);
        res.status(200).json({ ...venda[0], itens, totalPaid: pagamentos[0].total_pago || 0 });
    } catch (erro) { 
        console.error(`Erro no GET /comandas/${req.params.id}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno.' }); 
    }
});

app.post('/comandas/:id/itens', async (req, res) => {
    try {
        const { id } = req.params;
        const { codp, qtde, lote, codu = 2 } = req.body;

        const loteFinal = lote || '1';

        const [lotes] = await db.execute('SELECT lote, COALESCE(preco_venda, 0) as preco_venda, COALESCE(qtde_estoque, 0) as qtde_estoque FROM Produto WHERE codp = ? AND lote = ?', [codp, loteFinal]);
        
        if (lotes.length === 0) return res.status(400).json({ mensagem: 'Produto/Lote não encontrado' });
        const loteAtual = lotes[0];

        if (loteAtual.qtde_estoque < qtde) return res.status(400).json({ mensagem: `Estoque insuficiente. Disp: ${loteAtual.qtde_estoque}` });

        const [itemExistente] = await db.execute('SELECT qtde FROM ItemVenda WHERE codc = ? AND codp = ? AND lote = ?', [id, codp, loteFinal]);
        if (itemExistente.length > 0) {
            await db.execute('UPDATE ItemVenda SET qtde = qtde + ? WHERE codc = ? AND codp = ? AND lote = ?', [qtde, id, codp, loteFinal]);
        } else {
            await db.execute('INSERT INTO ItemVenda (codc, codp, lote, qtde, preco_vendido) VALUES (?, ?, ?, ?, ?)', [id, codp, loteFinal, qtde, loteAtual.preco_venda]);
        }

        const novoEstoque = loteAtual.qtde_estoque - qtde;
        await db.execute('UPDATE Produto SET qtde_estoque = ? WHERE codp = ? AND lote = ?', [novoEstoque, codp, loteFinal]);
        
        await db.execute('INSERT INTO SaldoEstoque (qtde, data, codp, codu, descricao, lote) VALUES (?, NOW(), ?, ?, ?, ?)', 
            [novoEstoque, codp, codu, `SAÍDA: Comanda #${id}`, loteFinal]);

        await atualizarTotalComanda(id);
        res.status(200).json({ mensagem: 'Adicionado com sucesso!' });
    } catch (erro) { 
        console.error(`Erro no POST /comandas/${req.params.id}/itens:`, erro);
        res.status(500).json({ mensagem: 'Erro interno.' }); 
    }
});

app.put('/comandas/:id/itens/:codp', async (req, res) => {
    try {
        const { id, codp } = req.params;
        const { qtde, lote, codu = 2 } = req.body; 

        if (!lote) return res.status(400).json({ mensagem: 'Lote não informado.' });

        const [itensAtuais] = await db.execute('SELECT qtde FROM ItemVenda WHERE codc = ? AND codp = ? AND lote = ?', [id, codp, lote]);
        if (itensAtuais.length === 0) return res.status(404).json({ mensagem: 'Item não encontrado.' });

        const qtdeAnterior = itensAtuais[0].qtde;
        const diferenca = qtde - qtdeAnterior;

        if (diferenca === 0) return res.status(200).json({ mensagem: 'Sem alteração.' });

        const [prod] = await db.execute('SELECT qtde_estoque FROM Produto WHERE codp = ? AND lote = ?', [codp, lote]);
        const estoqueAtual = prod[0].qtde_estoque;

        if (diferenca > 0 && estoqueAtual < diferenca) {
            return res.status(400).json({ mensagem: `Estoque insuficiente. Disp: ${estoqueAtual}` });
        }

        const novoEstoque = estoqueAtual - diferenca;
        await db.execute('UPDATE Produto SET qtde_estoque = ? WHERE codp = ? AND lote = ?', [novoEstoque, codp, lote]);
        
        const tipoAuditoria = diferenca > 0 ? 'SAÍDA' : 'ENTRADA';
        await db.execute('INSERT INTO SaldoEstoque (qtde, data, codp, codu, descricao, lote) VALUES (?, NOW(), ?, ?, ?, ?)', 
            [novoEstoque, codp, codu, `${tipoAuditoria}: Ajuste Comanda #${id}`, lote]);

        if (qtde === 0) {
            await db.execute('DELETE FROM ItemVenda WHERE codc = ? AND codp = ? AND lote = ?', [id, codp, lote]);
        } else {
            await db.execute('UPDATE ItemVenda SET qtde = ? WHERE codc = ? AND codp = ? AND lote = ?', [qtde, id, codp, lote]);
        }

        await atualizarTotalComanda(id);
        res.status(200).json({ mensagem: 'Quantidade atualizada!' });
    } catch (erro) { 
        console.error(`Erro no PUT /comandas/${req.params.id}/itens/${req.params.codp}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno.' }); 
    }
});

app.delete('/comandas/:id/itens/:codp', async (req, res) => {
    try {
        const { id, codp } = req.params;
        const lote = req.query.lote; 
        const codu = req.query.codu || 2; 

        if (!lote) return res.status(400).json({ mensagem: 'Lote não especificado.' });

        const [itensVenda] = await db.execute('SELECT qtde FROM ItemVenda WHERE codc = ? AND codp = ? AND lote = ?', [id, codp, lote]);
        if (itensVenda.length === 0) return res.status(404).json({ mensagem: 'Item não encontrado.' });
        
        const qtdeDevolver = itensVenda[0].qtde;

        const [produto] = await db.execute('SELECT qtde_estoque FROM Produto WHERE codp = ? AND lote = ?', [codp, lote]);
        const novoEstoque = produto[0].qtde_estoque + qtdeDevolver;
        
        await db.execute('UPDATE Produto SET qtde_estoque = ? WHERE codp = ? AND lote = ?', [novoEstoque, codp, lote]);
        
        await db.execute('INSERT INTO SaldoEstoque (qtde, data, codp, codu, descricao, lote) VALUES (?, NOW(), ?, ?, ?, ?)', 
            [novoEstoque, codp, codu, `ENTRADA: Devolução da Comanda #${id}`, lote]);
        
        await db.execute('DELETE FROM ItemVenda WHERE codc = ? AND codp = ? AND lote = ?', [id, codp, lote]);
        
        await atualizarTotalComanda(id);
        res.status(200).json({ mensagem: 'Item removido!' });
    } catch (erro) { 
        console.error(`Erro no DELETE /comandas/${req.params.id}/itens/${req.params.codp}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno.' }); 
    }
});

/* ==========================================
   PAGAMENTOS
   ========================================== */
app.get('/tipos-pagamento', async (req, res) => {
    try {
        const [tipos] = await db.execute(
            'SELECT codtp, descricao, status FROM TipoPagamento WHERE status = 1 ORDER BY descricao'
        );
        res.status(200).json(tipos);
    } catch (erro) {
        console.error('Erro ao buscar tipos de pagamento:', erro);
        res.status(500).json({ mensagem: 'Erro ao buscar formas de pagamento.' });
    }
});

app.post('/tipos-pagamento', async (req, res) => {
    try {
        const descricao = req.body && typeof req.body.descricao === 'string' ? req.body.descricao.trim() : '';
        if (!descricao) return res.status(400).json({ mensagem: 'Informe a descrição da forma de pagamento.' });
        if (descricao.length > 45) return res.status(400).json({ mensagem: 'A descrição deve ter no máximo 45 caracteres.' });

        const [existentes] = await db.execute(
            'SELECT codtp, descricao, status FROM TipoPagamento WHERE LOWER(descricao) = LOWER(?) LIMIT 1',
            [descricao]
        );
        if (existentes.length > 0) {
            if (Number(existentes[0].status) === 1) {
                return res.status(409).json({ mensagem: 'Já existe uma forma de pagamento com essa descrição.' });
            }

            await db.execute('UPDATE TipoPagamento SET status = 1 WHERE codtp = ?', [existentes[0].codtp]);
            return res.status(201).json({
                codtp: existentes[0].codtp,
                descricao: existentes[0].descricao,
                status: 1
            });
        }

        const [resultado] = await db.execute(
            'INSERT INTO TipoPagamento (descricao, status) VALUES (?, 1)',
            [descricao]
        );
        res.status(201).json({ codtp: resultado.insertId, descricao, status: 1 });
    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ mensagem: 'Já existe uma forma de pagamento com essa descrição.' });
        }
        console.error('Erro ao cadastrar tipo de pagamento:', erro);
        res.status(500).json({ mensagem: 'Erro ao cadastrar forma de pagamento.' });
    }
});

app.delete('/tipos-pagamento/:id', async (req, res) => {
    try {
        const codtp = Number(req.params.id);
        if (!Number.isInteger(codtp) || codtp <= 0) {
            return res.status(400).json({ mensagem: 'Código da forma de pagamento inválido.' });
        }

        const [resultado] = await db.execute(
            'UPDATE TipoPagamento SET status = 0 WHERE codtp = ?',
            [codtp]
        );
        if (resultado.affectedRows === 0) {
            const [tipos] = await db.execute('SELECT codtp FROM TipoPagamento WHERE codtp = ?', [codtp]);
            if (tipos.length === 0) {
                return res.status(404).json({ mensagem: 'Forma de pagamento não encontrada.' });
            }
        }

        res.status(200).json({ mensagem: 'Forma de pagamento removida da seleção.' });
    } catch (erro) {
        console.error(`Erro ao remover forma de pagamento ${req.params.id}:`, erro);
        res.status(500).json({ mensagem: 'Erro ao remover forma de pagamento.' });
    }
});

app.post('/comandas/:id/pagamentos', async (req, res) => {
    let connection;
    let transactionStarted = false;
    try {
        const { id } = req.params;
        const pagamentos = req.body && req.body.pagamentos;

        if (!Array.isArray(pagamentos) || pagamentos.length === 0) {
            return res.status(400).json({ mensagem: 'Informe ao menos um pagamento.' });
        }

        const pagamentosValidados = pagamentos.map((pagamento) => {
            if (!pagamento || typeof pagamento !== 'object') return null;
            const valor = Number(pagamento.amount);
            if (!Number.isFinite(valor) || valor <= 0) return null;
            const rawCodtp = pagamento.codtp;
            return {
                codtp: rawCodtp !== undefined && rawCodtp !== null && Number.isInteger(Number(rawCodtp))
                    ? Number(rawCodtp)
                    : null,
                descricao: typeof pagamento.method === 'string' ? pagamento.method.trim() : null,
                valor,
            };
        });
        if (pagamentosValidados.some((pagamento) => !pagamento)) {
            return res.status(400).json({ mensagem: 'Todos os pagamentos devem ter um valor válido.' });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        const tiposSelecionados = [];
        for (const pagamento of pagamentosValidados) {
            let tipo;
            if (pagamento.codtp !== null) {
                const [tipos] = await connection.execute(
                    'SELECT codtp FROM TipoPagamento WHERE codtp = ? AND status = 1',
                    [pagamento.codtp]
                );
                tipo = tipos[0];
            } else if (pagamento.descricao) {
                const [tipos] = await connection.execute(
                    'SELECT codtp FROM TipoPagamento WHERE LOWER(descricao) = LOWER(?) AND status = 1',
                    [pagamento.descricao]
                );
                tipo = tipos[0];
            }
            if (!tipo) {
                await connection.rollback();
                transactionStarted = false;
                return res.status(400).json({ mensagem: 'Uma das formas de pagamento não existe ou está inativa.' });
            }
            tiposSelecionados.push(tipo.codtp);
        }

        for (let index = 0; index < pagamentosValidados.length; index += 1) {
            await connection.execute(
                'INSERT INTO Pagamento (valor, codc, status, codtp) VALUES (?, ?, ?, ?)',
                [pagamentosValidados[index].valor, id, 'Pago', tiposSelecionados[index]]
            );
        }

        await connection.commit();
        transactionStarted = false;
        res.status(200).json({ mensagem: 'Pagamentos registrados com sucesso!' });
    } catch (erro) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (erroRollback) {
                console.error('Erro ao desfazer registro parcial de pagamentos:', erroRollback);
            }
        }
        console.error(`Erro no POST /comandas/${req.params.id}/pagamentos:`, erro);
        res.status(500).json({ mensagem: 'Erro ao registrar pagamentos.' });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/comandas/:id/fechar', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute("UPDATE Comanda SET status = 0 WHERE codc = ?", [id]);
        res.status(200).json({ mensagem: 'Comanda fechada!' });
    } catch (erro) { 
        console.error(`Erro no PUT /comandas/${req.params.id}/fechar:`, erro);
        res.status(500).json({ mensagem: 'Erro' }); 
    }
});

const porta = 3000;
app.listen(porta, '0.0.0.0', () => console.log(`🚀 Servidor rodando na porta ${porta} e aceitando conexões externas!`));