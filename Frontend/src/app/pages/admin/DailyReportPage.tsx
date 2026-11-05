import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Download, HelpOutline } from '@mui/icons-material';
import { apiUrl } from '../../../services/api';

interface DailyReport {
  data: string;
  comandas: {
    codc: number;
    numero_exibicao: number;
    data_operacional: string;
    nick: string;
    valor_total: number | string;
    data_venda: string;
    status: number;
  }[];
  itens: {
    codc: number;
    codp: string;
    produto_nome: string | null;
    lote: string;
    qtde: number;
    preco_vendido: number | string;
  }[];
  pagamentos: {
    codpag: number;
    data: string | null;
    tipo_pagamento: string;
    valor: number | string;
    codc: number;
    numero_exibicao: number;
    data_operacional: string;
    nick: string | null;
  }[];
  estoque: {
    codse: number;
    qtde: number;
    data: string;
    codp: string;
    lote: string;
    descricao: string;
    produto_nome: string | null;
    usuario_nome: string | null;
    estoque_anterior: number | string | null;
  }[];
}

type ReportStockMovement = DailyReport['estoque'][number] & {
  variacao: number | null;
};

const localDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const normalized = value.replace('T', ' ');
  const [date, time = ''] = normalized.split(' ');
  return `${formatDate(date)}${time ? ` ${time.slice(0, 5)}` : ''}`;
};

const formatCurrency = (value: number | string) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const aggregateStockMovements = (
  movements: DailyReport['estoque'],
): ReportStockMovement[] => {
  const grouped = new Map<string, ReportStockMovement>();

  movements.forEach((movement) => {
    const previous = movement.estoque_anterior === null
      ? null
      : Number(movement.estoque_anterior);
    const variation = previous === null ? null : movement.qtde - previous;
    const orderMovement = movement.descricao.match(
      /^(SAÍDA|ENTRADA):\s*(?:Ajuste\s+)?Comanda\s+#(\d+)$/i,
    );

    if (!orderMovement) {
      grouped.set(`registro:${movement.codse}`, { ...movement, variacao: variation });
      return;
    }

    const key = `${orderMovement[1].toLocaleUpperCase('pt-BR')}:${orderMovement[2]}:${movement.codp}:${movement.lote}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...movement, variacao: variation });
      return;
    }

    existing.variacao = existing.variacao === null || variation === null
      ? null
      : existing.variacao + variation;
    if (movement.codse > existing.codse) {
      existing.codse = movement.codse;
      existing.data = movement.data;
      existing.qtde = movement.qtde;
      existing.usuario_nome = movement.usuario_nome;
    }
  });

  return Array.from(grouped.values());
};

const reportDateTime = () =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());

export default function DailyReportPage() {
  const today = localDateValue(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadReport = async () => {
      setLoading(true);
      setError('');
      setReport(null);

      try {
        const response = await fetch(apiUrl(`/api/relatorios/movimentacao-diaria?data=${encodeURIComponent(selectedDate)}`));
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error(
            'A API do relatório não está disponível ou o backend está desatualizado. Reinicie o servidor em Backend/app.js e tente novamente.',
          );
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.mensagem || 'Não foi possível carregar o relatório.');
        if (active) setReport(result);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar as movimentações.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadReport();
    return () => { active = false; };
  }, [selectedDate]);

  const orderTotals = report
    ? report.comandas.reduce(
        (totals, order) => {
          const items = report.itens.filter((item) => item.codc === order.codc);
          items.forEach((item) => {
            totals.quantity += Number(item.qtde || 0);
            totals.subtotal += Number(item.qtde || 0) * Number(item.preco_vendido || 0);
          });
          if (!items.length) totals.subtotal += Number(order.valor_total || 0);
          return totals;
        },
        { quantity: 0, subtotal: 0 },
      )
    : { quantity: 0, subtotal: 0 };

  const generatePdf = async () => {
    if (!report) return;

    setGenerating(true);
    setError('');

    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const response = await fetch('/pwa-192x192.png');
      if (!response.ok) throw new Error('Não foi possível carregar o logo do sistema.');
      const logoBlob = await response.blob();
      const logoData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Não foi possível preparar o logo para o PDF.'));
        };
        reader.onerror = () => reject(new Error('Não foi possível ler o logo do sistema.'));
        reader.readAsDataURL(logoBlob);
      });

      doc.setProperties({
        title: `Relatório diário de movimentação - ${report.data}`,
        subject: 'Movimentação de comandas, pagamentos e estoque',
        creator: 'Sistema de Gerenciamento',
      });
      doc.addImage(logoData, 'PNG', 14, 9, 24, 24);
      doc.setTextColor(25, 25, 25);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.text('Relatório diário de movimentação', 42, 17);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(70, 70, 70);
      doc.text(`Data do filtro: ${formatDate(report.data)}`, 42, 23);
      doc.text(`Emitido em: ${reportDateTime()}`, 42, 28);
      doc.setDrawColor(180, 180, 180);
      doc.line(14, 34, 283, 34);

      const totalComandas = report.comandas.reduce((sum, order) => sum + Number(order.valor_total || 0), 0);
      const totalPagamentos = report.pagamentos.reduce((sum, payment) => sum + Number(payment.valor || 0), 0);
      const summaries = [
        ['Comandas', String(report.comandas.length)],
        ['Total das comandas', formatCurrency(totalComandas)],
        ['Pagamentos recebidos no dia', formatCurrency(totalPagamentos)],
        ['Movimentações de estoque', String(stockMovements.length)],
      ];
      const summaryWidth = 269 / summaries.length;
      summaries.forEach(([label, value], index) => {
        const x = 14 + index * summaryWidth;
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(x, 39, summaryWidth - 3, 17, 2, 2, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(75, 75, 75);
        doc.text(label, x + 3, 45);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(25, 25, 25);
        doc.text(value, x + 3, 52);
      });

      const addTableSection = (
        title: string,
        headers: string[],
        rows: (string | number)[][],
        columnStyles?: Record<number, { cellWidth: number }>,
        footerRows?: (string | number)[][],
      ) => {
        const lastAutoTable = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable;
        let startY = lastAutoTable ? lastAutoTable.finalY + 12 : 65;
        if (startY > 180) {
          doc.addPage();
          startY = 18;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(25, 25, 25);
        doc.text(title, 14, startY);
        autoTable(doc, {
          startY: startY + 3,
          head: [headers],
          body: rows.length ? rows : [[`Nenhum registro neste dia.`, ...headers.slice(1).map(() => '')]],
          foot: footerRows,
          styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, overflow: 'linebreak', textColor: [35, 35, 35], lineColor: [200, 200, 200], lineWidth: 0.1 },
          headStyles: { fillColor: [225, 225, 225], textColor: [25, 25, 25], fontStyle: 'bold' },
          footStyles: { fillColor: [235, 235, 235], textColor: [20, 20, 20], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 248, 248] },
          columnStyles,
          margin: { top: 22, bottom: 18, left: 14, right: 14 },
          didDrawPage: ({ pageNumber }) => {
            if (pageNumber > 1) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(90, 90, 90);
              doc.text(`Relatório diário de movimentação - ${formatDate(report.data)}`, 14, 12);
              doc.setDrawColor(190, 190, 190);
              doc.line(14, 15, 283, 15);
            }
          },
        });
      };

      const orderRows = report.comandas.flatMap((order) => {
        const items = report.itens.filter((item) => item.codc === order.codc);
        const status = Number(order.status) === 0 ? 'Encerrada' : 'Em aberto';
        if (!items.length) {
          return [[
            `#${order.numero_exibicao}`, order.nick, formatDateTime(order.data_venda), 'Sem itens',
            '-', '-', formatCurrency(order.valor_total), status,
          ]];
        }
        return items.map((item) => [
          `#${order.numero_exibicao}`,
          order.nick,
          formatDateTime(order.data_venda),
          `${item.produto_nome || 'Produto não identificado'} (lote ${item.lote})`,
          String(item.qtde),
          formatCurrency(item.preco_vendido),
          formatCurrency(Number(item.qtde) * Number(item.preco_vendido)),
          status,
        ]);
      });
      addTableSection(
        'Comandas e itens registrados no dia',
        ['Comanda', 'Cliente', 'Abertura', 'Produto / lote', 'Qtde.', 'Unitário', 'Subtotal', 'Situação'],
        orderRows,
        undefined,
        [['TOTAL GERAL', '', '', '', String(orderTotals.quantity), '', formatCurrency(orderTotals.subtotal), '']],
      );
      addTableSection(
        'Pagamentos recebidos no dia',
        ['Horário', 'Comanda', 'Cliente', 'Forma de pagamento', 'Valor'],
        report.pagamentos.map((payment) => [
          formatDateTime(payment.data),
          `#${payment.numero_exibicao}`,
          payment.nick || 'Comanda não identificada',
          payment.tipo_pagamento,
          formatCurrency(payment.valor),
        ]),
      );
      addTableSection(
        'Atualizações de estoque',
        ['Horário', 'Produto', 'Código / lote', 'Movimento', 'Variação', 'Saldo após', 'Responsável'],
        stockMovements.map((movement) => [
          formatDateTime(movement.data),
          movement.produto_nome || 'Produto não identificado',
          `${movement.codp} / ${movement.lote}`,
          movement.descricao,
          movement.variacao === null ? 'N/D' : `${movement.variacao > 0 ? '+' : ''}${movement.variacao}`,
          String(movement.qtde),
          movement.usuario_nome || 'Usuário não identificado',
        ]),
      );

      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(90, 90, 90);
        doc.text('Documento gerado pelo Sistema de Gerenciamento', 14, 202);
        doc.text(`Página ${page} de ${pageCount}`, 283, 202, { align: 'right' });
      }

      doc.save(`relatorio-movimentacao-${report.data}.pdf`);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Não foi possível gerar o PDF.');
    } finally {
      setGenerating(false);
    }
  };

  const totalPaid = report?.pagamentos.reduce((sum, payment) => sum + Number(payment.valor || 0), 0) || 0;
  const totalOrders = report?.comandas.reduce((sum, order) => sum + Number(order.valor_total || 0), 0) || 0;
  const stockMovements = report ? aggregateStockMovements(report.estoque) : [];

 return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* 🟢 AGRUPAMOS O CAMPO DE DATA E O ÍCONE AQUI */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              label="Data do relatório"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              inputProps={{ max: today }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 220 }}
            />
            <Tooltip 
              title="Consulte a movimentação diária e gere um documento PDF para conferência e arquivo." 
              arrow 
              placement="top"
            >
              <IconButton size="small" color="default">
                <HelpOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* O BOTÃO FICA SOZINHO AGORA */}
          <Button
            variant="contained"
            startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <Download />}
            onClick={generatePdf}
            disabled={!report || loading || generating}
          >
            {generating ? 'Gerando PDF...' : 'Gerar PDF'}
          </Button>
          
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress aria-label="Carregando movimentações" />
        </Box>
      )}
      {report && !loading && (
        // ... (O restante da renderização das tabelas continua igual)
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>Movimentação de {formatDate(report.data)}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
            {[
              ['Comandas', String(report.comandas.length)],
              ['Total das comandas', formatCurrency(totalOrders)],
              ['Pagamentos do dia', formatCurrency(totalPaid)],
              ['Movimentos de estoque', String(stockMovements.length)],
            ].map(([label, value]) => (
              <Card key={label} variant="outlined">
                <CardContent>
                  <Typography color="text.secondary" variant="body2">{label}</Typography>
                  <Typography variant="h6" sx={{ mt: 1, fontWeight: 700 }}>{value}</Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Comandas e itens</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Comanda</TableCell><TableCell>Cliente</TableCell><TableCell>Horário</TableCell>
                  <TableCell>Produto / lote</TableCell><TableCell align="right">Quantidade</TableCell>
                  <TableCell align="right">Subtotal</TableCell><TableCell>Situação</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {report.comandas.flatMap((order) => {
                    const items = report.itens.filter((item) => item.codc === order.codc);
                    return (items.length ? items : [null]).map((item, index) => (
                      <TableRow key={`${order.codc}-${item?.codp || 'empty'}-${item?.lote || index}`}>
                        <TableCell>#{order.numero_exibicao}</TableCell>
                        <TableCell>{order.nick}</TableCell>
                        <TableCell>{formatDateTime(order.data_venda)}</TableCell>
                        <TableCell>{item ? `${item.produto_nome || 'Produto não identificado'} / lote ${item.lote}` : 'Sem itens'}</TableCell>
                        <TableCell align="right">{item?.qtde ?? '-'}</TableCell>
                        <TableCell align="right">{item ? formatCurrency(Number(item.qtde) * Number(item.preco_vendido)) : formatCurrency(order.valor_total)}</TableCell>
                        <TableCell>{Number(order.status) === 0 ? 'Encerrada' : 'Em aberto'}</TableCell>
                      </TableRow>
                    ));
                  })}
                  {!report.comandas.length && <TableRow><TableCell colSpan={7} align="center">Nenhuma comanda registrada.</TableCell></TableRow>}
                  <TableRow sx={{ '& td': { fontWeight: 700, bgcolor: 'action.hover' } }}>
                    <TableCell colSpan={4}>Total geral</TableCell>
                    <TableCell align="right">{orderTotals.quantity}</TableCell>
                    <TableCell align="right">{formatCurrency(orderTotals.subtotal)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Pagamentos recebidos</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Horário</TableCell><TableCell>Comanda</TableCell><TableCell>Cliente</TableCell>
                  <TableCell>Forma de pagamento</TableCell><TableCell align="right">Valor</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {report.pagamentos.map((payment) => (
                    <TableRow key={payment.codpag}>
                      <TableCell>{formatDateTime(payment.data)}</TableCell><TableCell>#{payment.numero_exibicao}</TableCell>
                      <TableCell>{payment.nick || 'Comanda não identificada'}</TableCell>
                      <TableCell>{payment.tipo_pagamento}</TableCell><TableCell align="right">{formatCurrency(payment.valor)}</TableCell>
                    </TableRow>
                  ))}
                  {!report.pagamentos.length && <TableRow><TableCell colSpan={5} align="center">Nenhum pagamento registrado.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Atualizações de estoque</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Horário</TableCell><TableCell>Produto</TableCell><TableCell>Código / lote</TableCell>
                  <TableCell>Movimento</TableCell><TableCell align="right">Variação</TableCell>
                  <TableCell align="right">Saldo após</TableCell><TableCell>Responsável</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {stockMovements.map((movement) => (
                    <TableRow key={movement.codse}>
                      <TableCell>{formatDateTime(movement.data)}</TableCell>
                      <TableCell>{movement.produto_nome || 'Produto não identificado'}</TableCell>
                      <TableCell>{movement.codp} / {movement.lote}</TableCell>
                      <TableCell>{movement.descricao}</TableCell>
                      <TableCell align="right">
                        {movement.variacao === null ? 'N/D' : `${movement.variacao > 0 ? '+' : ''}${movement.variacao}`}
                      </TableCell>
                      <TableCell align="right">{movement.qtde}</TableCell>
                      <TableCell>{movement.usuario_nome || 'Usuário não identificado'}</TableCell>
                    </TableRow>
                  ))}
                  {!stockMovements.length && <TableRow><TableCell colSpan={7} align="center">Nenhuma atualização de estoque registrada.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}

    </Box>
  );
}
