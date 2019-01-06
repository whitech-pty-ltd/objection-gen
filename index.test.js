const { Model } = require('objection')
const Knex = require('knex')
const jsf = require('json-schema-faker')
const { create } = require('./index')

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
        relation: Model.BelongsToOneRelation,
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
  it.only('works for models without any relation', async () => {
    const { id } = await create(Account)
    const accounts = await Account.query().where({id})
    expect(accounts.length).toEqual(1)
    console.log(accounts)

    const roles = await Role.query().where({})
    expect(roles.length).toEqual(1)
    console.log(roles)

    const rows = await Model.knex().select('*').from('account_role')
    console.log(rows)
  })

  it('works for models with oneToOne relation', async () => {
    const { id } = await create(Profile)
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

  it('works for models with many to many relation', async () => {
    const { id } = await create(Account)
    const accounts = await Account.query().where({id})
    expect(accounts.length).toEqual(1)

    const roles = await Role.query().where({id: blogs[0].account_id})
    expect(accounts.length).toEqual(1)
  })
})
