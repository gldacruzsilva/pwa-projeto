import express from 'express';
import db from './banco.js'; 
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

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
        const [linhas] = await db.execute("SELECT codc, nick, valor_total, data_venda, status FROM Comanda ORDER BY data_venda DESC");
        res.status(200).json(linhas);
    } catch (erro) { 
        console.error('Erro ao buscar relatório de vendas:', erro);
        res.status(500).json({ mensagem: 'Erro interno' }); 
    }
});

app.get('/relatorios/produtos/:nome/pagamentos', async (req, res) => {
    try {
        const { nome } = req.params;
        const { inicio, fim } = req.query;
        const sql = `
            SELECT
                pg.tipo_pagamento AS name,
                SUM(iv.qtde * iv.preco_vendido * (pg.valor / v.valor_total)) AS value,
                SUM(iv.qtde * (pg.valor / v.valor_total)) AS units
            FROM ItemVenda iv
            JOIN Comanda v ON iv.codc = v.codc
            JOIN Pagamento pg ON v.codc = pg.codc
            JOIN Produto p ON p.codp = iv.codp AND p.lote = iv.lote
            WHERE p.nome = ? AND v.data_venda >= ? AND v.data_venda <= ? AND v.valor_total > 0
            GROUP BY pg.tipo_pagamento
        `;
        const [results] = await db.execute(sql, [nome, `${inicio} 00:00:00`, `${fim} 23:59:59`]);
        res.status(200).json(results);
    } catch (erro) { 
        console.error('Erro ao buscar pagamentos do produto:', erro);
        res.status(500).json({ erro: 'Erro interno' }); 
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
                si.codsi AS codse, si.qtde, si.data_hora AS data, si.descricao,
                i.a AS codp, i.nome AS produto_nome,
                u.codu, u.nome AS usuario_nome, u.tipo AS usuario_tipo
            FROM SaldoItem si
            LEFT JOIN Ativo i ON si.coda = i.coda
            LEFT JOIN Usuario u ON si.codu = u.codu
            ORDER BY si.data_hora DESC, si.codsi DESC
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
            await db.execute('DELETE FROM SaldoItem WHERE codsi = ?', [id]);
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
        await db.execute('DELETE FROM SaldoItem'); 
        res.status(200).json({ mensagem: 'Histórico limpo com sucesso.' });
    } catch (erro) { 
        console.error('Erro ao limpar todo o histórico:', erro);
        res.status(500).json({ mensagem: 'Erro ao limpar' }); 
    }
});

/* ==========================================
   ROTAS DE ESTOQUE E PRODUTOS
   ========================================== */
app.post('/produtos', async (req, res) => {
    try {
        let { codp, nome = '', preco_venda = 0, qtde_estoque = 0, preco_custo = 0, lote = '1', descricao = 'ENTRADA: Cadastro Inicial', codu = 1 } = req.body; 
        
        if (!nome || nome.trim() === '') return res.status(400).json({ mensagem: 'Nome do produto é obrigatório.' });
        
        if (!codp) {
            const [rows] = await db.execute('SELECT MAX(codp) as maxCod FROM Produto');
            codp = (rows[0].maxCod || 0) + 1;
        }

        const sql = 'INSERT INTO Produto (codp, nome, preco_venda, qtde_estoque, preco_custo, lote) VALUES (?, ?, ?, ?, ?, ?)';
        await db.execute(sql, [codp, nome.trim(), Number(preco_venda ?? 0), Number(qtde_estoque ?? 0), Number(preco_custo ?? 0), lote]);
        
        const descSegura = (descricao || 'ENTRADA: Cadastro Inicial').substring(0, 40);
        await db.execute('INSERT INTO SaldoEstoque (qtde, data, codp, codu, descricao, lote) VALUES (?, NOW(), ?, ?, ?, ?)', 
            [Number(qtde_estoque ?? 0), codp, Number(codu ?? 1), descSegura, lote]);

        res.status(201).json({ mensagem: 'Produto cadastrado com sucesso!', codp: codp });
    } catch (erro) {
        console.error('Erro no POST /produtos:', erro);
        if (erro.code === 'ER_DUP_ENTRY') return res.status(400).json({ mensagem: 'Este lote já existe para este produto!' });
        res.status(500).json({ mensagem: 'Erro interno.', detalhe: erro.message });
    }
});

app.put('/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params; 
        const { nome, preco_venda, qtde_estoque, preco_custo, lote, lote_original, descricao = 'Movimentação', codu = 1 } = req.body; 

        const [produtoAtual] = await db.execute('SELECT nome, preco_venda, qtde_estoque, preco_custo, lote FROM Produto WHERE codp = ? AND lote = ?', [id, lote_original]);
        if (produtoAtual.length === 0) return res.status(404).json({ mensagem: 'Produto não encontrado.' });
        
        const p = produtoAtual[0];
        const nomeFinal = nome !== undefined ? nome : p.nome;
        const precoFinal = preco_venda !== undefined ? preco_venda : p.preco_venda;
        const qtdeFinal = qtde_estoque !== undefined ? qtde_estoque : p.qtde_estoque;
        const custoFinal = preco_custo !== undefined ? preco_custo : p.preco_custo;
        const loteFinal = lote !== undefined ? lote : p.lote;

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

        const sql = 'UPDATE Produto SET nome = ?, preco_venda = ?, qtde_estoque = ?, preco_custo = ?, lote = ? WHERE codp = ? AND lote = ?';
        await db.execute(sql, [nomeFinal, precoFinal, qtdeFinal, custoFinal, loteFinal, id, lote_original]);
        
        if (registrarAuditoria) {
            const descSegura = textoAuditoria.substring(0, 40);
            await db.execute(`INSERT INTO SaldoEstoque (qtde, data, codp, codu, descricao, lote) VALUES (?, NOW(), ?, ?, ?, ?)`, 
                [qtdeFinal, id, codu, descSegura, loteFinal]); 
        }

        res.status(200).json({ mensagem: 'Produto atualizado!', id_atualizado: id });
    } catch (erro) { 
        console.error(`Erro no PUT /produtos/${req.params.id}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno.' }); 
    }
});

app.get('/produtos', async (req, res) => {
    try {
        const [linhas] = await db.execute('SELECT * FROM Produto'); 
        res.status(200).json(linhas);
    } catch (erro) { 
        console.error('Erro no GET /produtos:', erro);
        res.status(500).json({ mensagem: 'Erro interno' }); 
    }
});

app.delete('/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params; 
        const { lote } = req.query;
        const [resultado] = await db.execute('DELETE FROM Produto WHERE codp = ? AND lote = ?', [id, lote]);
        if (resultado.affectedRows === 0) return res.status(404).json({ mensagem: 'Produto não encontrado.' });
        res.status(200).json({ mensagem: 'Produto deletado!' });
    } catch (erro) { 
        console.error(`Erro no DELETE /produtos/${req.params.id}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno.' }); 
    }
});

/* ==========================================
   ROTAS DE ATIVOS
   ========================================== */
app.get('/bens', async (req, res) => {
    try {
        const [linhas] = await db.execute('SELECT * FROM Ativo'); 
        res.status(200).json(linhas);
    } catch (erro) { 
        console.error('Erro no GET /bens:', erro);
        res.status(500).json({ mensagem: 'Erro ao buscar ativos.' }); 
    }
});

app.put('/bens/:id', async (req, res) => {
    const coda = req.params.id;
    const { nome, qtde, valor, descricao = 'EDIÇÃO: Atualização', codu = 1 } = req.body;
    try {
        const descSegura = descricao.substring(0, 38);
        await db.execute('UPDATE Ativo SET nome = ?, qtde = ?, valor = ? WHERE coda = ?', [nome, qtde, valor, coda]);
        await db.execute('INSERT INTO SaldoItem (data_hora, qtde, codu, descricao, coda) VALUES (NOW(), ?, ?, ?, ?)', [qtde, codu, descSegura, coda]);
        res.status(200).json({ mensagem: 'Movimentação registrada com sucesso!' });
    } catch (erro) { 
        console.error(`Erro no PUT /bens/${req.params.id}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno ao editar ativo.', detalhe: erro.message }); 
    }
});

app.post('/bens', async (req, res) => {
    const { coda, nome, qtde, valor, descricao = 'ENTRADA: Novo ativo', codu = 1 } = req.body;
    const descSegura = descricao.substring(0, 38);

    try {
        await db.execute('INSERT INTO Ativo (coda, qtde, valor, nome) VALUES (?, ?, ?, ?)', [coda, qtde, valor, nome]);
        try {
            await db.execute('INSERT INTO SaldoItem (data_hora, qtde, codu, descricao, coda) VALUES (NOW(), ?, ?, ?, ?)', [qtde, codu, descSegura, coda]);
            res.status(201).json({ mensagem: 'Ativo cadastrado com sucesso!' });
        } catch (erroAuditoria) {
            try {
                await db.execute('DELETE FROM Ativo WHERE coda = ?', [coda]);
            } catch (erroRollback) {
                console.error('Falha crítica ao tentar deletar o ativo órfão:', erroRollback);
            }
            console.error('Falha na auditoria de ativos:', erroAuditoria);
            res.status(500).json({ mensagem: 'Falha na auditoria do banco', detalhe: erroAuditoria.message });
        }
    } catch (erroAtivo) {
        console.error('Erro no POST /bens:', erroAtivo);
        if (erroAtivo.code === 'ER_DUP_ENTRY') return res.status(400).json({ mensagem: `O código '${coda}' já está em uso.` });
        res.status(500).json({ mensagem: 'Erro ao cadastrar o ativo.', detalhe: erroAtivo.message });
    }
});

app.delete('/bens/:id', async (req, res) => {
    try {
        const { id } = req.params; 
        const [resultado] = await db.execute('DELETE FROM Ativo WHERE coda = ?', [id]);
        if (resultado.affectedRows === 0) return res.status(404).json({ mensagem: 'Ativo não encontrado.' });
        res.status(200).json({ mensagem: 'Ativo deletado!' });
    } catch (erro) { 
        console.error(`Erro no DELETE /bens/${req.params.id}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno ao deletar.', detalhe: erro.message }); 
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
                v.codc, v.nick, v.valor_total, v.data_venda, v.status,
                COALESCE(SUM(p.valor), 0) AS valor_pago
            FROM Comanda v
            LEFT JOIN Pagamento p ON v.codc = p.codc
            WHERE v.status = 'aberta'
            GROUP BY v.codc, v.nick, v.valor_total, v.data_venda, v.status
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
    try {
        const { nick } = req.body;
        if (!nick || nick.trim() === '') return res.status(400).json({ mensagem: 'Nome obrigatório.' });
        const nickFormatado = nick.trim();
        const [comandaExistente] = await db.execute("SELECT codc FROM Comanda WHERE nick = ? AND status = 'aberta'", [nickFormatado]);
        if (comandaExistente.length > 0) return res.status(400).json({ mensagem: 'Já existe comanda ativa.' });
        const [resultado] = await db.execute("INSERT INTO Comanda (valor_total, nick, status) VALUES (0.00, ?, 'aberta')", [nickFormatado]);
        res.status(201).json({ mensagem: 'Criada!', codc: resultado.insertId });
    } catch (erro) { 
        console.error('Erro no POST /comandas:', erro);
        res.status(500).json({ mensagem: 'Erro interno' }); 
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
        const [venda] = await db.execute('SELECT codc, nick, valor_total, data_venda, status FROM Comanda WHERE codc = ?', [id]);
        if (venda.length === 0) return res.status(404).json({ mensagem: 'Não encontrada' });

        const [itens] = await db.execute(`
            SELECT iv.codp, p.nome, SUM(iv.qtde) AS qtde, iv.preco_vendido AS valor_unit
            FROM ItemVenda iv JOIN Produto p ON iv.codp = p.codp AND iv.lote = p.lote
            WHERE iv.codc = ? GROUP BY iv.codp, p.nome, iv.preco_vendido
        `, [id]);

        const [pagamentos] = await db.execute('SELECT SUM(valor) as total_pago FROM Pagamento WHERE codc = ?', [id]);
        res.status(200).json({ ...venda[0], itens, totalPaid: pagamentos[0].total_pago || 0 });
    } catch (erro) { 
        console.error(`Erro no GET /comandas/${req.params.id}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno.' }); 
    }
});

// 🟢 INTELIGÊNCIA NOVA: ADD ITEM COM USUÁRIO CORRETO (codu)
app.post('/comandas/:id/itens', async (req, res) => {
    try {
        const { id } = req.params;
        const { codp, qtde, codu = 2 } = req.body; // Pega o usuário ou assume ID 2 (funcionário) por segurança

        const [lotes] = await db.execute('SELECT lote, COALESCE(preco_venda, 0) as preco_venda, COALESCE(qtde_estoque, 0) as qtde_estoque FROM Produto WHERE codp = ? ORDER BY lote ASC', [codp]);
        
        if (lotes.length === 0) return res.status(400).json({ mensagem: 'Produto não encontrado' });
        
        const lotesComEstoque = lotes.filter(l => l.qtde_estoque > 0);
        const estoqueTotal = lotesComEstoque.reduce((acc, l) => acc + l.qtde_estoque, 0);

        if (estoqueTotal < qtde) return res.status(400).json({ mensagem: `Estoque insuficiente. Disp: ${estoqueTotal}` });

        let qtdeRestante = qtde;
        for (let loteAtual of lotesComEstoque) {
            if (qtdeRestante <= 0) break;
            const qtdeAAbater = Math.min(qtdeRestante, loteAtual.qtde_estoque);

            const [itemExistente] = await db.execute('SELECT qtde FROM ItemVenda WHERE codc = ? AND codp = ? AND lote = ?', [id, codp, loteAtual.lote]);
            if (itemExistente.length > 0) {
                await db.execute('UPDATE ItemVenda SET qtde = qtde + ? WHERE codc = ? AND codp = ? AND lote = ?', [qtdeAAbater, id, codp, loteAtual.lote]);
            } else {
                await db.execute('INSERT INTO ItemVenda (codc, codp, lote, qtde, preco_vendido) VALUES (?, ?, ?, ?, ?)', [id, codp, loteAtual.lote, qtdeAAbater, loteAtual.preco_venda || 0]);
            }

            const novoEstoque = loteAtual.qtde_estoque - qtdeAAbater;
            await db.execute('UPDATE Produto SET qtde_estoque = ? WHERE codp = ? AND lote = ?', [novoEstoque, codp, loteAtual.lote]);
            
            // 🟢 Inserindo a auditoria com a variável 'codu'
            await db.execute('INSERT INTO SaldoEstoque (qtde, data, codp, codu, descricao, lote) VALUES (?, NOW(), ?, ?, ?, ?)', 
                [novoEstoque, codp, codu, `SAÍDA: Comanda #${id}`, loteAtual.lote]);

            qtdeRestante -= qtdeAAbater;
        }

        await atualizarTotalComanda(id);
        res.status(200).json({ mensagem: 'Adicionado com sucesso!' });
    } catch (erro) { 
        console.error(`Erro no POST /comandas/${req.params.id}/itens:`, erro);
        res.status(500).json({ mensagem: 'Erro interno.' }); 
    }
});

// 🟢 INTELIGÊNCIA NOVA: ALTERAR QUANTIDADE ITEM COM USUÁRIO CORRETO (codu)
app.put('/comandas/:id/itens/:codp', async (req, res) => {
    try {
        const { id, codp } = req.params;
        const { qtde, codu = 2 } = req.body; // Pega o usuário

        const [itensAtuais] = await db.execute('SELECT lote, qtde FROM ItemVenda WHERE codc = ? AND codp = ?', [id, codp]);
        if (itensAtuais.length === 0) return res.status(404).json({ mensagem: 'Item não encontrado.' });

        for (let iv of itensAtuais) {
            const [prod] = await db.execute('SELECT qtde_estoque FROM Produto WHERE codp = ? AND lote = ?', [codp, iv.lote]);
            const novoEst = prod[0].qtde_estoque + iv.qtde;
            await db.execute('UPDATE Produto SET qtde_estoque = ? WHERE codp = ? AND lote = ?', [novoEst, codp, iv.lote]);
            
            // 🟢 Inserindo a auditoria com a variável 'codu'
            await db.execute('INSERT INTO SaldoEstoque (qtde, data, codp, codu, descricao, lote) VALUES (?, NOW(), ?, ?, ?, ?)', 
                [novoEst, codp, codu, `ENTRADA: Reajuste Comanda #${id}`, iv.lote]);
        }
        await db.execute('DELETE FROM ItemVenda WHERE codc = ? AND codp = ?', [id, codp]);

        if (qtde === 0) {
            await atualizarTotalComanda(id);
            return res.status(200).json({ mensagem: 'Removido!' });
        }

        const [lotes] = await db.execute('SELECT lote, COALESCE(preco_venda, 0) as preco_venda, COALESCE(qtde_estoque, 0) as qtde_estoque FROM Produto WHERE codp = ? ORDER BY lote ASC', [codp]);
        const lotesComEstoque = lotes.filter(l => l.qtde_estoque > 0);
        const estoqueTotal = lotesComEstoque.reduce((acc, l) => acc + l.qtde_estoque, 0);

        if (estoqueTotal < qtde) {
            for (let iv of itensAtuais) {
                const loteDado = lotes.find(l => l.lote === iv.lote);
                const precoVenda = loteDado ? loteDado.preco_venda : 0;
                await db.execute('INSERT INTO ItemVenda (codc, codp, qtde, preco_vendido, lote) VALUES (?, ?, ?, ?, ?)', [id, codp, iv.qtde, precoVenda, iv.lote]);
                const [prod] = await db.execute('SELECT qtde_estoque FROM Produto WHERE codp = ? AND lote = ?', [codp, iv.lote]);
                const voltaEst = prod[0].qtde_estoque - iv.qtde;
                await db.execute('UPDATE Produto SET qtde_estoque = ? WHERE codp = ? AND lote = ?', [voltaEst, codp, iv.lote]);
            }
            return res.status(400).json({ mensagem: `Estoque insuficiente. Disp: ${estoqueTotal}` });
        }

        let qtdeRestante = qtde;
        for (let loteAtual of lotesComEstoque) {
            if (qtdeRestante <= 0) break;
            const qtdeAAbater = Math.min(qtdeRestante, loteAtual.qtde_estoque);
            await db.execute('INSERT INTO ItemVenda (codc, codp, lote, qtde, preco_vendido) VALUES (?, ?, ?, ?, ?)', [id, codp, loteAtual.lote, qtdeAAbater, loteAtual.preco_venda || 0]);
            
            const novoEst = loteAtual.qtde_estoque - qtdeAAbater;
            await db.execute('UPDATE Produto SET qtde_estoque = ? WHERE codp = ? AND lote = ?', [novoEst, codp, loteAtual.lote]);
            
            // 🟢 Inserindo a auditoria com a variável 'codu'
            await db.execute('INSERT INTO SaldoEstoque (qtde, data, codp, codu, descricao, lote) VALUES (?, NOW(), ?, ?, ?, ?)', 
                [novoEst, codp, codu, `SAÍDA: Ajustada Comanda #${id}`, loteAtual.lote]);
            qtdeRestante -= qtdeAAbater;
        }

        await atualizarTotalComanda(id);
        res.status(200).json({ mensagem: 'Quantidade atualizada!' });
    } catch (erro) { 
        console.error(`Erro no PUT /comandas/${req.params.id}/itens/${req.params.codp}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno.' }); 
    }
});

// 🟢 INTELIGÊNCIA NOVA: DELETAR ITEM INTEIRO COM USUÁRIO CORRETO (codu via query string)
app.delete('/comandas/:id/itens/:codp', async (req, res) => {
    try {
        const { id, codp } = req.params;
        const codu = req.query.codu || 2; // Pega da URL (?codu=...)

        const [itensVenda] = await db.execute('SELECT lote, qtde FROM ItemVenda WHERE codc = ? AND codp = ?', [id, codp]);
        if (itensVenda.length === 0) return res.status(404).json({ mensagem: 'Item não encontrado.' });
        
        for (let iv of itensVenda) {
            const [produto] = await db.execute('SELECT qtde_estoque FROM Produto WHERE codp = ? AND lote = ?', [codp, iv.lote]);
            const novoEstoque = produto[0].qtde_estoque + iv.qtde;
            await db.execute('UPDATE Produto SET qtde_estoque = ? WHERE codp = ? AND lote = ?', [novoEstoque, codp, iv.lote]);
            
            // 🟢 Inserindo a auditoria com a variável 'codu'
            await db.execute('INSERT INTO SaldoEstoque (qtde, data, codp, codu, descricao, lote) VALUES (?, NOW(), ?, ?, ?, ?)', 
                [novoEstoque, codp, codu, `ENTRADA: Devolução da Comanda #${id}`, iv.lote]);
        }
        await db.execute('DELETE FROM ItemVenda WHERE codc = ? AND codp = ?', [id, codp]);
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
app.post('/comandas/:id/pagamentos', async (req, res) => {
    try {
        const { id } = req.params;
        const { pagamentos } = req.body;
        for (const p of pagamentos) {
            await db.execute('INSERT INTO Pagamento (valor, tipo_pagamento, codc) VALUES (?, ?, ?)', [p.amount, p.method, id]);
        }
        res.status(200).json({ mensagem: 'Pagamentos registrados com sucesso!' });
    } catch (erro) { 
        console.error(`Erro no POST /comandas/${req.params.id}/pagamentos:`, erro);
        res.status(500).json({ mensagem: 'Erro' }); 
    }
});

app.put('/comandas/:id/fechar', async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute("UPDATE Comanda SET status = 'paga' WHERE codc = ?", [id]);
        res.status(200).json({ mensagem: 'Comanda fechada!' });
    } catch (erro) { 
        console.error(`Erro no PUT /comandas/${req.params.id}/fechar:`, erro);
        res.status(500).json({ mensagem: 'Erro' }); 
    }
});

const porta = 3000;
app.listen(porta, '0.0.0.0', () => console.log(`🚀 Servidor rodando na porta ${porta} e aceitando conexões externas!`));