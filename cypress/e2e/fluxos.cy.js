describe('Testes E2E - Fluxos Críticos Conect60+', () => {
  const telefoneUnico = `719${Math.floor(10000000 + Math.random() * 90000000)}`;

  it('Fluxo 1: Deve cadastrar um novo usuário e consultar categorias do banco', () => {
    cy.request('POST', 'http://localhost:3000/api/auth/cadastro', {
      nome: 'Idoso Teste Cypress',
      telefone: telefoneUnico,
      senha: 'senha12345'
    }).then((res) => {
      expect(res.status).to.be.oneOf([200, 201]);
    });

    cy.request('GET', 'http://localhost:3000/api/categorias').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.be.an('array');
    });
  });

  it('Fluxo 2: Deve realizar login com usuário criado e validar sessão ativa', () => {
    cy.request('POST', 'http://localhost:3000/api/auth/login', {
      telefone: telefoneUnico,
      senha: 'senha12345'
    }).then((res) => {
      expect(res.status).to.eq(200);
    });

    cy.request('GET', 'http://localhost:3000/api/auth/eu').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.property('usuario');
    });
  });
});