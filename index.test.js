const { Model } = require('objection')
const Knex = require('knex')
const jsf = require('json-schema-faker')
const { generator } = require('./index')

const { create, clean, prepare } = generator()

// Initialize knex.
const knex = Knex({
  client: 'postgres',
  connection: {
    host: 'psql',
    user: 'postgres',
    database: 'postgres'
  }
})

Model.knex(knex)

class Account extends Model {
  static get tableName() {
    return 'account'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      properties: {
        id: {type: 'integer', minimum: 1},
        username: {type: 'string'},
        email: {type: 'string'},
        password: {type: 'string'},
        full_name: {type: 'string'}
      },
      required: ['id', 'username', 'email', 'password', 'full_name']
    }
  }

  static get relationMappings() {
    return {
      roles: {
        relation: Model.ManyToManyRelation,
        modelClass: Role,
        join: {
          from: 'account.id',
          through: {
            from: 'account_role.account_id',
            to: 'account_role.role_id'
          },
          to: 'role.id'
        }
      }
    }
  }
}

class Profile extends Model {
  static get tableName() {
    return 'profile'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      properties: {
        id: {type: 'integer', minimum: 1},
        address: {type: 'string'}
      },
      required: ['id', 'address']
    }
  }

  static get relationMappings() {
    return {
      account: {
        relation: Model.HasOneRelation,
        modelClass: Account,
        join: {
          from: 'profile.account_id',
          to: 'account.id'
        }
      }
    }
  }
}

class Blog extends Model {
  static get tableName() {
    return 'blog'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      properties: {
        id: {type: 'integer', minimum: 1},
        title: {type: 'string'},
        body: {type: 'string'},
        account_id: {type: 'integer', minimum: 1}
      },
      required: ['id', 'title', 'body', 'account_id']
    }
  }

  static get relationMappings() {
    return {
      account: {
        relation: Model.HasManyRelation,
        modelClass: Account,
        join: {
          from: 'blog.account_id',
          to: 'account.id'
        }
      }
    }
  }
}

class Role extends Model {
  static get tableName() {
    return 'role'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      properties: {
        id: {type: 'integer', minimum: 1},
        name: {type: 'string'}
      },
      required: ['id', 'name']
    }
  }
}

describe('create', async () => {
  beforeEach(async () => {
    await clean()
  })

  it('works for models without any relation', async () => {
    const { id } = await create(Role)
    const roles = await Role.query().where({id})
    expect(roles.length).toEqual(1)
  })

  it('works for models with oneToOne relation', async () => {
    const { id } = await create(Profile)
    const profiles = await Profile.query().where({id})
    expect(profiles.length).toEqual(1)

    const accounts = await Account.query().where({id: profiles[0].account_id})
    expect(accounts.length).toEqual(1)
  })

  it('wont create related model if it is being supplied by a user(HasOneRelation)', async () => {
    const acc = await create(Account)
    const { id } = await create(Profile, { account: acc })
    const profiles = await Profile.query().where({id})
    expect(profiles.length).toEqual(1)

    const accounts = await Account.query().where({id: profiles[0].account_id})
    expect(accounts.length).toEqual(1)
  })

  it('works for models with foreign key', async () => {
    const { id } = await create(Blog)
    const blogs = await Blog.query().where({id})
    expect(blogs.length).toEqual(1)

    const accounts = await Account.query().where({id: blogs[0].account_id})
    expect(accounts.length).toEqual(1)
  })

  it('wont create related model if it is being supplied by a user(HasManyRelation)', async () => {
    const acc = await create(Account)
    const { id } = await create(Blog, { account: acc })
    const blogs = await Blog.query().where({id})
    expect(blogs.length).toEqual(1)

    const accounts = await Account.query().where({id: blogs[0].account_id})
    expect(accounts.length).toEqual(1)
  })

  it('works for models with many to many relation', async () => {
    const { id } = await create(Account)
    const accounts = await Account.query().where({id})
    expect(accounts.length).toEqual(1)

    const roles = await Role.query().where({})
    expect(roles.length).toEqual(1)

    const relations = await Model.knex().select('*').from('account_role')
    expect(relations.length).toEqual(1)
  })

  it('wont create related models if it is being supplied by a user(ManyToManyRelation)', async () => {
    const roles = [ await create(Role) ]
    const { id } = await create(Account, {roles})
    const accounts = await Account.query().where({id})
    expect(accounts.length).toEqual(1)

    const relations = await Model.knex().select('*').from('account_role')
    expect(relations.length).toEqual(1)

    const r = await Role.query().where({})
    expect(r.length).toEqual(1)
  })

  it("respects 'followRelations' option", async () => {
    try {
      await create(Profile, {}, {followRelations: false})
      expect.fail('It should not have created the related models.')
    }
    catch(e) {
      expect(e.message.includes('violates foreign key constraint')).toEqual(true)
    }
  })
})
