function validarModulo(block: string, esperado: number, isMod11: boolean): boolean {
  if (isMod11) {
    let sum = 0, mult = 2;
    for (let i = block.length - 1; i >= 0; i--) {
      sum += parseInt(block[i]) * mult;
      mult = mult > 8 ? 2 : mult + 1;
    }
    const rem = sum % 11;
    let dac = 11 - rem;
    if (dac === 10 || dac === 11) dac = 0;
    return dac === esperado;
  } else {
    let sum = 0, mult = 2;
    for (let i = block.length - 1; i >= 0; i--) {
      let val = parseInt(block[i]) * mult;
      if (val > 9) val = Math.floor(val / 10) + (val % 10);
      sum += val;
      mult = mult === 2 ? 1 : 2;
    }
    const rem = sum % 10;
    let dac = 10 - rem;
    if (dac === 10) dac = 0;
    return dac === esperado;
  }
}

export function validarBoleto(codigo: string): boolean {
  if (!codigo || codigo.length !== 48) return false;
  if (codigo[0] !== '8') return true;
  const isMod11 = (codigo[2] === '8' || codigo[2] === '9');
  for (let i = 0; i < 4; i++) {
    const block = codigo.substring(i * 12, i * 12 + 11);
    const digito = parseInt(codigo[i * 12 + 11]);
    if (!validarModulo(block, digito, isMod11)) return false;
  }
  return true;
}

export function formatarBoleto(d: string): string {
  return `${d.substring(0,11)}-${d.substring(11,12)} ${d.substring(12,23)}-${d.substring(23,24)} ${d.substring(24,35)}-${d.substring(35,36)} ${d.substring(36,47)}-${d.substring(47,48)}`;
}
