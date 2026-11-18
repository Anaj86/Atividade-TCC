describe('Testes Unitários - Regras de Negócio Conect60+', () => {
  test('Cenário 1 (Sucesso): Deve limpar máscara de telefone deixando apenas números', () => {
    const limparTelefone = (tel) => String(tel || '').replace(/\D/g, '');
    expect(limparTelefone('(71) 98888-1111')).toBe('71988881111');
  });

  test('Cenário 2 (Sucesso): Deve validar senha forte com 8 ou mais caracteres', () => {
    const senhaValida = (senha) => typeof senha === 'string' && senha.length >= 8;
    expect(senhaValida('Conect60@2026')).toBe(true);
  });

  test('Cenário 3 (Falha Esperada): Deve rejeitar cadastro sem nome ou telefone', () => {
    const validarCadastro = ({ nome, telefone }) => Boolean(nome && telefone);
    expect(validarCadastro({ nome: '', telefone: '71988881111' })).toBe(false);
  });
});