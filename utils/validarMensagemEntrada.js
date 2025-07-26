function validarMensagemEntrada(numero, mensagem) {
  const maxCaracteres = 500;

  // Verifica se os campos estão preenchidos
  if (!numero || !mensagem) {
    return 'Informe os parâmetros obrigatórios: numero= e mensagem=';
  }

  // Verifica se mensagem é uma string
  if (typeof mensagem !== 'string') {
    return 'A mensagem deve ser um texto (string).';
  }

  // Verifica se mensagem está vazia ou só com espaços
  if (mensagem.trim().length === 0) {
    return 'A mensagem não pode estar vazia.';
  }

  // Limita o número de caracteres
  if (mensagem.length > maxCaracteres) {
    return `A mensagem é muito longa. Máximo permitido: ${maxCaracteres} caracteres.`;
  }

  // Verifica se o número contém apenas dígitos e tem entre 8 e 15 caracteres
  const numeroValido = /^\d{8,15}$/.test(numero);
  if (!numeroValido) {
    return 'Número inválido. Deve conter apenas dígitos e ter entre 8 e 15 caracteres.';
  }

  // Se passou por todas as validações
  return null;
}

module.exports = validarMensagemEntrada;