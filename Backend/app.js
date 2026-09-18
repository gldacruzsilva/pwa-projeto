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
                a.coda AS codp, a.nome AS produto_nome,
                u.codu, u.nome AS usuario_nome, u.tipo AS usuario_tipo
            FROM SaldoItem si
            LEFT JOIN Ativo a ON si.coda = a.coda
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
// 1. Substitua a rota GET /produtos atual por esta (Filtra por status)
app.get('/produtos', async (req, res) => {
    try {
        const { status } = req.query;
        let sql = 'SELECT codp, nome, preco_venda, preco_custo, qtde_estoque, lote, status FROM Produto';
        let params = [];
        
        // Se a query vier com ?status=0 (Lixeira), traz os inativos. 
        // Caso contrário, traz os ativos (status = 1) por padrão.
        if (status !== undefined && status !== 'all') {
            sql += ' WHERE status = ?';
            params.push(Number(status));
        } else {
            sql += ' WHERE status = 1';
        }
        
        const [linhas] = await db.execute(sql, params);
        res.json(linhas);
    } catch (erro) {
        console.error('Erro ao buscar produtos:', erro);
        res.status(500).json({ mensagem: 'Erro interno ao buscar produtos.' });
    }
});

// 2. Substitua o DELETE /produtos/:id por este (Soft Delete)
app.delete('/produtos/:id', async (req, res) => {
    try {
        const { id } = req.params; 
        const { lote } = req.query;
        // EXCLUSÃO LÓGICA: Em vez de apagar a linha, mudamos o status para 0
        const [resultado] = await db.execute('UPDATE Produto SET status = 0 WHERE codp = ? AND lote = ?', [id, lote]);
        
        if (resultado.affectedRows === 0) return res.status(404).json({ mensagem: 'Produto não encontrado.' });
        res.status(200).json({ mensagem: 'Produto movido para a lixeira (inativado)!' });
    } catch (erro) { 
        console.error(`Erro no DELETE /produtos/${req.params.id}:`, erro);
        res.status(500).json({ mensagem: 'Erro interno.' }); 
    }
});

// 3. ADICIONE ESTA NOVA ROTA para reativar o produto
app.put('/produtos/:id/reativar', async (req, res) => {
    try {
        const { id } = req.params;
        const { lote } = req.body;
        // REATIVAÇÃO: Volta o status para 1
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

        // Se passar ?status=0 traz a lixeira, senão traz os ativos (status = 1 ou nulo caso BD não esteja atualizado)
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
    // ... MANTER O SEU PUT /bens/:id EXATAMENTE COMO VOCÊ MANDOU, NÃO MUDA NADA AQUI ...
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
                'INSERT INTO SaldoItem (data_hora, qtde, codu, descricao, coda) VALUES (NOW(), ?, ?, ?, ?)', 
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
        // MUDANÇA: Adicionado status = 1 no momento da criação
        const [resultado] = await db.execute(
            'INSERT INTO Ativo (qtde, valor, nome, status) VALUES (?, ?, ?, 1)', 
            [qtde ?? null, valor ?? null, nome ?? null]
        );

        const novoCoda = resultado.insertId; 

        try {
            await db.execute(
                'INSERT INTO SaldoItem (data_hora, qtde, codu, descricao, coda) VALUES (NOW(), ?, ?, ?, ?)', 
                [qtde ?? null, codu ?? null, descSegura ?? null, novoCoda]
            );

            res.status(201).json({ 
                mensagem: 'Ativo cadastrado com sucesso!',
                codigoGerado: novoCoda 
            });
        } catch (erroAuditoria) {
            try {
                // Se a auditoria falhar, exclui direto (rollback real)
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

// MUDANÇA: Soft Delete ao invés de Delete total
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

// NOVA ROTA: Reativar Ativo da Lixeira
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
                v.codc, v.nick, v.valor_total, v.data_venda, v.status,
                COALESCE(SUM(p.valor), 0) AS valor_pago
            FROM Comanda v
            LEFT JOIN Pagamento p ON v.codc = p.codc
            WHERE v.status = 1
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
        const [comandaExistente] = await db.execute("SELECT codc FROM Comanda WHERE nick = ? AND status = 1", [nickFormatado]);
        if (comandaExistente.length > 0) return res.status(400).json({ mensagem: 'Já existe comanda ativa.' });
        const [resultado] = await db.execute("INSERT INTO Comanda (valor_total, nick, status) VALUES (0.00, ?, 1)", [nickFormatado]);
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

// 🟢 INTELIGÊNCIA NOVA: ADD ITEM COM LOTE ESPECÍFICO
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

// 🟢 INTELIGÊNCIA NOVA: ALTERAR QUANTIDADE DE UM LOTE ESPECÍFICO
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

// 🟢 INTELIGÊNCIA NOVA: DELETAR LOTE ESPECÍFICO INTEIRO
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
        await db.execute("UPDATE Comanda SET status = 0 WHERE codc = ?", [id]);
        res.status(200).json({ mensagem: 'Comanda fechada!' });
    } catch (erro) { 
        console.error(`Erro no PUT /comandas/${req.params.id}/fechar:`, erro);
        res.status(500).json({ mensagem: 'Erro' }); 
    }
});

const porta = 3000;
app.listen(porta, '0.0.0.0', () => console.log(`🚀 Servidor rodando na porta ${porta} e aceitando conexões externas!`));