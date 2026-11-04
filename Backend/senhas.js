import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };
const SALT_LENGTH = 16;

export async function hashSenha(senha) {
    const salt = randomBytes(SALT_LENGTH);
    const hash = await scrypt(senha, salt, KEY_LENGTH, SCRYPT_OPTIONS);

    return `scrypt$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verificarSenha(senha, senhaArmazenada) {
    if (senhaArmazenada.startsWith('scrypt$')) {
        const [algoritmo, custoN, custoR, custoP, saltHex, hashHex, ...extras] = senhaArmazenada.split('$');
        if (
            algoritmo !== 'scrypt'
            || custoN !== String(SCRYPT_OPTIONS.N)
            || custoR !== String(SCRYPT_OPTIONS.r)
            || custoP !== String(SCRYPT_OPTIONS.p)
            || !/^[\da-f]{32}$/i.test(saltHex)
            || !/^[\da-f]{128}$/i.test(hashHex)
            || extras.length > 0
        ) {
            return false;
        }

        const hashEsperado = Buffer.from(hashHex, 'hex');
        const hashRecebido = await scrypt(senha, Buffer.from(saltHex, 'hex'), KEY_LENGTH, SCRYPT_OPTIONS);
        return timingSafeEqual(hashRecebido, hashEsperado);
    }

    const senhaRecebida = Buffer.from(senha);
    const senhaLegada = Buffer.from(senhaArmazenada);
    return senhaRecebida.length === senhaLegada.length && timingSafeEqual(senhaRecebida, senhaLegada);
}

export function senhaEstaHasheada(senhaArmazenada) {
    return senhaArmazenada.startsWith('scrypt$');
}
