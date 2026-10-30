export function validarCodigoBarras(codigo) {
    if (typeof codigo !== 'string' || !/^\d+$/.test(codigo)) {
        return { valido: false, mensagem: 'O código de barras deve conter apenas números.' };
    }

    if (codigo.length !== 8 && codigo.length !== 13) {
        return {
            valido: false,
            mensagem: 'O código de barras deve ter 8 dígitos (EAN-8) ou 13 dígitos (EAN-13).',
            tamanho: codigo.length
        };
    }
 
    let soma = 0;
    let peso = 3;
    for (let indice = codigo.length - 2; indice >= 0; indice -= 1) {
        soma += Number(codigo[indice]) * peso;
        peso = peso === 3 ? 1 : 3;
    }

    const digitoCalculado = (10 - (soma % 10)) % 10;
    const digitoInformado = Number(codigo.at(-1));
    if (digitoCalculado !== digitoInformado) {
        return {
            valido: false,
            mensagem: `Dígito verificador inválido: recebido ${digitoInformado}, esperado ${digitoCalculado}.`,
            tamanho: codigo.length,
            digitoInformado,
            digitoCalculado
        };
    }

    return { valido: true, tamanho: codigo.length, digitoInformado, digitoCalculado };
}