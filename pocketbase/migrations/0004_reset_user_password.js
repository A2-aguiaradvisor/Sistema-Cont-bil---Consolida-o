/// <reference path="../pb_data/types.d.ts" />
/**
 * Migração idempotente: garante que o usuário contábil existente
 * (vinicius_contabeis89@yahoo.com.br) tenha a senha conhecida "Skip@Pass".
 * A migração 0002 só definia a senha na CRIAÇÃO do registro — se o usuário
 * já existia com outra senha, ela permanecia e o login falhava. Aqui a senha
 * é redefinida em toda execução (up), sem recriar o registro.
 * Se o usuário não existir ainda, é criado com essa senha.
 */
migrate(
  (app) => {
    const adminEmail = 'vinicius_contabeis89@yahoo.com.br'
    const senhaConhecida = 'Skip@Pass'
    let admin = null
    try {
      admin = app.findAuthRecordByEmail('_pb_users_auth_', adminEmail)
    } catch (_) {
      admin = null
    }

    if (!admin) {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      admin = new Record(users)
      admin.setEmail(adminEmail)
      admin.set('name', 'Equipe Contábil ABC')
      admin.setVerified(true)
      admin.setPassword(senhaConhecida)
      app.save(admin)
      return
    }

    // Redefine a senha do registro existente (idempotente: sempre define).
    admin.setPassword(senhaConhecida)
    admin.setVerified(true)
    app.save(admin)
  },
  (app) => {
    // down: nada a reverter — a senha anterior é desconhecida por definição.
  },
)
